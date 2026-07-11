import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { 
  initDb, getUserByUsername, getUsers, createUser, updateUser, deleteUser,
  getHymns, getHymnById, createHymn, updateHymn, deleteHymn, duplicateHymn,
  getAnnouncements, getAnnouncementById, createAnnouncement, updateAnnouncement, deleteAnnouncement,
  getCitations, getCitationById, createCitation, updateCitation, deleteCitation,
  getMessages, getMessageById, createMessage, updateMessage, deleteMessage,
  getCurrentDisplay, setCurrentDisplay, getDisplayHistory,
  getSettings, saveSettings, logActivity, getActivityLogs,
  exportBackup, importBackup, getDashboardStats
} from './src/db/db.ts';
import { UserRole } from './src/types.ts';

// Load environment variables
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'church-qr-hymn-display-secret-key-9988';
const PORT = 3000;

// Initialize Server
async function startServer() {
  // Wait for database initialization (Postgres / local file)
  await initDb();

  const app = express();

  // Basic Middlewares
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });
  app.use(express.json({ limit: '15mb' })); // support larger payloads for base64 logos
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // SSE client references
  let sseClients: Response[] = [];

  // Authentication Middleware
  const authenticateToken = (req: any, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: 'Authentication token required' });
    
    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.status(403).json({ error: 'Token is invalid or expired' });
      req.user = user;
      next();
    });
  };

  // Role Checker Middleware
  const requireRole = (role: UserRole) => {
    return (req: any, res: Response, next: NextFunction) => {
      if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
      if (req.user.role !== UserRole.SUPER_ADMIN && req.user.role !== role) {
        return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
      }
      next();
    };
  };

  // ==========================================
  // REAL-TIME SSE ENDPOINT
  // ==========================================
  app.get('/api/display/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send the current display immediately to initialize
    getCurrentDisplay()
      .then(display => {
        res.write(`data: ${JSON.stringify(display)}\n\n`);
      })
      .catch(err => {
        console.error('SSE initial send error:', err);
      });

    sseClients.push(res);
    console.log(`SSE Client connected. Total clients: ${sseClients.length}`);

    req.on('close', () => {
      sseClients = sseClients.filter(client => client !== res);
      console.log(`SSE Client disconnected. Total clients: ${sseClients.length}`);
    });
  });

  // Helper to notify all screens of display updates
  const notifyDisplayClients = async () => {
    try {
      const display = await getCurrentDisplay();
      const payload = `data: ${JSON.stringify(display)}\n\n`;
      sseClients.forEach(client => {
        try {
          client.write(payload);
        } catch (err) {
          // Client already disconnected
        }
      });
    } catch (err) {
      console.error('Failed to notify SSE clients:', err);
    }
  };

  // ==========================================
  // AUTHENTICATION ENDPOINTS
  // ==========================================
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
      const user = await getUserByUsername(username);
      if (!user || !user.passwordHash) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const isMatch = bcrypt.compareSync(password, user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      // Generate JWT
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '8h' } // 8 hours session timeout
      );

      await logActivity(username, 'LOGIN', `Logged in successfully from session IP`);

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/auth/me', authenticateToken, async (req: any, res: Response) => {
    try {
      const user = await getUserByUsername(req.user.username);
      if (!user) return res.status(404).json({ error: 'User not found' });
      
      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // USER MANAGEMENT ENDPOINTS
  // ==========================================
  app.get('/api/auth/users', authenticateToken, requireRole(UserRole.SUPER_ADMIN), async (req: any, res: Response) => {
    try {
      const usersList = await getUsers();
      res.json(usersList);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/users', authenticateToken, requireRole(UserRole.SUPER_ADMIN), async (req: any, res: Response) => {
    const { username, email, password, role } = req.body;
    if (!username || !email || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    try {
      const existing = await getUserByUsername(username);
      if (existing) return res.status(400).json({ error: 'Username already exists' });

      const hash = bcrypt.hashSync(password, 10);
      const created = await createUser(username, email, hash, role);
      await logActivity(req.user.username, 'CREATE_USER', `Created user account: ${username} (${role})`);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/auth/users/:id', authenticateToken, requireRole(UserRole.SUPER_ADMIN), async (req: any, res: Response) => {
    const id = parseInt(req.params.id);
    const { username, email, password, role } = req.body;

    try {
      const hash = password ? bcrypt.hashSync(password, 10) : null;
      const updated = await updateUser(id, username, email, hash, role);
      await logActivity(req.user.username, 'UPDATE_USER', `Updated user account: ${username}`);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/auth/users/:id', authenticateToken, requireRole(UserRole.SUPER_ADMIN), async (req: any, res: Response) => {
    const id = parseInt(req.params.id);
    try {
      const deleted = await deleteUser(id);
      if (!deleted) return res.status(404).json({ error: 'User not found' });
      await logActivity(req.user.username, 'DELETE_USER', `Deleted user account ID: ${id}`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // HYMN MANAGEMENT ENDPOINTS
  // ==========================================
  app.get('/api/hymns', async (req: Request, res: Response) => {
    const search = (req.query.search as string) || '';
    const category = (req.query.category as string) || '';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    try {
      const result = await getHymns(search, category, page, limit);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/hymns/:id', async (req: Request, res: Response) => {
    try {
      const hymn = await getHymnById(parseInt(req.params.id));
      if (!hymn) return res.status(404).json({ error: 'Hymn not found' });
      res.json(hymn);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/hymns', authenticateToken, async (req: any, res: Response) => {
    const { hymnNumber, title, lyrics, chorus, category, language } = req.body;
    if (!hymnNumber || !title || !lyrics || !category) {
      return res.status(400).json({ error: 'Hymn number, title, lyrics, and category are required' });
    }

    try {
      const created = await createHymn(parseInt(hymnNumber), title, lyrics, chorus || null, category, language || 'English');
      await logActivity(req.user.username, 'CREATE_HYMN', `Created Hymn #${hymnNumber}: ${title}`);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/hymns/:id', authenticateToken, async (req: any, res: Response) => {
    const id = parseInt(req.params.id);
    const { hymnNumber, title, lyrics, chorus, category, language } = req.body;

    try {
      const updated = await updateHymn(id, parseInt(hymnNumber), title, lyrics, chorus || null, category, language || 'English');
      await logActivity(req.user.username, 'EDIT_HYMN', `Edited Hymn #${hymnNumber}: ${title}`);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/hymns/:id', authenticateToken, async (req: any, res: Response) => {
    const id = parseInt(req.params.id);
    try {
      const deleted = await deleteHymn(id);
      if (!deleted) return res.status(404).json({ error: 'Hymn not found' });
      await logActivity(req.user.username, 'DELETE_HYMN', `Deleted Hymn ID: ${id}`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/hymns/:id/duplicate', authenticateToken, async (req: any, res: Response) => {
    const id = parseInt(req.params.id);
    try {
      const duplicated = await duplicateHymn(id);
      await logActivity(req.user.username, 'DUPLICATE_HYMN', `Duplicated Hymn ID: ${id} to #${duplicated.hymnNumber}`);
      res.json(duplicated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // =<ctrl42>= Display Hymn immediately
  app.post('/api/display/hymn/:id', authenticateToken, async (req: any, res: Response) => {
    const id = parseInt(req.params.id);
    try {
      const hymn = await getHymnById(id);
      if (!hymn) return res.status(404).json({ error: 'Hymn not found' });
      
      const updated = await setCurrentDisplay('HYMN', id, `Hymn #${hymn.hymnNumber}: ${hymn.title}`);
      await logActivity(req.user.username, 'DISPLAY_HYMN', `Displayed Hymn #${hymn.hymnNumber}: ${hymn.title}`);
      notifyDisplayClients(); // trigger real-time push
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // ANNOUNCEMENT MODULE ENDPOINTS
  // ==========================================
  app.get('/api/announcements', async (req: Request, res: Response) => {
    try {
      const items = await getAnnouncements();
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/announcements', authenticateToken, async (req: any, res: Response) => {
    const { title, body, date, priority, expiryDate, status } = req.body;
    if (!title || !body) return res.status(400).json({ error: 'Title and body are required' });

    try {
      const created = await createAnnouncement(title, body, date || '', priority || 'MEDIUM', expiryDate || '', status || 'PUBLISHED');
      await logActivity(req.user.username, 'CREATE_ANNOUNCEMENT', `Created announcement: ${title}`);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/announcements/:id', authenticateToken, async (req: any, res: Response) => {
    const id = parseInt(req.params.id);
    const { title, body, date, priority, expiryDate, status } = req.body;

    try {
      const updated = await updateAnnouncement(id, title, body, date || '', priority || 'MEDIUM', expiryDate || '', status || 'PUBLISHED');
      await logActivity(req.user.username, 'EDIT_ANNOUNCEMENT', `Edited announcement: ${title}`);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/announcements/:id', authenticateToken, async (req: any, res: Response) => {
    const id = parseInt(req.params.id);
    try {
      const deleted = await deleteAnnouncement(id);
      if (!deleted) return res.status(404).json({ error: 'Announcement not found' });
      await logActivity(req.user.username, 'DELETE_ANNOUNCEMENT', `Deleted announcement ID: ${id}`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/display/announcement/:id', authenticateToken, async (req: any, res: Response) => {
    const id = parseInt(req.params.id);
    try {
      const ann = await getAnnouncementById(id);
      if (!ann) return res.status(404).json({ error: 'Announcement not found' });
      
      const updated = await setCurrentDisplay('ANNOUNCEMENT', id, `Announcement: ${ann.title}`);
      await logActivity(req.user.username, 'DISPLAY_ANNOUNCEMENT', `Displayed announcement: ${ann.title}`);
      notifyDisplayClients();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // BIBLE CITATION MODULE ENDPOINTS
  // ==========================================
  app.get('/api/citations', async (req: Request, res: Response) => {
    try {
      const items = await getCitations();
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/citations', authenticateToken, async (req: any, res: Response) => {
    const { book, chapter, verse, displayText, notes } = req.body;
    if (!book || !chapter || !verse || !displayText) {
      return res.status(400).json({ error: 'Book, chapter, verse, and display text are required' });
    }

    try {
      const created = await createCitation(book, parseInt(chapter), verse, displayText, notes || '');
      await logActivity(req.user.username, 'CREATE_CITATION', `Created Bible Citation: ${book} ${chapter}:${verse}`);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/citations/:id', authenticateToken, async (req: any, res: Response) => {
    const id = parseInt(req.params.id);
    const { book, chapter, verse, displayText, notes } = req.body;

    try {
      const updated = await updateCitation(id, book, parseInt(chapter), verse, displayText, notes || '');
      await logActivity(req.user.username, 'EDIT_CITATION', `Edited Bible Citation: ${book} ${chapter}:${verse}`);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/citations/:id', authenticateToken, async (req: any, res: Response) => {
    const id = parseInt(req.params.id);
    try {
      const deleted = await deleteCitation(id);
      if (!deleted) return res.status(404).json({ error: 'Citation not found' });
      await logActivity(req.user.username, 'DELETE_CITATION', `Deleted Bible Citation ID: ${id}`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/display/citation/:id', authenticateToken, async (req: any, res: Response) => {
    const id = parseInt(req.params.id);
    try {
      const cit = await getCitationById(id);
      if (!cit) return res.status(404).json({ error: 'Citation not found' });
      
      const updated = await setCurrentDisplay('CITATION', id, `Bible Citation: ${cit.book} ${cit.chapter}:${cit.verse}`);
      await logActivity(req.user.username, 'DISPLAY_CITATION', `Displayed Bible Citation: ${cit.book} ${cit.chapter}:${cit.verse}`);
      notifyDisplayClients();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // CUSTOM MESSAGES MODULE ENDPOINTS
  // ==========================================
  app.get('/api/messages', async (req: Request, res: Response) => {
    try {
      const items = await getMessages();
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/messages', authenticateToken, async (req: any, res: Response) => {
    const { type, title, body } = req.body;
    if (!type || !title || !body) return res.status(400).json({ error: 'Type, title, and body are required' });

    try {
      const created = await createMessage(type, title, body);
      await logActivity(req.user.username, 'CREATE_MESSAGE', `Created custom message: [${type}] ${title}`);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/messages/:id', authenticateToken, async (req: any, res: Response) => {
    const id = parseInt(req.params.id);
    const { type, title, body } = req.body;

    try {
      const updated = await updateMessage(id, type, title, body);
      await logActivity(req.user.username, 'EDIT_MESSAGE', `Edited custom message: [${type}] ${title}`);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/messages/:id', authenticateToken, async (req: any, res: Response) => {
    const id = parseInt(req.params.id);
    try {
      const deleted = await deleteMessage(id);
      if (!deleted) return res.status(404).json({ error: 'Message not found' });
      await logActivity(req.user.username, 'DELETE_MESSAGE', `Deleted custom message ID: ${id}`);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/display/message/:id', authenticateToken, async (req: any, res: Response) => {
    const id = parseInt(req.params.id);
    try {
      const msg = await getMessageById(id);
      if (!msg) return res.status(404).json({ error: 'Custom message not found' });
      
      const updated = await setCurrentDisplay('MESSAGE', id, `Custom Message: ${msg.title}`);
      await logActivity(req.user.username, 'DISPLAY_MESSAGE', `Displayed Custom Message: [${msg.type}] ${msg.title}`);
      notifyDisplayClients();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/display/welcome', authenticateToken, async (req: any, res: Response) => {
    try {
      const updated = await setCurrentDisplay('WELCOME_SLIDE', 0, 'Welcome Slide Display');
      await logActivity(req.user.username, 'DISPLAY_WELCOME', 'Displayed Welcome Slide default screen');
      notifyDisplayClients();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // SETTINGS ENDPOINTS
  // ==========================================
  app.get('/api/settings', async (req: Request, res: Response) => {
    try {
      const settings = await getSettings();
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/settings', authenticateToken, async (req: any, res: Response) => {
    try {
      const updated = await saveSettings(req.body);
      await logActivity(req.user.username, 'UPDATE_SETTINGS', 'Updated branding and church configuration settings');
      notifyDisplayClients(); // trigger client refresh as settings (colors/logo) might have changed
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // LOGS AND HISTORY ENDPOINTS
  // ==========================================
  app.get('/api/logs', authenticateToken, async (req: Request, res: Response) => {
    try {
      const logs = await getActivityLogs();
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/display/current', async (req: Request, res: Response) => {
    try {
      const current = await getCurrentDisplay();
      res.json(current);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/display/history', authenticateToken, async (req: Request, res: Response) => {
    try {
      const history = await getDisplayHistory();
      res.json(history);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/stats', authenticateToken, async (req: Request, res: Response) => {
    try {
      const stats = await getDashboardStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // BACKUP & RESTORE ENDPOINTS
  // ==========================================
  app.get('/api/backup', authenticateToken, async (req: any, res: Response) => {
    try {
      const backupData = await exportBackup();
      await logActivity(req.user.username, 'DOWNLOAD_BACKUP', 'Exported and downloaded full database backup package');
      
      res.setHeader('Content-disposition', `attachment; filename=church_qr_backup_${Date.now()}.json`);
      res.setHeader('Content-type', 'application/json');
      res.write(JSON.stringify(backupData, null, 2));
      res.end();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/restore', authenticateToken, async (req: any, res: Response) => {
    try {
      const backupData = req.body;
      if (!backupData || typeof backupData !== 'object') {
        return res.status(400).json({ error: 'Valid backup JSON payload is required' });
      }
      
      await importBackup(backupData);
      await logActivity(req.user.username, 'RESTORE_BACKUP', 'Successfully restored database from uploaded backup file');
      notifyDisplayClients(); // force displays to pull latest content
      res.json({ success: true, message: 'Database successfully restored' });
    } catch (err: any) {
      console.error('Database restore error:', err);
      res.status(500).json({ error: `Restore failed: ${err.message}` });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // ==========================================
  // FRONTEND ROUTING & VITE MIDDLEWARE
  // ==========================================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log('Vite development middleware integrated.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Production static asset server active.');
  }

  // Error Handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Express Unhandled Error:', err);
    res.status(500).json({ error: 'An unexpected internal server error occurred' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Church QR Hymn Display System running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Fatal initialization error:', err);
});

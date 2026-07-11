import pg from 'pg';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { generateSeedHymns } from './seed_hymns.ts';
import { 
  User, UserRole, Hymn, Announcement, Citation, 
  CustomMessage, CurrentDisplay, ActivityLog, DisplayHistory, ChurchSettings 
} from '../types.ts';

const { Pool } = pg;

// Load environment variables
const dbUrl = process.env.DATABASE_URL;

let pool: pg.Pool | null = null;
let isPostgres = false;

// Local JSON DB config
const LOCAL_DB_DIR = path.resolve('./data');
const LOCAL_DB_PATH = path.join(LOCAL_DB_DIR, 'db.json');

const DEFAULT_SETTINGS: ChurchSettings = {
  churchName: 'Grace Community Church',
  headerText: 'Welcome to worship service!',
  footerText: 'Join us for refreshments after service!',
  footerBibleVerse: 'The Lord bless you and keep you. - Numbers 6:24',
  footerContact: 'info@gracechurch.org',
  footerAddress: '123 Grace Way, Faith City',
  footerPhone: '+1 (555) 123-4567',
  footerEmail: 'contact@gracechurch.org',
  footerCopyright: '© 2026 Grace Community Church. All rights reserved.',
  primaryColor: '#5A5A40', // Olive Sage
  secondaryColor: '#2D3A3A', // Slate Forest
  backgroundColor: '#F5F5F0', // Warm Stone
  textColor: '#2D3A3A', // Slate Forest
  fontSize: 'medium',
  fontFamily: 'serif',
  logoUrl: '' // Base64 logo string
};

// Initialize connection pool
if (dbUrl) {
  console.log('PostgreSQL DATABASE_URL found. Initializing PostgreSQL Pool...');
  const useSsl = !dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1') && !dbUrl.includes('::1');
  pool = new Pool({
    connectionString: dbUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  });
  
  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err);
  });
} else {
  console.log('No DATABASE_URL found. Falling back to high-fidelity local JSON database...');
}

// Database schema setup DDL
const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'ADMIN',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hymns (
  id SERIAL PRIMARY KEY,
  hymn_number INTEGER UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  lyrics TEXT NOT NULL,
  chorus TEXT,
  category VARCHAR(255) NOT NULL,
  language VARCHAR(100) DEFAULT 'English',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  date VARCHAR(100),
  priority VARCHAR(50) DEFAULT 'MEDIUM',
  expiry_date VARCHAR(100),
  status VARCHAR(50) DEFAULT 'PUBLISHED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS citations (
  id SERIAL PRIMARY KEY,
  book VARCHAR(255) NOT NULL,
  chapter INTEGER NOT NULL,
  verse VARCHAR(100) NOT NULL,
  display_text TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS custom_messages (
  id SERIAL PRIMARY KEY,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS current_displays (
  id INTEGER PRIMARY KEY DEFAULT 1,
  display_type VARCHAR(100) NOT NULL,
  record_id INTEGER NOT NULL,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(100) DEFAULT 'PUBLISHED'
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  username VARCHAR(255) NOT NULL,
  details TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS display_histories (
  id SERIAL PRIMARY KEY,
  display_type VARCHAR(100) NOT NULL,
  record_id INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  displayed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

export async function initDb() {
  if (pool) {
    try {
      console.log('Testing PostgreSQL connection and running migrations...');
      const client = await pool.connect();
      try {
        await client.query(DDL);
        isPostgres = true;
        console.log('PostgreSQL schema migrations successfully verified!');
        
        // Seed default admin if missing (case-insensitive)
        const adminCheck = await client.query("SELECT COUNT(*) FROM users WHERE LOWER(username) = 'admin'");
        if (parseInt(adminCheck.rows[0].count) === 0) {
          console.log('PostgreSQL: Seeding default admin user...');
          const adminPasswordHash = bcrypt.hashSync('admin123', 10);
          await client.query(
            'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4)',
            ['admin', 'admin@church.org', adminPasswordHash, 'SUPER_ADMIN']
          );
        }

        // Seed hymns if empty
        const hymnsCheck = await client.query('SELECT COUNT(*) FROM hymns');
        if (parseInt(hymnsCheck.rows[0].count) === 0) {
          console.log('PostgreSQL: Seeding 2,000 hymns (this may take a moment)...');
          const seedHymns = generateSeedHymns();
          await client.query('BEGIN');
          for (const h of seedHymns) {
            await client.query(
              'INSERT INTO hymns (hymn_number, title, lyrics, chorus, category, language) VALUES ($1, $2, $3, $4, $5, $6)',
              [h.hymnNumber, h.title, h.lyrics, h.chorus || null, h.category, h.language]
            );
          }
          await client.query('COMMIT');
          console.log('PostgreSQL: Successfully seeded 2,000 hymns!');
        }

        // Seed settings if empty
        const settingsCheck = await client.query('SELECT COUNT(*) FROM settings WHERE key = $1', ['branding_settings']);
        if (parseInt(settingsCheck.rows[0].count) === 0) {
          await client.query(
            'INSERT INTO settings (key, value) VALUES ($1, $2)',
            ['branding_settings', JSON.stringify(DEFAULT_SETTINGS)]
          );
        }

        // Seed current display if empty
        const displayCheck = await client.query('SELECT COUNT(*) FROM current_displays');
        if (parseInt(displayCheck.rows[0].count) === 0) {
          await client.query(
            'INSERT INTO current_displays (id, display_type, record_id, status) VALUES (1, $1, $2, $3)',
            ['WELCOME_SLIDE', 0, 'PUBLISHED']
          );
        }

      } finally {
        client.release();
      }
    } catch (err) {
      console.error('PostgreSQL connection failed. Reverting to local JSON database...', err);
      isPostgres = false;
    }
  }

  if (!isPostgres) {
    console.log('JSON Database Mode Active.');
    if (!fs.existsSync(LOCAL_DB_DIR)) {
      fs.mkdirSync(LOCAL_DB_DIR, { recursive: true });
    }
    if (!fs.existsSync(LOCAL_DB_PATH)) {
      console.log('Creating fresh local database and seeding records...');
      const adminPasswordHash = bcrypt.hashSync('admin123', 10);
      const seedHymns = generateSeedHymns().map((h, i) => ({
        id: i + 1,
        ...h,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      const initialData = {
        users: [
          {
            id: 1,
            username: 'admin',
            email: 'admin@church.org',
            passwordHash: adminPasswordHash,
            role: UserRole.SUPER_ADMIN,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        hymns: seedHymns,
        announcements: [
          {
            id: 1,
            title: 'Sunday Worship Service starts at 9:00 AM',
            body: 'We invite you to join us this Sunday for our divine worship service! Please invite your family, friends, and neighbors.',
            date: 'Every Sunday',
            priority: 'HIGH',
            expiryDate: '',
            status: 'PUBLISHED',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 2,
            title: 'Midweek Bible Study',
            body: 'Join us online and in-person every Wednesday at 7:00 PM for deep scripture analysis and prayer meeting.',
            date: 'Every Wednesday',
            priority: 'MEDIUM',
            expiryDate: '',
            status: 'PUBLISHED',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        citations: [
          {
            id: 1,
            book: 'John',
            chapter: 3,
            verse: '16',
            displayText: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
            notes: 'The central message of the gospel.',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 2,
            book: 'Psalm',
            chapter: 23,
            verse: '1-3',
            displayText: 'The Lord is my shepherd; I shall not want. He maketh me to lie down in green pastures: he leadeth me beside the still waters. He restoreth my soul.',
            notes: 'A scripture of deep comfort.',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        custom_messages: [
          {
            id: 1,
            type: 'WELCOME',
            title: 'Welcome Message',
            body: 'Welcome to Grace Community Church! We are truly glad you joined us today. God bless you!',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 2,
            type: 'OFFERING',
            title: 'Offering & Tithe Message',
            body: 'Give cheerfully as the Lord has blessed you. Thank you for supporting God\'s work in this sanctuary!',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        current_display: {
          id: 1,
          displayType: 'WELCOME_SLIDE',
          recordId: 0,
          lastUpdated: new Date().toISOString(),
          status: 'PUBLISHED'
        },
        activity_logs: [
          {
            id: 1,
            action: 'INITIALIZATION',
            username: 'SYSTEM',
            details: 'Database initialized successfully',
            timestamp: new Date().toISOString()
          }
        ],
        settings: {
          branding_settings: DEFAULT_SETTINGS
        },
        display_histories: []
      };

      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
      console.log('Local JSON Database seeded with 2,000 hymns, admins, and settings!');
    } else {
      // Ensure 'admin' user exists in JSON database so admin/admin123 works
      try {
        const data = readLocalJson();
        const usersList = Array.isArray(data?.users) ? data.users : [];
        const hasAdmin = usersList.some((u: any) => u && u.username && u.username.toLowerCase() === 'admin');
        if (!hasAdmin) {
          console.log('JSON Database: Seeding missing default admin user...');
          const adminPasswordHash = bcrypt.hashSync('admin123', 10);
          const nextId = usersList.length > 0 ? Math.max(...usersList.map((u: any) => u.id)) + 1 : 1;
          usersList.push({
            id: nextId,
            username: 'admin',
            email: 'admin@church.org',
            passwordHash: adminPasswordHash,
            role: UserRole.SUPER_ADMIN,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          data.users = usersList;
          writeLocalJson(data);
        }
      } catch (err) {
        console.error('Failed to verify/seed admin in local JSON db:', err);
      }
    }
  }
}

// Read JSON Helper
function readLocalJson(): any {
  const defaultObj = {
    users: [],
    hymns: [],
    announcements: [],
    citations: [],
    custom_messages: [],
    activity_logs: [],
    display_histories: [],
    settings: { branding_settings: DEFAULT_SETTINGS },
    current_display: { displayType: 'WELCOME_SLIDE', recordId: 0, status: 'PUBLISHED', lastUpdated: new Date().toISOString() }
  };

  try {
    if (!fs.existsSync(LOCAL_DB_PATH)) {
      return defaultObj;
    }
    const raw = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
    if (!raw || raw.trim() === '') {
      return defaultObj;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return defaultObj;
    }
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      hymns: Array.isArray(parsed.hymns) ? parsed.hymns : [],
      announcements: Array.isArray(parsed.announcements) ? parsed.announcements : [],
      citations: Array.isArray(parsed.citations) ? parsed.citations : [],
      custom_messages: Array.isArray(parsed.custom_messages) ? parsed.custom_messages : [],
      activity_logs: Array.isArray(parsed.activity_logs) ? parsed.activity_logs : [],
      display_histories: Array.isArray(parsed.display_histories) ? parsed.display_histories : [],
      settings: parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : { branding_settings: DEFAULT_SETTINGS },
      current_display: parsed.current_display && typeof parsed.current_display === 'object' ? parsed.current_display : { displayType: 'WELCOME_SLIDE', recordId: 0, status: 'PUBLISHED', lastUpdated: new Date().toISOString() }
    };
  } catch (err) {
    console.error('Error reading local JSON database:', err);
    return defaultObj;
  }
}

// Write JSON Helper
function writeLocalJson(data: any) {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing local JSON database:', err);
  }
}

// ==========================================
// USER REPOSITORY OPERATIONS
// ==========================================

export async function getUserByUsername(username: string): Promise<User | null> {
  if (isPostgres && pool) {
    const res = await pool.query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role as UserRole,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  } else {
    const data = readLocalJson();
    const usersList = Array.isArray(data?.users) ? data.users : [];
    const user = usersList.find((u: any) => u && u.username && u.username.toLowerCase() === username.toLowerCase());
    return user || null;
  }
}

export async function getUsers(): Promise<User[]> {
  if (isPostgres && pool) {
    const res = await pool.query('SELECT id, username, email, role, created_at, updated_at FROM users ORDER BY id ASC');
    return res.rows.map(row => ({
      id: row.id,
      username: row.username,
      email: row.email,
      role: row.role as UserRole,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    }));
  } else {
    const data = readLocalJson();
    return data.users.map(({ passwordHash, ...rest }: any) => rest);
  }
}

export async function createUser(username: string, email: string, passwordHash: string, role: UserRole): Promise<User> {
  if (isPostgres && pool) {
    const res = await pool.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [username, email, passwordHash, role]
    );
    const row = res.rows[0];
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      role: row.role as UserRole,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  } else {
    const data = readLocalJson();
    const id = data.users.length > 0 ? Math.max(...data.users.map((u: any) => u.id)) + 1 : 1;
    const newUser: User = {
      id,
      username,
      email,
      passwordHash,
      role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.users.push(newUser);
    writeLocalJson(data);
    const { passwordHash: _, ...rest } = newUser as any;
    return rest;
  }
}

export async function updateUser(id: number, username: string, email: string, passwordHash: string | null, role: UserRole): Promise<User> {
  if (isPostgres && pool) {
    let q = 'UPDATE users SET username = $1, email = $2, role = $3, updated_at = CURRENT_TIMESTAMP';
    const params = [username, email, role];
    if (passwordHash) {
      q += `, password_hash = $${params.length + 1}`;
      params.push(passwordHash);
    }
    q += ` WHERE id = $${params.length + 1} RETURNING *`;
    params.push(id.toString());
    
    const res = await pool.query(q, params);
    const row = res.rows[0];
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      role: row.role as UserRole,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  } else {
    const data = readLocalJson();
    const index = data.users.findIndex((u: any) => u.id === id);
    if (index === -1) throw new Error('User not found');
    
    data.users[index].username = username;
    data.users[index].email = email;
    data.users[index].role = role;
    data.users[index].updatedAt = new Date().toISOString();
    if (passwordHash) {
      data.users[index].passwordHash = passwordHash;
    }
    
    writeLocalJson(data);
    const { passwordHash: _, ...rest } = data.users[index];
    return rest;
  }
}

export async function deleteUser(id: number): Promise<boolean> {
  if (isPostgres && pool) {
    const res = await pool.query('DELETE FROM users WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  } else {
    const data = readLocalJson();
    const index = data.users.findIndex((u: any) => u.id === id);
    if (index === -1) return false;
    data.users.splice(index, 1);
    writeLocalJson(data);
    return true;
  }
}

// ==========================================
// HYMNS REPOSITORY OPERATIONS
// ==========================================

interface HymnsResult {
  hymns: Hymn[];
  total: number;
}

export async function getHymns(search = '', category = '', page = 1, limit = 10): Promise<HymnsResult> {
  const offset = (page - 1) * limit;
  
  if (isPostgres && pool) {
    let query = 'SELECT * FROM hymns WHERE 1=1';
    const params: any[] = [];
    
    if (search.trim()) {
      const keywords = search.trim().split(/\s+/).filter(Boolean);
      keywords.forEach(keyword => {
        params.push(`%${keyword}%`);
        query += ` AND (hymn_number::text LIKE $${params.length} OR title ILIKE $${params.length} OR lyrics ILIKE $${params.length} OR chorus ILIKE $${params.length})`;
      });
    }
    
    if (category.trim()) {
      params.push(category.trim());
      query += ` AND category = $${params.length}`;
    }
    
    // Count total
    const countQuery = `SELECT COUNT(*) FROM (${query}) AS temp`;
    const countRes = await pool.query(countQuery, params);
    const total = parseInt(countRes.rows[0].count);
    
    // Sort and Paginate
    query += ' ORDER BY hymn_number ASC';
    params.push(limit);
    query += ` LIMIT $${params.length}`;
    params.push(offset);
    query += ` OFFSET $${params.length}`;
    
    const res = await pool.query(query, params);
    const hymns = res.rows.map(row => ({
      id: row.id,
      hymnNumber: row.hymn_number,
      title: row.title,
      lyrics: row.lyrics,
      chorus: row.chorus || undefined,
      category: row.category,
      language: row.language,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    }));
    
    return { hymns, total };
  } else {
    const data = readLocalJson();
    let list: Hymn[] = data.hymns;
    
    if (search.trim()) {
      const keywords = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
      if (keywords.length > 0) {
        list = list.filter(h => 
          keywords.every(kw => 
            h.hymnNumber.toString().includes(kw) ||
            h.title.toLowerCase().includes(kw) ||
            h.lyrics.toLowerCase().includes(kw) ||
            (h.chorus && h.chorus.toLowerCase().includes(kw))
          )
        );
      }
    }
    
    if (category.trim()) {
      list = list.filter(h => h.category === category);
    }
    
    const total = list.length;
    // Sort
    list.sort((a, b) => a.hymnNumber - b.hymnNumber);
    const paginated = list.slice(offset, offset + limit);
    return { hymns: paginated, total };
  }
}

export async function getHymnById(id: number): Promise<Hymn | null> {
  if (isPostgres && pool) {
    const res = await pool.query('SELECT * FROM hymns WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      hymnNumber: row.hymn_number,
      title: row.title,
      lyrics: row.lyrics,
      chorus: row.chorus || undefined,
      category: row.category,
      language: row.language,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  } else {
    const data = readLocalJson();
    return data.hymns.find((h: any) => h.id === id) || null;
  }
}

export async function createHymn(hymnNumber: number, title: string, lyrics: string, chorus: string | null, category: string, language: string): Promise<Hymn> {
  if (isPostgres && pool) {
    const res = await pool.query(
      'INSERT INTO hymns (hymn_number, title, lyrics, chorus, category, language) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [hymnNumber, title, lyrics, chorus, category, language]
    );
    const row = res.rows[0];
    return {
      id: row.id,
      hymnNumber: row.hymn_number,
      title: row.title,
      lyrics: row.lyrics,
      chorus: row.chorus || undefined,
      category: row.category,
      language: row.language,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  } else {
    const data = readLocalJson();
    // Validate number unique
    if (data.hymns.some((h: any) => h.hymnNumber === hymnNumber)) {
      throw new Error(`Hymn number ${hymnNumber} already exists`);
    }
    const id = data.hymns.length > 0 ? Math.max(...data.hymns.map((h: any) => h.id)) + 1 : 1;
    const newHymn: Hymn = {
      id,
      hymnNumber,
      title,
      lyrics,
      chorus: chorus || undefined,
      category,
      language,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.hymns.push(newHymn);
    writeLocalJson(data);
    return newHymn;
  }
}

export async function updateHymn(id: number, hymnNumber: number, title: string, lyrics: string, chorus: string | null, category: string, language: string): Promise<Hymn> {
  if (isPostgres && pool) {
    const res = await pool.query(
      'UPDATE hymns SET hymn_number = $1, title = $2, lyrics = $3, chorus = $4, category = $5, language = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7 RETURNING *',
      [hymnNumber, title, lyrics, chorus, category, language, id]
    );
    const row = res.rows[0];
    return {
      id: row.id,
      hymnNumber: row.hymn_number,
      title: row.title,
      lyrics: row.lyrics,
      chorus: row.chorus || undefined,
      category: row.category,
      language: row.language,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  } else {
    const data = readLocalJson();
    const index = data.hymns.findIndex((h: any) => h.id === id);
    if (index === -1) throw new Error('Hymn not found');
    
    // Validate number unique if changed
    if (data.hymns.some((h: any) => h.hymnNumber === hymnNumber && h.id !== id)) {
      throw new Error(`Hymn number ${hymnNumber} already exists`);
    }

    data.hymns[index] = {
      ...data.hymns[index],
      hymnNumber,
      title,
      lyrics,
      chorus: chorus || undefined,
      category,
      language,
      updatedAt: new Date().toISOString()
    };
    writeLocalJson(data);
    return data.hymns[index];
  }
}

export async function deleteHymn(id: number): Promise<boolean> {
  if (isPostgres && pool) {
    const res = await pool.query('DELETE FROM hymns WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  } else {
    const data = readLocalJson();
    const index = data.hymns.findIndex((h: any) => h.id === id);
    if (index === -1) return false;
    data.hymns.splice(index, 1);
    writeLocalJson(data);
    return true;
  }
}

export async function duplicateHymn(id: number): Promise<Hymn> {
  const original = await getHymnById(id);
  if (!original) throw new Error('Original hymn not found');
  
  // Find next available hymn number
  let nextNumber = original.hymnNumber + 1;
  if (isPostgres && pool) {
    while (true) {
      const check = await pool.query('SELECT id FROM hymns WHERE hymn_number = $1', [nextNumber]);
      if (check.rows.length === 0) break;
      nextNumber++;
    }
  } else {
    const data = readLocalJson();
    while (data.hymns.some((h: any) => h.hymnNumber === nextNumber)) {
      nextNumber++;
    }
  }

  return await createHymn(
    nextNumber,
    `${original.title} (Copy)`,
    original.lyrics,
    original.chorus || null,
    original.category,
    original.language
  );
}

// ==========================================
// ANNOUNCEMENTS REPOSITORY OPERATIONS
// ==========================================

export async function getAnnouncements(): Promise<Announcement[]> {
  if (isPostgres && pool) {
    const res = await pool.query('SELECT * FROM announcements ORDER BY created_at DESC');
    return res.rows.map(row => ({
      id: row.id,
      title: row.title,
      body: row.body,
      date: row.date || undefined,
      priority: row.priority as any,
      expiryDate: row.expiry_date || undefined,
      status: row.status as any,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    }));
  } else {
    const data = readLocalJson();
    return data.announcements;
  }
}

export async function getAnnouncementById(id: number): Promise<Announcement | null> {
  if (isPostgres && pool) {
    const res = await pool.query('SELECT * FROM announcements WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      date: row.date || undefined,
      priority: row.priority as any,
      expiryDate: row.expiry_date || undefined,
      status: row.status as any,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  } else {
    const data = readLocalJson();
    return data.announcements.find((a: any) => a.id === id) || null;
  }
}

export async function createAnnouncement(title: string, body: string, date: string, priority: string, expiryDate: string, status: string): Promise<Announcement> {
  if (isPostgres && pool) {
    const res = await pool.query(
      'INSERT INTO announcements (title, body, date, priority, expiry_date, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [title, body, date, priority, expiryDate, status]
    );
    const row = res.rows[0];
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      date: row.date || undefined,
      priority: row.priority as any,
      expiryDate: row.expiry_date || undefined,
      status: row.status as any,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  } else {
    const data = readLocalJson();
    const id = data.announcements.length > 0 ? Math.max(...data.announcements.map((a: any) => a.id)) + 1 : 1;
    const item: Announcement = {
      id,
      title,
      body,
      date,
      priority: priority as any,
      expiryDate,
      status: status as any,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.announcements.unshift(item);
    writeLocalJson(data);
    return item;
  }
}

export async function updateAnnouncement(id: number, title: string, body: string, date: string, priority: string, expiryDate: string, status: string): Promise<Announcement> {
  if (isPostgres && pool) {
    const res = await pool.query(
      'UPDATE announcements SET title = $1, body = $2, date = $3, priority = $4, expiry_date = $5, status = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7 RETURNING *',
      [title, body, date, priority, expiryDate, status, id]
    );
    const row = res.rows[0];
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      date: row.date || undefined,
      priority: row.priority as any,
      expiryDate: row.expiry_date || undefined,
      status: row.status as any,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  } else {
    const data = readLocalJson();
    const index = data.announcements.findIndex((a: any) => a.id === id);
    if (index === -1) throw new Error('Announcement not found');
    data.announcements[index] = {
      ...data.announcements[index],
      title,
      body,
      date,
      priority: priority as any,
      expiryDate,
      status: status as any,
      updatedAt: new Date().toISOString()
    };
    writeLocalJson(data);
    return data.announcements[index];
  }
}

export async function deleteAnnouncement(id: number): Promise<boolean> {
  if (isPostgres && pool) {
    const res = await pool.query('DELETE FROM announcements WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  } else {
    const data = readLocalJson();
    const index = data.announcements.findIndex((a: any) => a.id === id);
    if (index === -1) return false;
    data.announcements.splice(index, 1);
    writeLocalJson(data);
    return true;
  }
}

// ==========================================
// CITATIONS REPOSITORY OPERATIONS
// ==========================================

export async function getCitations(): Promise<Citation[]> {
  if (isPostgres && pool) {
    const res = await pool.query('SELECT * FROM citations ORDER BY created_at DESC');
    return res.rows.map(row => ({
      id: row.id,
      book: row.book,
      chapter: row.chapter,
      verse: row.verse,
      displayText: row.display_text,
      notes: row.notes || undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    }));
  } else {
    const data = readLocalJson();
    return data.citations;
  }
}

export async function getCitationById(id: number): Promise<Citation | null> {
  if (isPostgres && pool) {
    const res = await pool.query('SELECT * FROM citations WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      book: row.book,
      chapter: row.chapter,
      verse: row.verse,
      displayText: row.display_text,
      notes: row.notes || undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  } else {
    const data = readLocalJson();
    return data.citations.find((c: any) => c.id === id) || null;
  }
}

export async function createCitation(book: string, chapter: number, verse: string, displayText: string, notes: string): Promise<Citation> {
  if (isPostgres && pool) {
    const res = await pool.query(
      'INSERT INTO citations (book, chapter, verse, display_text, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [book, chapter, verse, displayText, notes]
    );
    const row = res.rows[0];
    return {
      id: row.id,
      book: row.book,
      chapter: row.chapter,
      verse: row.verse,
      displayText: row.display_text,
      notes: row.notes || undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  } else {
    const data = readLocalJson();
    const id = data.citations.length > 0 ? Math.max(...data.citations.map((c: any) => c.id)) + 1 : 1;
    const item: Citation = {
      id,
      book,
      chapter,
      verse,
      displayText,
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.citations.unshift(item);
    writeLocalJson(data);
    return item;
  }
}

export async function updateCitation(id: number, book: string, chapter: number, verse: string, displayText: string, notes: string): Promise<Citation> {
  if (isPostgres && pool) {
    const res = await pool.query(
      'UPDATE citations SET book = $1, chapter = $2, verse = $3, display_text = $4, notes = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *',
      [book, chapter, verse, displayText, notes, id]
    );
    const row = res.rows[0];
    return {
      id: row.id,
      book: row.book,
      chapter: row.chapter,
      verse: row.verse,
      displayText: row.display_text,
      notes: row.notes || undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  } else {
    const data = readLocalJson();
    const index = data.citations.findIndex((c: any) => c.id === id);
    if (index === -1) throw new Error('Citation not found');
    data.citations[index] = {
      ...data.citations[index],
      book,
      chapter,
      verse,
      displayText,
      notes,
      updatedAt: new Date().toISOString()
    };
    writeLocalJson(data);
    return data.citations[index];
  }
}

export async function deleteCitation(id: number): Promise<boolean> {
  if (isPostgres && pool) {
    const res = await pool.query('DELETE FROM citations WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  } else {
    const data = readLocalJson();
    const index = data.citations.findIndex((c: any) => c.id === id);
    if (index === -1) return false;
    data.citations.splice(index, 1);
    writeLocalJson(data);
    return true;
  }
}

// ==========================================
// MESSAGES REPOSITORY OPERATIONS
// ==========================================

export async function getMessages(): Promise<CustomMessage[]> {
  if (isPostgres && pool) {
    const res = await pool.query('SELECT * FROM custom_messages ORDER BY created_at DESC');
    return res.rows.map(row => ({
      id: row.id,
      type: row.type as any,
      title: row.title,
      body: row.body,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    }));
  } else {
    const data = readLocalJson();
    return data.custom_messages;
  }
}

export async function getMessageById(id: number): Promise<CustomMessage | null> {
  if (isPostgres && pool) {
    const res = await pool.query('SELECT * FROM custom_messages WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      type: row.type as any,
      title: row.title,
      body: row.body,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  } else {
    const data = readLocalJson();
    return data.custom_messages.find((m: any) => m.id === id) || null;
  }
}

export async function createMessage(type: string, title: string, body: string): Promise<CustomMessage> {
  if (isPostgres && pool) {
    const res = await pool.query(
      'INSERT INTO custom_messages (type, title, body) VALUES ($1, $2, $3) RETURNING *',
      [type, title, body]
    );
    const row = res.rows[0];
    return {
      id: row.id,
      type: row.type as any,
      title: row.title,
      body: row.body,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  } else {
    const data = readLocalJson();
    const id = data.custom_messages.length > 0 ? Math.max(...data.custom_messages.map((m: any) => m.id)) + 1 : 1;
    const item: CustomMessage = {
      id,
      type: type as any,
      title,
      body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.custom_messages.unshift(item);
    writeLocalJson(data);
    return item;
  }
}

export async function updateMessage(id: number, type: string, title: string, body: string): Promise<CustomMessage> {
  if (isPostgres && pool) {
    const res = await pool.query(
      'UPDATE custom_messages SET type = $1, title = $2, body = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
      [type, title, body, id]
    );
    const row = res.rows[0];
    return {
      id: row.id,
      type: row.type as any,
      title: row.title,
      body: row.body,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  } else {
    const data = readLocalJson();
    const index = data.custom_messages.findIndex((m: any) => m.id === id);
    if (index === -1) throw new Error('Message not found');
    data.custom_messages[index] = {
      ...data.custom_messages[index],
      type: type as any,
      title,
      body,
      updatedAt: new Date().toISOString()
    };
    writeLocalJson(data);
    return data.custom_messages[index];
  }
}

export async function deleteMessage(id: number): Promise<boolean> {
  if (isPostgres && pool) {
    const res = await pool.query('DELETE FROM custom_messages WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  } else {
    const data = readLocalJson();
    const index = data.custom_messages.findIndex((m: any) => m.id === id);
    if (index === -1) return false;
    data.custom_messages.splice(index, 1);
    writeLocalJson(data);
    return true;
  }
}

// ==========================================
// DISPLAY ENGINE OPERATIONS
// ==========================================

export async function getCurrentDisplay(): Promise<CurrentDisplay> {
  let rawDisplay: { display_type: string, record_id: number, last_updated: any, status: string } | null = null;
  
  if (isPostgres && pool) {
    const res = await pool.query('SELECT * FROM current_displays WHERE id = 1');
    if (res.rows.length > 0) {
      const row = res.rows[0];
      rawDisplay = {
        display_type: row.display_type,
        record_id: row.record_id,
        last_updated: row.last_updated.toISOString(),
        status: row.status
      };
    }
  } else {
    const data = readLocalJson();
    rawDisplay = {
      display_type: data.current_display.displayType,
      record_id: data.current_display.recordId,
      last_updated: data.current_display.lastUpdated,
      status: data.current_display.status
    };
  }

  if (!rawDisplay) {
    return {
      id: 1,
      displayType: 'WELCOME_SLIDE',
      recordId: 0,
      lastUpdated: new Date().toISOString(),
      status: 'PUBLISHED',
      data: { title: 'Welcome to Church', body: 'Scan the QR code to participate!' }
    };
  }

  // Hydrate data based on type
  let hydratedData: any = null;
  const { display_type: type, record_id: rId, last_updated, status } = rawDisplay;

  try {
    if (type === 'HYMN') {
      hydratedData = await getHymnById(rId);
    } else if (type === 'ANNOUNCEMENT') {
      hydratedData = await getAnnouncementById(rId);
    } else if (type === 'CITATION') {
      hydratedData = await getCitationById(rId);
    } else if (type === 'MESSAGE') {
      hydratedData = await getMessageById(rId);
    } else {
      hydratedData = {
        title: 'Welcome to Our Sanctuary',
        body: 'Glad you joined us today. Prepare your hearts for worship.'
      };
    }
  } catch (err) {
    console.error('Error hydrating display data:', err);
  }

  return {
    id: 1,
    displayType: type as any,
    recordId: rId,
    lastUpdated: last_updated,
    status,
    data: hydratedData
  };
}

export async function setCurrentDisplay(displayType: string, recordId: number, title: string): Promise<CurrentDisplay> {
  const lastUpdated = new Date().toISOString();
  
  if (isPostgres && pool) {
    // Upsert current display
    await pool.query(
      `INSERT INTO current_displays (id, display_type, record_id, last_updated, status) 
       VALUES (1, $1, $2, CURRENT_TIMESTAMP, 'PUBLISHED') 
       ON CONFLICT (id) DO UPDATE SET display_type = $1, record_id = $2, last_updated = CURRENT_TIMESTAMP`,
      [displayType, recordId]
    );
    
    // Log history
    await pool.query(
      'INSERT INTO display_histories (display_type, record_id, title) VALUES ($1, $2, $3)',
      [displayType, recordId, title]
    );
  } else {
    const data = readLocalJson();
    data.current_display = {
      id: 1,
      displayType,
      recordId,
      lastUpdated,
      status: 'PUBLISHED'
    };
    
    // Add history
    const histId = data.display_histories.length > 0 ? Math.max(...data.display_histories.map((h: any) => h.id)) + 1 : 1;
    data.display_histories.unshift({
      id: histId,
      displayType,
      recordId,
      title,
      displayedAt: lastUpdated
    });
    
    // Keep history trimmed to 50 items
    if (data.display_histories.length > 50) {
      data.display_histories.pop();
    }
    
    writeLocalJson(data);
  }

  return await getCurrentDisplay();
}

export async function getDisplayHistory(): Promise<DisplayHistory[]> {
  if (isPostgres && pool) {
    const res = await pool.query('SELECT * FROM display_histories ORDER BY displayed_at DESC LIMIT 20');
    return res.rows.map(row => ({
      id: row.id,
      displayType: row.display_type,
      recordId: row.record_id,
      title: row.title,
      displayedAt: row.displayed_at.toISOString()
    }));
  } else {
    const data = readLocalJson();
    return data.display_histories || [];
  }
}

// ==========================================
// SETTINGS REPOSITORY OPERATIONS
// ==========================================

export async function getSettings(): Promise<ChurchSettings> {
  if (isPostgres && pool) {
    const res = await pool.query('SELECT value FROM settings WHERE key = $1', ['branding_settings']);
    if (res.rows.length === 0) return DEFAULT_SETTINGS;
    return JSON.parse(res.rows[0].value);
  } else {
    const data = readLocalJson();
    return data.settings.branding_settings || DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: ChurchSettings): Promise<ChurchSettings> {
  if (isPostgres && pool) {
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2`,
      ['branding_settings', JSON.stringify(settings)]
    );
  } else {
    const data = readLocalJson();
    data.settings.branding_settings = settings;
    writeLocalJson(data);
  }
  return settings;
}

// ==========================================
// ACTIVITY LOG OPERATIONS
// ==========================================

export async function logActivity(username: string, action: string, details: string): Promise<ActivityLog> {
  const timestamp = new Date().toISOString();
  if (isPostgres && pool) {
    const res = await pool.query(
      'INSERT INTO activity_logs (username, action, details) VALUES ($1, $2, $3) RETURNING *',
      [username, action, details]
    );
    const row = res.rows[0];
    return {
      id: row.id,
      username: row.username,
      action: row.action,
      details: row.details,
      timestamp: row.timestamp.toISOString()
    };
  } else {
    const data = readLocalJson();
    const id = data.activity_logs.length > 0 ? Math.max(...data.activity_logs.map((l: any) => l.id)) + 1 : 1;
    const log: ActivityLog = {
      id,
      username,
      action,
      details,
      timestamp
    };
    data.activity_logs.unshift(log);
    
    // Trim to 200 logs
    if (data.activity_logs.length > 200) {
      data.activity_logs.pop();
    }
    
    writeLocalJson(data);
    return log;
  }
}

export async function getActivityLogs(): Promise<ActivityLog[]> {
  if (isPostgres && pool) {
    const res = await pool.query('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 100');
    return res.rows.map(row => ({
      id: row.id,
      username: row.username,
      action: row.action,
      details: row.details,
      timestamp: row.timestamp.toISOString()
    }));
  } else {
    const data = readLocalJson();
    return data.activity_logs;
  }
}

// ==========================================
// BACKUP & RESTORE OPERATIONS
// ==========================================

export async function exportBackup(): Promise<any> {
  if (isPostgres && pool) {
    const users = await pool.query('SELECT * FROM users');
    const hymns = await pool.query('SELECT * FROM hymns');
    const announcements = await pool.query('SELECT * FROM announcements');
    const citations = await pool.query('SELECT * FROM citations');
    const custom_messages = await pool.query('SELECT * FROM custom_messages');
    const display_histories = await pool.query('SELECT * FROM display_histories');
    const current_displays = await pool.query('SELECT * FROM current_displays');
    const settingsVal = await pool.query('SELECT * FROM settings');

    const settingsObj: any = {};
    settingsVal.rows.forEach(r => {
      settingsObj[r.key] = JSON.parse(r.value);
    });

    return {
      users: users.rows,
      hymns: hymns.rows.map(r => ({ ...r, hymnNumber: r.hymn_number })),
      announcements: announcements.rows.map(r => ({ ...r, expiryDate: r.expiry_date })),
      citations: citations.rows.map(r => ({ ...r, displayText: r.display_text })),
      custom_messages: custom_messages.rows,
      display_histories: display_histories.rows.map(r => ({ ...r, displayType: r.display_type, recordId: r.record_id, displayedAt: r.displayed_at })),
      current_display: current_displays.rows[0] ? {
        id: current_displays.rows[0].id,
        displayType: current_displays.rows[0].display_type,
        recordId: current_displays.rows[0].record_id,
        lastUpdated: current_displays.rows[0].last_updated,
        status: current_displays.rows[0].status
      } : undefined,
      settings: settingsObj
    };
  } else {
    return readLocalJson();
  }
}

export async function importBackup(backup: any): Promise<void> {
  if (isPostgres && pool) {
    await pool.query('BEGIN');
    try {
      if (backup.users && backup.users.length > 0) {
        await pool.query('TRUNCATE users CASCADE');
        for (const u of backup.users) {
          await pool.query(
            'INSERT INTO users (id, username, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)',
            [u.id, u.username, u.email, u.password_hash || u.passwordHash, u.role]
          );
        }
      }
      if (backup.hymns && backup.hymns.length > 0) {
        await pool.query('TRUNCATE hymns CASCADE');
        for (const h of backup.hymns) {
          await pool.query(
            'INSERT INTO hymns (id, hymn_number, title, lyrics, chorus, category, language) VALUES ($1, $2, $3, $4, $5, $6)',
            [h.id, h.hymn_number || h.hymnNumber, h.title, h.lyrics, h.chorus || null, h.category, h.language || 'English']
          );
        }
      }
      if (backup.announcements) {
        await pool.query('TRUNCATE announcements CASCADE');
        for (const a of backup.announcements) {
          await pool.query(
            'INSERT INTO announcements (id, title, body, date, priority, expiry_date, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [a.id, a.title, a.body, a.date || null, a.priority || 'MEDIUM', a.expiry_date || a.expiryDate || null, a.status || 'PUBLISHED']
          );
        }
      }
      if (backup.citations) {
        await pool.query('TRUNCATE citations CASCADE');
        for (const c of backup.citations) {
          await pool.query(
            'INSERT INTO citations (id, book, chapter, verse, display_text, notes) VALUES ($1, $2, $3, $4, $5, $6)',
            [c.id, c.book, c.chapter, c.verse, c.display_text || c.displayText, c.notes || null]
          );
        }
      }
      if (backup.custom_messages) {
        await pool.query('TRUNCATE custom_messages CASCADE');
        for (const m of backup.custom_messages) {
          await pool.query(
            'INSERT INTO custom_messages (id, type, title, body) VALUES ($1, $2, $3, $4)',
            [m.id, m.type, m.title, m.body]
          );
        }
      }
      if (backup.settings) {
        await pool.query('TRUNCATE settings CASCADE');
        for (const key of Object.keys(backup.settings)) {
          const val = backup.settings[key];
          await pool.query(
            'INSERT INTO settings (key, value) VALUES ($1, $2)',
            [key, typeof val === 'string' ? val : JSON.stringify(val)]
          );
        }
      }
      if (backup.current_display) {
        const cd = backup.current_display;
        await pool.query(
          `INSERT INTO current_displays (id, display_type, record_id, status) VALUES (1, $1, $2, $3)
           ON CONFLICT (id) DO UPDATE SET display_type = $1, record_id = $2, status = $3`,
          [cd.displayType || cd.display_type, cd.recordId || cd.record_id, cd.status || 'PUBLISHED']
        );
      }
      await pool.query('COMMIT');
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }
  } else {
    // Validate backup format
    if (!backup.users || !backup.hymns || !backup.settings) {
      throw new Error('Invalid backup file format');
    }
    
    // Safe restore
    const original = readLocalJson();
    try {
      const merged = {
        users: backup.users,
        hymns: backup.hymns,
        announcements: backup.announcements || [],
        citations: backup.citations || [],
        custom_messages: backup.custom_messages || [],
        current_display: backup.current_display || original.current_display,
        settings: backup.settings,
        activity_logs: [
          {
            id: Date.now(),
            action: 'RESTORE',
            username: 'ADMIN',
            details: 'System restored from backup file successfully',
            timestamp: new Date().toISOString()
          },
          ...(original.activity_logs || [])
        ].slice(0, 100),
        display_histories: backup.display_histories || []
      };
      writeLocalJson(merged);
    } catch (err) {
      writeLocalJson(original); // Rollback
      throw err;
    }
  }
}

// ==========================================
// DASHBOARD STATS
// ==========================================

export async function getDashboardStats(): Promise<any> {
  if (isPostgres && pool) {
    const hymnsCount = await pool.query('SELECT COUNT(*) FROM hymns');
    const annCount = await pool.query('SELECT COUNT(*) FROM announcements');
    const citCount = await pool.query('SELECT COUNT(*) FROM citations');
    const msgCount = await pool.query('SELECT COUNT(*) FROM custom_messages');
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    const recentDisplay = await pool.query('SELECT * FROM display_histories ORDER BY displayed_at DESC LIMIT 5');
    const logs = await pool.query('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 5');

    return {
      totalHymns: parseInt(hymnsCount.rows[0].count),
      totalAnnouncements: parseInt(annCount.rows[0].count),
      totalCitations: parseInt(citCount.rows[0].count),
      totalMessages: parseInt(msgCount.rows[0].count),
      totalUsers: parseInt(userCount.rows[0].count),
      recentDisplay: recentDisplay.rows.map(r => ({
        id: r.id,
        displayType: r.display_type,
        recordId: r.record_id,
        title: r.title,
        displayedAt: r.displayed_at.toISOString()
      })),
      recentLogs: logs.rows.map(r => ({
        id: r.id,
        username: r.username,
        action: r.action,
        details: r.details,
        timestamp: r.timestamp.toISOString()
      }))
    };
  } else {
    const data = readLocalJson();
    return {
      totalHymns: data.hymns.length,
      totalAnnouncements: data.announcements.length,
      totalCitations: data.citations.length,
      totalMessages: data.custom_messages.length,
      totalUsers: data.users.length,
      recentDisplay: (data.display_histories || []).slice(0, 5),
      recentLogs: (data.activity_logs || []).slice(0, 5)
    };
  }
}

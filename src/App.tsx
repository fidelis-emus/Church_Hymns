import React, { useEffect, useState } from 'react';
import { 
  Church, LayoutDashboard, Music, Megaphone, BookOpen, MessageSquare, 
  Settings, Users, Shield, Database, Tv, LogOut, Menu, X, User, Lock, ArrowUpRight,
  QrCode, Printer, Download, Copy, Check
} from 'lucide-react';

import PublicDisplay from './components/PublicDisplay.tsx';
import DashboardHome from './components/DashboardHome.tsx';
import CurrentDisplayQueue from './components/CurrentDisplayQueue.tsx';
import HymnManager from './components/HymnManager.tsx';
import AnnouncementManager from './components/AnnouncementManager.tsx';
import CitationManager from './components/CitationManager.tsx';
import MessageManager from './components/MessageManager.tsx';
import SettingsBranding from './components/SettingsBranding.tsx';
import UserManager from './components/UserManager.tsx';
import ActivityLogViewer from './components/ActivityLogViewer.tsx';
import BackupRestoreManager from './components/BackupRestoreManager.tsx';

import { CurrentDisplay, ChurchSettings, UserRole } from './types.ts';

export default function App() {
  const [isPublicScreen, setIsPublicScreen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [settings, setSettings] = useState<ChurchSettings | null>(null);
  const [currentDisplay, setCurrentDisplay] = useState<CurrentDisplay | null>(null);

  // Nav tab state
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Login form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // 1. Detect if the viewport is the public Display Target
  useEffect(() => {
    if (window.location.pathname === '/display') {
      setIsPublicScreen(true);
    } else {
      setIsPublicScreen(false);
    }
  }, []);

  // 2. Hydrate token and fetch branding settings
  useEffect(() => {
    const savedToken = localStorage.getItem('pulpit_admin_token');
    if (savedToken) {
      setToken(savedToken);
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${savedToken}` }
      })
        .then(res => {
          if (!res.ok) {
            localStorage.removeItem('pulpit_admin_token');
            setToken(null);
            throw new Error('Session expired');
          }
          return res.json();
        })
        .then(user => setCurrentUser(user))
        .catch(() => {});
    }

    // Load general branding configurations
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(err => console.error('Failed to load branding configurations:', err));
  }, []);

  // 3. Connect Admin screen to the real-time SSE stream
  // This keeps the live active displays and badge listings synchronised in real-time
  useEffect(() => {
    let eventSource: EventSource | null = null;

    if (!isPublicScreen) {
      eventSource = new EventSource('/api/display/stream');
      eventSource.onmessage = (event) => {
        try {
          const latestDisplay = JSON.parse(event.data);
          setCurrentDisplay(latestDisplay);
        } catch (err) {
          console.error('SSE parsed data error inside workspace:', err);
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        setTimeout(() => {
          if (!isPublicScreen) {
            // reconnect
            eventSource = new EventSource('/api/display/stream');
          }
        }, 5000);
      };
    }

    return () => {
      eventSource?.close();
    };
  }, [isPublicScreen]);

  // Handle Login submission
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setLoginError('Please fill out all login credentials.');
      return;
    }

    setLoggingIn(true);
    setLoginError(null);

    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login authorization failed.');
        return data;
      })
      .then(data => {
        localStorage.setItem('pulpit_admin_token', data.token);
        setToken(data.token);
        setCurrentUser(data.user);
        setLoggingIn(false);
      })
      .catch(err => {
        setLoginError(err.message);
        setLoggingIn(false);
      });
  };

  // Handle Log Out
  const handleLogout = () => {
    localStorage.removeItem('pulpit_admin_token');
    setToken(null);
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  // Route Rendering
  if (isPublicScreen) {
    return <PublicDisplay />;
  }

  // RENDER ADMIN PORTAL AUTHENTICATION GATE
  if (!token) {
    return (
      <div className="min-h-screen bg-organic-bg text-organic-dark flex flex-col items-center justify-center p-4" id="admin-login-page">
        
        {/* BRANDING LOGO & HEADER */}
        <div className="text-center mb-8">
          {settings?.logoUrl ? (
            <img 
              src={settings.logoUrl} 
              alt="Church Crest" 
              className="h-16 w-auto object-contain mx-auto mb-4" 
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-14 h-14 bg-organic-olive rounded-full flex items-center justify-center text-white mx-auto shadow-md mb-4">
              <Church className="w-8 h-8" />
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-serif italic text-organic-dark tracking-tight">
            {settings?.churchName || 'Church QR Hymn Display System'}
          </h1>
          <p className="text-xs text-organic-olive/70 font-bold mt-1 uppercase tracking-wider font-mono">
            Staff pulpit portal login
          </p>
        </div>

        {/* LOGIN CONTAINER CARD */}
        <div className="bg-white border border-organic-border rounded-3xl p-6 sm:p-8 shadow-xl w-full max-w-md space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-serif italic text-organic-dark">Welcome back</h2>
            <p className="text-xs text-organic-olive/60">Authenticate to broadcast hymns and manage settings.</p>
          </div>

          {loginError && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-bold leading-relaxed">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Username</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter admin username"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition font-bold text-slate-700"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loggingIn}
              className="w-full py-3 bg-organic-olive hover:bg-organic-dark disabled:opacity-50 text-white rounded-xl text-sm font-extrabold shadow-md flex items-center justify-center gap-2 transition"
            >
              {loggingIn && <Church className="w-4 h-4 animate-spin" />}
              <span>{loggingIn ? 'Authenticating...' : 'Sign In to Pulpit'}</span>
            </button>
          </form>

          {/* QUICK DEMO ASSISTANCE (HUMBLE AND HELPFUL) */}
          <div className="border-t border-organic-border pt-4 text-center">
            <p className="text-[11px] text-organic-olive/60 font-medium leading-relaxed">
              Default system deployment seed accounts:<br />
              <span className="font-mono bg-organic-bg px-1 py-0.5 rounded text-organic-olive/80">admin / admin123</span> or <span className="font-mono bg-organic-bg px-1 py-0.5 rounded text-organic-olive/80">superadmin / super123</span>
            </p>
          </div>
        </div>

        {/* EXTERNAL VIEW BUTTON FOR SCAN PREVIEW */}
        <a 
          href="/display" 
          target="_blank"
          className="mt-6 text-xs font-bold text-organic-olive hover:text-organic-dark transition flex items-center gap-1 bg-white border border-organic-border rounded-full px-4 py-2 shadow-sm"
        >
          <span>Open Public Display (Members' View)</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </a>
      </div>
    );
  }

  // SIDEBAR SECTIONS
  const menuItems = [
    { id: 'dashboard', label: 'Pulpit Overview', icon: LayoutDashboard },
    { id: 'current', label: 'Live Broadcast', icon: Tv, highlight: true },
    { id: 'hymns', label: 'Hymnal Base', icon: Music },
    { id: 'announcements', label: 'Bulletins & Notices', icon: Megaphone },
    { id: 'citations', label: 'Preach Scriptures', icon: BookOpen },
    { id: 'messages', label: 'Liturgy Slide Cards', icon: MessageSquare },
    { id: 'settings', label: 'Identity & Theme', icon: Settings },
    { id: 'users', label: 'Security Accounts', icon: Users, roleRequired: UserRole.SUPER_ADMIN },
    { id: 'logs', label: 'Security Audit Trail', icon: Shield },
    { id: 'backup', label: 'Recovery & Backups', icon: Database, roleRequired: UserRole.SUPER_ADMIN },
  ];

  const handleDisplayChange = () => {
    // This triggers a local refresh when displays are updated
  };

  return (
    <div className="min-h-screen bg-organic-bg text-organic-dark flex flex-col font-sans" id="admin-workspace-layout">
      
      {/* GLOBAL WORKSPACE HEADER */}
      <header className="h-16 bg-white border-b border-organic-border px-6 flex items-center justify-between sticky top-0 z-[60] shadow-sm">
        
        {/* LOGO AND BRANDING */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-organic-dark/60 hover:bg-organic-bg rounded-lg lg:hidden"
            title="Toggle Sidebar"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {settings?.logoUrl ? (
            <img 
              src={settings.logoUrl} 
              alt="Crest" 
              className="h-9 w-auto object-contain max-w-[120px]" 
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-organic-olive flex items-center justify-center text-white font-black text-sm">
              <Church className="w-4 h-4" />
            </div>
          )}
          <div>
            <h1 className="font-serif italic text-organic-dark text-sm sm:text-base leading-tight">
              {settings?.churchName || 'Church QR Hymn Display System'}
            </h1>
            <p className="text-[10px] text-organic-olive/60 uppercase tracking-widest font-mono hidden sm:block">
              Pulpit Broadcasting Console
            </p>
          </div>
        </div>

        {/* ACTIVE DISPLAY INDICATOR */}
        <div className="hidden md:flex items-center gap-2 bg-organic-dark text-white rounded-full px-3 py-1 text-xs border border-white/10 max-w-xs shrink">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
          <span className="font-bold uppercase text-[9px] text-emerald-400 shrink-0 font-mono">LIVE:</span>
          <span className="truncate font-semibold text-white/90">
            {currentDisplay?.displayType === 'WELCOME_SLIDE' ? 'Welcome & Prep Card' : (currentDisplay?.title || 'Inactive')}
          </span>
        </div>

        {/* CURRENT ADMIN CARD & QUICK QR LINK */}
        <div className="flex items-center gap-3">
          
          <button
            onClick={() => setQrModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-organic-olive hover:bg-organic-dark text-white rounded-xl text-xs font-bold shadow-sm transition-colors duration-150"
            title="Show Member QR Code"
          >
            <QrCode className="w-4 h-4" />
            <span className="hidden sm:inline">Member QR Code</span>
          </button>

          <div className="flex items-center gap-2 bg-organic-bg border border-organic-border rounded-xl px-3 py-1.5">
            <div className="w-6 h-6 rounded-full bg-organic-olive flex items-center justify-center text-xs font-bold text-white">
              {currentUser?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-extrabold text-organic-dark leading-none">{currentUser?.username}</p>
              <p className="text-[9px] text-organic-olive/60 uppercase font-mono mt-0.5">{currentUser?.role}</p>
            </div>
          </div>

          <button 
            onClick={handleLogout}
            className="p-2 border border-organic-border hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 rounded-xl text-organic-dark/40 transition"
            title="Log Out Session"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

      </header>

      {/* CORE CONTENT LAYOUT */}
      <div className="flex-grow flex relative">
        
        {/* SIDEBAR NAVIGATION */}
        <aside className={`w-64 bg-organic-dark text-white p-4 space-y-1 shrink-0 flex flex-col justify-between fixed lg:static top-16 bottom-0 left-0 transition-transform duration-300 z-50 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}>
          
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-3 mb-2 font-mono">Main Operations</p>
            
            {menuItems.map((item) => {
              // Role check
              if (item.roleRequired && currentUser?.role !== item.roleRequired) {
                return null;
              }

              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                    isActive 
                      ? 'bg-organic-olive text-white shadow-md border-r-4 border-white' 
                      : item.highlight 
                      ? 'bg-white/10 hover:bg-white/20 text-white/90 border border-white/5'
                      : 'text-white/70 hover:bg-[#3E4D4D] hover:text-white'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-white/50 group-hover:text-white'}`} />
                  <span className="truncate">{item.label}</span>
                  {item.id === 'current' && (
                    <span className={`ml-auto w-2 h-2 rounded-full ${isActive ? 'bg-white' : 'bg-emerald-500 animate-pulse'}`}></span>
                  )}
                </button>
              );
            })}
          </div>

          {/* SIDEBAR FOOTER (Branding placeholder) */}
          <div className="p-3 bg-[#3E4D4D] border border-white/5 rounded-2xl text-center space-y-1 mt-6">
            <span className="text-[9px] uppercase font-black text-white/40 font-mono tracking-widest block">System Release</span>
            <p className="text-[11px] font-bold text-white">Pulpit QR v3.2.0</p>
            <p className="text-[9px] text-white/60 font-semibold">PostgreSQL & React Live</p>
          </div>

        </aside>

        {/* MOBILE OVERLAY BACKGROUND */}
        {mobileMenuOpen && (
          <div 
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          ></div>
        )}

        {/* MAIN DISPLAY PORTAL WORKSPACE */}
        <main className="flex-grow p-4 sm:p-8 max-w-7xl mx-auto w-full overflow-x-hidden min-h-[calc(100vh-4rem)]">
          
          {activeTab === 'dashboard' && (
            <DashboardHome 
              token={token} 
              onNavigate={(tab) => setActiveTab(tab)} 
            />
          )}

          {activeTab === 'current' && (
            <CurrentDisplayQueue 
              token={token}
              display={currentDisplay}
              onDisplayChange={handleDisplayChange}
            />
          )}

          {activeTab === 'hymns' && (
            <HymnManager 
              token={token}
              currentDisplayId={currentDisplay?.displayType === 'HYMN' ? currentDisplay.recordId : undefined}
              onDisplayChange={handleDisplayChange}
            />
          )}

          {activeTab === 'announcements' && (
            <AnnouncementManager 
              token={token}
              currentDisplayId={currentDisplay?.displayType === 'ANNOUNCEMENT' ? currentDisplay.recordId : undefined}
              onDisplayChange={handleDisplayChange}
            />
          )}

          {activeTab === 'citations' && (
            <CitationManager 
              token={token}
              currentDisplayId={currentDisplay?.displayType === 'CITATION' ? currentDisplay.recordId : undefined}
              onDisplayChange={handleDisplayChange}
            />
          )}

          {activeTab === 'messages' && (
            <MessageManager 
              token={token}
              currentDisplayId={currentDisplay?.displayType === 'MESSAGE' ? currentDisplay.recordId : undefined}
              onDisplayChange={handleDisplayChange}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsBranding 
              token={token}
              onSettingsSaved={(newSettings) => setSettings(newSettings)}
            />
          )}

          {activeTab === 'users' && (
            <UserManager 
              token={token}
              currentAdminUsername={currentUser?.username}
            />
          )}

          {activeTab === 'logs' && (
            <ActivityLogViewer 
              token={token}
            />
          )}

          {activeTab === 'backup' && (
            <BackupRestoreManager 
              token={token}
            />
          )}

        </main>

      </div>

      {/* MEMBER ACCESS QR CODE MODAL (WARM ORGANIC THEME) */}
      {qrModalOpen && (
        <div className="fixed inset-0 bg-organic-dark/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in" id="member-qr-modal">
          <div className="bg-white border border-organic-border rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="bg-organic-dark text-white px-6 py-4 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-organic-olive" />
                <h3 className="font-serif italic text-lg font-medium text-white">Member Access Point</h3>
              </div>
              <button 
                onClick={() => setQrModalOpen(false)}
                className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 text-center space-y-6">
              <div>
                <h4 className="font-serif italic text-2xl text-organic-dark">
                  {settings?.churchName || 'Grace Community Church'}
                </h4>
                <p className="text-xs text-organic-olive/80 mt-1">
                  Active Display & Broadcast Portal QR Code
                </p>
              </div>

              {/* QR Image Frame */}
              <div className="bg-organic-bg border border-organic-border p-6 rounded-2xl inline-block shadow-inner relative group mx-auto">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`${window.location.origin}/display`)}`}
                  alt="Member Access QR Code"
                  className="w-48 h-48 mx-auto bg-white p-1 rounded-xl shadow-sm"
                  referrerPolicy="no-referrer"
                />
                <span className="absolute -top-2.5 -right-2.5 bg-organic-olive text-white text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow">
                  Worship QR
                </span>
              </div>

              <p className="text-xs text-organic-olive/70 max-w-sm mx-auto font-serif italic">
                Members scan this QR code once with their mobile cameras. The screen will instantly display current hymns, bible verses, or announcements as you push them from this console in real-time. No sign-up required.
              </p>

              {/* URL Display Area */}
              <div className="bg-organic-bg border border-organic-border rounded-xl px-3 py-2.5 flex items-center justify-between text-left">
                <div className="truncate text-xs font-mono text-organic-olive/80 mr-2 max-w-[280px]">
                  {`${window.location.origin}/display`}
                </div>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/display`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="p-1.5 hover:bg-organic-border text-organic-dark/60 hover:text-organic-dark rounded transition shrink-0"
                  title="Copy Display Link"
                >
                  {copied ? <Check className="w-4.5 h-4.5 text-emerald-600" /> : <Copy className="w-4.5 h-4.5" />}
                </button>
              </div>

              {/* Quick Actions Grid */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => {
                    const displayUrl = `${window.location.origin}/display`;
                    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(displayUrl)}`;
                    const printWindow = window.open('', '_blank');
                    if (!printWindow) return;
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>Print Church QR Hymn Display</title>
                          <style>
                            body { font-family: 'Inter', sans-serif; text-align: center; padding: 50px; color: #2D3A3A; background-color: #F5F5F0; }
                            .card { max-width: 500px; margin: 0 auto; border: 3px solid #E6E6E1; padding: 40px; border-radius: 24px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); background: white; }
                            h1 { font-size: 28px; font-weight: 800; font-family: "Playfair Display", Georgia, serif; font-style: italic; margin-bottom: 5px; color: #5A5A40; }
                            h2 { font-size: 16px; font-weight: 500; color: #2D3A3A; margin-top: 0; margin-bottom: 30px; text-transform: uppercase; letter-spacing: 0.1em; }
                            img { width: 280px; height: 280px; margin-bottom: 30px; border: 1px solid #E6E6E1; padding: 10px; border-radius: 12px; }
                            p { font-size: 14px; font-weight: 600; color: #5A5A40; margin-bottom: 5px; font-style: italic; }
                            span { font-size: 12px; font-family: monospace; color: #8E9299; }
                          </style>
                        </head>
                        <body>
                          <div class="card">
                            <h1>${settings?.churchName || 'Our Church'}</h1>
                            <h2>Hymnal & Scripture QR Display</h2>
                            <img src="${qrCodeUrl}" />
                            <p>Scan to see live hymns, announcements, & scriptures instantly</p>
                            <span>URL: ${displayUrl}</span>
                          </div>
                          <script>
                            window.onload = function() { window.print(); window.close(); }
                          </script>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }}
                  className="py-2.5 px-3 border border-organic-border hover:bg-organic-bg text-organic-dark text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-4 h-4 text-organic-olive" />
                  Print flyer
                </button>
                <a
                  href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(`${window.location.origin}/display`)}`}
                  download="church_hymnal_qr_code.png"
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-3 bg-organic-dark hover:bg-organic-olive text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  Get PNG image
                </a>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-organic-bg border-t border-organic-border px-6 py-4 flex justify-end">
              <button
                onClick={() => setQrModalOpen(false)}
                className="px-5 py-2 bg-organic-olive text-white rounded-xl text-xs font-bold shadow-sm hover:bg-organic-dark transition"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

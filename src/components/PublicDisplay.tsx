import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, AlertCircle, FileText, Compass, Church, RotateCw } from 'lucide-react';
import { CurrentDisplay, ChurchSettings } from '../types.ts';

export default function PublicDisplay() {
  const [display, setDisplay] = useState<CurrentDisplay | null>(null);
  const [settings, setSettings] = useState<ChurchSettings | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch settings on load
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(err => {
        console.error('Failed to load branding settings:', err);
        setError('Failed to connect to the church network. Retrying...');
      });
  }, []);

  // Connect to SSE stream for live updates
  useEffect(() => {
    let eventSource: EventSource | null = null;

    function connectSSE() {
      eventSource = new EventSource('/api/display/stream');

      eventSource.onopen = () => {
        setConnected(true);
        setError(null);
      };

      eventSource.onmessage = (event) => {
        try {
          const latestDisplay = JSON.parse(event.data);
          setDisplay(latestDisplay);
        } catch (err) {
          console.error('SSE JSON parse error:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE connection error:', err);
        setConnected(false);
        setError('Connection lost. Attempting to reconnect...');
        eventSource?.close();
        setTimeout(connectSSE, 3000); // retry
      };
    }

    connectSSE();

    return () => {
      eventSource?.close();
    };
  }, []);

  if (!settings) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] text-[#2D3A3A] flex flex-col items-center justify-center p-6">
        <Church className="w-12 h-12 text-[#5A5A40] animate-pulse mb-4" />
        <p className="text-[#5A5A40] font-serif italic">Preparing Worship Display...</p>
      </div>
    );
  }

  // Map font styles
  const fontClass = 
    settings.fontFamily === 'serif' ? 'font-serif' :
    settings.fontFamily === 'mono' ? 'font-mono' : 'font-sans';

  // Map font sizes
  const fontSizeClass = 
    settings.fontSize === 'small' ? 'text-base md:text-lg' :
    settings.fontSize === 'large' ? 'text-xl md:text-2xl' :
    settings.fontSize === 'xlarge' ? 'text-2xl md:text-3xl' : 'text-lg md:text-xl';

  const headingSizeClass = 
    settings.fontSize === 'small' ? 'text-2xl sm:text-3xl' :
    settings.fontSize === 'large' ? 'text-4xl sm:text-5xl' :
    settings.fontSize === 'xlarge' ? 'text-5xl sm:text-6xl' : 'text-3xl sm:text-4xl';

  // Dynamic style object with warm organic fallbacks
  const rootStyle = {
    backgroundColor: settings.backgroundColor || '#F5F5F0',
    color: settings.textColor || '#2D3A3A',
  };

  const primaryBtnColor = {
    backgroundColor: settings.primaryColor || '#5A5A40',
  };

  return (
    <div 
      className={`min-h-screen flex flex-col justify-between transition-colors duration-500 ${fontClass}`} 
      style={rootStyle}
      id="public-display-root"
    >
      {/* HEADER BAR */}
      <header className="border-b border-[#E6E6E1]/80 backdrop-blur-sm sticky top-0 z-50 py-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm bg-white/95">
        <div className="flex items-center gap-3">
          {settings.logoUrl ? (
            <img 
              src={settings.logoUrl} 
              alt="Church Logo" 
              className="h-10 w-auto object-contain max-w-[150px]" 
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-serif italic text-lg" style={primaryBtnColor}>
              {settings.churchName ? settings.churchName.charAt(0) : 'C'}
            </div>
          )}
          <div>
            <h1 className="font-serif italic text-[#2D3A3A] text-base sm:text-lg leading-tight">
              {settings.churchName}
            </h1>
            <p className="text-[10px] text-[#5A5A40]/80 uppercase tracking-widest font-mono hidden sm:block">
              {settings.headerText || 'Sanctuary Worship Display'}
            </p>
          </div>
        </div>

        {/* CONNECTION STATUS BADGE */}
        <div className="flex items-center gap-2">
          {error && (
            <div className="text-xs font-semibold text-rose-600 bg-rose-50 px-3 py-1 rounded-full flex items-center gap-1.5 animate-bounce border border-rose-100">
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
              <span>{error}</span>
            </div>
          )}
          {!error && (
            <div className={`text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5 ${
              connected ? 'bg-[#5A5A40]/10 text-[#5A5A40] border border-[#5A5A40]/20' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-[#5A5A40] animate-pulse' : 'bg-amber-500'}`}></span>
              <span>{connected ? 'Live Sync Active' : 'Connecting...'}</span>
            </div>
          )}
        </div>
      </header>

      {/* MAIN DISPLAY VIEWPORT */}
      <main className="flex-grow flex items-center justify-center p-4 sm:p-8 max-w-4xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {!display ? (
            <motion.div 
              key="loader"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center py-12 px-6"
            >
              <Compass className="w-16 h-16 mx-auto mb-4 animate-spin text-[#5A5A40]/30" />
              <h2 className="text-xl font-serif italic text-[#2D3A3A] mb-2">Connecting to Pulpit</h2>
              <p className="text-[#5A5A40]/70 text-sm">Waiting for display items to be broadcasted by the pulpit...</p>
            </motion.div>
          ) : (
            <motion.div
              key={`${display.displayType}-${display.recordId}-${display.lastUpdated}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="w-full py-4 animate-fade-in"
            >
              {/* HYMN DISPLAY */}
              {display.displayType === 'HYMN' && display.data && (
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#5A5A40]/10 text-[#5A5A40] rounded-full text-xs font-semibold mb-4 border border-[#E6E6E1]">
                    <FileText className="w-3.5 h-3.5" />
                    <span className="font-mono">Hymn {display.data.hymnNumber} ({display.data.category})</span>
                  </div>
                  
                  <h2 className={`font-serif italic font-normal tracking-tight mb-8 ${headingSizeClass}`} style={{ color: settings.primaryColor || '#2D3A3A' }}>
                    {display.data.title}
                  </h2>
                  
                  <div className={`space-y-6 leading-relaxed whitespace-pre-line font-serif italic ${fontSizeClass}`} style={{ color: settings.textColor || '#2D3A3A' }}>
                    {/* Render lyrics structured nicely */}
                    {display.data.lyrics.split('\n\n').map((paragraph: string, idx: number) => {
                      const isVerse = paragraph.toLowerCase().startsWith('verse');
                      return (
                        <div 
                          key={idx} 
                          className={`p-4 sm:p-6 rounded-2xl transition-all ${
                            isVerse 
                              ? 'bg-white/50 border border-[#E6E6E1]/50 shadow-sm' 
                              : 'bg-transparent border-none'
                          }`}
                        >
                          {paragraph}
                        </div>
                      );
                    })}
                  </div>

                  {display.data.chorus && (
                    <div className="mt-8 p-6 bg-white border-l-4 border-[#5A5A40] rounded-r-2xl text-left max-w-2xl mx-auto shadow-sm border border-[#E6E6E1]/30">
                      <p className="text-[10px] uppercase tracking-widest font-mono font-bold text-[#5A5A40] mb-2">Chorus</p>
                      <p className={`font-serif italic leading-relaxed text-[#2D3A3A] ${fontSizeClass}`}>
                        {display.data.chorus}
                      </p>
                    </div>
                  )}
                  
                  {display.data.language && display.data.language !== 'English' && (
                    <p className="text-xs text-[#5A5A40]/50 mt-6 font-mono">Language: {display.data.language}</p>
                  )}
                </div>
              )}

              {/* ANNOUNCEMENT DISPLAY */}
              {display.displayType === 'ANNOUNCEMENT' && display.data && (
                <div className="max-w-2xl mx-auto bg-white border border-[#E6E6E1] shadow-md rounded-3xl overflow-hidden">
                  <div className={`p-2 text-center text-white text-[11px] font-bold tracking-widest uppercase flex items-center justify-center gap-1.5 ${
                    display.data.priority === 'HIGH' ? 'bg-[#8C6B4F]' :
                    display.data.priority === 'MEDIUM' ? 'bg-[#5A5A40]' : 'bg-[#2D3A3A]'
                  }`}>
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{display.data.priority} Priority Announcement</span>
                  </div>
                  
                  <div className="p-8 sm:p-10">
                    <span className="text-[10px] text-[#5A5A40]/70 font-bold block mb-2 font-mono uppercase tracking-widest">
                      {display.data.date || 'Today\'s Announcement'}
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-serif italic text-[#2D3A3A] mb-6 border-b pb-4 border-[#E6E6E1] leading-tight">
                      {display.data.title}
                    </h2>
                    
                    <div className="text-[#2D3A3A]/90 space-y-4 leading-relaxed whitespace-pre-line text-lg font-medium">
                      {display.data.body}
                    </div>

                    {display.data.expiryDate && (
                      <div className="mt-8 pt-4 border-t border-[#E6E6E1] text-[10px] text-[#5A5A40]/50 font-mono">
                        Valid until: {display.data.expiryDate}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* BIBLE CITATION DISPLAY */}
              {display.displayType === 'CITATION' && display.data && (
                <div className="text-center max-w-2xl mx-auto p-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#5A5A40]/10 text-[#5A5A40] rounded-full text-xs font-bold mb-6 border border-[#E6E6E1]">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span className="font-mono text-[10px] uppercase tracking-wider">Scripture Reading</span>
                  </div>

                  <blockquote className="relative p-6 sm:p-10 bg-white rounded-3xl border-l-8 border-[#5A5A40] shadow-sm text-left border border-y border-r border-[#E6E6E1]">
                    <span className="text-7xl font-serif text-[#5A5A40]/10 absolute -top-5 left-2 pointer-events-none">“</span>
                    <p className={`font-serif italic leading-relaxed text-[#2D3A3A] relative z-10 ${fontSizeClass}`}>
                      {display.data.displayText}
                    </p>
                    <cite className="block mt-6 text-right not-italic">
                      <span className="font-serif italic text-[#5A5A40] text-xl block">
                        {display.data.book} {display.data.chapter}:{display.data.verse}
                      </span>
                    </cite>
                  </blockquote>

                  {display.data.notes && (
                    <div className="mt-6 p-4 bg-white/50 border border-[#E6E6E1] rounded-2xl text-left text-sm text-[#2D3A3A]/80 leading-relaxed font-serif italic">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-[#5A5A40] mb-1">Preacher's Notes</p>
                      {display.data.notes}
                    </div>
                  )}
                </div>
              )}

              {/* CUSTOM MESSAGE DISPLAY */}
              {display.displayType === 'MESSAGE' && display.data && (
                <div className="text-center max-w-2xl mx-auto">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#2D3A3A]/10 text-[#2D3A3A] rounded-full text-xs font-bold mb-6 border border-[#E6E6E1]">
                    <FileText className="w-3.5 h-3.5" />
                    <span className="font-mono text-[10px] uppercase tracking-wider">{display.data.type}</span>
                  </div>

                  <h2 className="text-3xl sm:text-4xl font-serif italic text-[#2D3A3A] mb-8 tracking-tight">
                    {display.data.title}
                  </h2>

                  <div className={`leading-relaxed whitespace-pre-line text-[#2D3A3A]/90 font-serif italic ${fontSizeClass}`}>
                    {display.data.body}
                  </div>
                </div>
              )}

              {/* DEFAULT WELCOME SLIDE */}
              {display.displayType === 'WELCOME_SLIDE' && (
                <div className="text-center max-w-2xl mx-auto py-8">
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                    className="inline-block mb-6"
                  >
                    {settings.logoUrl ? (
                      <img 
                        src={settings.logoUrl} 
                        alt="Church Logo" 
                        className="h-28 w-auto object-contain mx-auto max-w-[200px]" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full flex items-center justify-center text-white mx-auto shadow-md" style={primaryBtnColor}>
                        <Church className="w-10 h-10" />
                      </div>
                    )}
                  </motion.div>

                  <h2 className="text-3xl sm:text-5xl font-serif italic tracking-tight mb-4 text-[#2D3A3A]">
                    {settings.churchName}
                  </h2>
                  <p className="text-lg sm:text-xl text-[#5A5A40] font-serif italic max-w-lg mx-auto leading-relaxed mb-8">
                    {settings.headerText || 'We are glad to have you join our service today. Prepare your heart for worship.'}
                  </p>

                  <div className="inline-block bg-white border border-[#E6E6E1] rounded-2xl p-5 shadow-sm max-w-md">
                    <p className="text-[10px] text-[#5A5A40] font-mono font-bold uppercase tracking-widest mb-2">Pulpit QR System</p>
                    <p className="text-xs text-[#2D3A3A]/80 font-serif italic leading-relaxed">
                      Please keep this screen open on your device. Hymns, scriptures, and announcements will be displayed here automatically in real-time as they are called by the preacher.
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* FOOTER BAR */}
      <footer className="border-t border-[#E6E6E1] bg-white py-6 px-6 text-center text-[#5A5A40]/80 text-xs sm:text-sm">
        <div className="max-w-4xl mx-auto space-y-3">
          <p className="font-serif italic text-[#2D3A3A] text-base mb-1">
            {settings.footerBibleVerse}
          </p>
          <p className="font-serif italic text-[#5A5A40] text-sm">
            {settings.footerText}
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-[#5A5A40]/70 border-t border-[#E6E6E1]/50 pt-3 mt-3">
            {settings.footerAddress && <span>📍 {settings.footerAddress}</span>}
            {settings.footerPhone && <span>📞 {settings.footerPhone}</span>}
            {settings.footerEmail && <span>✉️ {settings.footerEmail}</span>}
          </div>

          <p className="text-[10px] text-[#5A5A40]/40 pt-1 font-mono uppercase tracking-wider">
            {settings.footerCopyright}
          </p>
        </div>
      </footer>
    </div>
  );
}

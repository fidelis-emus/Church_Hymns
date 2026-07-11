import { useEffect, useState } from 'react';
import { 
  Tv, RotateCcw, Clock, RotateCw, Trash2, Compass, AlertCircle, PlayCircle,
  QrCode, Printer, Download, Copy, Check
} from 'lucide-react';
import { CurrentDisplay } from '../types.ts';

export default function CurrentDisplayQueue({ 
  token,
  display,
  onDisplayChange
}: { 
  token: string;
  display: CurrentDisplay | null;
  onDisplayChange: () => void;
}) {
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [copied, setCopied] = useState(false);

  const displayUrl = `${window.location.origin}/display`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(displayUrl)}`;

  useEffect(() => {
    fetchHistory();
  }, [display]);

  const fetchHistory = () => {
    setLoadingHistory(true);
    fetch('/api/display/history', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setHistory(data || []);
        setLoadingHistory(false);
      })
      .catch(err => {
        console.error(err);
        setLoadingHistory(false);
      });
  };

  const handleResetToWelcome = () => {
    fetch('/api/display/welcome', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Reset failed');
        onDisplayChange();
      })
      .catch(err => alert(err.message));
  };

  const handleReproject = (type: string, id: number) => {
    const routeMap: { [key: string]: string } = {
      'HYMN': `/api/display/hymn/${id}`,
      'ANNOUNCEMENT': `/api/display/announcement/${id}`,
      'CITATION': `/api/display/citation/${id}`,
      'MESSAGE': `/api/display/message/${id}`,
    };

    const route = routeMap[type];
    if (!route) return;

    fetch(route, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Projection failed');
        onDisplayChange();
      })
      .catch(err => alert(err.message));
  };

  const handlePrintQR = () => {
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
            <h1>Hymn & Activity Display</h1>
            <h2>Worship Portal Access</h2>
            <img src="${qrCodeUrl}" />
            <p>Scan with your mobile camera to see live lyrics & verses instantly</p>
            <span>URL: ${displayUrl}</span>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-8 animate-fade-in" id="current-display-queue-view">
      {/* HEADER */}
      <div>
        <h2 className="text-3xl font-serif italic text-organic-dark tracking-tight flex items-center gap-2">
          <Tv className="w-8 h-8 text-organic-olive" />
          Live Broadcast Console
        </h2>
        <p className="text-organic-olive/70 text-sm mt-1">Monitor active projections and manage the church display broadcast flow.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* ACTIVE DISPLAY SLIDE */}
        <div className="lg:col-span-2 bg-organic-dark text-white rounded-3xl p-6 shadow-xl border border-white/5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <span className="text-xs uppercase font-extrabold tracking-wider text-emerald-400 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Broadcasting Live to Mobile
              </span>
              <span className="text-xs font-mono text-white/50">
                {display?.lastUpdated ? new Date(display.lastUpdated).toLocaleTimeString() : ''}
              </span>
            </div>

            {!display ? (
              <div className="text-center py-16">
                <Tv className="w-16 h-16 text-white/20 mx-auto mb-4 animate-pulse" />
                <p className="text-white/60">Loading projection viewport...</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 bg-white/10 text-white px-3.5 py-1.5 rounded-xl text-xs font-black uppercase font-mono">
                  {display.displayType}
                </div>

                <div className="space-y-3">
                  <h3 className="text-2xl sm:text-3xl font-serif italic tracking-tight text-white leading-tight">
                    {display.displayType === 'WELCOME_SLIDE' 
                      ? 'Welcome & Preparation' 
                      : (display.data?.title || (display.data?.book ? `${display.data.book} ${display.data.chapter}:${display.data.verse}` : 'Active Broadcast Slide'))
                    }
                  </h3>
                  
                  <p className="text-white/70 text-sm leading-relaxed whitespace-pre-line truncate-lines-4 font-serif italic">
                    {display.displayType === 'WELCOME_SLIDE' 
                      ? 'No active hymn is displayed. Screens are showing the church branding logo, welcome greeting, and live socket connection alerts.' 
                      : 'Display payload details currently rendered in full high-contrast layout on church member phones.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 pt-6 mt-12 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleResetToWelcome}
              className="py-3 px-4 bg-white/10 hover:bg-white/20 text-white border border-white/10 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
            >
              <RotateCcw className="w-4 h-4" />
              Clear Screen (Welcome Slide)
            </button>
            <a
              href="/display"
              target="_blank"
              className="py-3 px-4 bg-organic-olive hover:bg-organic-olive/90 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
            >
              <Tv className="w-4 h-4" />
              Open Screen Broadcast (New Tab)
            </a>
          </div>
        </div>

        {/* SIDE BAR STACK */}
        <div className="space-y-6 flex flex-col">
          
          {/* HIGH IMPACT QUICK ACCESS QR CODE CARD */}
          <div className="bg-white border border-organic-border rounded-3xl p-6 shadow-sm text-center">
            <div className="flex items-center gap-2 border-b border-organic-bg pb-3 mb-4 text-left">
              <QrCode className="w-5 h-5 text-organic-olive" />
              <div>
                <h3 className="font-serif italic text-organic-dark text-sm font-bold">Worship Access QR</h3>
                <p className="text-[10px] text-organic-olive/60">Members scan this to join the display</p>
              </div>
            </div>

            <div className="bg-organic-bg border border-organic-border p-4 rounded-2xl inline-block shadow-inner mb-4 relative group">
              <img 
                src={qrCodeUrl} 
                alt="Permanent QR Code" 
                className="w-36 h-36 mx-auto bg-white p-0.5 rounded-lg shadow-sm"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="space-y-2">
              <div className="bg-organic-bg border border-organic-border rounded-lg px-2.5 py-1.5 flex items-center justify-between text-left">
                <div className="truncate text-[10px] font-mono text-organic-olive/80 mr-2 max-w-[150px]">
                  {displayUrl}
                </div>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(displayUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="p-1 hover:bg-organic-border text-organic-dark/60 rounded transition shrink-0"
                  title="Copy Display Link"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handlePrintQR}
                  className="py-2 px-2.5 border border-organic-border hover:bg-organic-bg text-organic-dark text-[11px] font-bold rounded-lg transition flex items-center justify-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5 text-organic-olive" />
                  Print Flyer
                </button>
                <a
                  href={qrCodeUrl}
                  download="church_hymnal_qr_code.png"
                  target="_blank"
                  rel="noreferrer"
                  className="py-2 px-2.5 bg-organic-dark hover:bg-organic-olive text-white text-[11px] font-bold rounded-lg transition flex items-center justify-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  Get Image
                </a>
              </div>
            </div>
          </div>

          {/* PROJECTION HISTORY & RE-PROJECTOR */}
          <div className="bg-white border border-organic-border rounded-3xl p-6 shadow-sm flex flex-col justify-between flex-grow">
            <div>
              <div className="flex items-center justify-between border-b border-organic-bg pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-organic-olive" />
                  <h3 className="font-serif italic text-organic-dark text-sm font-bold">Projection Logs</h3>
                </div>
                <span className="text-[10px] text-organic-olive/60 font-mono">Session logs</span>
              </div>

              {loadingHistory ? (
                <div className="text-center py-12">
                  <RotateCw className="w-6 h-6 text-organic-olive/40 animate-spin mx-auto mb-2" />
                  <p className="text-organic-olive/50 text-xs font-medium">Reconstructing events...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-12">
                  <Tv className="w-10 h-10 text-organic-olive/10 mx-auto mb-2" />
                  <p className="text-organic-olive/50 text-xs">No displays in this session.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {history.map((h, idx) => {
                    return (
                      <div 
                        key={h.id || idx} 
                        className="group border border-organic-border bg-organic-bg/40 p-2.5 rounded-xl flex items-center justify-between gap-3 hover:bg-organic-bg/80 transition"
                      >
                        <div className="min-w-0 flex-grow">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-organic-olive/10 text-organic-olive font-mono">
                              {h.displayType}
                            </span>
                            <span className="text-[9px] text-organic-olive/40 font-mono">
                              {new Date(h.displayedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-organic-dark truncate pr-2">
                            {h.title}
                          </p>
                        </div>

                        {h.displayType !== 'WELCOME_SLIDE' && (
                          <button
                            onClick={() => handleReproject(h.displayType, h.recordId)}
                            className="shrink-0 p-1.5 bg-white border border-organic-border hover:bg-organic-bg hover:text-organic-dark rounded-lg text-organic-olive transition"
                            title="Re-project Slide"
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-organic-bg mt-4 text-center">
              <p className="text-[10px] text-organic-olive/50 font-medium leading-relaxed font-serif italic">
                Broadcasting trigger alerts other clients via live SSE broadcast frames.
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

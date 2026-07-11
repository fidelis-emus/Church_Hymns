import { useEffect, useState } from 'react';
import { 
  Music, Megaphone, BookOpen, MessageSquare, Users, 
  Tv, History, ShieldAlert, CheckCircle2, Clock, RotateCw 
} from 'lucide-react';

interface Stats {
  totalHymns: number;
  totalAnnouncements: number;
  totalCitations: number;
  totalMessages: number;
  totalUsers: number;
  recentDisplay: any[];
  recentLogs: any[];
}

export default function DashboardHome({ 
  token, 
  onNavigate 
}: { 
  token: string; 
  onNavigate: (tab: string) => void;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load dashboard metrics');
        return res.json();
      })
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <RotateCw className="w-10 h-10 text-organic-olive animate-spin mb-4" />
        <p className="text-organic-olive/80 font-medium">Loading pulpit telemetry...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-2xl flex items-start gap-3 max-w-2xl mx-auto my-10 animate-fade-in">
        <ShieldAlert className="w-6 h-6 shrink-0 text-rose-600" />
        <div>
          <h4 className="font-bold text-lg">Failed to initialize stats</h4>
          <p className="text-sm text-rose-700/80 mb-4">{error || 'Please make sure the server is healthy.'}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const statCards = [
    { 
      title: 'Total Seeded Hymns', 
      value: stats.totalHymns, 
      icon: Music, 
      color: 'bg-organic-olive', 
      textColor: 'text-organic-olive',
      bgColor: 'bg-organic-bg',
      tab: 'hymns'
    },
    { 
      title: 'Active Announcements', 
      value: stats.totalAnnouncements, 
      icon: Megaphone, 
      color: 'bg-organic-olive', 
      textColor: 'text-[#8C6B4F]',
      bgColor: 'bg-[#8C6B4F]/10',
      tab: 'announcements'
    },
    { 
      title: 'Bible Citations', 
      value: stats.totalCitations, 
      icon: BookOpen, 
      color: 'bg-organic-dark', 
      textColor: 'text-organic-dark',
      bgColor: 'bg-organic-bg',
      tab: 'citations'
    },
    { 
      title: 'Custom Messages', 
      value: stats.totalMessages, 
      icon: MessageSquare, 
      color: 'bg-organic-olive', 
      textColor: 'text-organic-olive',
      bgColor: 'bg-organic-bg',
      tab: 'messages'
    },
    { 
      title: 'Active Admins', 
      value: stats.totalUsers, 
      icon: Users, 
      color: 'bg-organic-dark', 
      textColor: 'text-organic-dark',
      bgColor: 'bg-organic-bg',
      tab: 'users'
    }
  ];

  return (
    <div className="space-y-8 animate-fade-in" id="dashboard-home-view">
      {/* GREETING */}
      <div>
        <h2 className="text-3xl font-serif italic text-organic-dark">Pulpit Overview</h2>
        <p className="text-organic-olive/70 text-sm mt-1">Real-time stats and control log for your QR Hymn Display Network.</p>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        {statCards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div 
              key={i} 
              onClick={() => onNavigate(c.tab)}
              className="bg-white border border-organic-border rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-organic-olive/40 transition cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-organic-dark/60 group-hover:text-organic-dark transition">{c.title}</span>
                <div className={`p-2.5 rounded-xl ${c.bgColor} ${c.textColor}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-3xl font-serif text-organic-dark mt-4">
                {c.value.toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* RECENTLY BROADCASTED (DISPLAY HISTORY) */}
        <div className="lg:col-span-2 bg-white border border-organic-border rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-organic-border pb-4 mb-5">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-organic-olive" />
                <h3 className="font-serif italic text-organic-dark text-lg">Recently Displayed</h3>
              </div>
              <span className="text-xs text-organic-olive/60 font-mono">Last 5 actions</span>
            </div>

            {stats.recentDisplay.length === 0 ? (
              <div className="text-center py-12">
                <Tv className="w-12 h-12 text-organic-border mx-auto mb-3" />
                <p className="text-organic-olive/70 text-sm">No display history yet.</p>
                <button 
                  onClick={() => onNavigate('hymns')}
                  className="mt-3 px-4 py-2 bg-organic-bg text-organic-dark font-bold rounded-xl text-xs hover:bg-organic-border transition"
                >
                  Broadcast Your First Hymn
                </button>
              </div>
            ) : (
              <div className="divide-y divide-organic-border/50">
                {stats.recentDisplay.map((item, idx) => {
                  return (
                    <div key={item.id || idx} className="py-3.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          item.displayType === 'HYMN' ? 'bg-organic-bg text-organic-dark border border-organic-border' :
                          item.displayType === 'ANNOUNCEMENT' ? 'bg-[#8C6B4F]/10 text-[#8C6B4F]' :
                          item.displayType === 'CITATION' ? 'bg-[#5A5A40]/10 text-[#5A5A40]' :
                          'bg-organic-dark/10 text-organic-dark'
                        }`}>
                          {item.displayType}
                        </span>
                        <p className="text-sm font-bold text-organic-dark truncate max-w-sm sm:max-w-md">
                          {item.title}
                        </p>
                      </div>
                      <span className="text-[11px] text-organic-olive/70 whitespace-nowrap flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5 text-organic-olive/40" />
                        {new Date(item.displayedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-organic-border/50 pt-4 mt-4">
            <button 
              onClick={() => onNavigate('current')} 
              className="w-full py-3 bg-organic-bg hover:bg-organic-border text-organic-dark text-xs font-bold rounded-xl transition text-center"
            >
              Manage Active Display & Layout Queue
            </button>
          </div>
        </div>

        {/* RECENT SECURITY LOGS */}
        <div className="bg-white border border-organic-border rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-organic-border pb-4 mb-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-organic-olive" />
              <h3 className="font-serif italic text-organic-dark text-lg">System Audit Log</h3>
            </div>
            <span className="text-xs text-organic-olive/60 font-mono">Live</span>
          </div>

          {stats.recentLogs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-organic-olive/70 text-sm">No activities recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {stats.recentLogs.map((log, idx) => (
                <div key={log.id || idx} className="text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-organic-olive font-bold">{log.username}</span>
                    <span className="text-[10px] text-organic-olive/60 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="font-medium text-organic-dark">
                    <span className="text-organic-olive font-mono font-bold mr-1.5">[{log.action}]</span>
                    {log.details}
                  </p>
                </div>
              ))}
              
              <button 
                onClick={() => onNavigate('logs')}
                className="w-full mt-4 py-2.5 bg-organic-bg hover:bg-organic-border text-organic-dark text-xs font-bold rounded-xl transition text-center border border-organic-border"
              >
                View Full Audit History
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

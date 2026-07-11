import { useEffect, useState } from 'react';
import { Shield, RotateCw, Search, ShieldAlert, Key, Edit, Music, Calendar } from 'lucide-react';

interface ActivityLog {
  id: number;
  username: string;
  action: string;
  details: string;
  timestamp: string;
}

export default function ActivityLogViewer({ token }: { token: string }) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = () => {
    setLoading(true);
    fetch('/api/logs', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load system audit trails');
        return res.json();
      })
      .then(data => {
        setLogs(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  };

  const filteredLogs = logs.filter(log => {
    const term = search.toLowerCase();
    return (
      log.username.toLowerCase().includes(term) ||
      log.action.toLowerCase().includes(term) ||
      log.details.toLowerCase().includes(term)
    );
  });

  const getActionIcon = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('LOGIN')) return <Key className="w-4 h-4 text-emerald-600" />;
    if (act.includes('CREATE') || act.includes('EDIT') || act.includes('UPDATE')) return <Edit className="w-4 h-4 text-blue-600" />;
    if (act.includes('DISPLAY') || act.includes('BROADCAST')) return <Music className="w-4 h-4 text-indigo-600" />;
    return <ShieldAlert className="w-4 h-4 text-slate-500" />;
  };

  return (
    <div className="space-y-6 animate-fade-in" id="activity-log-viewer">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Shield className="w-8 h-8 text-slate-700" />
            Security Audit Trail
          </h2>
          <p className="text-slate-500 text-sm mt-1">Review authenticated actions, administrator sessions, database updates, and live display events.</p>
        </div>
        
        <button 
          onClick={fetchLogs}
          className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Refresh Audit</span>
        </button>
      </div>

      {/* SEARCH AND FILTER */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search audit trail by administrator, specific action code, or keyword..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-blue-500 transition"
          />
        </div>
      </div>

      {/* LOGS LIST */}
      {loading ? (
        <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center shadow-sm">
          <RotateCw className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-slate-500 font-medium text-sm">Decoding security events logs...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 text-rose-800 max-w-xl mx-auto flex gap-3">
          <ShieldAlert className="w-6 h-6 shrink-0 text-rose-600" />
          <div>
            <h4 className="font-extrabold text-base">Security audit lookup failure</h4>
            <p className="text-sm text-rose-700/80 mt-1">{error}</p>
          </div>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-3xl p-16 text-center shadow-sm">
          <Shield className="w-14 h-14 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700">No events matched</h3>
          <p className="text-slate-400 text-sm mt-1">Try searching with other keywords.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                  <th className="py-4 px-6 w-44">Date & Time</th>
                  <th className="py-4 px-6 w-36">Personnel</th>
                  <th className="py-4 px-6 w-40">Action Tag</th>
                  <th className="py-4 px-6">Event Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-4 px-6 font-mono text-slate-400 text-xs whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-300" />
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                    </td>
                    <td className="py-4 px-6 font-mono font-bold text-slate-600">{log.username}</td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {getActionIcon(log.action)}
                        {log.action}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-semibold text-slate-700">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

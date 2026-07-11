import React, { useEffect, useState } from 'react';
import { 
  Megaphone, Plus, Edit2, Trash2, Tv, AlertCircle, X, RotateCw, Check 
} from 'lucide-react';
import { Announcement } from '../types.ts';

export default function AnnouncementManager({ 
  token,
  currentDisplayId,
  onDisplayChange
}: { 
  token: string;
  currentDisplayId?: number;
  onDisplayChange: () => void;
}) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Form States
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Announcement | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Form Fields
  const [fTitle, setFTitle] = useState('');
  const [fBody, setFBody] = useState('');
  const [fDate, setFDate] = useState('');
  const [fPriority, setFPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [fExpiryDate, setFExpiryDate] = useState('');
  const [fStatus, setFStatus] = useState<'DRAFT' | 'PUBLISHED'>('PUBLISHED');
  
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = () => {
    setLoading(true);
    fetch('/api/announcements')
      .then(res => res.json())
      .then(data => {
        setItems(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to fetch bulletins database');
        setLoading(false);
      });
  };

  // Display immediately
  const handleDisplay = (id: number) => {
    fetch(`/api/display/announcement/${id}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to broadcast announcement');
        onDisplayChange();
      })
      .catch(err => alert(err.message));
  };

  // Open Form for Creation
  const openCreate = () => {
    setEditingItem(null);
    setFTitle('');
    setFBody('');
    setFDate('');
    setFPriority('MEDIUM');
    setFExpiryDate('');
    setFStatus('PUBLISHED');
    setFormError(null);
    setFormOpen(true);
  };

  // Open Form for Editing
  const openEdit = (item: Announcement) => {
    setEditingItem(item);
    setFTitle(item.title);
    setFBody(item.body);
    setFDate(item.date || '');
    setFPriority(item.priority);
    setFExpiryDate(item.expiryDate || '');
    setFStatus(item.status);
    setFormError(null);
    setFormOpen(true);
  };

  // Submit Form
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fTitle || !fBody) {
      setFormError('Title and announcement body are required.');
      return;
    }

    setSaving(true);
    const body = {
      title: fTitle,
      body: fBody,
      date: fDate,
      priority: fPriority,
      expiryDate: fExpiryDate,
      status: fStatus
    };

    const url = editingItem ? `/api/announcements/${editingItem.id}` : '/api/announcements';
    const method = editingItem ? 'PUT' : 'POST';

    fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save announcement');
        return data;
      })
      .then(() => {
        setFormOpen(false);
        setSaving(false);
        fetchAnnouncements();
      })
      .catch(err => {
        setFormError(err.message);
        setSaving(false);
      });
  };

  // Delete Announcement
  const handleDelete = (id: number) => {
    fetch(`/api/announcements/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Deletion failed');
        setDeleteConfirmId(null);
        fetchAnnouncements();
      })
      .catch(err => alert(err.message));
  };

  return (
    <div className="space-y-6 animate-fade-in" id="announcements-manager-view">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Megaphone className="w-8 h-8 text-amber-500" />
            Bulletins & Announcements
          </h2>
          <p className="text-slate-500 text-sm mt-1">Broadcast slides, prayer schedules, event times, and general church notices.</p>
        </div>
        
        <button 
          onClick={openCreate}
          className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-extrabold flex items-center gap-2 shadow-md transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Announcement</span>
        </button>
      </div>

      {/* ANNOUNCEMENTS GRID */}
      {loading ? (
        <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center shadow-sm">
          <RotateCw className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-slate-500 font-medium text-sm">Searching church bulletins...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-3xl p-16 text-center shadow-sm">
          <Megaphone className="w-14 h-14 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700">No announcements found</h3>
          <p className="text-slate-400 text-sm mt-1">Create a new bulletin or announcement to display it on member devices.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {items.map((item) => {
            const isCurrentlyDisplayed = currentDisplayId === item.id;
            return (
              <div 
                key={item.id} 
                className={`bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between ${
                  isCurrentlyDisplayed ? 'border-emerald-500 ring-2 ring-emerald-500/10' : 'border-slate-100'
                }`}
              >
                {/* PRIORITY HEADER */}
                <div className={`px-4 py-2 text-xs font-bold flex items-center justify-between text-white ${
                  item.priority === 'HIGH' ? 'bg-rose-500' :
                  item.priority === 'MEDIUM' ? 'bg-amber-500' : 'bg-blue-500'
                }`}>
                  <div className="flex items-center gap-1.5 uppercase tracking-wider">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{item.priority} Priority</span>
                  </div>
                  <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] uppercase font-mono font-black">{item.status}</span>
                </div>

                <div className="p-6 flex-grow space-y-4">
                  {item.date && (
                    <span className="text-xs text-slate-400 font-bold font-mono uppercase bg-slate-50 px-2.5 py-1 rounded-lg">
                      {item.date}
                    </span>
                  )}
                  
                  <h3 className="text-xl font-extrabold text-slate-800 leading-snug">
                    {item.title}
                  </h3>
                  
                  <p className="text-slate-500 text-sm leading-relaxed whitespace-pre-line truncate-lines-4">
                    {item.body}
                  </p>
                </div>

                {/* FOOTER ACTIONS */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-mono">
                    ID: {item.id} {item.expiryDate ? `• Expires: ${item.expiryDate}` : ''}
                  </span>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleDisplay(item.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                        isCurrentlyDisplayed 
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm' 
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Tv className="w-3.5 h-3.5" />
                      <span>{isCurrentlyDisplayed ? 'Live Now' : 'Display'}</span>
                    </button>

                    <button
                      onClick={() => openEdit(item)}
                      className="p-1.5 hover:bg-slate-200/60 rounded-lg text-slate-500 hover:text-slate-800 transition"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {deleteConfirmId === item.id ? (
                      <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 p-0.5 rounded-lg">
                        <button 
                          onClick={() => handleDelete(item.id)}
                          className="p-1 hover:bg-rose-100 text-rose-600 rounded text-xs font-bold"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => setDeleteConfirmId(null)}
                          className="p-1 hover:bg-slate-200 text-slate-500 rounded text-xs font-bold"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(item.id)}
                        className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT FORM MODAL */}
      {formOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-lg font-black text-slate-800">
                {editingItem ? `Modify Announcement: ${editingItem.title}` : 'Draft New Church Announcement'}
              </h3>
              <button 
                onClick={() => setFormOpen(false)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="overflow-y-auto p-6 space-y-4 flex-grow">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-bold leading-relaxed">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Announcement Title *</label>
                <input 
                  type="text" 
                  value={fTitle}
                  onChange={(e) => setFTitle(e.target.value)}
                  placeholder="e.g. Divine Youth Retreat 2026"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date / Frequency</label>
                <input 
                  type="text" 
                  value={fDate}
                  onChange={(e) => setFDate(e.target.value)}
                  placeholder="e.g. Next Sunday, July 20th or Weekly on Wed"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Priority Level</label>
                  <select
                    value={fPriority}
                    onChange={(e) => setFPriority(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition cursor-pointer"
                  >
                    <option value="LOW">Low Priority</option>
                    <option value="MEDIUM">Medium Priority</option>
                    <option value="HIGH">High Priority</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
                  <select
                    value={fStatus}
                    onChange={(e) => setFStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition cursor-pointer"
                  >
                    <option value="PUBLISHED">Published (Visible)</option>
                    <option value="DRAFT">Draft (Invisible)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Expiry Date / Deadline (Optional)</label>
                <input 
                  type="text" 
                  value={fExpiryDate}
                  onChange={(e) => setFExpiryDate(e.target.value)}
                  placeholder="e.g. August 1, 2026"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Announcement Body *</label>
                <textarea 
                  rows={5}
                  value={fBody}
                  onChange={(e) => setFBody(e.target.value)}
                  placeholder="Type the full detailed announcement message that members will read on their devices."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition leading-relaxed font-medium"
                  required
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-white">
                <button 
                  type="button" 
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-sm font-bold text-slate-500 transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-extrabold shadow-md transition flex items-center gap-2"
                >
                  {saving && <RotateCw className="w-4 h-4 animate-spin" />}
                  <span>{editingItem ? 'Save Changes' : 'Publish Announcement'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

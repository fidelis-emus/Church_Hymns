import React, { useEffect, useState } from 'react';
import { 
  MessageSquare, Plus, Edit2, Trash2, Tv, X, RotateCw, Check, Layers 
} from 'lucide-react';
import { CustomMessage } from '../types.ts';

const MESSAGE_TYPES = [
  'Offering / Tithe',
  'Communion',
  'Intercessory Prayer',
  'Benediction',
  'Altar Call',
  'Special Liturgy',
  'Sermon Title Card'
];

export default function MessageManager({ 
  token,
  currentDisplayId,
  onDisplayChange
}: { 
  token: string;
  currentDisplayId?: number;
  onDisplayChange: () => void;
}) {
  const [items, setItems] = useState<CustomMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Form States
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CustomMessage | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Form Fields
  const [fType, setFType] = useState(MESSAGE_TYPES[0]);
  const [fTitle, setFTitle] = useState('');
  const [fBody, setFBody] = useState('');
  
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = () => {
    setLoading(true);
    fetch('/api/messages')
      .then(res => res.json())
      .then(data => {
        setItems(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to fetch liturgy message cards');
        setLoading(false);
      });
  };

  // Display immediately
  const handleDisplay = (id: number) => {
    fetch(`/api/display/message/${id}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to broadcast message card');
        onDisplayChange();
      })
      .catch(err => alert(err.message));
  };

  const handleDisplayWelcome = () => {
    fetch(`/api/display/welcome`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to restore Welcome screen');
        onDisplayChange();
      })
      .catch(err => alert(err.message));
  };

  // Open Form for Creation
  const openCreate = () => {
    setEditingItem(null);
    setFType(MESSAGE_TYPES[0]);
    setFTitle('');
    setFBody('');
    setFormError(null);
    setFormOpen(true);
  };

  // Open Form for Editing
  const openEdit = (item: CustomMessage) => {
    setEditingItem(item);
    setFType(item.type);
    setFTitle(item.title);
    setFBody(item.body);
    setFormError(null);
    setFormOpen(true);
  };

  // Submit Form
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fType || !fTitle || !fBody) {
      setFormError('Type, Title and Message body are required.');
      return;
    }

    setSaving(true);
    const body = {
      type: fType,
      title: fTitle,
      body: fBody
    };

    const url = editingItem ? `/api/messages/${editingItem.id}` : '/api/messages';
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
        if (!res.ok) throw new Error(data.error || 'Failed to save message template');
        return data;
      })
      .then(() => {
        setFormOpen(false);
        setSaving(false);
        fetchMessages();
      })
      .catch(err => {
        setFormError(err.message);
        setSaving(false);
      });
  };

  // Delete Message
  const handleDelete = (id: number) => {
    fetch(`/api/messages/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Deletion failed');
        setDeleteConfirmId(null);
        fetchMessages();
      })
      .catch(err => alert(err.message));
  };

  return (
    <div className="space-y-6 animate-fade-in" id="custom-messages-manager-view">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <MessageSquare className="w-8 h-8 text-indigo-600" />
            Liturgy Slide Cards
          </h2>
          <p className="text-slate-500 text-sm mt-1">Design special displays for Tithes & Offerings, Lord's Supper Communion, altar calls, and worship sermon headers.</p>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={handleDisplayWelcome}
            className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold flex items-center gap-2 border border-slate-200 transition"
          >
            <span>Reset to Welcome Card</span>
          </button>
          
          <button 
            onClick={openCreate}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-extrabold flex items-center gap-2 shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Liturgy Card</span>
          </button>
        </div>
      </div>

      {/* MESSAGES LIST */}
      {loading ? (
        <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center shadow-sm">
          <RotateCw className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-slate-500 font-medium text-sm">Synchronizing liturgy templates...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-3xl p-16 text-center shadow-sm">
          <MessageSquare className="w-14 h-14 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700">No Custom Cards Preloaded</h3>
          <p className="text-slate-400 text-sm mt-1">Create cards for Communion or Tithes to let members follow along with details.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => {
            const isCurrentlyDisplayed = currentDisplayId === item.id;
            return (
              <div 
                key={item.id} 
                className={`bg-white border rounded-2xl p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between ${
                  isCurrentlyDisplayed ? 'border-indigo-500 ring-2 ring-indigo-500/10' : 'border-slate-100'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between border-b border-slate-50 pb-3 mb-4">
                    <span className="text-[10px] font-black tracking-wider uppercase bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      {item.type}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">ID: {item.id}</span>
                  </div>

                  <h3 className="text-lg font-extrabold text-slate-800 tracking-tight leading-snug mb-3">
                    {item.title}
                  </h3>

                  <p className="text-slate-500 text-sm leading-relaxed whitespace-pre-line truncate-lines-4 mb-4">
                    {item.body}
                  </p>
                </div>

                <div className="border-t border-slate-50 pt-4 flex items-center justify-end gap-1">
                  <button
                    onClick={() => handleDisplay(item.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                      isCurrentlyDisplayed 
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm' 
                        : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                    }`}
                  >
                    <Tv className="w-3.5 h-3.5" />
                    <span>{isCurrentlyDisplayed ? 'Live Now' : 'Display'}</span>
                  </button>

                  <button
                    onClick={() => openEdit(item)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition"
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
                {editingItem ? `Modify Slide Card: ${editingItem.title}` : 'Draft Liturgical Message Slide'}
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
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Liturgy Template Category *</label>
                <select
                  value={fType}
                  onChange={(e) => setFType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition cursor-pointer"
                >
                  {MESSAGE_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Slide Header / Title *</label>
                <input 
                  type="text" 
                  value={fTitle}
                  onChange={(e) => setFTitle(e.target.value)}
                  placeholder="e.g. Offering: Malachi 3:10"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Slide Contents / Liturgy Body *</label>
                <textarea 
                  rows={6}
                  value={fBody}
                  onChange={(e) => setFBody(e.target.value)}
                  placeholder="Type the message, details, instructions, or scripture reading. Will be centered and blown up in large elegant display formats on members' phones."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition leading-relaxed font-semibold text-sm"
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
                  <span>{editingItem ? 'Save Changes' : 'Publish Liturgy'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

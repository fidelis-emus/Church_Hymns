import React, { useEffect, useState } from 'react';
import { 
  BookOpen, Plus, Edit2, Trash2, Tv, X, RotateCw, Check, Compass 
} from 'lucide-react';
import { Citation } from '../types.ts';

export default function CitationManager({ 
  token,
  currentDisplayId,
  onDisplayChange
}: { 
  token: string;
  currentDisplayId?: number;
  onDisplayChange: () => void;
}) {
  const [items, setItems] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Form States
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Citation | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Form Fields
  const [fBook, setFBook] = useState('');
  const [fChapter, setFChapter] = useState('');
  const [fVerse, setFVerse] = useState('');
  const [fDisplayText, setFDisplayText] = useState('');
  const [fNotes, setFNotes] = useState('');
  
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCitations();
  }, []);

  const fetchCitations = () => {
    setLoading(true);
    fetch('/api/citations')
      .then(res => res.json())
      .then(data => {
        setItems(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to fetch scripture citation database');
        setLoading(false);
      });
  };

  // Display immediately
  const handleDisplay = (id: number) => {
    fetch(`/api/display/citation/${id}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to project scripture');
        onDisplayChange();
      })
      .catch(err => alert(err.message));
  };

  // Open Form for Creation
  const openCreate = () => {
    setEditingItem(null);
    setFBook('');
    setFChapter('');
    setFVerse('');
    setFDisplayText('');
    setFNotes('');
    setFormError(null);
    setFormOpen(true);
  };

  // Open Form for Editing
  const openEdit = (item: Citation) => {
    setEditingItem(item);
    setFBook(item.book);
    setFChapter(item.chapter.toString());
    setFVerse(item.verse);
    setFDisplayText(item.displayText);
    setFNotes(item.notes || '');
    setFormError(null);
    setFormOpen(true);
  };

  // Submit Form
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fBook || !fChapter || !fVerse || !fDisplayText) {
      setFormError('Book, Chapter, Verse, and Scripture Verse Text are required.');
      return;
    }

    setSaving(true);
    const body = {
      book: fBook,
      chapter: parseInt(fChapter),
      verse: fVerse,
      displayText: fDisplayText,
      notes: fNotes
    };

    const url = editingItem ? `/api/citations/${editingItem.id}` : '/api/citations';
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
        if (!res.ok) throw new Error(data.error || 'Failed to save scripture reading');
        return data;
      })
      .then(() => {
        setFormOpen(false);
        setSaving(false);
        fetchCitations();
      })
      .catch(err => {
        setFormError(err.message);
        setSaving(false);
      });
  };

  // Delete Citation
  const handleDelete = (id: number) => {
    fetch(`/api/citations/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Deletion failed');
        setDeleteConfirmId(null);
        fetchCitations();
      })
      .catch(err => alert(err.message));
  };

  return (
    <div className="space-y-6 animate-fade-in" id="citations-manager-view">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-emerald-600" />
            Scriptures & Bible Citations
          </h2>
          <p className="text-slate-500 text-sm mt-1">Preload preaching scriptures to flash verses immediately on members' screens during scripture readings.</p>
        </div>
        
        <button 
          onClick={openCreate}
          className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-extrabold flex items-center gap-2 shadow-md transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Scripture Verse</span>
        </button>
      </div>

      {/* CITATIONS GRID */}
      {loading ? (
        <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center shadow-sm">
          <RotateCw className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-slate-500 font-medium text-sm">Searching scripture database...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-3xl p-16 text-center shadow-sm">
          <BookOpen className="w-14 h-14 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700">No scripture records</h3>
          <p className="text-slate-400 text-sm mt-1">Add Bible verses in advance so they are ready for the sermon.</p>
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
                <div className="p-6 flex-grow space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                    <span className="text-base font-extrabold text-slate-800 flex items-center gap-1.5 font-serif">
                      <Compass className="w-4 h-4 text-emerald-600" />
                      {item.book} {item.chapter}:{item.verse}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded">ID: {item.id}</span>
                  </div>
                  
                  <blockquote className="border-l-4 border-emerald-500 pl-4 py-1">
                    <p className="text-slate-600 text-sm sm:text-base leading-relaxed italic font-serif truncate-lines-4">
                      "{item.displayText}"
                    </p>
                  </blockquote>

                  {item.notes && (
                    <div className="bg-slate-50 border border-slate-100/50 p-3 rounded-xl">
                      <p className="text-xs font-bold text-slate-500 mb-0.5">Preacher Notes:</p>
                      <p className="text-xs text-slate-400 leading-relaxed truncate-lines-2">{item.notes}</p>
                    </div>
                  )}
                </div>

                {/* ACTION ROW */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => handleDisplay(item.id)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
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
                {editingItem ? `Modify Passage: ${editingItem.book} ${editingItem.chapter}` : 'Add Preach Scripture Reading'}
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

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Bible Book *</label>
                  <input 
                    type="text" 
                    value={fBook}
                    onChange={(e) => setFBook(e.target.value)}
                    placeholder="e.g. Psalms, John, 1 Corinthians"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Chapter *</label>
                  <input 
                    type="number" 
                    value={fChapter}
                    onChange={(e) => setFChapter(e.target.value)}
                    placeholder="e.g. 23"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Verse *</label>
                  <input 
                    type="text" 
                    value={fVerse}
                    onChange={(e) => setFVerse(e.target.value)}
                    placeholder="e.g. 1-6 or 16, 18"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Scripture Verse Text *</label>
                <textarea 
                  rows={4}
                  value={fDisplayText}
                  onChange={(e) => setFDisplayText(e.target.value)}
                  placeholder="The Lord is my shepherd; I shall not want..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition font-serif text-sm leading-relaxed"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Supplementary Preacher Notes / Theme (Optional)</label>
                <textarea 
                  rows={3}
                  value={fNotes}
                  onChange={(e) => setFNotes(e.target.value)}
                  placeholder="Add details, translation markers, or sermon theme contexts to refer to."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition text-xs leading-relaxed"
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
                  <span>{editingItem ? 'Save Changes' : 'Publish Scripture'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

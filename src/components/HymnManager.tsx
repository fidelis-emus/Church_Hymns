import React, { useEffect, useState } from 'react';
import { 
  Music, Search, Filter, Plus, Edit2, Copy, Trash2, 
  Tv, Eye, ChevronLeft, ChevronRight, RotateCw, X, Check 
} from 'lucide-react';
import { Hymn } from '../types.ts';

const CATEGORIES = [
  'Praise & Worship',
  'Grace & Mercy',
  'Peace & Comfort',
  'Adoration',
  'Assurance & Trust',
  'Salvation',
  'Faithfulness',
  'Prayer & Fellowship',
  'Consecration & Commitment',
  'Hope & Resurrection'
];

export default function HymnManager({ 
  token,
  currentDisplayId,
  onDisplayChange
}: { 
  token: string;
  currentDisplayId?: number;
  onDisplayChange: () => void;
}) {
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination State
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Modal States
  const [formOpen, setFormOpen] = useState(false);
  const [editingHymn, setEditingHymn] = useState<Hymn | null>(null);
  const [previewHymn, setPreviewHymn] = useState<Hymn | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Form Fields
  const [fNumber, setFNumber] = useState('');
  const [fTitle, setFTitle] = useState('');
  const [fLyrics, setFLyrics] = useState('');
  const [fChorus, setFChorus] = useState('');
  const [fCategory, setFCategory] = useState(CATEGORIES[0]);
  const [fLanguage, setFLanguage] = useState('English');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);

  // Load Hymns whenever filters or page changes
  useEffect(() => {
    fetchHymns();
  }, [search, category, page, limit]);

  const fetchHymns = () => {
    setLoading(true);
    const query = new URLSearchParams({
      search,
      category,
      page: page.toString(),
      limit: limit.toString()
    });

    fetch(`/api/hymns?${query.toString()}`)
      .then(res => res.json())
      .then(data => {
        setHymns(data.hymns || []);
        setTotal(data.total || 0);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to fetch hymns database');
        setLoading(false);
      });
  };

  // Trigger Immediate Display Broadcast
  const handleDisplay = (hymnId: number, title: string) => {
    fetch(`/api/display/hymn/${hymnId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to broadcast hymn');
        return res.json();
      })
      .then(() => {
        onDisplayChange();
      })
      .catch(err => alert(err.message));
  };

  // Handle Duplication
  const handleDuplicate = (hymnId: number) => {
    if (!confirm('Are you sure you want to duplicate this hymn? This will generate a copy under the next available number.')) return;
    fetch(`/api/hymns/${hymnId}/duplicate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Duplication failed');
        return res.json();
      })
      .then(() => {
        fetchHymns();
      })
      .catch(err => alert(err.message));
  };

  // Open Form for Creation
  const openCreate = () => {
    setEditingHymn(null);
    setFNumber('');
    setFTitle('');
    setFLyrics('');
    setFChorus('');
    setFCategory(CATEGORIES[0]);
    setFLanguage('English');
    setFormError(null);
    setFormOpen(true);
  };

  // Open Form for Editing
  const openEdit = (hymn: Hymn) => {
    setEditingHymn(hymn);
    setFNumber(hymn.hymnNumber.toString());
    setFTitle(hymn.title);
    setFLyrics(hymn.lyrics);
    setFChorus(hymn.chorus || '');
    setFCategory(hymn.category);
    setFLanguage(hymn.language || 'English');
    setFormError(null);
    setFormOpen(true);
  };

  // Submit Creation / Editing Form
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fNumber || !fTitle || !fLyrics || !fCategory) {
      setFormError('Hymn Number, Title, Lyrics and Category are required.');
      return;
    }

    setFormSaving(true);
    const body = {
      hymnNumber: parseInt(fNumber),
      title: fTitle,
      lyrics: fLyrics,
      chorus: fChorus || null,
      category: fCategory,
      language: fLanguage
    };

    const url = editingHymn ? `/api/hymns/${editingHymn.id}` : '/api/hymns';
    const method = editingHymn ? 'PUT' : 'POST';

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
        if (!res.ok) throw new Error(data.error || 'Failed to save hymn');
        return data;
      })
      .then(() => {
        setFormOpen(false);
        setFormSaving(false);
        fetchHymns();
      })
      .catch(err => {
        setFormError(err.message);
        setFormSaving(false);
      });
  };

  // Delete Hymn
  const handleDelete = (id: number) => {
    fetch(`/api/hymns/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Deletion failed');
        setDeleteConfirmId(null);
        fetchHymns();
      })
      .catch(err => alert(err.message));
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6 animate-fade-in" id="hymns-manager-view">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Music className="w-8 h-8 text-blue-600" />
            Hymnal Base
          </h2>
          <p className="text-slate-500 text-sm mt-1">Manage and broadcast from the fully indexed {total.toLocaleString()} hymns.</p>
        </div>
        
        <button 
          onClick={openCreate}
          className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-extrabold flex items-center gap-2 shadow-md transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Hymn Entry</span>
        </button>
      </div>

      {/* FILTER PANEL */}
      <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Search by title, hymn number, or keywords..." 
            value={search}
            onChange={(e) => { 
              setSearch(e.target.value); 
              setPage(1); 
              if (e.target.value.trim() !== '') {
                setCategory('');
              }
            }}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        <div className="flex w-full md:w-auto gap-3 items-center">
          <div className="relative flex-grow md:flex-grow-0">
            <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
              className="pl-9 pr-6 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm text-slate-700 focus:bg-white focus:outline-none transition appearance-none cursor-pointer w-full"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <select
            value={limit}
            onChange={(e) => { setLimit(parseInt(e.target.value)); setPage(1); }}
            className="px-3 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm text-slate-700 focus:bg-white focus:outline-none transition cursor-pointer font-mono"
          >
            <option value="10">10 / page</option>
            <option value="25">25 / page</option>
            <option value="50">50 / page</option>
          </select>
        </div>
      </div>

      {/* HYMNS GRID / TABLE */}
      {loading ? (
        <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center shadow-sm">
          <RotateCw className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-slate-500 font-medium text-sm">Searching the hymnal library...</p>
        </div>
      ) : hymns.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-3xl p-16 text-center shadow-sm">
          <Music className="w-14 h-14 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700">No hymns found</h3>
          <p className="text-slate-400 text-sm mt-1">Adjust your search parameters or register a new hymn.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                  <th className="py-4 px-6 w-24"># Number</th>
                  <th className="py-4 px-6">Title</th>
                  <th className="py-4 px-6 hidden md:table-cell">Category</th>
                  <th className="py-4 px-6 hidden sm:table-cell">Language</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hymns.map((hymn) => {
                  const isCurrentlyDisplayed = currentDisplayId === hymn.id;
                  return (
                    <tr key={hymn.id} className={`hover:bg-slate-50/40 transition-colors ${isCurrentlyDisplayed ? 'bg-blue-50/20' : ''}`}>
                      <td className="py-4 px-6 font-mono font-black text-slate-700">
                        {hymn.hymnNumber}
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-extrabold text-slate-800 text-sm sm:text-base">{hymn.title}</div>
                        <div className="text-xs text-slate-400 md:hidden mt-1">{hymn.category}</div>
                      </td>
                      <td className="py-4 px-6 text-sm text-slate-500 font-medium hidden md:table-cell">
                        {hymn.category}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-400 font-mono hidden sm:table-cell">
                        {hymn.language || 'English'}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleDisplay(hymn.id, `Hymn #${hymn.hymnNumber}: ${hymn.title}`)}
                            title="Display Immediately"
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                              isCurrentlyDisplayed 
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm' 
                                : 'bg-blue-50 hover:bg-blue-100 text-blue-700'
                            }`}
                          >
                            <Tv className="w-3.5 h-3.5" />
                            <span>{isCurrentlyDisplayed ? 'Live Now' : 'Display'}</span>
                          </button>

                          <button
                            onClick={() => setPreviewHymn(hymn)}
                            title="Preview Lyrics"
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-lg transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDuplicate(hymn.id)}
                            title="Duplicate Hymn"
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-lg transition"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => openEdit(hymn)}
                            title="Edit"
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-lg transition"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {deleteConfirmId === hymn.id ? (
                            <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 p-0.5 rounded-lg">
                              <button 
                                onClick={() => handleDelete(hymn.id)}
                                className="p-1 hover:bg-rose-100 text-rose-600 rounded"
                                title="Confirm Delete"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => setDeleteConfirmId(null)}
                                className="p-1 hover:bg-slate-200 text-slate-500 rounded"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(hymn.id)}
                              title="Delete"
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* PAGINATION CONTROLS */}
          {totalPages > 1 && (
            <div className="bg-slate-50/50 py-4 px-6 border-t border-slate-100 flex items-center justify-between gap-4 text-xs font-bold text-slate-400">
              <span>Showing Page {page} of {totalPages} ({total.toLocaleString()} total hymns)</span>
              
              <div className="flex items-center gap-1">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                {/* Adaptive page number indicators */}
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                    let pageNum = idx + 1;
                    if (page > 3 && totalPages > 5) {
                      pageNum = page - 3 + idx;
                      if (pageNum + (4 - idx) > totalPages) {
                        pageNum = totalPages - 4 + idx;
                      }
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-7 h-7 rounded-lg text-center font-mono ${
                          page === pageNum 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {formOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-800">
                {editingHymn ? `Modify Hymn Entry: ${editingHymn.title}` : 'Create New Hymn Entry'}
              </h3>
              <button 
                onClick={() => setFormOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition"
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Hymn Number *</label>
                  <input 
                    type="number" 
                    value={fNumber}
                    onChange={(e) => setFNumber(e.target.value)}
                    placeholder="e.g. 235"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Language</label>
                  <input 
                    type="text" 
                    value={fLanguage}
                    onChange={(e) => setFLanguage(e.target.value)}
                    placeholder="e.g. English, Spanish"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Hymn Title *</label>
                <input 
                  type="text" 
                  value={fTitle}
                  onChange={(e) => setFTitle(e.target.value)}
                  placeholder="e.g. Amazing Grace"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Hymn Category *</label>
                <select
                  value={fCategory}
                  onChange={(e) => setFCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition cursor-pointer"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Hymn Lyrics *</label>
                  <span className="text-[10px] text-slate-400 font-medium">Use double newlines for paragraph spacing</span>
                </div>
                <textarea 
                  rows={8}
                  value={fLyrics}
                  onChange={(e) => setFLyrics(e.target.value)}
                  placeholder="Verse 1:&#10;Lyrics here...&#10;&#10;Verse 2:&#10;Lyrics here..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition font-sans leading-relaxed"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Chorus (Optional)</label>
                <textarea 
                  rows={3}
                  value={fChorus}
                  onChange={(e) => setFChorus(e.target.value)}
                  placeholder="Chorus lyrics go here (will be formatted distinctively)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition font-sans leading-relaxed"
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
                  disabled={formSaving}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-extrabold shadow-md transition flex items-center gap-2"
                >
                  {formSaving && <RotateCw className="w-4 h-4 animate-spin" />}
                  <span>{editingHymn ? 'Save Changes' : 'Create Hymn'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PREVIEW DRAWER / MODAL */}
      {previewHymn && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg text-sm">#{previewHymn.hymnNumber}</span>
                <span className="text-xs text-slate-400 font-bold font-mono">({previewHymn.category})</span>
              </div>
              <button 
                onClick={() => setPreviewHymn(null)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-8 text-center space-y-6 flex-grow">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">{previewHymn.title}</h3>
              
              <div className="whitespace-pre-line text-slate-600 leading-relaxed font-semibold text-base sm:text-lg border-y border-slate-100 py-6">
                {previewHymn.lyrics}
              </div>

              {previewHymn.chorus && (
                <div className="p-4 bg-amber-50/60 border-l-4 border-amber-500 rounded-r-xl text-left">
                  <p className="text-[10px] uppercase font-bold text-amber-700 mb-1.5 tracking-wider">Chorus</p>
                  <p className="font-bold italic text-slate-700 leading-relaxed text-sm sm:text-base">
                    {previewHymn.chorus}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => {
                  handleDisplay(previewHymn.id, `Hymn #${previewHymn.hymnNumber}: ${previewHymn.title}`);
                  setPreviewHymn(null);
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition"
              >
                <Tv className="w-4 h-4" />
                <span>Go Live Now</span>
              </button>
              <button 
                onClick={() => setPreviewHymn(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-500 transition"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

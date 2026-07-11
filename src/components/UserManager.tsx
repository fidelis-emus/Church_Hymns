import React, { useEffect, useState } from 'react';
import { Users, Plus, Edit2, Trash2, Shield, X, RotateCw, Check } from 'lucide-react';
import { User, UserRole } from '../types.ts';

export default function UserManager({ 
  token,
  currentAdminUsername
}: { 
  token: string;
  currentAdminUsername?: string;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const [fUsername, setFUsername] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [fPassword, setFPassword] = useState('');
  const [fRole, setFRole] = useState<UserRole>(UserRole.ADMIN);

  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = () => {
    setLoading(true);
    fetch('/api/auth/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load administrators (Super Admin authorization required)');
        return res.json();
      })
      .then(data => {
        setUsers(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  };

  const openCreate = () => {
    setEditingUser(null);
    setFUsername('');
    setFEmail('');
    setFPassword('');
    setFRole(UserRole.ADMIN);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setFUsername(user.username);
    setFEmail(user.email);
    setFPassword(''); // leave blank
    setFRole(user.role);
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fUsername || !fEmail || (!editingUser && !fPassword)) {
      setFormError('Username, Email, and Password are required.');
      return;
    }

    setSaving(true);
    const body = {
      username: fUsername,
      email: fEmail,
      password: fPassword || undefined,
      role: fRole
    };

    const url = editingUser ? `/api/auth/users/${editingUser.id}` : '/api/auth/users';
    const method = editingUser ? 'PUT' : 'POST';

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
        if (!res.ok) throw new Error(data.error || 'Failed to persist user');
        return data;
      })
      .then(() => {
        setFormOpen(false);
        setSaving(false);
        fetchUsers();
      })
      .catch(err => {
        setFormError(err.message);
        setSaving(false);
      });
  };

  const handleDelete = (id: number) => {
    fetch(`/api/auth/users/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Deletion failed');
        setDeleteConfirmId(null);
        fetchUsers();
      })
      .catch(err => alert(err.message));
  };

  if (error) {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-800 p-6 rounded-2xl max-w-2xl mx-auto my-10 flex gap-3">
        <Shield className="w-6 h-6 shrink-0 text-amber-600" />
        <div>
          <h4 className="font-extrabold text-lg">Super Admin Authorization Required</h4>
          <p className="text-sm text-amber-700/80 leading-relaxed">
            Only Super Administrators are authorized to access the Admin User Management panel to add, edit, or terminate accounts. Please sign in as a Super Admin to perform user audits.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" id="user-manager-view">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Users className="w-8 h-8 text-slate-700" />
            Administrative Accounts
          </h2>
          <p className="text-slate-500 text-sm mt-1">Super Admins can configure personnel access permissions, assign roles, and audit login privileges.</p>
        </div>
        
        <button 
          onClick={openCreate}
          className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-extrabold flex items-center gap-2 shadow-md transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Admin User</span>
        </button>
      </div>

      {/* USER LIST */}
      {loading ? (
        <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center shadow-sm">
          <RotateCw className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-slate-500 font-medium text-sm">Authenticating and fetching admins...</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                <th className="py-4 px-6">Username</th>
                <th className="py-4 px-6">Email Address</th>
                <th className="py-4 px-6">Security Role</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const isSelf = u.username === currentAdminUsername;
                return (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-4 px-6 font-extrabold text-slate-800">
                      <div className="flex items-center gap-2">
                        <span>{u.username}</span>
                        {isSelf && (
                          <span className="bg-blue-50 text-blue-600 text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider font-mono">You</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm font-semibold text-slate-500">{u.email}</td>
                    <td className="py-4 px-6">
                      <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                        u.role === UserRole.SUPER_ADMIN ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEdit(u)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition"
                          title="Edit Account"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {!isSelf && (
                          deleteConfirmId === u.id ? (
                            <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 p-0.5 rounded-lg">
                              <button 
                                onClick={() => handleDelete(u.id)}
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
                              onClick={() => setDeleteConfirmId(u.id)}
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition"
                              title="Delete Account"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {formOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-base font-black text-slate-800">
                {editingUser ? `Edit Account: ${editingUser.username}` : 'Create New Administrative Account'}
              </h3>
              <button 
                onClick={() => setFormOpen(false)}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-bold">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Username *</label>
                <input 
                  type="text" 
                  value={fUsername}
                  onChange={(e) => setFUsername(e.target.value)}
                  placeholder="e.g. pastor_john"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Address *</label>
                <input 
                  type="email" 
                  value={fEmail}
                  onChange={(e) => setFEmail(e.target.value)}
                  placeholder="e.g. john@gracecathedral.org"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  {editingUser ? 'New Password (Leave empty to keep current)' : 'Password *'}
                </label>
                <input 
                  type="password" 
                  value={fPassword}
                  onChange={(e) => setFPassword(e.target.value)}
                  placeholder="Enter secure password"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white"
                  required={!editingUser}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Security Role Level</label>
                <select
                  value={fRole}
                  onChange={(e) => setFRole(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white cursor-pointer font-bold text-slate-700"
                >
                  <option value={UserRole.ADMIN}>Admin (Hymns, Bulletins, Scriptures)</option>
                  <option value={UserRole.SUPER_ADMIN}>Super Admin (Full System + Users + Backup)</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-500 transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-md transition flex items-center gap-1.5"
                >
                  {saving && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingUser ? 'Save Account' : 'Register Admin'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

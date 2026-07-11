import React, { useState } from 'react';
import { Database, Download, Upload, FileJson, AlertTriangle, RotateCw, CheckCircle2 } from 'lucide-react';

export default function BackupRestoreManager({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [dryRunData, setDryRunData] = useState<any | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Trigger Backup Download
  const handleExport = () => {
    setLoading(true);
    fetch('/api/backup', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(async res => {
        if (!res.ok) throw new Error('Backup export failed');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `church_qr_system_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setLoading(false);
      })
      .catch(err => {
        alert(err.message);
        setLoading(false);
      });
  };

  // Upload JSON & run DRY RUN verification
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setDryRunData(null);
    setRestoreSuccess(false);

    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      setError('Please upload a valid .json system backup file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        
        // Basic schema checks
        if (!parsed.metadata || !parsed.users || !parsed.hymns || !parsed.settings) {
          throw new Error('Invalid file structure. This file does not match a Church QR System backup blueprint.');
        }

        // Prepare dry run breakdown
        setDryRunData({
          hymnsCount: parsed.hymns.length,
          announcementsCount: parsed.announcements ? parsed.announcements.length : 0,
          citationsCount: parsed.citations ? parsed.citations.length : 0,
          messagesCount: parsed.messages ? parsed.messages.length : 0,
          usersCount: parsed.users.length,
          rawJson: parsed
        });

      } catch (err: any) {
        setError(`Failed to read backup: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Submit RESTORE Transaction
  const handleRestoreSubmit = () => {
    if (!dryRunData?.rawJson) return;

    if (!confirm('WARNING: Doing a full database restore will completely overwrite all existing hymns, bulletins, user accounts, and church configurations with the uploaded backup. This action is irreversible. Proceed?')) {
      return;
    }

    setLoading(true);
    setError(null);

    fetch('/api/restore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(dryRunData.rawJson)
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Restore transaction failed');
        return data;
      })
      .then(() => {
        setRestoreSuccess(true);
        setDryRunData(null);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  };

  return (
    <div className="space-y-6 animate-fade-in" id="backup-restore-view">
      {/* HEADER */}
      <div>
        <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
          <Database className="w-8 h-8 text-slate-700" />
          Recovery & Backups
        </h2>
        <p className="text-slate-500 text-sm mt-1">Export, snapshot, or restore your entire church database to protect against server relocations or accidental deletions.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* EXPORT DATABASE CARD */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-base">Export Backup Archive</h3>
              <p className="text-xs text-slate-400">Download a secure JSON snapshot of the current state.</p>
            </div>
          </div>

          <p className="text-sm text-slate-500 leading-relaxed font-medium">
            Generate a full system backup containing your complete list of 2,000+ hymns, current custom templates, announcements, administrator credentials, and church customization layouts. Download this file to your computer for archival storage.
          </p>

          <button 
            onClick={handleExport}
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-extrabold shadow-md flex items-center justify-center gap-2 transition"
          >
            {loading ? <RotateCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Download Backup Snapshot (.json)</span>
          </button>
        </div>

        {/* RESTORE DATABASE CARD */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-base">Import Restore Ledger</h3>
              <p className="text-xs text-slate-400">Upload a JSON ledger to overwrite database.</p>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-bold leading-relaxed flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {restoreSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-sm font-bold flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <p>Overwritten Successfully!</p>
                <p className="text-xs text-emerald-700/80 font-medium mt-0.5">Your church database was completely restored from the backup file. All screens have been synchronized.</p>
              </div>
            </div>
          )}

          {/* DRY RUN VIEWPORT */}
          {dryRunData && (
            <div className="p-4 bg-amber-50/50 border border-amber-200/60 rounded-2xl space-y-3">
              <div className="flex items-center gap-1.5 text-amber-800 font-extrabold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Dry Run Verification Passed</span>
              </div>
              
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-600 font-bold border-t border-slate-200/40 pt-2 font-mono">
                <div>Hymns: <span className="text-slate-800 font-black">{dryRunData.hymnsCount}</span></div>
                <div>Announcements: <span className="text-slate-800 font-black">{dryRunData.announcementsCount}</span></div>
                <div>Scriptures: <span className="text-slate-800 font-black">{dryRunData.citationsCount}</span></div>
                <div>Liturgy Cards: <span className="text-slate-800 font-black">{dryRunData.messagesCount}</span></div>
                <div>Users: <span className="text-slate-800 font-black">{dryRunData.usersCount}</span></div>
              </div>

              <button 
                onClick={handleRestoreSubmit}
                disabled={loading}
                className="w-full mt-2 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs shadow-sm flex items-center justify-center gap-2 transition"
              >
                {loading ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                <span>Perform Destructive Overwrite</span>
              </button>
            </div>
          )}

          {!dryRunData && !restoreSuccess && (
            <>
              <p className="text-sm text-slate-500 leading-relaxed font-medium">
                To restore your church database, drag and drop or click to upload a valid `.json` snapshot file previously exported from the system. It will run an automatic dry-run validation first.
              </p>

              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:bg-slate-50 transition relative group cursor-pointer">
                <input 
                  type="file" 
                  accept=".json"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full"
                />
                <FileJson className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <span className="text-xs font-bold text-slate-600 block">Select backup .json file</span>
                <span className="text-[10px] text-slate-400 mt-1 block">Maximum size 20MB</span>
              </div>
            </>
          )}

          {(dryRunData || restoreSuccess) && (
            <button 
              onClick={() => { setDryRunData(null); setRestoreSuccess(false); }}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition text-center"
            >
              Upload a Different Backup File
            </button>
          )}

        </div>

      </div>
    </div>
  );
}

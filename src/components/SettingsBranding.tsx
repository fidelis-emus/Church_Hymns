import React, { useEffect, useState } from 'react';
import { 
  Settings, Save, Upload, RotateCw, RefreshCw, Eye, Download, Printer, Copy, Check 
} from 'lucide-react';
import { ChurchSettings } from '../types.ts';

export default function SettingsBranding({ 
  token,
  onSettingsSaved
}: { 
  token: string;
  onSettingsSaved: (settings: ChurchSettings) => void;
}) {
  const [settings, setSettings] = useState<ChurchSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Form Fields
  const [fChurchName, setFChurchName] = useState('');
  const [fPrimaryColor, setFPrimaryColor] = useState('#5A5A40');
  const [fSecondaryColor, setFSecondaryColor] = useState('#2D3A3A');
  const [fBackgroundColor, setFBackgroundColor] = useState('#F5F5F0');
  const [fTextColor, setFTextColor] = useState('#2D3A3A');
  const [fFontFamily, setFFontFamily] = useState<'sans' | 'serif' | 'mono'>('serif');
  const [fFontSize, setFFontSize] = useState<'small' | 'medium' | 'large' | 'xlarge'>('medium');
  const [fLogoUrl, setFLogoUrl] = useState('');
  const [fHeaderText, setFHeaderText] = useState('');
  const [fFooterText, setFFooterText] = useState('');
  const [fFooterBibleVerse, setFFooterBibleVerse] = useState('');
  const [fFooterContact, setFFooterContact] = useState('');
  const [fFooterAddress, setFFooterAddress] = useState('');
  const [fFooterPhone, setFFooterPhone] = useState('');
  const [fFooterEmail, setFFooterEmail] = useState('');
  const [fFooterCopyright, setFFooterCopyright] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        setSettings(data);
        // Bind fields
        setFChurchName(data.churchName || '');
        setFPrimaryColor(data.primaryColor || '#5A5A40');
        setFSecondaryColor(data.secondaryColor || '#2D3A3A');
        setFBackgroundColor(data.backgroundColor || '#F5F5F0');
        setFTextColor(data.textColor || '#2D3A3A');
        setFFontFamily(data.fontFamily === 'sans-serif' ? 'sans' : (data.fontFamily || 'serif'));
        setFFontSize(data.fontSize || 'medium');
        setFLogoUrl(data.logoUrl || '');
        setFHeaderText(data.headerText || '');
        setFFooterText(data.footerText || '');
        setFFooterBibleVerse(data.footerBibleVerse || '');
        setFFooterContact(data.footerContact || '');
        setFFooterAddress(data.footerAddress || '');
        setFFooterPhone(data.footerPhone || '');
        setFFooterEmail(data.footerEmail || '');
        setFFooterCopyright(data.footerCopyright || '');
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to load branding configurations');
        setLoading(false);
      });
  }, []);

  // Handle Logo file reader
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1.5 * 1024 * 1024) {
      alert('The logo file is too large. Please upload an image smaller than 1.5MB for optimized database transmission.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFLogoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setFLogoUrl('');
  };

  // Submit Settings
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload: ChurchSettings = {
      churchName: fChurchName,
      primaryColor: fPrimaryColor,
      secondaryColor: fSecondaryColor,
      backgroundColor: fBackgroundColor,
      textColor: fTextColor,
      fontFamily: fFontFamily,
      fontSize: fFontSize,
      logoUrl: fLogoUrl,
      headerText: fHeaderText,
      footerText: fFooterText,
      footerBibleVerse: fFooterBibleVerse,
      footerContact: fFooterContact,
      footerAddress: fFooterAddress,
      footerPhone: fFooterPhone,
      footerEmail: fFooterEmail,
      footerCopyright: fFooterCopyright
    };

    fetch('/api/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to update church settings');
        return res.json();
      })
      .then((data) => {
        setSaving(false);
        onSettingsSaved(data);
        alert('Branding and layout customization saved successfully! Members\' display will auto-update.');
      })
      .catch(err => {
        alert(err.message);
        setSaving(false);
      });
  };

  // Target QR display url
  const displayUrl = `${window.location.origin}/display`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(displayUrl)}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(displayUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrintQR = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Church QR Hymn Display</title>
          <style>
            body { font-family: 'Inter', sans-serif; text-align: center; padding: 50px; color: #1e293b; }
            .card { max-width: 500px; margin: 0 auto; border: 3px solid #e2e8f0; padding: 40px; border-radius: 24px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
            h1 { font-size: 28px; font-weight: 800; margin-bottom: 5px; }
            h2 { font-size: 16px; font-weight: 500; color: #64748b; margin-top: 0; margin-bottom: 30px; }
            img { width: 280px; height: 280px; margin-bottom: 30px; }
            p { font-size: 14px; font-weight: 600; color: #475569; margin-bottom: 5px; }
            span { font-size: 12px; font-family: monospace; color: #94a3b8; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>${fChurchName || 'Our Church'}</h1>
            <h2>Hymnal & Scripture QR Display</h2>
            <img src="${qrCodeUrl}" />
            <p>Scan to see live hymns, announcements, & scriptures instantly</p>
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <RotateCw className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Synchronizing configurations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in" id="settings-branding-view">
      {/* HEADER */}
      <div>
        <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
          <Settings className="w-8 h-8 text-slate-700" />
          Settings & Identity
        </h2>
        <p className="text-slate-500 text-sm mt-1">Configure your church identity, color themes, logo assets, and access permanent QR display flyers.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* BRANDING FORM */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
          <h3 className="font-extrabold text-slate-800 text-lg mb-6 pb-3 border-b border-slate-50">Theme & Layout Editor</h3>
          
          <form onSubmit={handleSave} className="space-y-6">
            
            {/* Church Name */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Church Display Name *</label>
              <input 
                type="text" 
                value={fChurchName}
                onChange={(e) => setFChurchName(e.target.value)}
                placeholder="e.g. Grace Fellowship Cathedral"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:bg-white focus:border-blue-500 transition"
                required
              />
            </div>

            {/* Colors Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Primary (Buttons)</label>
                <div className="flex gap-2">
                  <input 
                    type="color" 
                    value={fPrimaryColor}
                    onChange={(e) => setFPrimaryColor(e.target.value)}
                    className="w-9 h-9 p-0.5 rounded-lg border border-slate-200 cursor-pointer shrink-0"
                  />
                  <input 
                    type="text" 
                    value={fPrimaryColor}
                    onChange={(e) => setFPrimaryColor(e.target.value)}
                    className="w-full px-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg text-center focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Secondary (Titles)</label>
                <div className="flex gap-2">
                  <input 
                    type="color" 
                    value={fSecondaryColor}
                    onChange={(e) => setFSecondaryColor(e.target.value)}
                    className="w-9 h-9 p-0.5 rounded-lg border border-slate-200 cursor-pointer shrink-0"
                  />
                  <input 
                    type="text" 
                    value={fSecondaryColor}
                    onChange={(e) => setFSecondaryColor(e.target.value)}
                    className="w-full px-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg text-center focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Background</label>
                <div className="flex gap-2">
                  <input 
                    type="color" 
                    value={fBackgroundColor}
                    onChange={(e) => setFBackgroundColor(e.target.value)}
                    className="w-9 h-9 p-0.5 rounded-lg border border-slate-200 cursor-pointer shrink-0"
                  />
                  <input 
                    type="text" 
                    value={fBackgroundColor}
                    onChange={(e) => setFBackgroundColor(e.target.value)}
                    className="w-full px-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg text-center focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Text Color</label>
                <div className="flex gap-2">
                  <input 
                    type="color" 
                    value={fTextColor}
                    onChange={(e) => setFTextColor(e.target.value)}
                    className="w-9 h-9 p-0.5 rounded-lg border border-slate-200 cursor-pointer shrink-0"
                  />
                  <input 
                    type="text" 
                    value={fTextColor}
                    onChange={(e) => setFTextColor(e.target.value)}
                    className="w-full px-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg text-center focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Typography Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Font Style (Worship Vibe)</label>
                <select
                  value={fFontFamily}
                  onChange={(e) => setFFontFamily(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition cursor-pointer font-bold"
                >
                  <option value="sans-serif">Sans-Serif (Modern / Swiss / Clean)</option>
                  <option value="serif">Serif (Traditional / Editorial / Hymnal)</option>
                  <option value="mono">Monospace (Technical / Minimalist)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Base Font Size (Members' screens)</label>
                <select
                  value={fFontSize}
                  onChange={(e) => setFFontSize(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition cursor-pointer font-bold"
                >
                  <option value="small">Small Sizing</option>
                  <option value="medium">Medium Sizing (Recommended)</option>
                  <option value="large">Large Sizing (Great readability)</option>
                  <option value="xlarge">X-Large Sizing (High Visibility)</option>
                </select>
              </div>
            </div>

            {/* Logo Management */}
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Church Crest / Logo Asset</label>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                {fLogoUrl ? (
                  <div className="relative group border border-slate-200 bg-white p-3 rounded-2xl w-32 h-20 flex items-center justify-center shrink-0">
                    <img 
                      src={fLogoUrl} 
                      alt="Logo Preview" 
                      className="max-h-full max-w-full object-contain" 
                      referrerPolicy="no-referrer"
                    />
                    <button 
                      type="button"
                      onClick={removeLogo}
                      className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white rounded-full p-1 hover:bg-rose-700 shadow-sm transition"
                      title="Remove Logo"
                    >
                      <Save className="w-3.5 h-3.5 rotate-45" /> {/* simple cross icon workaround */}
                    </button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-200 w-32 h-20 rounded-2xl flex flex-col items-center justify-center bg-white text-slate-400 shrink-0">
                    <Upload className="w-5 h-5 mb-1 text-slate-300" />
                    <span className="text-[10px] font-bold">No crest</span>
                  </div>
                )}
                
                <div className="flex-grow space-y-1 text-center sm:text-left">
                  <div className="relative inline-block">
                    <input 
                      type="file" 
                      accept=".png,.jpg,.jpeg,.svg" 
                      id="logo-upload-input"
                      onChange={handleLogoUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full"
                    />
                    <button 
                      type="button"
                      className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-extrabold text-slate-600 shadow-sm flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload Logo Asset
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400">Accepts PNG, JPEG, SVG. Sized under 1.5MB. Stored directly inside production database.</p>
                </div>
              </div>
            </div>

            {/* Headers and Footers */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h4 className="text-sm font-black text-slate-700">Display Headers & Footers Texts</h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Top Header Text</label>
                  <input 
                    type="text" 
                    value={fHeaderText}
                    onChange={(e) => setFHeaderText(e.target.value)}
                    placeholder="e.g. Welcome to Sunday Morning Worship"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Footer Signature Bible Verse</label>
                  <input 
                    type="text" 
                    value={fFooterBibleVerse}
                    onChange={(e) => setFFooterBibleVerse(e.target.value)}
                    placeholder="e.g. 'O magnify the LORD with me...' - Psalms 34:3"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition font-serif italic"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Main Footer Text / Notice</label>
                <input 
                  type="text" 
                  value={fFooterText}
                  onChange={(e) => setFFooterText(e.target.value)}
                  placeholder="e.g. Please stand up for the benediction reading."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-500 transition font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Church Address</label>
                  <input 
                    type="text" 
                    value={fFooterAddress}
                    onChange={(e) => setFFooterAddress(e.target.value)}
                    placeholder="e.g. 500 Sanctuary Lane, TX"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Church Telephone</label>
                  <input 
                    type="text" 
                    value={fFooterPhone}
                    onChange={(e) => setFFooterPhone(e.target.value)}
                    placeholder="e.g. +1 (555) 019-2831"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Contact Email</label>
                  <input 
                    type="email" 
                    value={fFooterEmail}
                    onChange={(e) => setFFooterEmail(e.target.value)}
                    placeholder="e.g. office@gracecathedral.org"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Copyright Disclaimer Footer</label>
                <input 
                  type="text" 
                  value={fFooterCopyright}
                  onChange={(e) => setFFooterCopyright(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:bg-white"
                />
              </div>
            </div>

            {/* Action Row */}
            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-extrabold shadow-md flex items-center gap-2 transition"
              >
                {saving ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Identity Settings</span>
              </button>
            </div>

          </form>
        </div>

        {/* PERMANENT QR DISPLAY CARD */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm text-center">
            <h3 className="font-extrabold text-slate-800 text-lg mb-2">Permanent QR Code</h3>
            <p className="text-xs text-slate-400 mb-6">Members scan this permanent QR once. The display automatically syncs to active hymns in real-time.</p>

            <div className="border border-slate-100 bg-slate-50 p-6 rounded-2xl inline-block shadow-inner mb-6 relative group">
              <img 
                src={qrCodeUrl} 
                alt="Permanent QR Code link to display" 
                className="w-48 h-48 mx-auto"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition rounded-2xl flex items-center justify-center gap-2">
                <button 
                  onClick={handlePrintQR} 
                  className="p-2 bg-white text-slate-800 hover:bg-slate-50 rounded-lg shadow-sm transition"
                  title="Print Flyer"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex items-center justify-between text-left">
                <div className="truncate text-xs font-mono text-slate-400 mr-2">
                  {displayUrl}
                </div>
                <button 
                  onClick={handleCopyUrl} 
                  className="p-1 hover:bg-slate-200 text-slate-500 rounded transition"
                  title="Copy Display Link"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handlePrintQR}
                  className="py-2 px-3 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Flyer
                </button>
                <a
                  href={qrCodeUrl}
                  download="church_hymnal_qr_code.png"
                  target="_blank"
                  rel="noreferrer"
                  className="py-2 px-3 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Get PNG QR
                </a>
              </div>
            </div>
          </div>

          {/* DISPLAY LIVE PREVIEW CARD */}
          <div className="bg-slate-950 text-slate-200 rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col justify-between h-56 border border-slate-800">
            <div className="absolute right-0 top-0 opacity-10 font-black text-9xl tracking-tighter select-none font-sans">TV</div>
            <div>
              <span className="text-[10px] uppercase font-black bg-emerald-500 text-black px-2 py-0.5 rounded-full">Live Monitor</span>
              <h4 className="text-lg font-black text-white mt-4">Screen Broadcast</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">Instantly verify what is projected on everyone's screen right now.</p>
            </div>

            <a
              href="/display"
              target="_blank"
              className="mt-6 py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white font-extrabold rounded-xl text-xs transition text-center flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Open Screen Broadcast (New Tab)
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}

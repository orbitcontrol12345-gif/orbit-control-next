'use client';

import { useState } from 'react';
import { Upload, Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';


const COUNTRIES = [
  'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman',
  'United States', 'United Kingdom', 'Germany', 'France', 'Netherlands',
  'India', 'Pakistan', 'Malaysia', 'Singapore', 'China', 'Japan',
  'South Korea', 'Australia', 'South Africa', 'Turkey', 'Brazil', 'Other',
];

const CONDITIONS = ['New (Surplus)', 'Used (Working)', 'Refurbished', 'Unknown', 'Mixed Lot'];

export default function SellSurplusPage() {
  const [form, setForm] = useState({
    company: '',
    contact_person: '',
    email: '',
    phone: '',
    country: '',
    brand: '',
    part_numbers: '',
    quantity: '',
    condition: '',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (loading) return;

  setLoading(true);
  setError('');

  try {
    const formData = new FormData();

Object.entries(form).forEach(([key, value]) => {
  formData.append(key, value);
});

selectedFiles.forEach((file) => {
  formData.append('files', file);
});

const response = await fetch('/api/sell-surplus', {
  method: 'POST',
  body: formData,
});

    setSuccess(true);

    setForm({
      company: '',
      contact_person: '',
      email: '',
      phone: '',
      country: '',
      brand: '',
      part_numbers: '',
      quantity: '',
      condition: '',
      message: '',
    });

    setSelectedFiles([]);
  } catch {
    setError('Failed to send your inventory offer.');
  } finally {
    setLoading(false);
  }
};
  if (success) {
    return (
      <div className="min-h-screen bg-navy-900 pt-20 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-20 h-20 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={36} className="text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Offer Received!</h2>
          <p className="text-slate-300 mb-6">
            Thank you, <strong className="text-gold-500">{form.contact_person}</strong>. Our sourcing team will review your inventory offer and contact you within 48 hours.
          </p>
          <a href="/" className="btn-outline-gold inline-flex">Back to Home</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-900 pt-20">
      {/* Header */}
<div className="bg-gradient-to-r from-navy-800 to-navy-700 border-b border-navy-600">
  <div className="page-container py-10">
    <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
      Sell Your Surplus Inventory
    </h1>

    <p className="text-slate-300 max-w-xl">
      Have excess industrial automation parts? We buy surplus inventory from manufacturers,
      distributors, and plant maintenance teams worldwide.
    </p>

    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 max-w-3xl">
      <div className="min-w-[130px] rounded-xl border border-gold-500/20 bg-gold-500/10 px-6 py-4 text-center">
        <p className="text-sm font-semibold text-white">Fast Evaluation</p>
        <p className="text-xs text-slate-400">Quick review</p>
      </div>

      <div className="min-w-[130px] rounded-xl border border-gold-500/20 bg-gold-500/10 px-6 py-4 text-center">
        <p className="text-sm font-semibold text-white">Worldwide Buyers</p>
        <p className="text-xs text-slate-400">Global sourcing</p>
      </div>

      <div className="min-w-[130px] rounded-xl border border-gold-500/20 bg-gold-500/10 px-6 py-4 text-center">
        <p className="text-sm font-semibold text-white">Competitive Offers</p>
        <p className="text-xs text-slate-400">Fair pricing</p>
      </div>

      <div className="min-w-[130px] rounded-xl border border-gold-500/20 bg-gold-500/10 px-6 py-4 text-center">
        <p className="text-sm font-semibold text-white">Secure Process</p>
        <p className="text-xs text-slate-400">Professional handling</p>
      </div>
    </div>
  </div>
</div>

      <div className="page-container py-10">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2">
            <div className="bg-navy-800 border border-navy-700 rounded-xl p-6 md:p-8">
              <h2 className="text-lg font-bold text-white mb-6">Surplus Inventory Details</h2>

              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg mb-5">
                  <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Company Name
                    </label>
                    <input name="company" type="text" value={form.company} onChange={handleChange}
                      placeholder="Your company name" className="input-field" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Contact Person <span className="text-red-400">*</span>
                    </label>
                    <input name="contact_person" type="text" required value={form.contact_person} onChange={handleChange}
                      placeholder="Your full name" className="input-field" />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Email <span className="text-red-400">*</span>
                    </label>
                    <input name="email" type="email" required value={form.email} onChange={handleChange}
                      placeholder="email@company.com" className="input-field" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Phone / WhatsApp
                    </label>
                    <input name="phone" type="tel" value={form.phone} onChange={handleChange}
                      placeholder="Phone / WhatsApp number" className="input-field" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Country <span className="text-red-400">*</span>
                  </label>
                  <select name="country" required value={form.country} onChange={handleChange} className="input-field">
                    <option value="">Select your country...</option>
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="bg-gold-500/5 border border-gold-500/20 rounded-lg p-4">
                  <p className="text-xs font-semibold text-gold-500 uppercase tracking-wider mb-4">Inventory Information</p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Brand / Manufacturer
                      </label>
                      <input name="brand" type="text" value={form.brand} onChange={handleChange}
                        placeholder="e.g. Siemens, ABB, Allen-Bradley" className="input-field" />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Part Numbers <span className="text-red-400">*</span>
                      </label>
                      <textarea name="part_numbers" required rows={3} value={form.part_numbers} onChange={handleChange}
                        placeholder="List the part numbers you want to sell, one per line or comma-separated"
                        className="input-field resize-none font-mono text-sm" />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          Quantity
                        </label>
                        <input name="quantity" type="text" value={form.quantity} onChange={handleChange}
                          placeholder="e.g. 50 units" className="input-field" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          Condition
                        </label>
                        <select name="condition" value={form.condition} onChange={handleChange} className="input-field">
                          <option value="">Select condition...</option>
                          {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Additional Details
                  </label>
                  <textarea name="message" rows={3} value={form.message} onChange={handleChange}
                    placeholder="Storage condition, history, reason for selling, expected price range..."
                    className="input-field resize-none" />
                </div>

                {/* Attachment upload */}
<label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gold-500/20 bg-navy-900/60 px-6 py-8 text-center transition hover:border-gold-400/60 hover:bg-gold-500/5">
  <Upload className="mb-3 h-8 w-8 text-gold-400" />

  <p className="text-sm font-semibold text-white">
    Upload Inventory List
    {selectedFiles.length > 0 && (
  <div className="mt-3 text-xs text-emerald-400 space-y-1">
    {selectedFiles.map((file, index) => (
      <div key={index}>✓ {file.name}</div>
    ))}
  </div>
)}
  </p>

  <p className="mt-1 text-xs text-slate-400">
    Excel, PDF, CSV, or equipment photos
  </p>

  <p className="mt-1 text-xs text-slate-500">
    Max file size: 10MB
  </p>

  <input
  type="file"
  name="files"
  multiple
  accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png,.zip"
  className="hidden"
  onChange={(e) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  }}
/>{selectedFiles.length > 0 && (
  <div className="mt-4 w-full rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-left">
    <p className="mb-2 text-sm font-semibold text-green-400">
      {selectedFiles.length} file(s) selected
    </p>

    <div className="space-y-1">
      {selectedFiles.map((file, index) => (
        <div key={index} className="truncate text-xs text-slate-300">
          📎 {file.name}
        </div>
      ))}
    </div>
  </div>
)}
</label>

                <button type="submit" disabled={loading} className="btn-gold w-full justify-center text-base py-3">
                  {loading ? (
                    <><Loader2 size={18} className="animate-spin" /> Submitting...</>
                  ) : (
                    <><Send size={18} /> Submit Inventory Offer</>
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            <div className="bg-navy-800 border border-navy-700 rounded-xl p-5">
              <h3 className="font-bold text-white mb-4">What We Buy</h3>
              <ul className="space-y-2.5">
                {[
                  'PLCs and CPU modules',
                  'HMI panels and terminals',
                  'VFDs and servo drives',
                  'Industrial sensors',
                  'Circuit breakers (MCC / MDB)',
                  'Power supplies',
                  'Obsolete and discontinued parts',
                  'Complete control panels',
                  'Spare parts lots and lots',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-slate-300">
                    <div className="w-1.5 h-1.5 bg-gold-500 rounded-full shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-navy-800 border border-gold-500/20 rounded-xl p-5">
              <h3 className="font-bold text-white mb-3">Fast & Fair Process</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Our sourcing team evaluates all offers within 48 hours. We offer competitive buy-back prices and handle international logistics.
              </p>
            </div>
            <div className="bg-navy-800 border border-gold-500/20 rounded-xl p-5">
  <h3 className="text-white font-semibold mb-3">
    Why Sell To Us?
  </h3>

  <ul className="space-y-2 text-sm text-slate-300">
    <li>✓ Fast evaluation within 24–48 hours</li>
    <li>✓ Competitive buy-back offers</li>
    <li>✓ Worldwide logistics support</li>
    <li>✓ Trusted industrial automation buyer</li>
    <li>✓ Secure and confidential process</li>
  </ul>
</div>
<div className="bg-navy-800 border border-gold-500/20 rounded-xl p-5">
  <h3 className="text-white font-semibold mb-3">
    Accepted File Types
  </h3>

  <ul className="space-y-2 text-sm text-slate-300">
    <li>✓ Excel inventory lists (.xlsx, .xls)</li>
    <li>✓ PDF documents & datasheets</li>
    <li>✓ Equipment photos (.jpg, .png)</li>
    <li>✓ CSV inventory exports</li>
    <li>✓ ZIP archives for bulk uploads</li>
  </ul>
</div>
          </div>
          
        </div>
      </div>
    </div>
  );
}

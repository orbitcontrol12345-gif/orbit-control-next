'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Upload, Send, CheckCircle, AlertCircle, Loader2, Phone, Mail, Globe, Package } from 'lucide-react';


const COUNTRIES = [
  'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman',
  'United States', 'United Kingdom', 'Germany', 'France', 'Italy', 'Spain',
  'Netherlands', 'Belgium', 'Sweden', 'Norway', 'Denmark', 'Poland',
  'India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Malaysia', 'Singapore',
  'Indonesia', 'Thailand', 'Vietnam', 'Philippines', 'China', 'Japan',
  'South Korea', 'Australia', 'New Zealand', 'South Africa', 'Nigeria',
  'Egypt', 'Turkey', 'Brazil', 'Mexico', 'Argentina', 'Colombia',
  'Other',
];

export default function RFQForm() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    country: '',
    part_number: '',
    quantity: 1,
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  useEffect(() => {
    const part = searchParams.get('part');
    if (part) setForm((f) => ({ ...f, part_number: part }));
  }, [searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: name === 'quantity' ? parseInt(value) || 1 : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError('');

  try {
    const formData = new FormData();

    formData.append('name', form.name);
    formData.append('company', form.company);
    formData.append('email', form.email);
    formData.append('phone', form.phone);
    formData.append('country', form.country);
    formData.append('part_number', form.part_number);
    formData.append('quantity', String(form.quantity));
    formData.append('message', form.message);

    selectedFiles.forEach((file) => {
      formData.append('files', file);
    });

    const response = await fetch('/api/rfq', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to send RFQ');
    }

    setSuccess(true);
    setForm({
      name: '',
      company: '',
      email: '',
      phone: '',
      country: '',
      part_number: '',
      quantity: 1,
      message: '',
    });
    setSelectedFiles([]);
  } catch (err) {
    setError('Failed to submit your request. Please try again or email us directly.');
  } finally {
    setLoading(false);
  }
};

  if (success) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={36} className="text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">RFQ Submitted Successfully!</h2>
        <p className="text-slate-300 mb-2">
          Thank you, <strong className="text-gold-500">{form.name}</strong>. We have received your request for:
        </p>
        <p className="text-lg font-mono font-bold text-gold-500 mb-6">{form.part_number}</p>
        <p className="text-slate-400 text-sm max-w-sm mx-auto mb-8">
          Our team will review your request and send a competitive quote to{' '}
          <strong className="text-slate-300">{form.email}</strong> within 24 hours.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => { setSuccess(false); setForm({ name: '', company: '', email: '', phone: '', country: '', part_number: '', quantity: 1, message: '' }); }}
            className="btn-outline-gold"
          >
            Submit Another RFQ
          </button>
          <a href="/" className="btn-outline-slate">
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Full Name <span className="text-red-400">*</span>
          </label>
          <input name="name" type="text" required value={form.name} onChange={handleChange}
            placeholder="John Smith" className="input-field" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Company Name <span className="text-red-400">*</span>
          </label>
          <input name="company" type="text" required value={form.company} onChange={handleChange}
            placeholder="ACME Industries Ltd." className="input-field" />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Email Address <span className="text-red-400">*</span>
          </label>
          <input name="email" type="email" required value={form.email} onChange={handleChange}
            placeholder="john@company.com" className="input-field" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Phone / WhatsApp
          </label>
          <input name="phone" type="tel" value={form.phone} onChange={handleChange}
            placeholder="+1 234 567 8900" className="input-field" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Country <span className="text-red-400">*</span>
        </label>
        <select name="country" required value={form.country} onChange={handleChange} className="input-field">
          <option value="">Select your country...</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="bg-gold-500/5 border border-gold-500/20 rounded-lg p-4">
        <p className="text-xs font-semibold text-gold-500 uppercase tracking-wider mb-4">Part Details</p>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Part Number <span className="text-red-400">*</span>
            </label>
            <input name="part_number" type="text" required value={form.part_number} onChange={handleChange}
              placeholder="e.g. 6ES7315-2EH14-0AB0" className="input-field font-mono" />
            <p className="text-xs text-slate-500 mt-1">You can enter multiple part numbers separated by commas</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Quantity <span className="text-red-400">*</span>
            </label>
            <input name="quantity" type="number" min={1} required value={form.quantity} onChange={handleChange}
              className="input-field" />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Additional Message
        </label>
        <textarea name="message" rows={4} value={form.message} onChange={handleChange}
          placeholder="Any additional information: urgency, technical requirements, condition preference, application..."
          className="input-field resize-none" />
      </div>

      {/* Attachment mockup */}
      <label className="block border-2 border-dashed border-navy-600 hover:border-gold-500/40 rounded-lg p-6 text-center cursor-pointer transition-colors group">
  <Upload size={22} className="text-slate-500 group-hover:text-gold-500 mx-auto mb-2 transition-colors" />

  <p className="text-sm text-slate-400">
    Attach inventory list or datasheet (optional)
  </p>

  <p className="text-xs text-slate-500 mt-1">
    PDF, Excel, or image — max 10MB
  </p>

  <input
  type="file"
  multiple
  className="hidden"
  accept=".pdf,.xls,.xlsx,.csv,.jpg,.jpeg,.png"
  onChange={(e) => {
    setSelectedFiles(Array.from(e.target.files || []));
  }}
/>

{selectedFiles.length > 0 && (
  <div className="mt-3 space-y-1">
    {selectedFiles.map((file, index) => (
      <p key={index} className="text-xs text-green-400">
        ✓ {file.name}
      </p>
    ))}
  </div>
)}
</label>

      <button
        type="submit"
        disabled={loading}
        className="btn-gold w-full justify-center text-base py-3"
      >
        {loading ? (
          <><Loader2 size={18} className="animate-spin" /> Submitting...</>
        ) : (
          <><Send size={18} /> Submit RFQ Request</>
        )}
      </button>

      <p className="text-xs text-slate-500 text-center">
        By submitting this form, you agree to be contacted by our team regarding your quote request.
        We typically respond within 24 business hours.
      </p>
    </form>
  );
}

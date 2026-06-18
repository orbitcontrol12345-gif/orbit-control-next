'use client';
import { useState } from 'react';
import {
  Send,
  CheckCircle,
  AlertCircle,
  Loader2,
  Mail,
  Phone,
  MapPin,
  Package,
  MessageCircle,
  Headphones,
} from 'lucide-react';
import Link from 'next/link';


export default function ContactPage() {
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError('');

  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(form),
    });

    if (!response.ok) {
      throw new Error('Failed to send');
    }

    setSuccess(true);

    setForm({
      name: '',
      company: '',
      email: '',
      phone: '',
      subject: '',
      message: '',
    });
  } catch (err) {
    setError('Failed to send your message.');
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="min-h-screen bg-navy-900 pt-20">
      {/* Header */}
      <div className="bg-navy-800 border-b border-navy-700">
        <div className="page-container py-10">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Contact Us</h1>
          <p className="text-slate-400 max-w-lg">
            Our team is ready to assist with part inquiries, technical questions, and order support.
          </p>
        </div>
      </div>

      <div className="page-container py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Contact info */}
<div className="lg:col-span-1 space-y-5">
  <div className="bg-navy-800 border border-navy-700 rounded-xl p-6">
    <h2 className="font-bold text-white mb-5">Get in Touch</h2>

    <div className="space-y-3">
      <a href="mailto:info@orbit-surplus.com" className="flex items-center gap-3 rounded-xl border border-gold-500/20 bg-gold-500/10 p-3 hover:border-gold-400/50 transition">
        <Mail size={18} className="text-gold-400" />
        <div>
          <p className="text-xs text-slate-400">General Inquiries</p>
          <p className="font-semibold text-white">info@orbit-surplus.com</p>
        </div>
      </a>

      <a href="mailto:sales@orbit-surplus.com" className="flex items-center gap-3 rounded-xl border border-gold-500/20 bg-gold-500/10 p-3 hover:border-gold-400/50 transition">
        <Mail size={18} className="text-gold-400" />
        <div>
          <p className="text-xs text-slate-400">Sales Department</p>
          <p className="font-semibold text-white">sales@orbit-surplus.com</p>
        </div>
      </a>

      <a href="mailto:rfq@orbit-surplus.com" className="flex items-center gap-3 rounded-xl border border-gold-500/20 bg-gold-500/10 p-3 hover:border-gold-400/50 transition">
        <Mail size={18} className="text-gold-400" />
        <div>
          <p className="text-xs text-slate-400">RFQ / Purchasing</p>
          <p className="font-semibold text-white">rfq@orbit-surplus.com</p>
        </div>
      </a>

      <a href="https://wa.me/971554835199" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-green-500/20 bg-green-500/10 p-3 hover:border-green-400/50 transition">
        <MessageCircle size={18} className="text-green-400" />
        <div>
          <p className="text-xs text-slate-400">WhatsApp</p>
          <p className="font-semibold text-white">+971 55 483 5199</p>
        </div>
      </a>

      <a href="tel:+97167677094" className="flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 hover:border-blue-400/50 transition">
        <Phone size={18} className="text-blue-400" />
        <div>
          <p className="text-xs text-slate-400">Office</p>
          <p className="font-semibold text-white">+971 6 767 7094</p>
        </div>
      </a>

      <a href="tel:+971506154473" className="flex items-center gap-3 rounded-xl border border-gold-500/20 bg-gold-500/10 p-3 hover:border-gold-400/50 transition">
        <Headphones size={18} className="text-gold-400" />
        <div>
          <p className="text-xs text-slate-400">Support</p>
          <p className="font-semibold text-white">+971 50 615 4473</p>
        </div>
      </a>

      <div className="flex items-center gap-3 rounded-xl border border-gold-500/20 bg-gold-500/10 p-3">
        <MapPin size={18} className="text-gold-400" />
        <div>
          <p className="text-xs text-slate-400">Location</p>
          <p className="font-semibold text-white">United Arab Emirates</p>
          <p className="text-xs text-slate-500">Serving customers globally</p>
        </div>
      </div>
    </div>
  </div>

  <div className="bg-navy-800 border border-gold-500/20 rounded-xl p-5">
    <p className="text-xs font-semibold text-gold-500 uppercase tracking-wider mb-3">Need a Price Quote?</p>
    <p className="text-sm text-slate-300 mb-4">
      For part number inquiries and pricing, use our dedicated RFQ form for the fastest response.
    </p>
    <Link href="/rfq" className="btn-gold w-full justify-center text-sm py-2.5">
      <Package size={15} />
      Submit an RFQ
    </Link>
  </div>
</div>

          {/* Contact form */}
          <div className="lg:col-span-2">
            <div className="bg-navy-800 border border-navy-700 rounded-xl p-6 md:p-8">
              <h2 className="text-lg font-bold text-white mb-6">Send Us a Message</h2>

              {success ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={28} className="text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Message Sent!</h3>
                  <p className="text-slate-400 text-sm">
                    Thank you, <strong className="text-slate-200">{form.name}</strong>. We&apos;ll reply to {form.email} within 24 hours.
                  </p>
                  <button onClick={() => { setSuccess(false); setForm({ name: '', company: '', email: '', phone: '', subject: '', message: '' }); }}
                    className="mt-5 btn-outline-slate text-sm py-2">
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-red-300">{error}</p>
                    </div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Name <span className="text-red-400">*</span></label>
                      <input name="name" type="text" required value={form.name} onChange={handleChange} placeholder="Your name" className="input-field" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Company</label>
                      <input name="company" type="text" value={form.company} onChange={handleChange} placeholder="Your company" className="input-field" />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email <span className="text-red-400">*</span></label>
                      <input name="email" type="email" required value={form.email} onChange={handleChange} placeholder="email@company.com" className="input-field" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Phone</label>
                      <input name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="Enter your phone number" className="input-field" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Subject</label>
                    <select name="subject" value={form.subject} onChange={handleChange} className="input-field">
                      <option value="">Select a subject...</option>
                      <option>Part Number Inquiry</option>
                      <option>Quote Request</option>
                      <option>Order Status</option>
                      <option>Shipping Question</option>
                      <option>Warranty / Return</option>
                      <option>Sell Surplus Parts</option>
                      <option>General Inquiry</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Message <span className="text-red-400">*</span></label>
                    <textarea name="message" required rows={5} value={form.message} onChange={handleChange}
                      placeholder="Describe your inquiry in detail..." className="input-field resize-none" />
                  </div>
                  <button type="submit" disabled={loading} className="btn-gold w-full justify-center text-base py-3">
                    {loading ? (
                      <><Loader2 size={18} className="animate-spin" /> Sending...</>
                    ) : (
                      <><Send size={18} /> Send Message</>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

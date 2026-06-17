import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Clock, Globe, ShieldCheck, Zap, Phone, Mail } from 'lucide-react';
import RFQForm from '@/components/rfq/RFQForm';

export const metadata: Metadata = {
  title: 'Request a Quote — Industrial Automation Parts',
  description:
    'Submit an RFQ for industrial automation spare parts. PLCs, HMIs, drives, sensors, and more. Fast 24-hour quote response. Worldwide shipping.',
};

export default function RFQPage() {
  return (
    <div className="min-h-screen bg-navy-900 pt-20">
      <div className="bg-gradient-to-r from-navy-800 to-navy-700 border-b border-navy-600">
        <div className="page-container py-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-gold-500/10 border border-gold-500/30 rounded-full px-4 py-1 mb-4">
              <Zap size={12} className="text-gold-500" />
              <span className="text-xs font-medium text-gold-400 uppercase tracking-wider">Fast Response Guaranteed</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
              Request a Quote
            </h1>
            <p className="text-slate-300 max-w-lg">
              Submit your part number and we&apos;ll provide a competitive price quote within 24 hours. We source industrial automation parts globally.
            </p>
          </div>
        </div>
      </div>

      <div className="page-container py-10">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2">
            <div className="bg-navy-800 border border-navy-700 rounded-xl p-6 md:p-8">
              <h2 className="text-lg font-bold text-white mb-6">RFQ Details</h2>
              <Suspense fallback={<div className="text-slate-400 text-sm">Loading form...</div>}>
                <RFQForm />
              </Suspense>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Why RFQ */}
            <div className="bg-navy-800 border border-navy-700 rounded-xl p-5">
              <h3 className="font-bold text-white mb-4">How It Works</h3>
              <ol className="space-y-4">
                {[
                  { step: '1', title: 'Submit Your RFQ', desc: 'Fill in the part number and your contact details' },
                  { step: '2', title: 'We Source Globally', desc: 'Our team locates the part from trusted suppliers' },
                  { step: '3', title: 'Receive Your Quote', desc: 'Competitive pricing sent to you within 24 hours' },
                  { step: '4', title: 'Fast Shipping', desc: 'DHL/FedEx express shipping worldwide' },
                ].map((item) => (
                  <li key={item.step} className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-gold-500/20 border border-gold-500/40 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-gold-500">
                      {item.step}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{item.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Trust */}
            <div className="bg-navy-800 border border-navy-700 rounded-xl p-5">
              <h3 className="font-bold text-white mb-4">Why Xeltronic</h3>
              <ul className="space-y-3">
                {[
                  { icon: Clock, text: '24-hour quote response' },
                  { icon: Globe, text: 'Ships to 200+ countries' },
                  { icon: ShieldCheck, text: 'Genuine & tested parts' },
                  { icon: Zap, text: 'Obsolete parts specialist' },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3 text-sm text-slate-300">
                    <Icon size={15} className="text-gold-500 shrink-0" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>

           {/* Contact */}
<div className="bg-navy-800 border border-gold-500/20 rounded-xl p-5">
  <h3 className="font-bold text-white mb-3">Prefer to Contact Directly?</h3>

  <div className="space-y-2">
    <a href="mailto:info@xeltronic.com" className="flex items-center gap-2.5 text-sm text-slate-300 hover:text-gold-500 transition-colors">
      <Mail size={15} className="text-gold-500" />
      info@xeltronic.com
    </a>

    <a href="tel:+971554835199" className="flex items-center gap-2.5 text-sm text-slate-300 hover:text-gold-500 transition-colors">
      <Phone size={15} className="text-gold-500" />
      WhatsApp: +971 55 483 5199
    </a>

    <a href="tel:+97167677094" className="flex items-center gap-2.5 text-sm text-slate-300 hover:text-gold-500 transition-colors">
      <Phone size={15} className="text-gold-500" />
      Office: +971 6 767 7094
    </a>

    <a href="tel:+971506154473" className="flex items-center gap-2.5 text-sm text-slate-300 hover:text-gold-500 transition-colors">
      <Phone size={15} className="text-gold-500" />
      Support: +971 50 615 4473
    </a>
  </div>

  <p className="text-xs text-slate-500 mt-2">
    WhatsApp available for urgent inquiries
  </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

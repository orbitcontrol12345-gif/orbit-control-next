import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, Package } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Warranty & Return Policy',
  description: 'Xeltronic Electrical Solution warranty and return policy for industrial automation spare parts.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-white mb-4 pb-3 border-b border-navy-700">{title}</h2>
      <div className="text-slate-300 space-y-3 leading-relaxed">{children}</div>
    </section>
  );
}

export default function WarrantyPolicyPage() {
  return (
    <div className="min-h-screen bg-navy-900 pt-20">
      <div className="bg-navy-800 border-b border-navy-700">
        <div className="page-container py-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gold-500/10 border border-gold-500/20 rounded-lg flex items-center justify-center">
              <ShieldCheck size={18} className="text-gold-500" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Warranty &amp; Return Policy</h1>
          <p className="text-slate-400">Last updated: January 2025</p>
        </div>
      </div>

      <div className="page-container py-12">
        <div className="max-w-3xl">
          {/* Warranty highlights */}
          <div className="grid sm:grid-cols-3 gap-4 mb-10">
            {[
              { title: 'New Parts', warranty: 'Manufacturer warranty applies' },
              { title: 'Refurbished Parts', warranty: '90-day limited warranty' },
              { title: 'Used Parts', warranty: '30-day DOA warranty' },
            ].map(({ title, warranty }) => (
              <div key={title} className="bg-navy-800 border border-gold-500/20 rounded-lg p-4 text-center">
                <p className="text-sm font-bold text-white mb-1">{title}</p>
                <p className="text-xs text-gold-500">{warranty}</p>
              </div>
            ))}
          </div>

          <Section title="1. Warranty Coverage">
            <p><strong className="text-white">New Parts:</strong> All new parts carry the original manufacturer&apos;s warranty. The duration and terms of the manufacturer&apos;s warranty apply. Xeltronic facilitates warranty claims to the extent possible.</p>
            <p><strong className="text-white">Refurbished Parts:</strong> Refurbished parts are covered by a 90-day limited warranty from the date of delivery. This warranty covers functional defects that existed at the time of shipment.</p>
            <p><strong className="text-white">Used Parts:</strong> Used parts carry a 30-day DOA (Dead on Arrival) warranty. If a used part is found to be non-functional upon receipt and proper installation, we will replace or refund the item.</p>
            <p><strong className="text-white">&ldquo;Not Working&rdquo; Parts:</strong> Parts sold as &ldquo;Not Working&rdquo; or &ldquo;for parts&rdquo; carry no warranty and are sold as-is for repair purposes.</p>
          </Section>

          <Section title="2. Warranty Exclusions">
            <p>The warranty does not cover:</p>
            <ul className="list-none space-y-2 mt-2">
              {[
                'Damage caused by improper installation or incorrect wiring',
                'Damage caused by overvoltage, electrical surges, or static discharge',
                'Physical damage caused by accident, misuse, or negligence',
                'Damage resulting from incompatible systems or incorrect configuration',
                'Normal wear and tear',
                'Parts modified or repaired by unauthorized parties',
                'Software or firmware issues',
                'Consumable components (fans, batteries, contactors)',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm">
                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="3. Return Procedure">
            <p>To initiate a return or warranty claim:</p>
            <ol className="list-none space-y-3 mt-3">
              {[
                'Contact us at info@xeltronic.com within the warranty period with your order number and a detailed description of the issue',
                'Our technical team will review the claim and may request photos, videos, or test reports',
                'If the claim is approved, we will issue a Return Merchandise Authorization (RMA) number',
                'Ship the item back to us using the instructions provided with the RMA',
                'Upon receipt and inspection, we will issue a replacement or refund',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <div className="w-5 h-5 bg-gold-500/20 border border-gold-500/30 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-gold-500 mt-0.5">
                    {i + 1}
                  </div>
                  {item}
                </li>
              ))}
            </ol>
          </Section>

          <Section title="4. Return Shipping Costs">
            <p>For warranty claims where the fault is verified to be on our end, Xeltronic will cover the return shipping cost or provide a shipping label. For returns not related to a proven defect, return shipping costs are the buyer&apos;s responsibility.</p>
          </Section>

          <Section title="5. Refunds">
            <p>Refunds are issued for:</p>
            <ul className="list-none space-y-2 mt-2">
              {[
                'Items that cannot be replaced within a reasonable timeframe',
                'Verified DOA items where no replacement is available',
                'Orders cancelled before shipment',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p>Refunds are processed within 7–14 business days via the original payment method.</p>
          </Section>

          <Section title="6. Non-Returnable Items">
            <p>The following items are non-returnable:</p>
            <ul className="list-none space-y-2 mt-2">
              {[
                'Items marked as "sold as-is" or "for parts"',
                'Items with clearly visible physical damage not reported within 48 hours of delivery',
                'Software licenses and digital products',
                'Custom or specially sourced items',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm">
                  <div className="w-1.5 h-1.5 bg-amber-400 rounded-full shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="7. Contact for Warranty Claims">
            <p>Email: <a href="mailto:warranty@xeltronic.com" className="text-gold-500 hover:text-gold-400">warranty@xeltronic.com</a></p>
            <p>Phone: +971 XX XXX XXXX</p>
            <p>Please have your order number and invoice ready when contacting us.</p>
          </Section>

          <div className="bg-navy-800 border border-gold-500/20 rounded-xl p-6 text-center">
            <p className="text-slate-300 text-sm mb-3">Questions about warranty? Contact our support team.</p>
            <Link href="/contact" className="btn-gold inline-flex">
              <Package size={15} />
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

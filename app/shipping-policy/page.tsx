import type { Metadata } from 'next';
import Link from 'next/link';
import { Truck, Globe, Clock, AlertTriangle, Package } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Shipping Policy',
  description: 'Xeltronic Electrical Solution shipping policy. Worldwide shipping via DHL and FedEx. Learn about delivery times, customs duties, and shipping procedures.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 pb-3 border-b border-navy-700">
        {title}
      </h2>
      <div className="text-slate-300 space-y-3 leading-relaxed">{children}</div>
    </section>
  );
}

export default function ShippingPolicyPage() {
  return (
    <div className="min-h-screen bg-navy-900 pt-20">
      <div className="bg-navy-800 border-b border-navy-700">
        <div className="page-container py-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gold-500/10 border border-gold-500/20 rounded-lg flex items-center justify-center">
              <Truck size={18} className="text-gold-500" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Shipping Policy</h1>
          <p className="text-slate-400">Last updated: January 2025</p>
        </div>
      </div>

      <div className="page-container py-12">
        <div className="max-w-3xl">
          {/* Highlights */}
          <div className="grid sm:grid-cols-3 gap-4 mb-10">
            {[
              { icon: Globe, title: 'Worldwide Shipping', desc: 'Shipping to 200+ countries' },
              { icon: Truck, title: 'DHL & FedEx', desc: 'Express international couriers' },
              { icon: Clock, title: 'Dispatch Time', desc: '1-3 business days after payment' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-navy-800 border border-navy-700 rounded-lg p-4 flex items-start gap-3">
                <Icon size={18} className="text-gold-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-xs text-slate-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <Section title="1. Shipping Methods">
            <p>Xeltronic Electrical Solution ships all orders internationally using DHL Express and FedEx International Priority. We select the best carrier based on destination, package weight, and delivery timeline.</p>
            <p>All shipments are fully trackable from our warehouse to your door. Tracking information will be provided via email once your order is dispatched.</p>
          </Section>

          <Section title="2. Shipping Destinations">
            <p>We ship to over 200 countries and territories worldwide. Customers in all regions are welcome to submit RFQ requests and purchase orders.</p>
            <p>Some remote destinations or regions with trade restrictions may have limited shipping options. Our team will advise you at the time of quotation if any restrictions apply to your location.</p>
          </Section>

          <Section title="3. Dispatch Timeframe">
            <p>Orders for in-stock items are typically dispatched within 1–3 business days of confirmed payment. Sourced or special order items may require additional lead time, which will be communicated during the quotation process.</p>
            <p>Business days are Sunday through Thursday, 9:00 AM to 6:00 PM Gulf Standard Time (GST). Orders placed on Fridays, Saturdays, or UAE public holidays will be processed on the next business day.</p>
          </Section>

          <Section title="4. Estimated Delivery Times">
            <p>Transit times are estimates provided by DHL and FedEx and may vary based on:</p>
            <ul className="list-none space-y-2 mt-3">
              {[
                'Destination country and city',
                'Customs clearance processing time',
                'Local public holidays',
                'Volume of international shipments',
                'Buyer-provided documents and customs authorizations',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm">
                  <div className="w-1.5 h-1.5 bg-gold-500 rounded-full shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-3">Typical transit times range from 2–7 business days for major destinations. Remote locations may take longer.</p>
          </Section>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 mb-10">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-amber-300 mb-2">Important: Customs & Import Responsibilities</h3>
                <p className="text-sm text-amber-200/80 leading-relaxed">
                  All customs duties, import taxes, VAT, clearance fees, and brokerage charges are the sole responsibility of the buyer. Xeltronic Electrical Solution does not pre-pay any destination country customs or import charges. Delivery times depend on customs clearance, which is controlled by the destination country&apos;s authorities. Buyers are responsible for providing all required import permits, licenses, and documentation.
                </p>
              </div>
            </div>
          </div>

          <Section title="5. Customs & Import Taxes">
            <p>When ordering goods from outside your country, you may be subject to import duties, customs fees, and taxes imposed by your country&apos;s customs authority. These charges are entirely the buyer&apos;s responsibility and are not included in the product price or shipping cost quoted by Xeltronic.</p>
            <p>We strongly recommend that buyers:</p>
            <ul className="list-none space-y-2 mt-3">
              {[
                'Check local import regulations before placing an order',
                'Ensure they have all required import permits for restricted items',
                'Be aware of HS codes and tariff classifications for automation equipment',
                'Have a customs broker ready for high-value or complex clearances',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm">
                  <div className="w-1.5 h-1.5 bg-gold-500 rounded-full shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="6. Shipping Insurance">
            <p>All shipments are insured for their declared value. In the event of loss or damage during transit, claims must be filed with us within 7 days of the scheduled delivery date. We will coordinate with the courier to process the claim.</p>
          </Section>

          <Section title="7. Packaging">
            <p>All items are carefully packaged to protect sensitive electronic components during international shipping. We use appropriate ESD (electrostatic discharge) protection, bubble wrap, foam padding, and double-wall corrugated cartons.</p>
          </Section>

          <Section title="8. Contact">
            <p>For shipping-related questions or to track your order, please contact us:</p>
            <p>Email: <a href="mailto:info@xeltronic.com" className="text-gold-500 hover:text-gold-400">info@xeltronic.com</a></p>
            <p>Phone: +971 XX XXX XXXX</p>
          </Section>

          <div className="bg-navy-800 border border-gold-500/20 rounded-xl p-6 text-center">
            <p className="text-slate-300 text-sm mb-3">Ready to request a quote with shipping options?</p>
            <Link href="/rfq" className="btn-gold inline-flex">
              <Package size={15} />
              Submit an RFQ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

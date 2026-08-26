import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Clock,
  Globe,
  Package,
  Truck,
} from 'lucide-react';

const SITE_URL = 'https://www.orbit-surplus.com';

export const metadata: Metadata = {
  title: 'Shipping Policy',
  description:
    'Learn about Orbit Control worldwide delivery through DHL and FedEx, dispatch times, customs duties, insurance and international shipping procedures.',
  alternates: {
    canonical: `${SITE_URL}/shipping-policy`,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/shipping-policy`,
    title: 'Shipping Policy | Orbit Control Automation',
    description:
      'Worldwide industrial automation parts shipping through DHL and FedEx from the United Arab Emirates.',
    siteName: 'Orbit Control Automation',
  },
};

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 flex items-center gap-2 border-b border-navy-700 pb-3 text-xl font-bold text-white">
        {title}
      </h2>

      <div className="space-y-3 leading-relaxed text-slate-300">
        {children}
      </div>
    </section>
  );
}

const shippingHighlights = [
  {
    icon: Globe,
    title: 'Worldwide Shipping',
    description: 'International delivery worldwide',
  },
  {
    icon: Truck,
    title: 'DHL & FedEx',
    description: 'Express international couriers',
  },
  {
    icon: Clock,
    title: 'Dispatch Time',
    description: '1–3 business days after payment',
  },
];

const deliveryFactors = [
  'Destination country and city',
  'Customs clearance processing time',
  'Local public holidays',
  'International shipment volumes',
  'Buyer-provided documents and customs authorizations',
];

const customsRecommendations = [
  'Check local import regulations before placing an order',
  'Ensure all required import permits are available for restricted items',
  'Review HS codes and tariff classifications for automation equipment',
  'Arrange a customs broker for high-value or complex clearances when required',
];

export default function ShippingPolicyPage() {
  return (
    <main className="min-h-screen bg-navy-900 pt-20">
      <div className="border-b border-navy-700 bg-navy-800">
        <div className="page-container py-10">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-gold-500/20 bg-gold-500/10">
              <Truck size={18} className="text-gold-500" />
            </div>
          </div>

          <h1 className="mb-2 text-3xl font-bold text-white md:text-4xl">
            Shipping Policy
          </h1>

          <p className="text-slate-400">Last updated: August 2026</p>
        </div>
      </div>

      <div className="page-container py-12">
        <div className="max-w-3xl">
          {/* Shipping highlights */}
          <div className="mb-10 grid gap-4 sm:grid-cols-3">
            {shippingHighlights.map(
              ({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="flex items-start gap-3 rounded-lg border border-navy-700 bg-navy-800 p-4"
                >
                  <Icon
                    size={18}
                    className="mt-0.5 shrink-0 text-gold-500"
                  />

                  <div>
                    <p className="text-sm font-semibold text-white">
                      {title}
                    </p>

                    <p className="text-xs text-slate-400">
                      {description}
                    </p>
                  </div>
                </div>
              ),
            )}
          </div>

          <Section title="1. Shipping Methods">
            <p>
              Orbit Control Automation ships orders internationally using DHL
              Express and FedEx International Priority. We select the most
              suitable carrier based on the destination, package dimensions,
              shipment weight, and expected delivery timeframe.
            </p>

            <p>
              Shipments are fully trackable from dispatch to delivery. Tracking
              information will be provided by email once the order has been
              collected by the courier.
            </p>
          </Section>

          <Section title="2. Shipping Destinations">
            <p>
              We provide worldwide shipping for industrial automation,
              electrical, electronic, obsolete, and surplus spare parts.
              Customers in supported countries may submit an RFQ or purchase
              order for delivery quotations.
            </p>

            <p>
              Remote destinations and regions affected by carrier limitations,
              export controls, sanctions, or trade restrictions may have
              limited shipping options. Our team will advise you during the
              quotation process if restrictions apply.
            </p>
          </Section>

          <Section title="3. Dispatch Timeframe">
            <p>
              In-stock items are normally dispatched within 1–3 business days
              after payment has been confirmed. Sourced, special-order, or
              inspection-dependent items may require additional preparation
              time, which will be confirmed in the quotation.
            </p>

            <p>
              Orders received outside our operating hours or during weekends
              and UAE public holidays will be processed on the next available
              business day.
            </p>
          </Section>

          <Section title="4. Estimated Delivery Times">
            <p>
              Courier transit times are estimates and may vary depending on:
            </p>

            <ul className="mt-3 list-none space-y-2">
              {deliveryFactors.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
                  {item}
                </li>
              ))}
            </ul>

            <p className="mt-3">
              Typical express transit time is approximately 2–7 business days
              for major destinations. Remote locations and shipments requiring
              extended customs clearance may take longer.
            </p>
          </Section>

          <div className="mb-10 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle
                size={18}
                className="mt-0.5 shrink-0 text-amber-400"
              />

              <div>
                <h2 className="mb-2 font-bold text-amber-300">
                  Important: Customs & Import Responsibilities
                </h2>

                <p className="text-sm leading-relaxed text-amber-200/80">
                  Customs duties, import taxes, VAT, clearance fees, brokerage
                  fees, and similar destination charges are the responsibility
                  of the buyer unless otherwise stated in writing. Orbit
                  Control Automation does not prepay destination-country
                  customs charges. Buyers must provide any required import
                  permits, licenses, tax numbers, and clearance documents.
                </p>
              </div>
            </div>
          </div>

          <Section title="5. Customs & Import Taxes">
            <p>
              International orders may be subject to import duties, customs
              charges, VAT, and taxes imposed by the destination country. These
              charges are not included in the product price or shipping cost
              quoted by Orbit Control Automation unless expressly stated
              otherwise.
            </p>

            <p>Before ordering, we recommend that buyers:</p>

            <ul className="mt-3 list-none space-y-2">
              {customsRecommendations.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
                  {item}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="6. Shipping Insurance">
            <p>
              Shipments may be insured according to their declared value and
              the terms of the selected courier service. Any visible shipping
              damage must be reported immediately upon delivery. Claims for
              loss, damage, or missing contents must be submitted to us within
              7 days, together with photographs of the package, shipping label,
              packaging materials, and product.
            </p>

            <p>
              Please retain all original packaging until the courier
              investigation has been completed.
            </p>
          </Section>

          <Section title="7. Packaging">
            <p>
              Products are carefully packaged for international transport.
              Depending on the item, we use ESD protection, protective wrap,
              foam padding, reinforced cartons, and double-wall corrugated
              boxes to protect sensitive industrial and electronic components.
            </p>
          </Section>

          <Section title="8. Delivery and Address Accuracy">
            <p>
              Buyers are responsible for providing a complete and accurate
              delivery address, postal code, contact name, telephone number,
              email address, and any information required for customs
              clearance.
            </p>

            <p>
              Additional courier charges caused by an incorrect address,
              refused delivery, unsuccessful delivery attempts, or failure to
              complete customs clearance may be charged to the buyer.
            </p>
          </Section>

          <Section title="9. Contact">
            <p>
              For shipping questions, delivery quotations, or tracking
              assistance, please contact us:
            </p>

            <p>
              Email:{' '}
              <a
                href="mailto:info@orbit-surplus.com"
                className="text-gold-500 transition-colors hover:text-gold-400"
              >
                info@orbit-surplus.com
              </a>
            </p>

            <p>
              Phone:{' '}
              <a
                href="tel:+97167677094"
                className="text-gold-500 transition-colors hover:text-gold-400"
              >
                +971 6 767 7094
              </a>
            </p>
          </Section>

          <div className="rounded-xl border border-gold-500/20 bg-navy-800 p-6 text-center">
            <p className="mb-3 text-sm text-slate-300">
              Ready to request a quote with international shipping options?
            </p>

            <Link href="/rfq" className="btn-gold inline-flex">
              <Package size={15} />
              Submit an RFQ
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

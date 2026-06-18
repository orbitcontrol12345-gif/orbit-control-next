import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, Package } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Warranty & Return Policy | Orbit Control Automation',
  description:
    'Warranty and return policy for industrial automation, electrical, surplus and obsolete spare parts supplied by Orbit Control Automation.',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 border-b border-navy-700 pb-3 text-xl font-bold text-white">
        {title}
      </h2>
      <div className="space-y-3 leading-relaxed text-slate-300">{children}</div>
    </section>
  );
}

export default function WarrantyPolicyPage() {
  return (
    <div className="min-h-screen bg-navy-900 pt-20">
      <div className="border-b border-navy-700 bg-navy-800">
        <div className="page-container py-10">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-gold-500/20 bg-gold-500/10">
              <ShieldCheck size={18} className="text-gold-500" />
            </div>
          </div>

          <h1 className="mb-2 text-3xl font-bold text-white md:text-4xl">
            Warranty &amp; Return Policy
          </h1>

          <p className="text-slate-400">Last updated: January 2026</p>
        </div>
      </div>

      <div className="page-container py-12">
        <div className="max-w-3xl">
          <div className="mb-10 rounded-xl border border-gold-500/20 bg-navy-800 p-6">
            <p className="leading-relaxed text-slate-300">
              Orbit Control Automation supplies industrial automation, electrical,
              surplus and obsolete spare parts to B2B customers worldwide. Because
              industrial spare parts vary by condition, age, availability and
              application, warranty and return eligibility depends on the product
              condition stated in the quotation, invoice or product description.
            </p>
          </div>

          <div className="mb-10 grid gap-4 sm:grid-cols-3">
            {[
              { title: 'New Parts', warranty: 'Manufacturer warranty when applicable' },
              { title: 'Refurbished Parts', warranty: 'Limited functional warranty' },
              { title: 'Used / Surplus Parts', warranty: 'Tested or supplied as stated' },
            ].map(({ title, warranty }) => (
              <div
                key={title}
                className="rounded-lg border border-gold-500/20 bg-navy-800 p-4 text-center"
              >
                <p className="mb-1 text-sm font-bold text-white">{title}</p>
                <p className="text-xs text-gold-500">{warranty}</p>
              </div>
            ))}
          </div>

          <Section title="1. Warranty Coverage">
            <p>
              All products are supplied according to the condition, description and
              terms stated in the quotation, invoice or sales confirmation.
            </p>

            <p>
              <strong className="text-white">New Products:</strong> New products may
              be covered by the original manufacturer warranty where such warranty is
              available and transferable.
            </p>

            <p>
              <strong className="text-white">Refurbished Products:</strong>{' '}
              Refurbished products are inspected and tested prior to shipment and may
              be covered by a limited functional warranty if stated in writing.
            </p>

            <p>
              <strong className="text-white">Used and Surplus Products:</strong>{' '}
              Used and surplus products are supplied based on the stated condition and
              availability. These products may show signs of previous storage,
              handling or use.
            </p>

            <p>
              <strong className="text-white">Obsolete and Discontinued Parts:</strong>{' '}
              Obsolete parts are sourced based on market availability and are subject
              to limited warranty terms unless otherwise agreed in writing.
            </p>
          </Section>

          <Section title="2. Inspection Before Shipment">
            <p>
              Orbit Control Automation inspects products before dispatch whenever
              possible. For applicable items, photos, condition details or basic
              verification may be provided before shipment upon request.
            </p>

            <p>
              Customers are responsible for confirming part numbers, compatibility,
              voltage, configuration, firmware, revision level and application
              suitability before placing an order.
            </p>
          </Section>

          <Section title="3. Warranty Exclusions">
            <p>The warranty does not cover:</p>

            <ul className="mt-2 space-y-2">
              {[
                'Incorrect installation, wiring, commissioning or configuration',
                'Electrical surge, overvoltage, short circuit or improper power supply',
                'Damage caused by misuse, negligence, modification or unauthorized repair',
                'Compatibility issues with customer equipment, software, firmware or systems',
                'Normal wear and tear, cosmetic marks, packaging condition or storage marks',
                'Consumables such as batteries, fans, fuses, bulbs, seals or similar parts',
                'Items sold as-is, for parts, repair only, damaged or non-working',
                'Losses related to downtime, production delay, labor, installation or consequential damages',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="4. Return Eligibility">
            <p>Returns may be accepted only when one of the following applies:</p>

            <ul className="mt-2 space-y-2">
              {[
                'The product received does not match the confirmed order',
                'The item arrives damaged and the issue is reported promptly',
                'The product is proven defective upon receipt and is covered by written warranty terms',
                'A return has been approved in writing by Orbit Control Automation',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <p>
              Return requests must be submitted within 7 days of delivery unless a
              different period is stated in writing. The request must include the
              invoice number, part number, photos and a clear description of the issue.
            </p>
          </Section>

          <Section title="5. Non-Returnable Items">
            <p>The following items are generally non-returnable:</p>

            <ul className="mt-2 space-y-2">
              {[
                'Special-order or specially sourced products',
                'Obsolete, discontinued or limited-availability parts',
                'Products installed, used, modified or opened after delivery',
                'Software, licenses, firmware, digital products or configured items',
                'Products sold as-is, final sale or non-returnable',
                'Items returned without prior written authorization',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="6. Return Authorization">
            <p>
              No product may be returned without prior written approval. If a return is
              approved, Orbit Control Automation will issue return instructions. The
              product must be returned in the same condition received, properly packed
              and protected against shipping damage.
            </p>

            <p>
              Unauthorized returns may be refused, returned to the sender or held until
              further instructions are provided.
            </p>
          </Section>

          <Section title="7. Refunds and Replacements">
            <p>
              If a warranty claim is approved, Orbit Control Automation may, at its
              discretion, provide a replacement, repair, credit note or refund depending
              on product availability and the original sales terms.
            </p>

            <p>
              Refunds, when approved, are processed after the returned item is received
              and inspected. Shipping, customs duties, taxes, bank fees and handling
              charges may be non-refundable unless otherwise agreed in writing.
            </p>
          </Section>

          <Section title="8. Shipping Damage">
            <p>
              Any shipping damage must be reported immediately upon delivery. Customers
              should keep all packaging materials and provide clear photos of the
              package, label, product and damage. Claims may be rejected if damage is
              reported late or without supporting evidence.
            </p>
          </Section>

          <Section title="9. Contact for Warranty or Return Requests">
            <p>
              Email:{' '}
              <a
                href="mailto:info@orbit-surplus.com"
                className="text-gold-500 transition hover:text-gold-400"
              >
                info@orbit-surplus.com
              </a>
            </p>

            <p>Phone: +971 55 483 5199</p>

            <p>
              Please include your invoice number, part number, photos and a detailed
              explanation of the issue when contacting us.
            </p>
          </Section>

          <div className="rounded-xl border border-gold-500/20 bg-navy-800 p-6 text-center">
            <p className="mb-3 text-sm text-slate-300">
              Questions about warranty, returns or product condition?
            </p>

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

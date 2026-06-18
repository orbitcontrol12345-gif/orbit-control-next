import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Globe,
  ShieldCheck,
  Zap,
  Award,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'About Us — Orbit Control Automation',
  description:
    'Orbit Control Automation is a UAE-based global supplier of industrial automation, electrical, surplus and obsolete spare parts including PLCs, HMIs, VFDs, sensors, relays and circuit breakers.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen pt-20">
      <div
        className="relative border-b border-navy-700"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(8,13,26,0.97), rgba(8,13,26,0.85)), url('https://images.pexels.com/photos/1148820/pexels-photo-1148820.jpeg?auto=compress&cs=tinysrgb&w=1920')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="page-container py-16">
          <div className="max-w-2xl">
            <h1 className="mb-5 text-4xl font-bold leading-tight text-white md:text-5xl">
              About Orbit Control{' '}
              <span className="text-gold-500">Automation</span>
            </h1>
            <p className="text-lg leading-relaxed text-slate-300">
              Global supplier of industrial automation, electrical, surplus and obsolete spare parts from the United Arab Emirates.
            </p>
          </div>
        </div>
      </div>

      <div className="page-container py-16">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="mb-5 text-2xl font-bold text-white md:text-3xl">
              Who We Are
            </h2>

            <div className="space-y-4 leading-relaxed text-slate-300">
              <p>
                Orbit Control Automation is a professional B2B supplier of industrial automation, electrical components, surplus inventory and obsolete spare parts. Based in the United Arab Emirates, we support manufacturers, maintenance companies, system integrators and industrial distributors worldwide.
              </p>

              <p>
                Our inventory covers PLCs, HMIs, VFDs, sensors, relays, contactors, circuit breakers, power supplies, control boards, industrial panels and hard-to-find automation equipment from leading global brands including Siemens, ABB, Schneider Electric, Allen-Bradley, Omron, Honeywell, Yokogawa, Mitsubishi Electric and many others.
              </p>

              <p>
                We specialize in sourcing discontinued and obsolete industrial parts that are no longer available through standard distribution channels, helping customers reduce downtime and keep critical operations running efficiently.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/rfq"
                className="inline-flex items-center justify-center rounded-xl bg-gold-500 px-6 py-3 font-semibold text-navy-900 transition hover:bg-gold-400"
              >
                Request a Quote
              </Link>

              <Link
                href="/products"
                className="inline-flex items-center justify-center rounded-xl border border-gold-500/30 px-6 py-3 font-semibold text-white transition hover:border-gold-400 hover:bg-gold-500/10"
              >
                Browse Products
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              {
                icon: Globe,
                title: 'Worldwide Supply',
                desc: 'Export-ready shipping to customers worldwide',
              },
              {
                icon: Zap,
                title: 'Fast RFQ Response',
                desc: 'Quick quotation support for urgent requirements',
              },
              {
                icon: ShieldCheck,
                title: 'Inspected Stock',
                desc: 'New, used, refurbished and surplus parts',
              },
              {
                icon: Award,
                title: 'Obsolete Specialists',
                desc: 'Hard-to-find industrial automation components',
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-xl border border-navy-700 bg-navy-800 p-5"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-gold-500/20 bg-gold-500/10">
                  <Icon size={18} className="text-gold-500" />
                </div>
                <h3 className="mb-1 text-sm font-bold text-white">{title}</h3>
                <p className="text-xs leading-relaxed text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-y border-navy-700 bg-navy-800">
        <div className="page-container py-14">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-white md:text-3xl">
              What We Supply
            </h2>
            <p className="mt-2 text-slate-400">
              Industrial automation and electrical spare parts for critical operations
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {[
              'Programmable Logic Controllers (PLCs)',
              'Human Machine Interfaces (HMIs)',
              'Variable Frequency Drives (VFDs)',
              'Servo Drives & Motors',
              'Industrial Sensors',
              'Circuit Breakers & Protection',
              'Relays & Contactors',
              'DIN Rail Power Supplies',
              'Control Cards & Boards',
              'Safety Devices',
              'Obsolete Automation Parts',
              'Surplus Industrial Equipment',
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 rounded-lg border border-navy-600 bg-navy-700 px-3 py-3"
              >
                <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />
                <span className="text-xs font-medium leading-tight text-slate-300">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

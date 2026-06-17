import type { Metadata } from 'next';
import Link from 'next/link';
import { Globe, ShieldCheck, Zap, Users, Package, Award, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About Us — Xeltronic Electrical Solution',
  description:
    'Xeltronic Electrical Solution is a global B2B supplier of industrial automation and electrical spare parts based in the UAE. Learn about our company, values, and expertise.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-navy-900 pt-20">
      {/* Hero */}
      <div
        className="relative border-b border-navy-700"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(8,13,26,0.97), rgba(8,13,26,0.85)), url('https://images.pexels.com/photos/1148820/pexels-photo-1148820.jpeg?auto=compress&cs=tinysrgb&w=1920')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="page-container py-16">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-5 leading-tight">
              About Xeltronic{' '}
              <span className="text-gold-500">Electrical Solution</span>
            </h1>
            <p className="text-lg text-slate-300 leading-relaxed">
              A specialist global supplier of industrial automation and electrical spare parts, based in the United Arab Emirates.
            </p>
          </div>
        </div>
      </div>

      {/* Who we are */}
      <div className="page-container py-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-5">
              Who We Are
            </h2>
            <div className="space-y-4 text-slate-300 leading-relaxed">
              <p>
                Xeltronic Electrical Solution is a professional B2B industrial spare parts supplier operating out of the United Arab Emirates. We specialize in sourcing and supplying industrial automation and electrical components to manufacturers, engineering firms, and plant maintenance teams across the globe.
              </p>
              <p>
                Our team has extensive experience in the industrial automation sector, with deep knowledge of PLCs, HMIs, variable frequency drives, sensors, circuit protection, and control systems from all major manufacturers including Siemens, ABB, Allen-Bradley (Rockwell), Omron, Schneider Electric, and many others.
              </p>
              <p>
                We are particularly known for our ability to source hard-to-find and obsolete automation parts that are no longer in production but are critical for keeping existing industrial equipment running.
              </p>
            </div><div className="mt-8 flex gap-4">
  <Link
    href="/rfq"
    className="inline-flex items-center justify-center rounded-xl bg-gold-500 px-6 py-3 font-semibold text-navy-900 hover:bg-gold-400 transition"
  >
    Request a Quote
  </Link>

  <Link
    href="/products"
    className="inline-flex items-center justify-center rounded-xl border border-gold-500/30 px-6 py-3 font-semibold text-white hover:border-gold-400 hover:bg-gold-500/10 transition"
  >
    Browse Products
  </Link>
</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Globe, title: 'Global Reach', desc: 'Shipping to 200+ countries with DHL & FedEx' },
              { icon: Zap, title: 'Rapid Response', desc: 'Quote within 24 hours on most inquiries' },
              { icon: ShieldCheck, title: 'Quality Assured', desc: 'Every part tested and inspected' },
              { icon: Award, title: 'Specialist Knowledge', desc: 'Deep expertise in industrial automation' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-navy-800 border border-navy-700 rounded-xl p-5">
                <div className="w-10 h-10 bg-gold-500/10 border border-gold-500/20 rounded-lg flex items-center justify-center mb-3">
                  <Icon size={18} className="text-gold-500" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">{title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* What we do */}
      <div className="bg-navy-800 border-y border-navy-700">
        <div className="page-container py-14">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-white">What We Supply</h2>
            <p className="text-slate-400 mt-2">Comprehensive range of industrial automation and electrical components</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {[
              'Programmable Logic Controllers (PLCs)',
              'Human Machine Interfaces (HMIs)',
              'Variable Frequency Drives (VFDs)',
              'Servo Drives & Motors',
              'Industrial Sensors',
              'Circuit Breakers & Protection',
              'Industrial Relays',
              'DIN Rail Power Supplies',
              'Control Cards & Boards',
              'Safety Devices',
              'Obsolete Automation Parts',
              'Field Instruments & Transmitters',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 bg-navy-700 border border-navy-600 rounded-lg px-3 py-3">
                <div className="w-1.5 h-1.5 bg-gold-500 rounded-full shrink-0" />
                <span className="text-xs text-slate-300 font-medium leading-tight">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Values */}
      <div className="page-container py-14">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-white">Our Commitments</h2>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
          {[
            {
              icon: ShieldCheck,
              title: 'Genuine Parts Only',
              desc: 'We supply genuine, verified parts from trusted sources. Every item is inspected and tested before dispatch.',
            },
            {
              icon: Zap,
              title: 'Fast Turnaround',
              desc: 'We understand that equipment downtime is costly. Our team prioritizes urgent requests and fast shipping.',
            },
            {
              icon: Globe,
              title: 'Worldwide Shipping',
              desc: 'We ship to over 200 countries using DHL Express and FedEx International Priority.',
            },
            {
              icon: Users,
              title: 'Expert Support',
              desc: 'Our team has deep technical knowledge and can assist with cross-references and compatibility.',
            },
            {
              icon: Package,
              title: 'Obsolete Parts',
              desc: 'We specialize in discontinued and hard-to-find parts that other suppliers cannot source.',
            },
            {
              icon: Award,
              title: 'Competitive Pricing',
              desc: 'We offer fair, transparent pricing with no hidden costs. Bulk order discounts available.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-navy-800 border border-navy-700 rounded-xl p-6">
              <div className="w-11 h-11 bg-gold-500/10 border border-gold-500/20 rounded-lg flex items-center justify-center mb-4">
                <Icon size={20} className="text-gold-500" />
              </div>
              <h3 className="font-bold text-white mb-2">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="bg-navy-800 border-t border-navy-700">
        <div className="page-container py-14 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Ready to Get Started?</h2>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            Submit your part number and receive a competitive quote within 24 hours.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/rfq" className="btn-gold justify-center">
              <Package size={16} />
              Request a Quote
            </Link>
            <Link href="/contact" className="btn-outline-slate justify-center">
              Contact Us <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

import Link from 'next/link';
import HeroGlobe from '@/components/home/HeroGlobe';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Globe2,
  PackageCheck,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
  Zap,
} from 'lucide-react';

import HeroSearchBar from '@/components/shared/HeroSearchBar';

const POPULAR_SEARCHES = [
  '6ES7',
  '2711P',
  'A06B',
  'IC693',
  'ACS800',
  '140M',
];

const TRUST_POINTS = [
  {
    icon: ShieldCheck,
    title: 'Verified Industrial Stock',
  },
  {
    icon: Globe2,
    title: 'Worldwide B2B Supply',
  },
  {
    icon: Truck,
    title: 'DHL & FedEx Shipping',
  },
];

const STATS = [
  {
    value: '14,000+',
    label: 'Industrial Parts',
  },
  {
    value: '200+',
    label: 'Global Brands',
  },
  {
    value: '24h',
    label: 'RFQ Target',
  },
];

const WORKFLOW = [
  {
    number: '01',
    icon: Search,
    title: 'Search',
    description: 'Enter a part number, model, manufacturer, or product name.',
  },
  {
    number: '02',
    icon: PackageCheck,
    title: 'Verify',
    description: 'We confirm stock, condition, quantity, and product photos.',
  },
  {
    number: '03',
    icon: FileText,
    title: 'Quote',
    description: 'Receive pricing, availability, and worldwide shipping options.',
  },
];

export default function HeroV2() {
  return (
    <section className="relative isolate min-h-[92vh] overflow-hidden border-b border-white/10 bg-[#030914]">
      {/* Background */}
      <div
        className="absolute inset-0 -z-30"
        style={{
          background:
            'radial-gradient(circle at 16% 18%, rgba(34,211,238,0.16), transparent 27%), radial-gradient(circle at 84% 16%, rgba(245,158,11,0.13), transparent 29%), radial-gradient(circle at 58% 82%, rgba(14,165,233,0.10), transparent 34%), linear-gradient(135deg, #030914 0%, #06121f 48%, #02060c 100%)',
        }}
      />

      <div
        className="absolute inset-0 -z-20 opacity-[0.075]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage:
            'linear-gradient(to bottom, black 0%, black 66%, transparent 100%)',
        }}
      />

      <div className="absolute left-[-180px] top-24 -z-10 h-[420px] w-[420px] rounded-full bg-cyan-400/10 blur-[100px]" />
      <div className="absolute right-[-160px] top-10 -z-10 h-[440px] w-[440px] rounded-full bg-amber-400/10 blur-[110px]" />

      <div className="page-container flex min-h-[92vh] items-center py-28 lg:py-32">
        <div className="grid w-full items-center gap-14 lg:grid-cols-[1.02fr_0.98fr] xl:gap-10">
  {/* Left side */}
  <div>
    {/* يبقى المحتوى الموجود كما هو */}
  </div>

  {/* Right side */}
  <div className="hidden lg:block">
    <HeroGlobe />
  </div>
</div>

            <h1 className="max-w-5xl text-5xl font-black leading-[0.98] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl xl:text-[84px]">
              Industrial Automation
              <span className="mt-2 block bg-gradient-to-r from-cyan-200 via-white to-amber-200 bg-clip-text text-transparent">
                Without Limits.
              </span>
            </h1>

            <p className="mt-7 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              Source PLCs, HMIs, VFDs, servo drives, circuit breakers,
              industrial boards, sensors, power supplies, and obsolete spare
              parts from one global supplier.
            </p>

            {/* Main Search */}
            <div className="relative mt-9 max-w-3xl">
              <div className="absolute -inset-1 rounded-[1.6rem] bg-gradient-to-r from-cyan-400/25 via-white/5 to-amber-400/25 blur-xl" />

              <div className="relative rounded-[1.6rem] border border-white/10 bg-white/[0.065] p-3 shadow-2xl shadow-black/40 backdrop-blur-2xl">
                <div className="mb-3 flex items-center justify-between gap-4 px-2">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
                    <Sparkles size={14} />
                    Search Industrial Inventory
                  </div>

                  <span className="hidden text-xs text-slate-500 sm:inline">
                    Part number gives best results
                  </span>
                </div>

                <HeroSearchBar />
              </div>
            </div>

            {/* Popular Searches */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                Popular:
              </span>

              {POPULAR_SEARCHES.map((item) => (
                <Link
                  key={item}
                  href={`/products?search=${encodeURIComponent(item)}`}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-slate-300 transition duration-300 hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-cyan-100"
                >
                  {item}
                </Link>
              ))}
            </div>

            {/* Buttons */}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/rfq"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 px-6 py-3.5 text-sm font-black text-[#111827] shadow-xl shadow-amber-950/30 transition duration-300 hover:-translate-y-0.5 hover:shadow-amber-900/40"
              >
                <FileText size={18} />
                Request a Quote
              </Link>

              <Link
                href="/products"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-6 py-3.5 text-sm font-black text-white backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-cyan-300/[0.08]"
              >
                Browse Inventory
                <ArrowRight size={18} />
              </Link>
            </div>

            {/* Trust Points */}
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3">
              {TRUST_POINTS.map(({ icon: Icon, title }) => (
                <div
                  key={title}
                  className="flex items-center gap-2 text-sm text-slate-400"
                >
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <Icon size={15} className="text-cyan-200" />
                  <span>{title}</span>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="mt-10 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
              {STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="group rounded-2xl border border-white/10 bg-white/[0.045] px-5 py-4 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-cyan-300/[0.065]"
                >
                  <div className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                    {stat.value}
                  </div>

                  <div className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-cyan-200">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right side */}
          <div className="hidden lg:block">
            <div className="relative mx-auto max-w-xl">
              <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-br from-cyan-400/20 via-transparent to-amber-400/20 blur-2xl" />

              <div className="relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-[#071522]/85 p-6 shadow-2xl shadow-black/50 backdrop-blur-2xl xl:p-7">
                <div className="absolute right-[-60px] top-[-70px] h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl" />
                <div className="absolute bottom-[-90px] left-[-60px] h-52 w-52 rounded-full bg-amber-400/10 blur-3xl" />

                <div className="relative">
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                        <Zap size={14} />
                        Industrial Sourcing
                      </div>

                      <h2 className="mt-3 text-3xl font-black tracking-tight text-white">
                        {/* Right side */}
<div className="hidden lg:block">
  <HeroGlobe />
</div>
                        </span>
                      </h2>
                    </div>

                    <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-emerald-300">
                      Online
                    </div>
                  </div>

                  <div className="mt-8 space-y-4">
                    {WORKFLOW.map(
                      ({ number, icon: Icon, title, description }, index) => (
                        <div key={number} className="relative">
                          {index < WORKFLOW.length - 1 && (
                            <div className="absolute left-[23px] top-[52px] h-8 w-px bg-gradient-to-b from-cyan-300/45 to-transparent" />
                          )}

                          <div className="group flex gap-4 rounded-2xl border border-white/10 bg-white/[0.045] p-4 transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/30 hover:bg-cyan-300/[0.065]">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                              <Icon size={20} />
                            </div>

                            <div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-black text-amber-300">
                                  {number}
                                </span>

                                <h3 className="font-black text-white">
                                  {title}
                                </h3>
                              </div>

                              <p className="mt-1.5 text-sm leading-6 text-slate-400">
                                {description}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    {[
                      'New & Surplus',
                      'Used Stock',
                      'Refurbished',
                      'Obsolete Parts',
                    ].map((label) => (
                      <div
                        key={label}
                        className="rounded-xl border border-amber-300/15 bg-amber-300/[0.07] px-4 py-3 text-center text-xs font-black uppercase tracking-wider text-amber-200"
                      >
                        {label}
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-5 py-4">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-500">
                        Supply Operations
                      </p>
                      <p className="mt-1 font-black text-white">
                        Ajman, United Arab Emirates
                      </p>
                    </div>

                    <Globe2 className="text-cyan-200" size={26} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

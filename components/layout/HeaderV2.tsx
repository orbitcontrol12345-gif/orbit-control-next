import Link from 'next/link';
import {
  ArrowRight,
  Box,
  CheckCircle2,
  Clock3,
  FileText,
  Globe2,
  Search,
  ShieldCheck,
  Truck,
  Zap,
} from 'lucide-react';

import HeroGlobe from '@/components/home/HeroGlobe';
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
    title: 'Verified Stock',
    description: 'Inspected & Tested',
  },
  {
    icon: Globe2,
    title: 'Worldwide Shipping',
    description: 'DHL & FedEx',
  },
  {
    icon: Zap,
    title: 'Fast RFQ Response',
    description: 'Within 24 Hours',
  },
];

const STATS = [
  {
    icon: Box,
    value: '14,000+',
    label: 'Industrial Parts',
  },
  {
    icon: Globe2,
    value: '200+',
    label: 'Global Brands',
  },
  {
    icon: Clock3,
    value: '24h',
    label: 'RFQ Target',
  },
  {
    icon: Truck,
    value: '65+',
    label: 'Countries Served',
  },
];

export default function HeroV2() {
  return (
    <section className="relative isolate overflow-hidden border-b border-cyan-400/10 bg-[#020711]">
      {/* Main background */}
      <div
        className="absolute inset-0 -z-40"
        style={{
          background:
            'radial-gradient(circle at 21% 28%, rgba(0,174,239,0.16), transparent 32%), radial-gradient(circle at 78% 22%, rgba(245,158,11,0.10), transparent 31%), linear-gradient(105deg, #020711 0%, #04101d 48%, #01050b 100%)',
        }}
      />

      {/* Grid */}
      <div
        className="absolute inset-0 -z-30 opacity-[0.055]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(56,189,248,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.35) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage:
            'linear-gradient(to bottom, black 0%, black 72%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, black 0%, black 72%, transparent 100%)',
        }}
      />

      {/* Background lighting */}
      <div className="absolute -left-48 top-16 -z-20 h-[560px] w-[560px] rounded-full bg-cyan-500/[0.09] blur-[130px]" />

      <div className="absolute -right-52 top-0 -z-20 h-[620px] w-[620px] rounded-full bg-amber-400/[0.08] blur-[150px]" />

      {/* Decorative horizontal light */}
      <div className="absolute left-0 right-0 top-[64%] -z-10 hidden h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent lg:block" />

      {/* Hero main content */}
      <div className="page-container relative">
        <div className="grid min-h-[690px] items-center gap-10 py-14 lg:min-h-[720px] lg:grid-cols-[0.94fr_1.06fr] lg:py-16 xl:min-h-[760px] xl:gap-0">
          {/* Left content */}
          <div className="relative z-20 max-w-[720px]">
            <div className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-cyan-400 sm:text-sm">
              Industrial Automation Parts
            </div>

            <h1 className="max-w-[720px] text-[46px] font-black uppercase leading-[0.98] tracking-[-0.045em] text-white sm:text-[62px] lg:text-[66px] xl:text-[76px]">
              Industrial
              <span className="block">Automation</span>

              <span className="mt-2 block bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 bg-clip-text text-transparent">
                Without Limits.
              </span>
            </h1>

            <p className="mt-6 max-w-[650px] text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
              Your global partner for PLCs, HMIs, VFDs, sensors, drives,
              circuit breakers and obsolete industrial automation parts.
            </p>

            {/* Search box */}
            <div className="relative mt-8 max-w-[720px]">
              <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-cyan-400/20 via-transparent to-amber-400/20 blur-lg" />

              <div className="relative overflow-hidden rounded-xl border border-white/15 bg-[#06111d]/90 shadow-[0_20px_70px_rgba(0,0,0,0.46)] backdrop-blur-xl">
                <HeroSearchBar />
              </div>
            </div>

            {/* Popular searches */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="mr-2 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">
                Popular Searches
              </span>

              {POPULAR_SEARCHES.map((item) => (
                <Link
                  key={item}
                  href={`/products?search=${encodeURIComponent(item)}`}
                  className="rounded-md border border-cyan-400/25 bg-cyan-400/[0.025] px-3 py-1.5 text-[11px] font-semibold text-cyan-100 transition duration-300 hover:border-amber-400/60 hover:bg-amber-400/[0.08] hover:text-amber-200"
                >
                  {item}
                </Link>
              ))}
            </div>

            {/* Action buttons */}
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/rfq"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 px-6 text-sm font-black text-[#111827] shadow-[0_12px_35px_rgba(245,158,11,0.2)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(245,158,11,0.32)]"
              >
                <FileText size={18} />
                Request a Quote
              </Link>

              <Link
                href="/products"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/[0.035] px-6 text-sm font-bold text-white transition duration-300 hover:-translate-y-0.5 hover:border-cyan-300/50 hover:bg-cyan-300/[0.09]"
              >
                Browse Inventory
                <ArrowRight size={17} />
              </Link>
            </div>

            {/* Trust features */}
            <div className="mt-8 grid max-w-[720px] gap-3 sm:grid-cols-3">
              {TRUST_POINTS.map(
                ({ icon: Icon, title, description }) => (
                  <div
                    key={title}
                    className="group flex min-h-[76px] items-center gap-3 rounded-xl border border-white/[0.08] bg-[#071522]/75 px-4 py-3 backdrop-blur transition duration-300 hover:border-cyan-400/25 hover:bg-cyan-400/[0.05]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-300 transition group-hover:border-amber-400/30 group-hover:bg-amber-400/[0.08] group-hover:text-amber-300">
                      <Icon size={20} strokeWidth={1.8} />
                    </div>

                    <div>
                      <div className="text-[12px] font-black uppercase leading-4 text-white">
                        {title}
                      </div>

                      <div className="mt-1 text-[11px] text-slate-500">
                        {description}
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Right globe */}
          <div className="relative hidden min-h-[620px] items-center justify-center lg:flex">
            <div className="absolute left-[5%] top-[12%] h-[480px] w-[480px] rounded-full bg-cyan-400/[0.06] blur-[100px]" />

            <div className="relative z-10 w-full scale-[1.08] xl:scale-[1.16]">
              <HeroGlobe />
            </div>

            {/* Location card */}
            <div className="absolute right-[2%] top-[39%] z-20 w-[190px] rounded-xl border border-cyan-400/20 bg-[#061423]/90 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl xl:right-[1%]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/25 bg-cyan-400/[0.07]">
                  <div className="relative h-5 w-5 rounded-full border border-amber-400">
                    <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.9)]" />
                  </div>
                </div>

                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.14em] text-cyan-300">
                    Supply Hub
                  </div>

                  <div className="mt-1 text-sm font-black uppercase text-white">
                    Ajman, UAE
                  </div>

                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400">
                    <span>🇦🇪</span>
                    Global Distribution
                  </div>
                </div>
              </div>
            </div>

            {/* Online indicator */}
            <div className="absolute bottom-[15%] left-[16%] z-20 flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>

              Global Supply Network
            </div>
          </div>
        </div>
      </div>

      {/* Statistics strip */}
      <div className="relative border-t border-cyan-400/15 bg-[#03101c]/90">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

        <div className="page-container py-5 lg:py-6">
          <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-cyan-400/20 bg-[#04111e]/80 shadow-[0_10px_50px_rgba(0,0,0,0.3)] md:grid-cols-4">
            {STATS.map(({ icon: Icon, value, label }, index) => (
              <div
                key={label}
                className={`group flex min-h-[102px] items-center gap-4 px-5 py-5 transition hover:bg-cyan-400/[0.04] lg:px-8 ${
                  index !== STATS.length - 1
                    ? 'border-r border-white/[0.07]'
                    : ''
                } ${
                  index < 2
                    ? 'border-b border-white/[0.07] md:border-b-0'
                    : ''
                }`}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/[0.07] text-cyan-300 transition duration-300 group-hover:border-amber-400/40 group-hover:text-amber-300">
                  <Icon size={23} strokeWidth={1.7} />
                </div>

                <div>
                  <div className="text-2xl font-black tracking-tight text-white lg:text-3xl">
                    {value}
                  </div>

                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 lg:text-[11px]">
                    {label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile value strip */}
      <div className="page-container pb-7 lg:hidden">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-white/[0.07] pt-5 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-emerald-400" />
            Genuine Industrial Parts
          </span>

          <span className="flex items-center gap-1.5">
            <Search size={13} className="text-cyan-400" />
            Search by Part Number
          </span>

          <span className="flex items-center gap-1.5">
            <Truck size={13} className="text-amber-400" />
            Worldwide Delivery
          </span>
        </div>
      </div>
    </section>
  );
}

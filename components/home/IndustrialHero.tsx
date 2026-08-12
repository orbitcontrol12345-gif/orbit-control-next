import Link from 'next/link';
import {
  ArrowRight,
  Cpu,
  FileText,
  Gauge,
  Globe2,
  Headphones,
  Monitor,
  Radio,
  Settings2,
  ShieldCheck,
  Truck,
  Zap,
} from 'lucide-react';

import HeroGlobe from '@/components/home/HeroGlobe';
import HeroSearchBar from '@/components/shared/HeroSearchBar';

const FLOATING_CARDS = [
  { label: 'PLCs', Icon: Cpu, className: 'left-[2%] top-[22%]' },
  { label: 'HMIs', Icon: Monitor, className: 'left-[-2%] top-[48%]' },
  { label: 'Sensors', Icon: Radio, className: 'left-[8%] bottom-[15%]' },
  { label: 'Drives', Icon: Zap, className: 'right-[2%] top-[27%]' },
  { label: 'Control Systems', Icon: Settings2, className: 'right-[-4%] bottom-[22%]' },
];

function getStats(productsCount: string) {
  return [
    [productsCount, 'Listed Products', 'Active catalog'],
    ['200+', 'Global Brands', 'Automation supply'],
    ['24h', 'RFQ Target', 'Fast response'],
    ['100+', 'Countries Served', 'Global distribution'],
  ];
}
const STATS = [
  ['64,000+', 'Industrial Items', 'Live inventory'],
  ['200+', 'Global Brands', 'Automation supply'],
  ['24h', 'RFQ Target', 'Fast response'],
  ['100+', 'Countries Served', 'Global distribution'],
];

export default function IndustrialHero({
  productsCount,
}: {
  productsCount: string;
}) {
  const STATS = getStats(productsCount);
  return (
    <section className="relative overflow-hidden border-b border-cyan-400/10 bg-[#04101b]">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 15% 18%, rgba(34,211,238,0.18), transparent 27%), radial-gradient(circle at 88% 12%, rgba(245,158,11,0.16), transparent 29%), radial-gradient(circle at 55% 88%, rgba(14,165,233,0.10), transparent 36%), linear-gradient(135deg, #04101b 0%, #071827 45%, #050b13 100%)',
        }}
      />

      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          background:
            'linear-gradient(rgba(255,255,255,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.14) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />

      <div className="absolute left-[-120px] top-28 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="absolute right-[-100px] top-20 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />

      <div className="page-container relative grid min-h-[82vh] items-center gap-10 py-14 lg:min-h-[88vh] lg:grid-cols-[0.94fr_1.06fr] lg:gap-12 lg:py-20">
        <div className="relative z-10">
          <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-cyan-100 shadow-lg shadow-cyan-950/30">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            Orbit Control Automation — UAE
          </div>

          <h1 className="max-w-4xl text-[40px] font-black leading-[1.02] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-[68px]">
            Industrial Automation
            <span className="block text-amber-300">Parts Delivered</span>
            <span className="block">Worldwide.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-[15px] leading-7 text-slate-300 sm:text-lg sm:leading-8">
            Source PLCs, HMIs, VFDs, sensors, relays, circuit breakers,
            control boards, obsolete and surplus automation spare parts
            with fast RFQ support.
          </p>

          <div className="mt-7 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            {TRUST_ITEMS.map(({ label, Icon }) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-center backdrop-blur"
              >
                <Icon className="mx-auto text-amber-300" size={21} />
                <p className="mt-2 text-[11px] font-bold leading-4 text-slate-200">
                  {label}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-7 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.06] p-3 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="mb-3 flex flex-wrap gap-2 px-1 text-xs font-bold uppercase tracking-wider text-slate-400">
              <span className="rounded-full bg-cyan-300/10 px-3 py-1 text-cyan-200">Part Number</span>
              <span className="rounded-full bg-white/5 px-3 py-1">Manufacturer</span>
              <span className="rounded-full bg-white/5 px-3 py-1">Model</span>
              <span className="rounded-full bg-white/5 px-3 py-1">Obsolete Stock</span>
            </div>
            <HeroSearchBar />
          </div>

          <div className="mt-5 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
            <Link
              href="/rfq"
              className="btn-gold w-full justify-center shadow-xl shadow-amber-950/30"
            >
              <FileText size={18} />
              Request a Quote
            </Link>

            <Link
              href="/products"
              className="btn-outline-slate w-full justify-center"
            >
              Browse Inventory
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>

        <div className="relative hidden min-h-[620px] lg:block">
          <div className="absolute inset-x-[10%] top-[8%] h-[78%] rounded-full bg-cyan-300/[0.07] blur-3xl" />

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-full max-w-[760px] scale-[1.05]">
              <HeroGlobe />
            </div>
          </div>

          {FLOATING_CARDS.map(({ label, Icon, className }) => (
            <div
              key={label}
              className={`absolute z-20 flex items-center gap-3 rounded-2xl border border-cyan-200/20 bg-[#0b1b2b]/85 px-4 py-3 text-sm font-bold text-white shadow-2xl shadow-black/30 backdrop-blur-md ${className}`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-300/10 text-amber-300">
                <Icon size={19} />
              </span>
              {label}
            </div>
          ))}

          <div className="absolute bottom-[7%] left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-[#071827]/85 px-5 py-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-100 shadow-xl backdrop-blur">
            <Truck size={16} className="text-amber-300" />
            Global Industrial Supply Network
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/10 bg-[#06121f]/88 backdrop-blur">
        <div className="page-container grid grid-cols-2 gap-3 py-4 lg:grid-cols-4 lg:gap-0">
          {STATS.map(([value, label, note], index) => (
            <div
              key={label}
              className={`px-4 py-3 ${index > 0 ? 'lg:border-l lg:border-white/10' : ''}`}
            >
              <div className="text-2xl font-black text-white sm:text-3xl">{value}</div>
              <div className="mt-1 text-[10px] font-black uppercase tracking-wider text-amber-300 sm:text-xs">{label}</div>
              <div className="mt-1 text-[10px] text-slate-400 sm:text-xs">{note}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

import Link from 'next/link';
import {
  ArrowRight,
  Box,
  Cpu,
  Monitor,
  Shield,
  Zap,
  BadgeCheck,
} from 'lucide-react';

const products = [
  {
    title: 'Siemens SIMATIC S7 PLC Module',
    partNumber: '6ES7 315-2AG10-0AB0',
    category: 'PLC Systems',
    condition: 'New Surplus',
    icon: Cpu,
  },
  {
    title: 'Allen-Bradley PanelView Plus HMI',
    partNumber: '2711P-T10C4D8',
    category: 'HMI Panels',
    condition: 'Used',
    icon: Monitor,
  },
  {
    title: 'Schneider Electric Variable Speed Drive',
    partNumber: 'ATV630D30N4',
    category: 'Drives & VFDs',
    condition: 'New Without Box',
    icon: Zap,
  },
  {
    title: 'ABB Molded Case Circuit Breaker',
    partNumber: 'T5N 400',
    category: 'Circuit Breakers',
    condition: 'New Surplus',
    icon: Shield,
  },
];

export default function FeaturedShowcase() {
  return (
    <section className="relative overflow-hidden border-y border-white/[0.06] bg-[#04101b] py-24">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.14) 1px, transparent 1px)',
          backgroundSize: '58px 58px',
        }}
      />

      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[800px] -translate-x-1/2 rounded-full bg-cyan-400/[0.05] blur-[130px]" />

      <div className="page-container relative">
        <div className="mb-14 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.35em] text-amber-300">
              Featured Inventory
            </p>

            <h2 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
              Industrial Parts Ready For Your RFQ
            </h2>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">
              Browse a selection of high-demand automation components from
              leading manufacturers. Product data will be connected to the live
              inventory after the homepage design is completed.
            </p>
          </div>

          <Link
            href="/products"
            className="inline-flex w-fit items-center gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-6 py-3 text-sm font-black uppercase tracking-[0.12em] text-cyan-200 transition duration-300 hover:border-cyan-300/40 hover:bg-cyan-300/[0.12]"
          >
            View All Products
            <ArrowRight size={17} />
          </Link>
        </div>

        <div className="grid gap-7 md:grid-cols-2 xl:grid-cols-4">
          {products.map((product) => {
            const Icon = product.icon;

            return (
              <article
                key={product.partNumber}
                className="group relative overflow-hidden rounded-2xl border border-white/[0.09] bg-[#071522] transition duration-300 hover:-translate-y-2 hover:border-cyan-300/30"
              >
                <div className="relative flex h-56 items-center justify-center overflow-hidden border-b border-white/[0.07] bg-[#081a29]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.09),transparent_65%)] opacity-0 transition duration-500 group-hover:opacity-100" />

                  <div className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[0.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-200">
                    <BadgeCheck size={13} />
                    {product.condition}
                  </div>

                  <div className="relative flex h-28 w-28 items-center justify-center rounded-3xl border border-cyan-300/10 bg-cyan-300/[0.05] text-cyan-200 transition duration-500 group-hover:scale-110 group-hover:rotate-2">
                    <Icon size={55} strokeWidth={1.4} />
                  </div>
                </div>

                <div className="p-6">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-300">
                    {product.category}
                  </p>

                  <h3 className="mt-3 min-h-[56px] text-lg font-black leading-7 text-white">
                    {product.title}
                  </h3>

                  <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/15 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">
                      Part Number
                    </p>

                    <p className="mt-1 break-words text-sm font-bold text-slate-200">
                      {product.partNumber}
                    </p>
                  </div>

                  <Link
                    href={`/rfq?part=${encodeURIComponent(product.partNumber)}`}
                    className="mt-6 flex items-center justify-between border-t border-white/[0.07] pt-5 text-sm font-bold text-cyan-300 transition group-hover:text-cyan-200"
                  >
                    Request A Quote

                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] transition duration-300 group-hover:translate-x-1">
                      <ArrowRight size={16} />
                    </span>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-5 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-6 py-6 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-4">
            <div className="hidden h-12 w-12 items-center justify-center rounded-xl bg-amber-300/10 text-amber-300 sm:flex">
              <Box size={23} />
            </div>

            <div>
              <p className="font-black text-white">
                Cannot find the part number you need?
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Send us your RFQ and our sourcing team will help locate it.
              </p>
            </div>
          </div>

          <Link
            href="/rfq"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-black text-[#07101b] transition duration-300 hover:-translate-y-0.5 hover:bg-amber-200"
          >
            Submit RFQ
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}

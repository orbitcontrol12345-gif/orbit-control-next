import Link from 'next/link';

const BRANDS = [
  'SIEMENS',
  'ALLEN-BRADLEY',
  'SCHNEIDER ELECTRIC',
  'ABB',
  'GE',
  'HONEYWELL',
  'FANUC',
  'OMRON',
  'MITSUBISHI',
  'YASKAWA',
];

function BrandRow() {
  return (
    <>
      {BRANDS.map((brand) => (
        <Link
          key={brand}
          href={`/brands?search=${encodeURIComponent(brand)}`}
          className="group flex h-24 min-w-[260px] items-center justify-center border-r border-white/[0.06] px-8 transition duration-300 hover:bg-white/[0.035]"
        >
          <span className="text-center text-2xl font-black tracking-[-0.02em] text-slate-400 transition duration-300 group-hover:text-cyan-200">
            {brand}
          </span>
        </Link>
      ))}
    </>
  );
}

export default function TrustedBrands() {
  return (
    <section className="relative overflow-hidden border-y border-cyan-300/10 bg-[#030b14] py-8">
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />

      <div className="page-container relative">
        <div className="mb-8 flex flex-col items-center justify-between gap-4 text-center md:flex-row md:text-left">
          <div>
           <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
  TRUSTED BY
</p>

            className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl"
              200+ Leading Industrial Brands
            </h2>
          </div>

          <div className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-5 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200"
            GLOBAL BRANDS
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-28 bg-gradient-to-r from-[#04101b] to-transparent" />

        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-28 bg-gradient-to-l from-[#04101b] to-transparent" />

        <div className="overflow-hidden rounded-2xl border border-cyan-300/10 bg-[#06101a]/80 shadow-[0_0_50px_rgba(0,180,255,0.05)]">
          <div className="flex w-max animate-[brandScroll_55s_linear_infinite]">
            <BrandRow />
            <BrandRow />
          </div>
        </div>
      </div>

      <div className="page-container relative mt-7">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs font-semibold text-slate-500">
          
          <span className="text-amber-300">•</span>
          <span>Obsolete Industrial Parts</span>
        </div>
      </div>
    </section>
  );
}

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
          className="group flex h-20 min-w-[220px] items-center justify-center border-r border-white/[0.06] px-8 transition duration-300 hover:bg-white/[0.035]"
        >
          <span className="text-center text-lg font-black tracking-[-0.02em] text-slate-500 transition duration-300 group-hover:text-white">
            {brand}
          </span>
        </Link>
      ))}
    </>
  );
}

export default function TrustedBrands() {
  return (
    <section className="relative overflow-hidden border-y border-white/[0.07] bg-[#04101b] py-12">
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
            <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">
              Trusted Manufacturers
            </p>

            <h2 className="mt-2 text-2xl font-black tracking-tight text-white md:text-3xl">
              Supplying automation parts from leading global brands
            </h2>
          </div>

          <div className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
            200+ Manufacturers
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-28 bg-gradient-to-r from-[#04101b] to-transparent" />

        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-28 bg-gradient-to-l from-[#04101b] to-transparent" />

        <div className="overflow-hidden border-y border-white/[0.06] bg-black/10">
          <div className="flex w-max animate-[brandScroll_36s_linear_infinite]">
            <BrandRow />
            <BrandRow />
          </div>
        </div>
      </div>

      <div className="page-container relative mt-7">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs font-semibold text-slate-500">
          <span>PLCs & Control Systems</span>
          <span className="text-amber-300">•</span>
          <span>HMIs & Operator Panels</span>
          <span className="text-amber-300">•</span>
          <span>Drives & Servo Systems</span>
          <span className="text-amber-300">•</span>
          <span>Circuit Breakers</span>
          <span className="text-amber-300">•</span>
          <span>Obsolete Industrial Parts</span>
        </div>
      </div>
    </section>
  );
}

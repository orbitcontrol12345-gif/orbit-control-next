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
           

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Factory, Search, ShieldCheck, Globe } from 'lucide-react';

import { BRANDS } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Industrial Automation Manufacturers | Orbit Control Automation',
  description:
    'Browse industrial automation manufacturers including ABB, Siemens, Schneider Electric, Allen-Bradley, Honeywell, Omron, Yokogawa, Mitsubishi Electric and more.',
};

const featuredBrands = BRANDS.slice(0, 12);

export default function ManufacturersPage() {
  const groupedBrands = BRANDS.reduce<Record<string, typeof BRANDS>>((acc, brand) => {
    const firstLetter = brand.name.charAt(0).toUpperCase();
    const key = /[A-Z]/.test(firstLetter) ? firstLetter : '#';

    if (!acc[key]) acc[key] = [];
    acc[key].push(brand);

    return acc;
  }, {});

  const letters = Object.keys(groupedBrands).sort();

  return (
    <main className="bg-[#06111d] text-white">
      <section className="relative overflow-hidden border-b border-white/10 py-20">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 20% 20%, rgba(34,211,238,0.16), transparent 30%), radial-gradient(circle at 85% 20%, rgba(245,158,11,0.14), transparent 28%), linear-gradient(135deg, #06111d 0%, #0b1f2f 55%, #06111d 100%)',
          }}
        />

        <div className="page-container relative">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-cyan-200">
              <Factory size={15} />
              Industrial Manufacturers
            </div>

            <h1 className="text-4xl font-black leading-tight md:text-6xl">
              Automation Brands & Manufacturers
            </h1>

            <p className="mt-6 text-lg leading-8 text-slate-300">
              Browse trusted industrial automation manufacturers for PLCs, HMIs,
              VFDs, sensors, circuit breakers, control systems, obsolete parts and
              surplus equipment.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              [Search, 'Find by Brand', 'Search manufacturers and automation part sources.'],
              [ShieldCheck, 'Trusted Supply', 'New, used, refurbished and obsolete stock.'],
              [Globe, 'Worldwide Shipping', 'Export-ready delivery via DHL and FedEx.'],
            ].map(([Icon, title, desc]: any) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <Icon className="mb-4 text-cyan-200" size={22} />
                <p className="font-bold text-white">{title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 py-16">
        <div className="page-container">
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-cyan-300">
                Featured Manufacturers
              </p>
              <h2 className="mt-3 text-3xl font-black md:text-4xl">
                Leading Industrial Brands
              </h2>
            </div>

            <Link
              href="/brands"
              className="inline-flex items-center gap-2 text-sm font-bold text-amber-300 hover:text-amber-200"
            >
              View all brands
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {featuredBrands.map((brand) => (
              <Link
                key={brand.slug}
                href={`/brands/${brand.slug}`}
                className="group flex h-28 items-center justify-center rounded-2xl bg-white p-5 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-500/10"
              >
                {brand.logo ? (
                  <Image
                    src={brand.logo}
                    alt={`${brand.name} logo`}
                    width={210}
                    height={90}
                    className="max-h-16 w-auto object-contain transition group-hover:scale-105"
                  />
                ) : (
                  <span className="text-center text-sm font-black text-slate-800">
                    {brand.name}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="page-container">
          <div className="mb-8 text-center">
            <p className="text-xs font-black uppercase tracking-widest text-amber-300">
              A-Z Directory
            </p>
            <h2 className="mt-3 text-3xl font-black md:text-4xl">
              Browse Manufacturers by Name
            </h2>
          </div>

          <div className="mb-8 flex flex-wrap justify-center gap-2">
            {letters.map((letter) => (
              <a
                key={letter}
                href={`#letter-${letter}`}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-sm font-bold text-cyan-200 transition hover:bg-cyan-300/10"
              >
                {letter}
              </a>
            ))}
          </div>

          <div className="space-y-8">
            {letters.map((letter) => (
              <div
                key={letter}
                id={`letter-${letter}`}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
              >
                <h3 className="mb-5 text-2xl font-black text-amber-300">
                  {letter}
                </h3>

                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {groupedBrands[letter].map((brand) => (
                    <Link
                      key={brand.slug}
                      href={`/brands/${brand.slug}`}
                      className="group flex items-center justify-between rounded-xl border border-white/10 bg-[#081827] px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-white"
                    >
                      <span>{brand.name}</span>
                      <ArrowRight
                        size={14}
                        className="text-cyan-300 transition group-hover:translate-x-1"
                      />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

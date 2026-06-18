import BrandSearch from '@/components/brands/BrandSearch';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  Globe,
  MapPin,
  Package,
  Zap,
} from 'lucide-react';
import { BRANDS } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Industrial Automation Brands | Xeltronic UAE',
  description:
    'Browse industrial automation brands including ABB, Siemens, Schneider Electric, Allen-Bradley, Omron, Honeywell, Mitsubishi Electric and more.',
};

interface Props {
  searchParams?: {
    q?: string;
  };
}

export default function BrandsPage({ searchParams }: Props) {
  const query = searchParams?.q?.toLowerCase().trim() || '';

  const filteredBrands = BRANDS.filter((brand) => {
    return (
      brand.name.toLowerCase().includes(query) ||
      brand.slug.toLowerCase().includes(query) ||
      brand.description.toLowerCase().includes(query) ||
      brand.country.toLowerCase().includes(query)
    );
  });

  return (
  <div
    className="relative min-h-screen overflow-hidden pt-20"
    style={{
      background:
        'radial-gradient(circle at 20% 20%, rgba(34,211,238,0.16), transparent 30%), radial-gradient(circle at 85% 20%, rgba(245,158,11,0.14), transparent 28%), linear-gradient(135deg, #06111d 0%, #0b1f2f 50%, #06111d 100%)',
    }}
  >

      {/* Header */}
      <section className="border-b border-navy-700 bg-navy-800">
        <div className="page-container py-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="mb-3 inline-flex rounded-full border border-gold-500/20 bg-gold-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-gold-400">
                Global Automation Manufacturers
              </span>

              <h1 className="text-3xl font-bold text-white md:text-4xl">
                Industrial Automation Brands
              </h1>

              <p className="mt-3 max-w-2xl text-slate-400">
                Browse leading manufacturers of PLCs, HMIs, drives, sensors,
                circuit breakers, relays, contactors and industrial control systems.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {['PLC Systems', 'HMIs & Panels', 'Drives & VFDs', 'Worldwide Supply'].map(
                  (item) => (
                    <span
                      key={item}
                      className="rounded-full border border-gold-500/20 bg-gold-500/10 px-3 py-1 text-xs text-gold-400"
                    >
                      {item}
                    </span>
                  )
                )}
              </div>
            </div>

            <div className="group flex flex-col justify-between rounded-xl border border-gold-500/20 bg-gradient-to-br from-[#06111d] via-[#0b1f2f] to-[#06111d] p-6 transition-all duration-300"
              <div>
                <p className="text-xl font-bold text-gold-500">{BRANDS.length}+</p>
                <p className="text-xs text-slate-500">Brands</p>
              </div>

              <div>
                <p className="text-xl font-bold text-gold-500">Global</p>
                <p className="text-xs text-slate-500">Supply</p>
              </div>

              <div>
                <p className="text-xl font-bold text-gold-500">24h</p>
                <p className="text-xs text-slate-500">RFQ</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="page-container py-8">
        {/* Search */}
        <div className="mb-8 rounded-2xl border border-gold-500/20 bg-navy-800 p-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-white">Find Parts by Brand</h2>
            <p className="mt-1 text-sm text-slate-400">
              Search by manufacturer, country, or product family.
            </p>
          </div>

          <BrandSearch />
        </div>

        {/* Brand Cards */}
        {filteredBrands.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {filteredBrands.map((brand) => (
              <Link
                key={brand.slug}
                href={`/brands/${brand.slug}`}
                className="group flex h-[300px] flex-col justify-between rounded-xl border border-navy-700 bg-navy-800 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gold-500/50 hover:bg-navy-700 hover:shadow-xl hover:shadow-black/20"
              >
                <div>
                  <div className="mb-5 flex items-start justify-between">
                    <div className="flex h-20 w-36 items-center justify-center rounded-lg border border-gold-500/20 bg-white p-3 transition-all group-hover:border-gold-500/50">
                      {brand.logo ? (
                        <Image
                          src={brand.logo}
                          alt={`${brand.name} logo`}
                          width={190}
                          height={85}
                          className="max-h-20 w-auto object-contain"
                        />
                      ) : (
                        <Building2 size={26} className="text-gold-500" />
                      )}
                    </div>

                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <MapPin size={10} />
                      {brand.country}
                    </span>
                  </div>

                  <h2 className="mb-2 text-lg font-bold text-white transition-colors group-hover:text-gold-400">
                    {brand.name}
                  </h2>

                  <p className="line-clamp-3 text-sm leading-relaxed text-slate-400">
                    {brand.description}
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Package size={12} />
                    <span>Available on RFQ</span>
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold-500 transition-transform group-hover:translate-x-1">
                    View parts <ArrowRight size={12} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-gold-500/20 bg-navy-800 p-10 text-center">
            <h3 className="text-2xl font-bold text-white">No Brands Found</h3>

            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400">
              We may still source this brand. Submit an RFQ with the part number
              and our team will check availability.
            </p>

            <Link
              href="/rfq"
              className="mt-6 inline-flex rounded-xl bg-gold-500 px-7 py-3 font-semibold text-navy-900 transition hover:bg-gold-400"
            >
              Submit RFQ
            </Link>
          </div>
        )}

        {/* CTA Banner */}
        <div className="mt-12 rounded-3xl border border-gold-500/20 bg-gradient-to-r from-navy-800 to-navy-700 p-10 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-gold-500/20 bg-gold-500/10">
            <Zap size={26} className="text-gold-500" />
          </div>

          <h3 className="text-2xl font-bold text-white">
            Can&apos;t Find the Brand or Part You Need?
          </h3>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-300">
            Send us the part number, photo or datasheet and our team will help source
            obsolete, discontinued and hard-to-find industrial automation parts worldwide.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/rfq"
              className="inline-flex items-center gap-2 rounded-xl bg-gold-500 px-7 py-3 font-semibold text-navy-900 transition hover:bg-gold-400"
            >
              <Package size={16} />
              Request Quote
            </Link>

            <Link
              href="/sell-surplus"
              className="inline-flex items-center gap-2 rounded-xl border border-navy-500 px-7 py-3 font-semibold text-slate-200 transition hover:border-gold-500/50 hover:text-gold-400"
            >
              <Globe size={16} />
              Sell Your Surplus
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

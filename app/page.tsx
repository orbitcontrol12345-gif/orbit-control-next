import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  FileText,
  Globe,
  ShieldCheck,
  Zap,
  Truck,
  Package,
  Cpu,
  Monitor,
  Radio,
  Shield,
  Battery,
  Settings,
  Archive,
} from 'lucide-react';

import HeroSearchBar from '@/components/shared/HeroSearchBar';
import ProductCard from '@/components/products/ProductCard';
import { CATEGORIES, BRANDS } from '@/lib/data';
import { getSupabaseProductsPage } from '@/lib/supabase-products';

export const metadata: Metadata = {
  title: 'Orbit Control Automation — Industrial Automation & Surplus Parts',
  description:
    'Worldwide supplier of PLCs, HMIs, VFDs, sensors, relays, circuit breakers, surplus and obsolete industrial automation spare parts.',
};

const CATEGORY_ICONS: Record<string, any> = {
  cpu: Cpu,
  monitor: Monitor,
  zap: Zap,
  radio: Radio,
  shield: Shield,
  'battery-charging': Battery,
  'circuit-board': Package,
  settings: Settings,
  archive: Archive,
};

async function getFeaturedProductsSafe() {
  try {
    const { products } = await getSupabaseProductsPage({
      page: 1,
      perPage: 6,
    });

    return products || [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const featuredProducts = await getFeaturedProductsSafe();

  return (
    <>
      {/* HERO */}
      <section className="relative min-h-[82vh] overflow-hidden border-b border-cyan-400/10 bg-[#06111d]">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 20% 20%, rgba(34,211,238,0.16), transparent 30%), radial-gradient(circle at 85% 20%, rgba(245,158,11,0.14), transparent 28%), linear-gradient(135deg, #06111d 0%, #0b1f2f 50%, #06111d 100%)',
          }}
        />

        <div className="page-container relative grid min-h-[82vh] items-center gap-12 py-24 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-cyan-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Orbit Control Automation — UAE
            </div>

            <h1 className="max-w-4xl text-4xl font-black leading-tight text-white md:text-6xl">
              Industrial Automation Parts,
              <span className="block text-cyan-200">Delivered Worldwide.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Source PLCs, HMIs, VFDs, sensors, relays, circuit breakers, control
              boards, obsolete and surplus automation spare parts with fast RFQ
              support.
            </p>

            <div className="mt-8 max-w-2xl">
              <HeroSearchBar />
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/rfq" className="btn-gold">
                <FileText size={18} />
                Request a Quote
              </Link>

              <Link href="/products" className="btn-outline-slate">
                Browse Inventory
                <ArrowRight size={18} />
              </Link>
            </div>

            <div className="mt-12 grid max-w-2xl grid-cols-3 gap-3">
              {[
                ['14,000+', 'Industrial Items'],
                ['200+', 'Countries'],
                ['24h', 'RFQ Target'],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="text-2xl font-black text-white">{value}</div>
                  <div className="mt-1 text-xs uppercase tracking-wider text-slate-400">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/30">
              <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">
                RFQ Workflow
              </p>
              <h3 className="mt-2 text-2xl font-black text-white">
                Fast Industrial Sourcing
              </h3>

              <div className="mt-6 space-y-4">
                {[
                  ['1', 'Search Part Number', 'Find PLC, HMI, VFD, sensor or obsolete part'],
                  ['2', 'Submit RFQ', 'Send quantity, condition and delivery requirement'],
                  ['3', 'Receive Quote', 'Get price, availability and shipping time'],
                  ['4', 'Worldwide Dispatch', 'DHL / FedEx export-ready shipping'],
                ].map(([num, title, desc]) => (
                  <div
                    key={title}
                    className="flex gap-4 rounded-2xl border border-white/10 bg-[#081827] p-4"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-300/10 font-black text-cyan-200">
                      {num}
                    </div>
                    <div>
                      <p className="font-bold text-white">{title}</p>
                      <p className="mt-1 text-sm text-slate-400">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm font-bold text-amber-200">
                New, Used, Refurbished & Obsolete Parts Available
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE STRIP */}
      <section className="overflow-hidden border-y border-cyan-500/10 bg-[#071421] py-3">
        <div className="flex w-max gap-12 whitespace-nowrap animate-[marquee_30s_linear_infinite] text-sm font-bold uppercase tracking-wider text-cyan-200">
          <span>✓ PLC SYSTEMS</span>
          <span>✓ HMI PANELS</span>
          <span>✓ VFD DRIVES</span>
          <span>✓ CIRCUIT BREAKERS</span>
          <span>✓ INDUSTRIAL BOARDS</span>
          <span>✓ OBSOLETE PARTS</span>
          <span>✓ WORLDWIDE SHIPPING</span>
          <span>✓ FAST RFQ RESPONSE</span>

          <span>✓ PLC SYSTEMS</span>
          <span>✓ HMI PANELS</span>
          <span>✓ VFD DRIVES</span>
          <span>✓ CIRCUIT BREAKERS</span>
          <span>✓ INDUSTRIAL BOARDS</span>
          <span>✓ OBSOLETE PARTS</span>
          <span>✓ WORLDWIDE SHIPPING</span>
          <span>✓ FAST RFQ RESPONSE</span>
        </div>
      </section>

      {/* TRUST BOXES */}
      <section className="border-b border-white/10 bg-[#081827] py-10">
        <div className="page-container grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            [Globe, 'Worldwide Supply', 'Industrial parts shipped globally from UAE'],
            [ShieldCheck, 'Inspected Stock', 'New, used, refurbished and surplus parts'],
            [Zap, 'Fast RFQ Response', 'Quick quotations for urgent requirements'],
            [Truck, 'DHL & FedEx', 'Fast international courier shipping'],
          ].map(([Icon, title, desc]: any) => (
            <div
              key={title}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <Icon size={22} className="mb-4 text-cyan-200" />
              <p className="font-bold text-white">{title}</p>
              <p className="mt-1 text-sm text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* BRANDS */}
      <section className="relative overflow-hidden border-y border-white/10 bg-[#06111d] py-20">
        <div
          className="absolute inset-0"
          style={{
            background:
              'repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 90px), repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 90px)',
          }}
        />

        <div className="page-container relative">
          <div className="mb-9 text-center">
            <p className="text-xs font-black uppercase tracking-widest text-cyan-300">
              Global Automation Brands
            </p>
            <h2 className="mt-3 text-3xl font-black text-white md:text-4xl">
              Trusted Industrial Manufacturers We Supply
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-400">
              Sourcing automation, electrical and obsolete spare parts from leading
              global brands.
            </p>
          </div>

          <div className="mx-auto max-w-6xl rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {BRANDS.slice(0, 12).map((brand) => (
                <Link
                  key={brand.slug}
                  href={`/brands/${brand.slug}`}
                 className="group flex h-28 items-center justify-center rounded-2xl border border-white/10 bg-[#0b1825] p-5 transition-all duration-300 hover:bg-[#102033] hover:border-cyan-400/30"
                >
                  {brand.logo ? (
                    <Image
                      src={brand.logo}
                      alt={`${brand.name} logo`}
                      width={210}
                      height={90}
                      className="max-h-20 w-auto object-contain opacity-60 saturate-50 transition-all duration-300 group-hover:opacity-100 group-hover:saturate-100 group-hover:scale-105"
                    />
                  ) : (
                    <span className="text-center text-sm font-black text-white">
                      {brand.name}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-7 text-center">
            <Link
              href="/brands"
              className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-6 py-2.5 text-sm font-bold text-amber-300"
            >
              View all brands
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="border-y border-white/10 bg-[#0a1d2e] py-20">
        <div className="page-container">
          <div className="mb-10 text-center">
            <p className="text-xs font-black uppercase tracking-widest text-amber-300">
              Product Categories
            </p>
            <h2 className="mt-3 text-3xl font-black text-white md:text-4xl">
              Source Critical Industrial Parts
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.slice(0, 9).map((category) => {
              const Icon = CATEGORY_ICONS[category.icon] || Package;

              return (
                <Link
                  key={category.slug}
                  href={`/categories/${category.slug}`}
                  className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:-translate-y-1 hover:border-cyan-300/30"
                >
                  <Icon size={24} className="mb-5 text-cyan-200" />
                  <h3 className="text-xl font-black text-white">
                    {category.name}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {category.description ||
                      'Industrial automation and electrical spare parts.'}
                  </p>
                  <div className="mt-5 text-sm font-bold text-amber-300">
                    Explore Category →
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      {featuredProducts.length > 0 && (
        <section className="bg-[#06111d] py-20">
          <div className="page-container">
            <div className="mb-10">
              <p className="text-xs font-black uppercase tracking-widest text-cyan-300">
                Available Inventory
              </p>
              <h2 className="mt-3 text-3xl font-black text-white md:text-4xl">
                Featured Industrial Parts
              </h2>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id || product.slug} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

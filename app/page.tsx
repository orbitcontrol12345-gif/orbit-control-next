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
  Search,
  Factory,
  MapPin,
  Gauge,
  Headphones,
  Layers,
} from 'lucide-react';

import HeroSearchBar from '@/components/shared/HeroSearchBar';
import HeroGlobe from '@/components/home/HeroGlobe';
import TrustedBrands from '@/components/home/TrustedBrands';
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

const TRUST_ITEMS = [
  [Globe, 'Worldwide Supply', 'Industrial automation parts shipped globally from UAE'],
  [ShieldCheck, 'Inspected Stock', 'Surplus, obsolete, new and refurbished inventory'],
  [Zap, 'Fast RFQ Response', 'Urgent quotation support for production downtime'],
  [Truck, 'DHL & FedEx', 'Export-ready international courier shipping'],
];

const PROCESS_ITEMS = [
  ['01', Search, 'Search Part Number', 'Find PLC, HMI, VFD, sensor, relay or obsolete spare part.'],
  ['02', FileText, 'Submit RFQ', 'Send required quantity, condition, and delivery destination.'],
  ['03', Gauge, 'Availability Check', 'Our team checks stock, pricing, photos, and shipping time.'],
  ['04', Truck, 'Worldwide Dispatch', 'DHL / FedEx packing and export-ready shipment support.'],
];

const INDUSTRIES = [
  'PLC Systems',
  'HMI Panels',
  'VFD Drives',
  'Servo Drives',
  'Circuit Breakers',
  'Power Supplies',
  'Industrial Sensors',
  'Obsolete Spare Parts',
];
export default async function HomePage() {
  const featuredProducts = await getFeaturedProductsSafe();

  return (
    <>
      {/* HERO */}
      <section className="relative min-h-[78vh] overflow-hidden border-b border-cyan-400/10 bg-[#04101b] lg:min-h-[88vh]">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 18% 18%, rgba(34,211,238,0.18), transparent 28%), radial-gradient(circle at 82% 12%, rgba(245,158,11,0.16), transparent 30%), radial-gradient(circle at 55% 85%, rgba(14,165,233,0.10), transparent 38%), linear-gradient(135deg, #04101b 0%, #071827 42%, #050b13 100%)',
          }}
        />

        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            background:
              'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />

        <div className="absolute left-[-120px] top-28 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute right-[-100px] top-20 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="page-container relative grid min-h-[78vh] items-center gap-10 py-14 lg:min-h-[88vh] lg:gap-14 lg:py-24 lg:grid-cols-[1.12fr_0.88fr]">
          <div>
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-cyan-100 shadow-lg shadow-cyan-950/30">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              Orbit Control Automation — UAE
            </div>

            <h1 className="max-w-5xl text-4xl font-black leading-[1.02] tracking-tight text-white md:text-6xl lg:text-7xl">
              Industrial Automation
              <span className="block bg-gradient-to-r from-cyan-200 via-white to-amber-200 bg-clip-text text-transparent">
                Parts Delivered Worldwide.
              </span>
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">
              Source PLCs, HMIs, VFDs, sensors, relays, circuit breakers, control boards,
              obsolete and surplus automation spare parts with fast RFQ support.
            </p>

            <div className="mt-8 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.06] p-3 shadow-2xl shadow-black/30 backdrop-blur">
              <div className="mb-3 flex flex-wrap gap-2 px-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                <span className="rounded-full bg-cyan-300/10 px-3 py-1 text-cyan-200">Part Number</span>
                <span className="rounded-full bg-white/5 px-3 py-1">Manufacturer</span>
                <span className="rounded-full bg-white/5 px-3 py-1">Model</span>
                <span className="rounded-full bg-white/5 px-3 py-1">Obsolete Stock</span>
              </div>
              <HeroSearchBar />
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/rfq" className="btn-gold shadow-xl shadow-amber-950/30">
                <FileText size={18} />
                Request a Quote
              </Link>

              <Link href="/products" className="btn-outline-slate">
                Browse Inventory
                <ArrowRight size={18} />
              </Link>
            </div>

            <div className="mt-12 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                ['64,000+', 'Industrial Items', 'Live inventory'],
                ['200+', 'Global Brands', 'Automation supply'],
                ['24h', 'RFQ Target', 'Fast response'],
              ].map(([value, label, note]) => (
                <div
                  key={label}
                  className="group rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-lg shadow-black/20 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-cyan-300/[0.07]"
                >
                  <div className="text-3xl font-black text-white">{value}</div>
                  <div className="mt-1 text-xs font-black uppercase tracking-wider text-cyan-200">
                    {label}
                  </div>
                  <div className="mt-2 text-xs text-slate-400">{note}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="hidden lg:block">
            <HeroGlobe />
          </div>
        </div>
      </section>

      <TrustedBrands />

      {/* TRUST BOXES */}
      <section className="border-b border-white/10 bg-[#071827] py-12">
        <div className="page-container grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_ITEMS.map(([Icon, title, desc]: any) => (
            <div
              key={title}
              className="group rounded-3xl border border-white/10 bg-white/[0.05] p-6 shadow-lg shadow-black/10 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-cyan-300/[0.06]"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                <Icon size={22} />
              </div>
              <p className="text-lg font-black text-white">{title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* BRANDS */}
      <section className="relative overflow-hidden border-y border-white/10 bg-[#04101b] py-20">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            background:
              'linear-gradient(rgba(255,255,255,0.20) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.20) 1px, transparent 1px)',
            backgroundSize: '72px 72px',
          }}
        />

        <div className="page-container relative">
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
              Global Automation Brands
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
              Trusted Industrial Manufacturers We Supply
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-400">
              Sourcing automation, electrical and obsolete spare parts from leading global brands
              with fast RFQ support and worldwide delivery.
            </p>
          </div>

          <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/[0.05] p-5 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {BRANDS.slice(0, 12).map((brand) => (
                <Link
                  key={brand.slug}
                  href={`/brands/${brand.slug}`}
                  className="group flex h-28 items-center justify-center rounded-2xl border border-white/10 bg-[#0b1825] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/40 hover:bg-[#102033]"
                >
                  {brand.logo ? (
                    <Image
                      src={brand.logo}
                      alt={`${brand.name} logo`}
                      width={210}
                      height={90}
                      className="max-h-20 w-auto object-contain opacity-60 saturate-50 transition-all duration-300 group-hover:scale-105 group-hover:opacity-100 group-hover:saturate-100"
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

          <div className="mt-8 text-center">
            <Link
              href="/brands"
              className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-7 py-3 text-sm font-black text-amber-300 transition hover:border-amber-300/60 hover:bg-amber-300/15"
            >
              View all manufacturers
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="border-y border-white/10 bg-[#071827] py-20">
        <div className="page-container">
          <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-300">
                Product Categories
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
                Source Critical Industrial Parts
              </h2>
            </div>

            <Link
              href="/categories"
              className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-black text-cyan-200 transition hover:border-cyan-300/30"
            >
              Browse Categories
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.slice(0, 9).map((category) => {
              const Icon = CATEGORY_ICONS[category.icon] || Package;

              return (
                <Link
                  key={category.slug}
                  href={`/categories/${category.slug}`}
                  className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.05] p-6 shadow-lg shadow-black/10 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-cyan-300/[0.06]"
                >
                  <div className="absolute right-[-40px] top-[-40px] h-28 w-28 rounded-full bg-cyan-300/10 blur-2xl transition group-hover:bg-cyan-300/20" />

                  <div className="relative">
                    <div className="mb-5 flex h-13 w-13 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                      <Icon size={24} />
                    </div>

                    <h3 className="text-xl font-black text-white">{category.name}</h3>

                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      {category.description ||
                        'Industrial automation and electrical spare parts.'}
                    </p>

                    <div className="mt-6 inline-flex items-center gap-2 text-sm font-black text-amber-300">
                      Explore Category
                      <ArrowRight size={15} className="transition group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* INDUSTRIES */}
      <section className="relative overflow-hidden border-y border-white/10 bg-[#04101b] py-20">
        <div className="absolute left-[-120px] top-20 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-[-140px] right-[-120px] h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="page-container relative grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
              Industries We Serve
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
              Critical Automation Parts, Ready for RFQ
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-400">
              Orbit Control supplies hard-to-find automation, electrical and obsolete spare parts for maintenance teams, factories, OEMs and industrial buyers worldwide.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/rfq" className="btn-gold">
                Submit RFQ
                <ArrowRight size={18} />
              </Link>
              <Link href="/about" className="btn-outline-slate">
                About Orbit Control
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {INDUSTRIES.map((industry) => (
              <div
                key={industry}
                className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 text-center transition hover:-translate-y-1 hover:border-amber-300/30 hover:bg-amber-300/[0.07]"
              >
                <Factory className="mx-auto mb-3 text-cyan-200" size={22} />
                <p className="text-sm font-black text-white">{industry}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GLOBAL PROCESS */}
      <section className="border-y border-white/10 bg-[#071827] py-20">
        <div className="page-container">
          <div className="mb-10 text-center">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-300">
              Global Supply Process
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
              From UAE Stock to Worldwide Delivery
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-5">
            {[
              [MapPin, 'UAE Hub', 'Central sourcing and coordination'],
              [Search, 'Part Check', 'Model, condition and availability'],
              [ShieldCheck, 'Inspection', 'Photos and basic verification'],
              [Package, 'Packing', 'Export-ready secure packaging'],
              [Truck, 'Dispatch', 'DHL / FedEx worldwide shipping'],
            ].map(([Icon, title, desc]: any) => (
              <div
                key={title}
                className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-6 text-center transition hover:border-cyan-300/30"
              >
                <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                  <Icon size={22} />
                </div>
                <p className="font-black text-white">{title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      {featuredProducts.length > 0 && (
        <section className="bg-[#04101b] py-20">
          <div className="page-container">
            <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
                  Available Inventory
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
                  Featured Industrial Parts
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                {['PLC', 'HMI', 'VFD', 'Breakers', 'Sensors'].map((tab) => (
                  <Link
                    key={tab}
                    href={`/products?search=${encodeURIComponent(tab)}`}
                    className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-300 transition hover:border-cyan-300/30 hover:text-cyan-200"
                  >
                    {tab}
                  </Link>
                ))}
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id || product.slug} product={product} />
              ))}
            </div>

            <div className="mt-10 text-center">
              <Link
                href="/products"
                className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-7 py-3 text-sm font-black text-amber-300 transition hover:border-amber-300/60 hover:bg-amber-300/15"
              >
                Browse full inventory
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* FINAL CTA */}
      <section className="relative overflow-hidden border-t border-white/10 bg-[#071827] py-20">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/10 via-transparent to-amber-400/10" />

        <div className="page-container relative">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-8 shadow-2xl shadow-black/30 md:p-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
                  Need urgent industrial parts?
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
                  Send your RFQ and our team will respond quickly.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">
                  Share part number, brand, quantity, condition preference and delivery country.
                  Orbit Control will check availability and prepare a quotation.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Link href="/rfq" className="btn-gold justify-center">
                  <FileText size={18} />
                  Request a Quote
                </Link>
                <Link href="/contact" className="btn-outline-slate justify-center">
                  <Headphones size={18} />
                  Contact Sales
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

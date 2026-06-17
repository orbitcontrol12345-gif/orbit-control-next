import type { Metadata } from 'next';
import type { ElementType } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Globe,
  ShieldCheck,
  Zap,
  Truck,
  ArrowRight,
  Package,
  Cpu,
  Monitor,
  Activity,
  Radio,
  Shield,
  Battery,
  Settings,
  Archive,
  Search,
  FileText,
  CheckCircle2,
  Factory,
  Wrench,
  Clock3,
} from 'lucide-react';

import HeroSearchBar from '@/components/shared/HeroSearchBar';
import ProductCard from '@/components/products/ProductCard';
import { CATEGORIES, BRANDS } from '@/lib/data';
import { getSupabaseProductsPage } from '@/lib/supabase-products';

export const metadata: Metadata = {
  title: 'Orbit Control Automation — Industrial Automation & Surplus Parts',
  description:
    'Orbit Control Automation supplies PLCs, HMIs, VFDs, sensors, circuit breakers, relays, obsolete and surplus industrial automation spare parts worldwide.',
};

const CATEGORY_ICONS: Record<string, ElementType> = {
  cpu: Cpu,
  monitor: Monitor,
  zap: Zap,
  radio: Radio,
  shield: Shield,
  activity: Activity,
  'battery-charging': Battery,
  'circuit-board': Package,
  settings: Settings,
  'alert-triangle': ShieldCheck,
  archive: Archive,
};

const TRUST_ITEMS = [
  {
    icon: Globe,
    title: 'Worldwide Supply',
    desc: 'Industrial parts shipped globally from UAE',
  },
  {
    icon: ShieldCheck,
    title: 'Inspected Stock',
    desc: 'New, used, refurbished and surplus parts',
  },
  {
    icon: Zap,
    title: 'Fast RFQ Response',
    desc: 'Quick quotations for urgent requirements',
  },
  {
    icon: Truck,
    title: 'DHL & FedEx',
    desc: 'Fast international courier shipping',
  },
];

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
      <section className="relative min-h-[92vh] overflow-hidden border-b border-cyan-400/10 bg-[#06111d]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.22),transparent_30%),radial-gradient(circle_at_85%_20%,rgba(245,158,11,0.18),transparent_28%),linear-gradient(135deg,#06111d_0%,#0b1f2f_45%,#06111d_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:44px_44px] opacity-30" />
        <div className="absolute -right-24 top-20 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute -left-24 bottom-20 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="page-container relative grid min-h-[92vh] items-center gap-12 py-20 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.9)]" />
              Orbit Control Automation — UAE
            </div>

            <h1 className="max-w-4xl text-4xl font-black leading-[1.05] tracking-tight text-white md:text-6xl lg:text-7xl">
              Industrial Automation Parts,
              <span className="block bg-gradient-to-r from-cyan-200 via-white to-amber-300 bg-clip-text text-transparent">
                Delivered Worldwide.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Source PLCs, HMIs, VFDs, sensors, relays, circuit breakers, control boards,
              obsolete and surplus automation spare parts with fast RFQ support.
            </p>

            <div className="mt-8 max-w-2xl">
              <HeroSearchBar />
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/rfq"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-3 text-sm font-bold text-slate-950 shadow-xl shadow-amber-500/20 transition hover:-translate-y-0.5 hover:shadow-amber-500/30"
              >
                <FileText size={18} />
                Request a Quote
              </Link>

              <Link
                href="/products"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-6 py-3 text-sm font-bold text-white backdrop-blur transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-cyan-300/10"
              >
                Browse Inventory
                <ArrowRight size={18} />
              </Link>
            </div>

            <div className="mt-12 grid max-w-2xl grid-cols-3 gap-3">
              {[
                { value: '14K+', label: 'Industrial Items' },
                { value: '200+', label: 'Countries' },
                { value: '24h', label: 'RFQ Target' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur"
                >
                  <div className="text-2xl font-black text-white">{stat.value}</div>
                  <div className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-400">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative hidden lg:block">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
              <div className="rounded-[1.5rem] border border-cyan-300/10 bg-[#091827] p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">
                      RFQ Workflow
                    </p>
                    <h3 className="mt-1 text-2xl font-bold text-white">
                      Fast Industrial Sourcing
                    </h3>
                  </div>
                  <Factory className="text-amber-300" size={34} />
                </div>

                {[
                  ['Search Part Number', 'Find PLC, HMI, VFD, sensor or obsolete part'],
                  ['Submit RFQ', 'Send quantity, condition and delivery requirement'],
                  ['Receive Quote', 'Get price, availability and shipping time'],
                  ['Worldwide Dispatch', 'DHL / FedEx export-ready shipping'],
                ].map(([title, desc], index) => (
                  <div
                    key={title}
                    className="mb-4 flex gap-4 rounded-2xl border border-white/8 bg-white/[0.04] p-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-300/10 text-sm font-black text-cyan-200">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-bold text-white">{title}</p>
                      <p className="mt-1 text-sm text-slate-400">{desc}</p>
                    </div>
                  </div>
                ))}

                <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
                  <p className="flex items-center gap-2 text-sm font-bold text-amber-200">
                    <CheckCircle2 size={17} />
                    New, Used, Refurbished & Obsolete Parts Available
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="border-b border-white/10 bg-[#081827]">
        <div className="page-container py-8">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {TRUST_ITEMS.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-cyan-300/[0.06]"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-200">
                  <Icon size={20} />
                </div>
                <p className="font-bold text-white">{title}</p>
                <p className="mt-1 text-sm text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

     {/* BRANDS - Clean Orbit Showcase */}

<section
  className="relative overflow-hidden border-y border-white/10 py-18"
  style={{
    background: `
      radial-gradient(circle at 20% 20%, rgba(34,211,238,0.08), transparent 30%),
      radial-gradient(circle at 80% 30%, rgba(245,158,11,0.08), transparent 30%),
      linear-gradient(180deg,#06111d 0%,#081827 100%)
    `,
  }}
>

 

  <div className="page-container">
    <div className="mb-9 text-center">
      <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
        Global Automation Brands
      </p>
      <h2 className="mt-3 text-3xl font-black text-white md:text-4xl">
        Trusted Industrial Manufacturers We Supply
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-400">
        Sourcing automation, electrical and obsolete spare parts from leading global brands.
      </p>
    </div>

    <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/20">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {BRANDS.slice(0, 12).map((brand) => (
          <Link
            key={brand.slug}
            href={`/brands/${brand.slug}`}
            className="group flex h-28 items-center justify-center rounded-2xl border border-white/10 bg-white p-5 transition duration-300 hover:-translate-y-1 hover:border-amber-400 hover:shadow-xl hover:shadow-amber-500/10"
          >
            {brand.logo ? (
              <Image
                src={brand.logo}
                alt={`${brand.name} logo`}
                width={210}
                height={90}
                className="max-h-16 w-auto object-contain transition duration-300 group-hover:scale-105"
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

    <div className="mt-7 text-center">
      <Link
        href="/brands"
        className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-6 py-2.5 text-sm font-bold text-amber-300 transition hover:bg-amber-300/20"
      >
        View all brands
        <ArrowRight size={16} />
      </Link>
    </div>
  </div>
</section>

      {/* CATEGORIES */}
      <section className="border-y border-white/10 bg-[#0a1d2e] py-16">
        <div className="page-container">
          <div className="mb-9 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300">
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
                  className="group rounded-3xl border border-white/10 bg-white/[0.045] p-6 transition hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-cyan-300/[0.06]"
                >
                  <div className="mb-5 flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300/20 to-amber-300/20 text-cyan-200">
                    <Icon size={24} />
                  </div>

                  <h3 className="text-xl font-black text-white">{category.name}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">
                    {category.description ||
                      'Industrial automation and electrical spare parts for maintenance and replacement.'}
                  </p>

                  <div className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-amber-300">
                    Explore Category
                    <ArrowRight
                      size={16}
                      className="transition group-hover:translate-x-1"
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      {featuredProducts.length > 0 && (
        <section className="bg-[#06111d] py-16">
          <div className="page-container">
            <div className="mb-9 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300">
                  Available Inventory
                </p>
                <h2 className="mt-3 text-3xl font-black text-white md:text-4xl">
                  Featured Industrial Parts
                </h2>
              </div>

              <Link
                href="/products"
                className="inline-flex items-center gap-2 text-sm font-bold text-amber-300 hover:text-amber-200"
              >
                View all products
                <ArrowRight size={16} />
              </Link>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id || product.slug} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* WHY ORBIT */}
      <section className="border-t border-white/10 bg-[#081827] py-16">
        <div className="page-container grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300">
              Why Orbit Control
            </p>
            <h2 className="mt-3 text-3xl font-black text-white md:text-4xl">
              Built for factories, maintenance teams and industrial buyers.
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-300">
              We help B2B customers source hard-to-find automation parts, obsolete
              industrial spares and urgent replacement components with professional RFQ
              handling and worldwide logistics.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                ['Obsolete Parts', Archive],
                ['Automation Spares', Cpu],
                ['Electrical Components', Zap],
                ['Export Shipping', Truck],
              ].map(([title, Icon]) => {
                const LucideIcon = Icon as ElementType;

                return (
                  <div
                    key={title as string}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                  >
                    <LucideIcon className="text-cyan-200" size={20} />
                    <span className="font-bold text-white">{title as string}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-6 shadow-2xl shadow-black/20">
            <div className="grid gap-4">
              {[
                {
                  icon: Search,
                  title: 'Search by Part Number',
                  desc: 'Find exact models, MPNs and industrial references quickly.',
                },
                {
                  icon: Wrench,
                  title: 'Maintenance Focused',
                  desc: 'Support for urgent factory downtime and replacement needs.',
                },
                {
                  icon: Clock3,
                  title: 'Quick Quotation',
                  desc: 'RFQ workflow designed for fast commercial response.',
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/10 bg-[#06111d]/70 p-5"
                >
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-300/10 text-amber-300">
                    <Icon size={20} />
                  </div>
                  <p className="font-black text-white">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#06111d] py-16">
        <div className="page-container">
          <div className="overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-gradient-to-r from-cyan-400/15 via-white/[0.06] to-amber-400/15 p-8 text-center shadow-2xl shadow-black/20 md:p-12">
            <h2 className="text-3xl font-black text-white md:text-5xl">
              Need a hard-to-find industrial part?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-300">
              Send us the part number, brand, quantity and required condition. Our team
              will check availability and reply with quotation details.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/rfq"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-7 py-3 text-sm font-black text-slate-950 shadow-xl shadow-amber-500/20 transition hover:-translate-y-0.5"
              >
                Submit RFQ Now
                <ArrowRight size={18} />
              </Link>

              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-7 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-white/15"
              >
                Contact Sales
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

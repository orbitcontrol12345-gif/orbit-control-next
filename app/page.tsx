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
  ChevronRight,
  Search,
  FileText,
} from 'lucide-react';

import HeroSearchBar from '@/components/shared/HeroSearchBar';
import ProductCard from '@/components/products/ProductCard';
import { CATEGORIES, BRANDS } from '@/lib/data';
import { getSupabaseProductsPage } from '@/lib/supabase-products';

export const metadata: Metadata = {
  title: 'Xeltronic Electrical Solution — Industrial Automation Spare Parts Supplier',
  description:
    'B2B supplier of industrial automation and electrical spare parts — PLCs, HMIs, drives, VFDs, sensors, and obsolete parts. Worldwide shipping from UAE. Submit your RFQ today.',
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
    title: 'Worldwide Shipping',
    desc: 'DHL & FedEx delivery to 200+ countries',
  },
  {
    icon: ShieldCheck,
    title: 'Quality Tested Parts',
    desc: 'Every part inspected before dispatch',
  },
  {
    icon: Zap,
    title: 'Fast RFQ Response',
    desc: 'Quote within 24 hours on most parts',
  },
  {
    icon: Truck,
    title: 'Express Courier',
    desc: 'Trackable international shipping',
  },
];

const { products: FEATURED_PRODUCTS } = await getSupabaseProductsPage({
  page: 1,
  perPage: 6,
});

export default async function HomePage() {
  return (
    <>
      {/* Hero */}
      <section
        className="relative flex min-h-[88vh] items-center overflow-hidden"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(8,13,26,0.88) 0%, rgba(8,13,26,0.96) 100%), url('https://images.pexels.com/photos/257700/pexels-photo-257700.jpeg?auto=compress&cs=tinysrgb&w=1920')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute left-0 right-0 top-0 h-1 bg-gradient-to-r from-transparent via-gold-500 to-transparent" />

        <div className="page-container w-full pb-12 pt-16 md:pb-16 md:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/10 px-4 py-1.5">
              <span className="h-2 w-2 rounded-full bg-gold-500" />
              <span className="text-xs font-medium uppercase tracking-widest text-gold-400">
                Global Industrial Parts Supplier — UAE
              </span>
            </div>

            <h1 className="mb-5 text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl">
              Find Industrial{' '}
              <span className="text-gold-500">Automation Parts</span> Worldwide
            </h1>

            <p className="mx-auto mb-6 md:mb-10 max-w-xl text-lg leading-relaxed text-slate-300">
              PLCs, HMIs, Drives, Sensors, Circuit Breakers and Obsolete Automation Parts.
              Search by part number and request a quote in seconds.
            </p>

            <div className="mb-6 md:mb-8 flex justify-center">
              <HeroSearchBar />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/rfq" className="btn-gold">
                <Package size={16} />
                Request a Quote
              </Link>

              <Link href="/products" className="btn-outline-slate">
                Browse Products
                <ArrowRight size={16} />
              </Link>
            </div>

            <div className="mx-auto mt-12 grid max-w-lg grid-cols-3 gap-4">
              {[
                { value: '10,000+', label: 'Parts Available' },
                { value: '200+', label: 'Countries Served' },
                { value: '24h', label: 'RFQ Response' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl font-bold text-gold-500">
                    {stat.value}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <section className="border-y border-navy-800 bg-navy-950">
        <div className="page-container py-8">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {TRUST_ITEMS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gold-500/20 bg-gold-500/10">
                  <Icon size={18} className="text-gold-500" />
                </div>

                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Brand Logos */}
      <section className="border-b border-navy-700 bg-navy-800">
        <div className="page-container py-10">
          <div className="mb-7 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Trusted Brands We Supply
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              Leading Industrial Automation Manufacturers
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {BRANDS.slice(0, 12).map((brand) => (
              <Link
  href={`/brands/${brand.slug}`}
  className="group flex h-36 items-center justify-center rounded-xl border border-navy-700 bg-white p-6 transition-all hover:-translate-y-1 hover:border-gold-500 hover:shadow-xl hover:shadow-black/30"
>
                {brand.logo ? (
                  <Image
   src={brand.logo}
  alt={`${brand.name} logo`}
  width={240}
  height={110}
  className="max-h-24 w-auto object-contain transition-transform duration-300 group-hover:scale-110"
/>
                ) : (
                  <span className="text-sm font-semibold text-slate-300 group-hover:text-gold-400">
                    {brand.name}
                  </span>
                )}
              </Link>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link href="/brands" className="btn-outline-gold">
              View All Brands
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Why Choose + How It Works */}
<section className="bg-navy-900 py-20">
  <div className="page-container">
    <div className="mb-12 text-center">
      <span className="mb-3 inline-flex rounded-full border border-gold-500/20 bg-gold-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-gold-400">
        Trusted Industrial Supplier
      </span>

      <h2 className="section-heading">
        Your Industrial Parts Sourcing Partner
      </h2>

      <p className="section-subheading mx-auto max-w-3xl">
        Fast RFQ support, worldwide sourcing, obsolete automation parts and
        reliable industrial supply solutions from the UAE.
      </p>
    </div>

    <div className="grid gap-8 lg:grid-cols-2">
      {/* Left Side */}
      <div className="rounded-3xl border border-navy-700 bg-navy-800 p-8">
        <h3 className="mb-6 text-2xl font-bold text-white">
          Why Choose Xeltronic?
        </h3>

        <div className="space-y-5">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold-500/10 text-gold-500">
              <ShieldCheck size={22} />
            </div>

            <div>
              <h4 className="font-semibold text-white">
                Verified Industrial Parts
              </h4>

              <p className="mt-1 text-sm text-slate-400">
                New, used, surplus and obsolete industrial automation parts
                from leading global brands.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold-500/10 text-gold-500">
              <Zap size={22} />
            </div>

            <div>
              <h4 className="font-semibold text-white">
                Fast RFQ Response
              </h4>

              <p className="mt-1 text-sm text-slate-400">
                Quick quotation support for urgent maintenance,
                shutdown and project requirements.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold-500/10 text-gold-500">
              <Globe size={22} />
            </div>

            <div>
              <h4 className="font-semibold text-white">
                Worldwide Supply Network
              </h4>

              <p className="mt-1 text-sm text-slate-400">
                Global sourcing and export support with DHL, FedEx
                and international logistics partners.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side */}
      <div className="rounded-3xl border border-gold-500/20 bg-navy-800 p-8">
        <h3 className="mb-6 text-2xl font-bold text-white">
          How It Works
        </h3>

        <div className="space-y-4">
          {[
            {
              icon: Search,
              title: 'Search Part Number',
            },
            {
              icon: FileText,
              title: 'Submit RFQ',
            },
            {
              icon: ShieldCheck,
              title: 'Receive Quote',
            },
            {
              icon: Truck,
              title: 'Worldwide Delivery',
            },
          ].map(({ icon: Icon, title }, index) => (
            <div
              key={title}
              className="flex items-center gap-4 rounded-2xl border border-navy-700 bg-navy-900 p-4"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold-500/10 text-gold-500">
                <Icon size={20} />
              </div>

              <div className="flex-1">
                <p className="text-xs font-semibold text-gold-500">
                  STEP 0{index + 1}
                </p>

                <h4 className="font-semibold text-white">
                  {title}
                </h4>
              </div>
            </div>
          ))}
        </div>

        <Link
          href="/rfq"
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-gold-500 px-6 py-3 font-semibold text-navy-900 transition hover:bg-gold-400"
        >
          Request a Quote
        </Link>
      </div>
    </div>
  </div>
</section>

      {/* Categories */}
      <section className="bg-navy-900 py-16">
        <div className="page-container">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="section-heading">Browse by Category</h2>
              <p className="section-subheading">
                Industrial automation and electrical parts organized by type
              </p>
            </div>

            <Link
              href="/categories"
              className="hidden items-center gap-1 text-sm font-medium text-gold-500 hover:text-gold-400 sm:flex"
            >
              All categories
              <ChevronRight size={15} />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {CATEGORIES.slice(0, 12).map((cat) => {
              const Icon = CATEGORY_ICONS[cat.icon] || Package;

              return (
                <Link
                  key={cat.slug}
                  href={`/categories/${cat.slug}`}
                  className="group flex flex-col items-center gap-3 rounded-lg border border-navy-700 bg-navy-800 p-4 text-center transition-all hover:border-gold-500/50 hover:bg-navy-700"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-gold-500/20 bg-gold-500/10 transition-colors group-hover:bg-gold-500/20">
                    <Icon size={20} className="text-gold-500" />
                  </div>

                  <span className="text-xs font-semibold leading-snug text-slate-200 group-hover:text-white">
                    {cat.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="bg-navy-950 py-16">
        <div className="page-container">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="section-heading">Featured Products</h2>
              <p className="section-subheading">
                Automation parts available for RFQ and fast dispatch
              </p>
            </div>

            <Link
              href="/products"
              className="hidden items-center gap-1 text-sm font-medium text-gold-500 hover:text-gold-400 sm:flex"
            >
              View all
              <ChevronRight size={15} />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURED_PRODUCTS.map((product) => (
  <ProductCard key={product.id} product={product} />
))}
          </div>

          <div className="mt-8 text-center">
            <Link href="/products" className="btn-outline-gold">
              Browse All Products
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-gold-500/20 bg-gradient-to-r from-navy-900 to-navy-800 py-20">
        <div className="page-container text-center">
          <h2 className="text-3xl font-bold text-white md:text-4xl">
            Can&apos;t Find The Part You Need?
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-slate-400">
            Send us any part number, brand, photo or datasheet. We source obsolete,
            discontinued and hard-to-find industrial automation parts worldwide.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/rfq" className="btn-gold">
              <Package size={16} />
              Request RFQ
            </Link>

            <Link href="/sell-surplus" className="btn-outline-slate">
              Sell Your Surplus
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

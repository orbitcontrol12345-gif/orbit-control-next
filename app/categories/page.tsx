import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Cpu,
  Monitor,
  Zap,
  Radio,
  Shield,
  Activity,
  Battery,
  Package,
  Settings,
  Archive,
  ChevronRight,
  Search,
} from 'lucide-react';
import { CATEGORIES } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Industrial Automation Parts Categories | Xeltronic UAE',
  description:
    'Browse PLCs, HMIs, VFDs, circuit breakers, relays, sensors, power supplies and obsolete industrial automation spare parts.',
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  cpu: Cpu,
  monitor: Monitor,
  zap: Zap,
  radio: Radio,
  shield: Shield,
  activity: Activity,
  'battery-charging': Battery,
  'circuit-board': Package,
  settings: Settings,
  'alert-triangle': Shield,
  archive: Archive,
};

export default function CategoriesPage() {
  return (
    <div className="min-h-screen bg-navy-900 pt-20">
      <div className="border-b border-navy-700 bg-navy-800">
        <div className="page-container py-10">
          <h1 className="text-3xl font-bold text-white md:text-4xl">
            Product Categories
          </h1>
          <p className="mt-2 text-slate-400">
            Browse industrial automation and electrical parts by type
          </p>
        </div>
      </div>

      <div className="page-container py-12">
        <div className="mb-8 rounded-2xl border border-gold-500/20 bg-navy-800 p-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-white">
              Find Parts by Category
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Search PLCs, HMIs, VFDs, relays, sensors, circuit breakers and more.
            </p>
          </div>

          <form action="/products" className="relative">
            <Search
              size={20}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              name="search"
              type="text"
              placeholder="Search by part number, brand, or category..."
              className="w-full rounded-xl border border-navy-600 bg-navy-900 py-4 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-gold-500"
            />
          </form>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
          {CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.icon] || Package;

            return (
              <Link
                key={cat.slug}
                href={`/categories/${cat.slug}`}
                className="group flex min-h-[190px] flex-col justify-between rounded-xl border border-navy-700 bg-navy-800 p-6 transition-all hover:-translate-y-1 hover:border-gold-500/50 hover:bg-navy-700 hover:shadow-xl hover:shadow-black/20"
              >
                <div>
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-gold-500/20 bg-gold-500/10 transition-colors group-hover:bg-gold-500/20">
                      <Icon size={22} className="text-gold-500" />
                    </div>

                    <ChevronRight
                      size={18}
                      className="text-slate-500 transition-all group-hover:translate-x-1 group-hover:text-gold-400"
                    />
                  </div>

                  <h2 className="mb-2 text-lg font-bold text-white transition-colors group-hover:text-gold-400">
                    {cat.name}
                  </h2>

                  <p className="text-xs leading-relaxed text-slate-400">
                    {cat.description}
                  </p>
                </div>

                <div className="mt-6">
                  <span className="inline-flex items-center rounded-lg border border-gold-500/30 px-4 py-2 text-sm font-semibold text-gold-400 transition-all group-hover:bg-gold-500 group-hover:text-navy-900">
                    Browse Category
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        <section className="mt-20 rounded-3xl border border-gold-500/20 bg-navy-800 p-10 text-center">
          <h2 className="text-3xl font-bold text-white">
            Can&apos;t Find The Part You Need?
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-slate-400">
            We source obsolete, discontinued, and hard-to-find industrial automation
            and electrical parts from trusted suppliers worldwide.
          </p>

          <Link
            href="/rfq"
            className="mt-8 inline-flex rounded-xl bg-gold-500 px-8 py-4 font-semibold text-navy-900 transition-all hover:bg-gold-400"
          >
            Request a Quote
          </Link>
        </section>
      </div>
    </div>
  );
}
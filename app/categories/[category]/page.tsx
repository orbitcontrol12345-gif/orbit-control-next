import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { CATEGORIES } from '@/lib/data';
import { getSupabaseProductsByCategoryTerms } from '@/lib/supabase-products';
import ProductCard from '@/components/products/ProductCard';

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: { category: string };
  searchParams?: { page?: string };
}) {
  const category = CATEGORIES.find((c) => c.slug === params.category);

  if (!category) notFound();

  const currentPage = Number(searchParams?.page || "1");

const categorySearchMap: Record<string, string[]> = {
  plcs: ['PLC'],
hmis: ['HMI'],
'drives-vfds': [
  'Variable Frequency Drives',
  'Servo Drives & Amplifiers',
  'General Purpose AC Drives',
  'Speed Controls',
  'Stepper Controls & Drives',
  'Reduced Voltage/Soft Starters',
  'Other Motor Controls',
  'Drive',
  'Drives',
  'VFD'
],
sensors: ['Sensor'],
'circuit-breakers': ['Breaker', 'Circuit Breaker'],
relays: ['Relay'],
'power-supplies': ['Power Supply'],
'control-boards': ['Control Board', 'Circuit Board', 'PCB'],
'servo-systems': ['Servo'],
'safety-devices': ['Safety'],
'obsolete-parts': ['Obsolete'],
contactors: ['Contactor'],
};

const terms = categorySearchMap[category.slug] || [category.name];

const { products, totalPages } = await getSupabaseProductsByCategoryTerms({
  terms,
  page: currentPage,
  perPage: 24,
});
  return (
    <div className="min-h-screen bg-navy-900 pt-20">
      <section className="border-b border-navy-700 bg-navy-800">
        <div className="page-container py-12">
          <nav className="mb-6 flex items-center gap-2 text-sm text-slate-400">
            <Link href="/" className="hover:text-gold-500">Home</Link>
            <ChevronRight size={14} />
            <Link href="/categories" className="hover:text-gold-500">
              Categories
            </Link>
            <ChevronRight size={14} />
            <span className="text-white">{category.name}</span>
          </nav>

          <h1 className="text-4xl font-bold text-white">{category.name} Parts</h1>
          <p className="mt-3 max-w-2xl text-slate-300">
            Browse real {category.name} products from our Supabase inventory.
          </p>
        </div>
      </section>

      <section className="page-container py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">
              Available {category.name} ({products.length})
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Real products loaded from Supabase.
            </p>
          </div>

          <Link
            href={`/products?q=${encodeURIComponent(category.name)}`}
            className="text-sm font-semibold text-gold-500 hover:text-gold-400"
          >
            Search all {category.name} →
          </Link>
        </div>

        {products.length > 0 ? (
  <>
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>

   {totalPages > 1 && (
  <div className="mt-10 flex justify-center">
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-navy-700 bg-navy-800 px-4 py-3">
      <Link
        href={`/categories/${category.slug}?page=${Math.max(1, currentPage - 1)}`}
        className={`rounded-lg px-4 py-2 text-sm font-semibold ${
          currentPage === 1
            ? 'pointer-events-none opacity-40 bg-navy-700 text-slate-400'
            : 'border border-gold-500 text-gold-400 hover:bg-gold-500 hover:text-navy-950'
        }`}
      >
        ← Previous
      </Link>

      <form
        action={`/categories/${category.slug}`}
        method="GET"
        className="flex items-center gap-2"
      >
        <span className="text-sm text-slate-400">Page</span>

        
          className="w-20 rounded-lg border border-navy-600 bg-navy-900 px-2 py-2 text-center text-sm font-bold text-white"
        />

        <span className="text-sm text-slate-400">of {totalPages}</span>

        <button
          type="submit"
          className="rounded-lg border border-gold-500 px-3 py-2 text-sm font-semibold text-gold-400 hover:bg-gold-500 hover:text-navy-950"
        >
          Go
        </button>
      </form>

      <Link
        href={`/categories/${category.slug}?page=${Math.min(totalPages, currentPage + 1)}`}
        className={`rounded-lg px-4 py-2 text-sm font-semibold ${
          currentPage === totalPages
            ? 'pointer-events-none opacity-40 bg-navy-700 text-slate-400'
            : 'border border-gold-500 text-gold-400 hover:bg-gold-500 hover:text-navy-950'
        }`}
      >
        Next →
      </Link>
    </div>
  </div>
)}
  </>
) : (
          <div className="rounded-xl border border-navy-700 bg-navy-800 p-10 text-center">
            <h3 className="text-xl font-bold text-white">No products found</h3>
            <p className="mt-2 text-slate-400">
              No Supabase products found for {category.name}.
            </p>

            <Link href="/rfq" className="btn-gold mt-6 inline-flex">
              Request a Quote
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

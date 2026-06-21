import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { BRANDS } from '@/lib/data';
import { getSupabaseProductsPage } from '@/lib/supabase-products';
import ProductCard from '@/components/products/ProductCard';

export default async function BrandPage({
  params,
  searchParams,
}: {
  params: { brand: string };
  searchParams?: { page?: string };
}) {
  const brand = BRANDS.find((b) => b.slug === params.brand);

  if (!brand) notFound();

  const currentPage = Number(searchParams?.page || '1');

  const { products, totalProducts, totalPages } = await getSupabaseProductsPage({
    search: brand.name,
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
            <Link href="/brands" className="hover:text-gold-500">Brands</Link>
            <ChevronRight size={14} />
            <span className="text-white">{brand.name}</span>
          </nav>

          <h1 className="text-4xl font-bold text-white">{brand.name}</h1>
          <p className="mt-3 max-w-2xl text-slate-300">
            Browse {brand.name} industrial automation parts from our live inventory.
          </p>
        </div>
      </section>

      <section className="page-container py-10">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">
            {brand.name} Parts ({totalProducts})
          </h2>

          <Link
            href={`/products?q=${encodeURIComponent(brand.name)}`}
            className="text-sm font-semibold text-gold-500 hover:text-gold-400"
          >
            Search all {brand.name} →
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
  href={`/brands/${params.brand}?page=${Math.max(1, currentPage - 1)}`}
  className={`rounded-lg px-4 py-2 text-sm font-semibold ${
    currentPage <= 1
      ? 'pointer-events-none opacity-40 bg-navy-700 text-slate-400'
      : 'border border-gold-500 text-gold-400 hover:bg-gold-500 hover:text-navy-950'
  }`}
>
  ← Previous
</Link>

      <form
        action={`/brands/${brand.slug}`}
        method="GET"
        className="flex items-center gap-2"
      >
        <span className="text-sm text-slate-400">Page</span>

        <input
          type="number"
          name="page"
          min="1"
          max={totalPages}
          defaultValue={currentPage}
          className="w-20 rounded-lg border border-navy-600 bg-navy-900 px-2 py-2 text-center text-sm font-bold text-white"
        />

        <span className="text-sm text-slate-400">
          of {totalPages}
        </span>

        <button
          type="submit"
          className="rounded-lg border border-gold-500 px-3 py-2 text-sm font-semibold text-gold-400 hover:bg-gold-500 hover:text-navy-950"
        >
          Go
        </button>
      </form>

      <Link
  href={`/brands/${params.brand}?page=${Math.min(totalPages, currentPage + 1)}`}
  className={`rounded-lg px-4 py-2 text-sm font-semibold ${
    currentPage >= totalPages
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
              No products found for {brand.name}.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

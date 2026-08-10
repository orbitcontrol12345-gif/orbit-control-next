import Link from 'next/link';
import type { Metadata } from 'next';

import { getSupabaseProductsPage } from '@/lib/supabase-products';

import ProductsClient from './ProductsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SITE_URL = 'https://www.orbit-surplus.com';
const PRODUCTS_TITLE =
  'Industrial Automation Parts & Obsolete Spares';
const PRODUCTS_DESCRIPTION =
  'Browse PLCs, HMIs, VFDs, sensors, relays, circuit breakers, control boards, and obsolete industrial automation spare parts available for worldwide RFQ.';

type ProductSortOption =
  | 'relevance'
  | 'name'
  | 'brand'
  | 'condition';

type ProductsSearchParams = {
  q?: string;
  brand?: string;
  category?: string;
  condition?: string;
  stock?: string;
  sort?: ProductSortOption;
  page?: string;
};

type ProductsPageProps = {
  searchParams?: ProductsSearchParams;
};

function parsePage(value?: string): number {
  const parsed = Number(value || 1);

  return Number.isFinite(parsed)
    ? Math.max(1, Math.floor(parsed))
    : 1;
}

function hasFilteredView(
  searchParams?: ProductsSearchParams,
): boolean {
  return Boolean(
    searchParams?.q?.trim() ||
      searchParams?.brand?.trim() ||
      searchParams?.category?.trim() ||
      searchParams?.condition?.trim() ||
      searchParams?.stock === 'in-stock' ||
      (searchParams?.sort &&
        searchParams.sort !== 'relevance'),
  );
}

export async function generateMetadata({
  searchParams,
}: ProductsPageProps): Promise<Metadata> {
  const filteredView = hasFilteredView(searchParams);
  const currentPage = parsePage(searchParams?.page);

  const canonicalUrl =
    !filteredView && currentPage > 1
      ? `${SITE_URL}/products?page=${currentPage}`
      : `${SITE_URL}/products`;

  return {
    title: PRODUCTS_TITLE,
    description: PRODUCTS_DESCRIPTION,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: !filteredView,
      follow: true,
      googleBot: {
        index: !filteredView,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
  };
}

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const search = searchParams?.q?.trim() || '';
  const brand = searchParams?.brand?.trim() || '';
  const category = searchParams?.category?.trim() || '';
  const condition = searchParams?.condition?.trim() || '';
  const inStockOnly = searchParams?.stock === 'in-stock';
  const sort = searchParams?.sort || 'relevance';
  const currentPage = parsePage(searchParams?.page);
  const filteredView = hasFilteredView(searchParams);
  const perPage = 24;

  const {
    products,
    totalProducts,
    totalPages,
  } = await getSupabaseProductsPage({
    search,
    brand,
    category,
    condition,
    inStockOnly,
    sort,
    page: currentPage,
    perPage,
  });

  const buildPageUrl = (page: number) => {
    const params = new URLSearchParams();

    if (search) params.set('q', search);
    if (brand) params.set('brand', brand);
    if (category) params.set('category', category);
    if (condition) params.set('condition', condition);
    if (inStockOnly) params.set('stock', 'in-stock');
    if (sort !== 'relevance') params.set('sort', sort);

    params.set('page', String(page));

    return `/products?${params.toString()}`;
  };

  return (
    <div>
      <ProductsClient
        initialProducts={products || []}
        initialQuery={search}
        initialBrand={brand}
        initialCategory={category}
        initialCondition={condition}
        initialInStockOnly={inStockOnly}
        initialSort={sort}
      />

      <div className="relative pb-16">
        <div className="page-container">
          <div className="mb-5 mt-6 text-center text-sm font-semibold text-slate-300">
            Showing {products.length} products on this page · Total
            Products: {totalProducts} · Page {currentPage} of{' '}
            {totalPages}
          </div>

          <div className="mt-10 flex justify-center">
            <div className="flex flex-wrap items-center justify-center gap-3 rounded-xl border border-navy-700 bg-navy-800 px-4 py-3">
              <Link
                href={buildPageUrl(
                  Math.max(1, currentPage - 1),
                )}
                rel={filteredView ? 'nofollow' : undefined}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  currentPage <= 1
                    ? 'pointer-events-none bg-navy-700 text-slate-500 opacity-50'
                    : 'bg-gold-500 text-navy-950 hover:bg-gold-400'
                }`}
              >
                ← Previous
              </Link>

              <form
                method="GET"
                action="/products"
                className="flex items-center gap-2"
              >
                {search && (
                  <input type="hidden" name="q" value={search} />
                )}

                {brand && (
                  <input
                    type="hidden"
                    name="brand"
                    value={brand}
                  />
                )}

                {category && (
                  <input
                    type="hidden"
                    name="category"
                    value={category}
                  />
                )}

                {condition && (
                  <input
                    type="hidden"
                    name="condition"
                    value={condition}
                  />
                )}

                {inStockOnly && (
                  <input
                    type="hidden"
                    name="stock"
                    value="in-stock"
                  />
                )}

                {sort !== 'relevance' && (
                  <input
                    type="hidden"
                    name="sort"
                    value={sort}
                  />
                )}

                <input
                  key={currentPage}
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
                href={buildPageUrl(
                  Math.min(totalPages, currentPage + 1),
                )}
                rel={filteredView ? 'nofollow' : undefined}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  currentPage >= totalPages
                    ? 'pointer-events-none bg-navy-700 text-slate-500 opacity-50'
                    : 'bg-gold-500 text-navy-950 hover:bg-gold-400'
                }`}
              >
                Next →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
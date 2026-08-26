'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpDown,
  ChevronDown,
  Package,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';

import ProductCard from '@/components/products/ProductCard';
import { BRANDS, CATEGORIES } from '@/lib/data';
import {
  getDisplayBrand,
  getDisplayPartNumber,
} from '@/lib/product-display';
import type {
  Product,
  ProductCategory,
  ProductCondition,
} from '@/lib/types';

const CONDITIONS: ProductCondition[] = [
  'New',
  'Used',
  'Refurbished',
  'Not Working',
];

type SortOption =
  | 'relevance'
  | 'name'
  | 'brand'
  | 'condition';

type ProductsClientProps = {
  initialProducts?: Product[];
  initialQuery?: string;
  initialBrand?: string;
  initialCategory?: string;
  initialCondition?: string;
  initialInStockOnly?: boolean;
  initialSort?: SortOption;
};

function safeText(value: unknown): string {
  return String(value ?? '').trim();
}

export default function ProductsClient({
  initialProducts = [],
  initialQuery = '',
  initialBrand = '',
  initialCategory = '',
  initialCondition = '',
  initialInStockOnly = false,
  initialSort = 'relevance',
}: ProductsClientProps) {
  const router = useRouter();

  const [query, setQuery] = useState(initialQuery);
  const [selectedBrand, setSelectedBrand] =
    useState(initialBrand);
  const [selectedCategory, setSelectedCategory] =
    useState<ProductCategory | ''>(
      initialCategory as ProductCategory | '',
    );
  const [selectedCondition, setSelectedCondition] =
    useState<ProductCondition | ''>(
      initialCondition as ProductCondition | '',
    );
  const [inStockOnly, setInStockOnly] = useState(
    initialInStockOnly,
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortBy, setSortBy] =
    useState<SortOption>(initialSort);
  const [suggestions, setSuggestions] = useState<Product[]>(
    [],
  );
  const [allowSuggestions, setAllowSuggestions] =
    useState(false);

  useEffect(() => {
    setQuery(initialQuery);
    setSelectedBrand(initialBrand);
    setSelectedCategory(
      initialCategory as ProductCategory | '',
    );
    setSelectedCondition(
      initialCondition as ProductCondition | '',
    );
    setInStockOnly(initialInStockOnly);
    setSortBy(initialSort);
    setSuggestions([]);
    setAllowSuggestions(false);
  }, [
    initialQuery,
    initialBrand,
    initialCategory,
    initialCondition,
    initialInStockOnly,
    initialSort,
  ]);

  useEffect(() => {
    const cleanQuery = query.trim();

    if (!allowSuggestions || cleanQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search-products?q=${encodeURIComponent(
            cleanQuery,
          )}`,
          {
            cache: 'no-store',
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error(
            `Search failed: ${response.status}`,
          );
        }

        const data = await response.json();

        if (!controller.signal.aborted) {
          const products = Array.isArray(data)
            ? data
            : Array.isArray(data?.products)
              ? data.products
              : [];

          setSuggestions(products.slice(0, 8));
        }
      } catch (error) {
        if (
          !controller.signal.aborted &&
          !(
            error instanceof Error &&
            error.name === 'AbortError'
          )
        ) {
          setSuggestions([]);
        }
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, allowSuggestions]);

  const navigateWithFilters = ({
    nextQuery = query,
    nextBrand = selectedBrand,
    nextCategory = selectedCategory,
    nextCondition = selectedCondition,
    nextInStockOnly = inStockOnly,
    nextSort = sortBy,
  }: {
    nextQuery?: string;
    nextBrand?: string;
    nextCategory?: string;
    nextCondition?: string;
    nextInStockOnly?: boolean;
    nextSort?: SortOption;
  } = {}) => {
    const params = new URLSearchParams();
    const cleanQuery = nextQuery.trim();

    if (cleanQuery) params.set('q', cleanQuery);
    if (nextBrand) params.set('brand', nextBrand);
    if (nextCategory) params.set('category', nextCategory);
    if (nextCondition) {
      params.set('condition', nextCondition);
    }
    if (nextInStockOnly) {
      params.set('stock', 'in-stock');
    }
    if (nextSort !== 'relevance') {
      params.set('sort', nextSort);
    }

    params.set('page', '1');

    router.push(`/products?${params.toString()}`);
  };

  const submitSearch = () => {
    setSuggestions([]);
    setAllowSuggestions(false);
    navigateWithFilters();
  };

  const clearFilters = () => {
    setQuery('');
    setSelectedBrand('');
    setSelectedCategory('');
    setSelectedCondition('');
    setInStockOnly(false);
    setSortBy('relevance');
    setSuggestions([]);
    setAllowSuggestions(false);

    router.push('/products?page=1');
  };

  const hasFilters = Boolean(
    query ||
      selectedBrand ||
      selectedCategory ||
      selectedCondition ||
      inStockOnly ||
      sortBy !== 'relevance',
  );

  const displayedProducts = useMemo(() => {
    return initialProducts;
  }, [initialProducts]);

  return (
    <div className="min-h-screen bg-navy-900 pt-24">
      <div className="border-b border-navy-700 bg-navy-800">
        <div className="page-container py-10">
          <span className="mb-3 inline-flex rounded-full border border-gold-500/20 bg-gold-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-gold-400">
            Industrial Automation Catalog
          </span>

          <h1 className="text-3xl font-bold text-white md:text-4xl">
            Industrial Automation Parts
          </h1>

          <p className="mt-2 max-w-2xl text-slate-400">
            Search by part number, SKU, brand, category,
            model, or keyword. Browse PLCs, HMIs, drives,
            sensors, circuit breakers and obsolete spare
            parts.
          </p>
        </div>
      </div>

      <div className="page-container py-8">
        <div className="mb-6 rounded-2xl border border-navy-700 bg-navy-800 p-5">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                aria-label="Search industrial automation products"
                placeholder="Search by part number, SKU, brand, model, or category..."
                value={query}
                autoComplete="off"
                onChange={(event) => {
                  setAllowSuggestions(true);
                  setQuery(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setSuggestions([]);
                    setAllowSuggestions(false);
                    event.currentTarget.blur();
                    return;
                  }

                  if (event.key === 'Enter') {
                    event.preventDefault();
                    event.currentTarget.blur();
                    submitSearch();
                  }
                }}
                className="w-full rounded-xl border border-navy-600 bg-navy-900 py-4 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-gold-500"
              />

              {suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-navy-600 bg-navy-800 shadow-2xl">
                  {suggestions.map((item) => (
                    <Link
                      key={item.id}
                      href={`/products/${item.slug}`}
                      onClick={() => {
                        setSuggestions([]);
                        setAllowSuggestions(false);
                      }}
                      className="flex items-center gap-3 border-b border-navy-700 px-4 py-3 hover:bg-navy-700"
                    >
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-white">
                        <Image
                          src={
                            item.imageUrl ||
                            '/placeholder-product.jpg'
                          }
                          alt={
                            item.name ||
                            item.partNumber ||
                            'Product'
                          }
                          fill
                          sizes="48px"
                          quality={60}
                          unoptimized
                          className="object-contain p-1"
                        />
                      </div>

                      <div className="min-w-0">
                        {getDisplayPartNumber(item.partNumber) && (
                          <div className="line-clamp-1 text-sm font-medium text-white">
                            {getDisplayPartNumber(item.partNumber)}
                          </div>
                        )}

                        <div className="line-clamp-1 text-xs text-slate-400">
                          {item.name}
                        </div>

                        {getDisplayBrand(item.brand) && (
                          <div className="text-xs text-slate-500">
                            {getDisplayBrand(item.brand)}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              aria-expanded={filtersOpen}
              aria-controls="product-filters"
              onClick={() =>
                setFiltersOpen((current) => !current)
              }
              className="flex items-center justify-center gap-2 rounded-xl border border-navy-600 bg-navy-700 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-gold-500/50 hover:text-white"
            >
              <SlidersHorizontal size={16} />
              Filters
              {hasFilters && (
                <span className="h-2 w-2 rounded-full bg-gold-500" />
              )}
              <ChevronDown
                size={14}
                className={`transition-transform ${
                  filtersOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            <div className="relative">
              <ArrowUpDown
                size={15}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <select
                aria-label="Sort products"
                value={sortBy}
                onChange={(event) => {
                  const nextSort =
                    event.target.value as SortOption;

                  setSortBy(nextSort);
                  navigateWithFilters({
                    nextSort,
                  });
                }}
                className="h-full min-w-[180px] rounded-xl border border-navy-600 bg-navy-700 py-3 pl-11 pr-4 text-sm font-semibold text-slate-300 outline-none transition focus:border-gold-500"
              >
                <option value="relevance">
                  Sort: Relevance
                </option>
                <option value="name">Sort: Name</option>
                <option value="brand">Sort: Brand</option>
                <option value="condition">
                  Sort: Condition
                </option>
              </select>
            </div>

            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-semibold text-slate-400 transition hover:bg-navy-700 hover:text-white"
              >
                <X size={15} />
                Clear
              </button>
            )}
          </div>

          {filtersOpen && (
            <div
              id="product-filters"
              className="mt-5 grid gap-4 border-t border-navy-700 pt-5 sm:grid-cols-2 lg:grid-cols-4"
            >
              <div>
                <label
                  htmlFor="product-brand-filter"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400"
                >
                  Brand
                </label>

                <select
                  id="product-brand-filter"
                  value={selectedBrand}
                  onChange={(event) => {
                    const nextBrand = event.target.value;

                    setSelectedBrand(nextBrand);
                    navigateWithFilters({
                      nextBrand,
                    });
                  }}
                  className="w-full rounded-xl border border-navy-600 bg-navy-900 px-4 py-3 text-sm text-white outline-none focus:border-gold-500"
                >
                  <option value="">All Brands</option>
                  {BRANDS.map((brand) => (
                    <option
                      key={brand.slug}
                      value={brand.name}
                    >
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="product-category-filter"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400"
                >
                  Category
                </label>

                <select
                  id="product-category-filter"
                  value={selectedCategory}
                  onChange={(event) => {
                    const nextCategory =
                      event.target
                        .value as ProductCategory | '';

                    setSelectedCategory(nextCategory);
                    navigateWithFilters({
                      nextCategory,
                    });
                  }}
                  className="w-full rounded-xl border border-navy-600 bg-navy-900 px-4 py-3 text-sm text-white outline-none focus:border-gold-500"
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map((category) => (
                    <option
                      key={category.slug}
                      value={category.name}
                    >
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="product-condition-filter"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400"
                >
                  Condition
                </label>

                <select
                  id="product-condition-filter"
                  value={selectedCondition}
                  onChange={(event) => {
                    const nextCondition =
                      event.target
                        .value as ProductCondition | '';

                    setSelectedCondition(nextCondition);
                    navigateWithFilters({
                      nextCondition,
                    });
                  }}
                  className="w-full rounded-xl border border-navy-600 bg-navy-900 px-4 py-3 text-sm text-white outline-none focus:border-gold-500"
                >
                  <option value="">All Conditions</option>
                  {CONDITIONS.map((condition) => (
                    <option
                      key={condition}
                      value={condition}
                    >
                      {condition}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Availability
                </label>

                <button
                  type="button"
                  onClick={() => {
                    const nextInStockOnly = !inStockOnly;

                    setInStockOnly(nextInStockOnly);
                    navigateWithFilters({
                      nextInStockOnly,
                    });
                  }}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${
                    inStockOnly
                      ? 'border-gold-500 bg-gold-500/10 text-gold-400'
                      : 'border-navy-600 bg-navy-900 text-slate-300 hover:border-gold-500/40'
                  }`}
                >
                  In Stock Only
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-400">
            Showing{' '}
            <span className="font-semibold text-white">
              {displayedProducts.length}
            </span>{' '}
            {displayedProducts.length === 1
              ? 'result'
              : 'results'}
          </p>

          <p className="text-xs text-slate-500">
            Search by part number, model, SKU, brand or
            category
          </p>
        </div>

        {displayedProducts.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {displayedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-gold-500/20 bg-navy-800 px-6 py-20 text-center">
            <Package
              size={44}
              className="mx-auto mb-5 text-gold-500"
            />

            <h3 className="text-2xl font-bold text-white">
              No Exact Match Found
            </h3>

            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
              We couldn&apos;t find an exact match in the
              current catalog. Send us the part number, brand,
              quantity and photos if available, and we&apos;ll
              help source it worldwide.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href={`/rfq?part=${encodeURIComponent(query)}`}
                className="rounded-xl bg-gold-500 px-7 py-3 text-sm font-semibold text-navy-900 transition hover:bg-gold-400"
              >
                Submit RFQ
              </Link>

              <button
                type="button"
                onClick={clearFilters}
                className="rounded-xl border border-navy-500 px-7 py-3 text-sm font-semibold text-white transition hover:border-gold-500 hover:text-gold-400"
              >
                Clear Search
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import Image from 'next/image';
import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
  Package,
  ArrowUpDown,
} from 'lucide-react';
import ProductCard from '@/components/products/ProductCard';
import { CATEGORIES, BRANDS } from '@/lib/data';
import type { Product, ProductCategory, ProductCondition } from '@/lib/types';

const CONDITIONS: ProductCondition[] = [
  'New',
  'Used',
  'Refurbished',
  'Not Working',
];

type SortOption = 'relevance' | 'name' | 'brand' | 'condition';

export default function ProductsClient({
  initialProducts = [],
}: {
  initialProducts?: Product[];
}) {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | ''>('');
  const [selectedCondition, setSelectedCondition] = useState<ProductCondition | ''>('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [suggestions, setSuggestions] = useState<Product[]>([]);

  useEffect(() => {
    setQuery(searchParams.get('q') || '');
  }, [searchParams]);

  useEffect(() => {
    const cleanQuery = query.trim();

    if (cleanQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search-products?q=${encodeURIComponent(cleanQuery)}`,
          { cache: 'no-store' }
        );

        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data.slice(0, 8) : []);
      } catch {
        setSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();

    const results = initialProducts.filter((p) => {
      const matchesQuery =
        !q ||
        p.partNumber.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.tags.some((t: string) => t.toLowerCase().includes(q));

      const matchesBrand = !selectedBrand || p.brand === selectedBrand;
      const matchesCategory = !selectedCategory || p.category === selectedCategory;
      const matchesCondition = !selectedCondition || p.condition === selectedCondition;
      const matchesStock = !inStockOnly || p.inStock;

      return matchesQuery && matchesBrand && matchesCategory && matchesCondition && matchesStock;
    });

    return [...results].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'brand') return a.brand.localeCompare(b.brand);
      if (sortBy === 'condition') return a.condition.localeCompare(b.condition);
      return 0;
    });
  }, [
    initialProducts,
    query,
    selectedBrand,
    selectedCategory,
    selectedCondition,
    inStockOnly,
    sortBy,
  ]);

  const clearFilters = () => {
    setQuery('');
    setSelectedBrand('');
    setSelectedCategory('');
    setSelectedCondition('');
    setInStockOnly(false);
    setSortBy('relevance');
    setSuggestions([]);
  };

  const hasFilters =
    query ||
    selectedBrand ||
    selectedCategory ||
    selectedCondition ||
    inStockOnly ||
    sortBy !== 'relevance';

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
            Search by part number, SKU, brand, category, model, or keyword.
            Browse PLCs, HMIs, drives, sensors, circuit breakers and obsolete
            spare parts.
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
                placeholder="Search by part number, SKU, brand, model, or category..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    window.location.href = `/products?q=${encodeURIComponent(query)}&page=1`;
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
                      className="flex items-center gap-3 border-b border-navy-700 px-4 py-3 hover:bg-navy-700"
                    >
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-white">
                        <Image
                          src={item.imageUrl || '/placeholder-product.jpg'}
                          alt={item.name || item.partNumber}
                          fill
                          sizes="48px"
                          className="object-contain p-1"
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="line-clamp-1 text-sm font-medium text-white">
                          {item.partNumber}
                        </div>
                        <div className="line-clamp-1 text-xs text-slate-400">
                          {item.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {item.brand}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="flex items-center justify-center gap-2 rounded-xl border border-navy-600 bg-navy-700 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:border-gold-500/50 hover:text-white"
            >
              <SlidersHorizontal size={16} />
              Filters
              {hasFilters && <span className="h-2 w-2 rounded-full bg-gold-500" />}
              <ChevronDown
                size={14}
                className={`transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
              />
            </button>

            <div className="relative">
              <ArrowUpDown
                size={15}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="h-full min-w-[180px] rounded-xl border border-navy-600 bg-navy-700 py-3 pl-11 pr-4 text-sm font-semibold text-slate-300 outline-none transition focus:border-gold-500"
              >
                <option value="relevance">Sort: Relevance</option>
                <option value="name">Sort: Name</option>
                <option value="brand">Sort: Brand</option>
                <option value="condition">Sort: Condition</option>
              </select>
            </div>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-semibold text-slate-400 transition hover:bg-navy-700 hover:text-white"
              >
                <X size={15} />
                Clear
              </button>
            )}
          </div>

          {filtersOpen && (
            <div className="mt-5 grid gap-4 border-t border-navy-700 pt-5 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Brand
                </label>

                <select
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="w-full rounded-xl border border-navy-600 bg-navy-900 px-4 py-3 text-sm text-white outline-none focus:border-gold-500"
                >
                  <option value="">All Brands</option>
                  {BRANDS.map((brand) => (
                    <option key={brand.slug} value={brand.name}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Category
                </label>

                <select
                  value={selectedCategory}
                  onChange={(e) =>
                    setSelectedCategory(e.target.value as ProductCategory | '')
                  }
                  className="w-full rounded-xl border border-navy-600 bg-navy-900 px-4 py-3 text-sm text-white outline-none focus:border-gold-500"
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.slug} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Condition
                </label>

                <select
                  value={selectedCondition}
                  onChange={(e) =>
                    setSelectedCondition(e.target.value as ProductCondition | '')
                  }
                  className="w-full rounded-xl border border-navy-600 bg-navy-900 px-4 py-3 text-sm text-white outline-none focus:border-gold-500"
                >
                  <option value="">All Conditions</option>
                  {CONDITIONS.map((condition) => (
                    <option key={condition} value={condition}>
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
                  onClick={() => setInStockOnly(!inStockOnly)}
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
            Showing <span className="font-semibold text-white">{filtered.length}</span>{' '}
            {filtered.length === 1 ? 'result' : 'results'}
          </p>

          <p className="text-xs text-slate-500">
            Search by part number, model, SKU, brand or category
          </p>
        </div>

        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-gold-500/20 bg-navy-800 px-6 py-20 text-center">
            <Package size={44} className="mx-auto mb-5 text-gold-500" />

            <h3 className="text-2xl font-bold text-white">
              No Exact Match Found
            </h3>

            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
              We couldn&apos;t find an exact match in the current catalog. Send
              us the part number, brand, quantity and photos if available, and
              we&apos;ll help source it worldwide.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href={`/rfq?part=${encodeURIComponent(query)}`}
                className="rounded-xl bg-gold-500 px-7 py-3 text-sm font-semibold text-navy-900 transition hover:bg-gold-400"
              >
                Submit RFQ
              </Link>

              <button
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

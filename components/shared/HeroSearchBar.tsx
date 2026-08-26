'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Loader2, Search } from 'lucide-react';

import type { Product } from '@/lib/types';
import {
  getDisplayBrand,
  getDisplayPartNumber,
} from '@/lib/product-display';

interface HeroSearchBarProps {
  initialQuery?: string;
}

export default function HeroSearchBar({
  initialQuery = '',
}: HeroSearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [userInteracted, setUserInteracted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const submittedRef = useRef(false);

  const closeSuggestions = () => {
    abortControllerRef.current?.abort();
    setOpen(false);
    setSelectedIndex(-1);
    setLoading(false);
  };

  useEffect(() => {
    setQuery(initialQuery);
    setSuggestions([]);
    setOpen(false);
    setSelectedIndex(-1);
    setUserInteracted(false);
    submittedRef.current = true;
    abortControllerRef.current?.abort();
    setLoading(false);
    inputRef.current?.blur();
  }, [initialQuery, pathname, searchParams]);

  useEffect(() => {
    const cleanQuery = query.trim();

    if (!userInteracted || submittedRef.current) {
      setOpen(false);
      setLoading(false);
      return;
    }

    if (cleanQuery.length < 2) {
      abortControllerRef.current?.abort();
      setSuggestions([]);
      setOpen(false);
      setSelectedIndex(-1);
      setLoading(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      abortControllerRef.current?.abort();

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setLoading(true);

      try {
        const response = await fetch(
          `/api/search-products?q=${encodeURIComponent(cleanQuery)}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`Search failed: ${response.status}`);
        }

        const data = await response.json();

        if (controller.signal.aborted || submittedRef.current) {
          return;
        }

        const products: Product[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.products)
            ? data.products
            : [];

        setSuggestions(products);
        setSelectedIndex(-1);
        setOpen(true);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        if (!submittedRef.current) {
          setSuggestions([]);
          setSelectedIndex(-1);
          setOpen(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query, userInteracted]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  const submitSearch = (searchValue?: string) => {
    const cleanQuery = String(searchValue ?? query).trim();
    if (!cleanQuery) return;

    submittedRef.current = true;
    setUserInteracted(false);
    closeSuggestions();
    inputRef.current?.blur();

    router.push(`/products?q=${encodeURIComponent(cleanQuery)}`);
  };

  const openProduct = (product: Product) => {
    submittedRef.current = true;
    setUserInteracted(false);
    closeSuggestions();
    inputRef.current?.blur();
    router.push(`/products/${product.slug}`);
  };

  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    submittedRef.current = false;
    setUserInteracted(true);
    setQuery(event.target.value);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setSelectedIndex(-1);
      inputRef.current?.blur();
      return;
    }

    if (!open || suggestions.length === 0) {
      if (event.key === 'Enter') {
        event.preventDefault();
        submitSearch();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((index) =>
        index < suggestions.length - 1 ? index + 1 : 0
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((index) =>
        index > 0 ? index - 1 : suggestions.length - 1
      );
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();

      const selectedProduct = suggestions[selectedIndex];
      if (selectedProduct) {
        openProduct(selectedProduct);
      } else {
        submitSearch();
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl">
      <div className="flex items-center overflow-hidden rounded-lg border-2 border-transparent bg-white shadow-xl shadow-black/30 transition-all focus-within:border-gold-500">
        <div className="flex min-w-0 flex-1 items-center gap-2 pl-4">
          {loading ? (
            <Loader2
              size={20}
              className="shrink-0 animate-spin text-slate-400"
            />
          ) : (
            <Search size={20} className="shrink-0 text-slate-400" />
          )}

          <input
            ref={inputRef}
            type="text"
            value={query}
            autoComplete="off"
            aria-label="Search products by part number"
            onFocus={() => {
              submittedRef.current = false;
              setUserInteracted(true);

              if (query.trim() && suggestions.length > 0) {
                setOpen(true);
              }
            }}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            placeholder="Part Number..."
            className="min-w-0 flex-1 bg-transparent py-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 md:py-4 md:text-base"
          />
        </div>

        <button
          type="button"
          onClick={() => submitSearch()}
          className="flex shrink-0 items-center gap-1 bg-gold-500 px-4 py-3 text-sm font-semibold text-navy-900 transition-colors hover:bg-gold-400 md:gap-2 md:px-6 md:py-4"
        >
          Search <ArrowRight size={16} />
        </button>
      </div>

      {open && query.trim() && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-navy-600 bg-navy-800 shadow-2xl shadow-black/60">
          {loading ? (
            <div className="px-4 py-5 text-center text-sm text-slate-400">
              Searching...
            </div>
          ) : suggestions.length > 0 ? (
            <>
              <div className="border-b border-navy-700 px-3 py-2">
                <p className="text-xs font-medium text-slate-400">
                  {suggestions.length} result
                  {suggestions.length !== 1 ? 's' : ''} found
                </p>
              </div>

              {suggestions.map((product, index) => (
                <button
                  key={product.id}
                  type="button"
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => openProduct(product)}
                  className={`flex w-full items-start gap-4 border-b border-navy-700 px-4 py-3 text-left transition-colors last:border-0 ${
                    selectedIndex === index
                      ? 'bg-navy-700'
                      : 'hover:bg-navy-700'
                  }`}
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white">
                    <Image
                      src={product.imageUrl || '/placeholder-product.jpg'}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="56px"
                      quality={60}
                      unoptimized
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {getDisplayPartNumber(product.partNumber) && (
                        <span className="font-mono text-sm font-bold text-gold-500">
                          {getDisplayPartNumber(product.partNumber)}
                        </span>
                      )}
                      {getDisplayBrand(product.brand) && (
                        <span className="text-xs font-medium text-slate-500">
                          {getDisplayBrand(product.brand)}
                        </span>
                      )}
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          product.condition === 'New'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : product.condition === 'Refurbished'
                              ? 'bg-sky-500/20 text-sky-400'
                              : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {product.condition}
                      </span>
                    </div>

                    <p className="mt-0.5 truncate text-sm text-slate-200">
                      {product.name}
                    </p>

                    <div className="mt-1 flex items-center gap-3">
                      <span className="text-xs text-slate-500">
                        {product.category}
                      </span>
                      <span
                        className={`flex items-center gap-1 text-xs ${
                          product.inStock
                            ? 'text-emerald-400'
                            : 'text-slate-500'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            product.inStock
                              ? 'bg-emerald-400'
                              : 'bg-slate-500'
                          }`}
                        />
                        {product.inStock
                          ? 'In Stock'
                          : 'Check Availability'}
                      </span>
                    </div>
                  </div>

                  <span className="shrink-0 self-center text-xs text-gold-500">
                    View →
                  </span>
                </button>
              ))}

              <button
                type="button"
                onClick={() => submitSearch()}
                className="w-full px-4 py-3 text-center text-sm font-medium text-gold-500 transition-colors hover:bg-navy-700"
              >
                Search all results for &ldquo;{query}&rdquo; →
              </button>
            </>
          ) : (
            <div className="px-4 py-5 text-center">
              <p className="text-sm font-semibold text-white">
                No exact match found for &ldquo;{query}&rdquo;
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Submit an RFQ and our team will help source this part.
              </p>
              <Link
                href={`/rfq?part=${encodeURIComponent(query.trim())}`}
                onClick={() => {
                  submittedRef.current = true;
                  setUserInteracted(false);
                  closeSuggestions();
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gold-500 px-4 py-2 text-sm font-semibold text-navy-900 transition hover:bg-gold-400"
              >
                Submit RFQ <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

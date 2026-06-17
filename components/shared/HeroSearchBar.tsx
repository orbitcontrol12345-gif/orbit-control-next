'use client';

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, ArrowRight, Loader2 } from 'lucide-react';
import type { Product } from '@/lib/types';

interface HeroSearchBarProps {
  initialQuery?: string;
}

export default function HeroSearchBar({
  initialQuery = '',
}: HeroSearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cleanQuery = query.trim();

    if (cleanQuery.length >= 1) {
      setLoading(true);

      const timer = setTimeout(async () => {
        try {
          const res = await fetch(
  `/api/search-products?q=${encodeURIComponent(cleanQuery)}`
);

          const data = await res.json();

          setSuggestions(
  Array.isArray(data)
    ? data
    : Array.isArray(data.products)
    ? data.products
    : []
);
          setOpen(true);
        } catch {
          setSuggestions([]);
          setOpen(true);
        } finally {
          setLoading(false);
        }
      }, 250);

      return () => clearTimeout(timer);
    }

    setSuggestions([]);
    setOpen(false);
    setLoading(false);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = () => {
    const cleanQuery = query.trim();

    if (!cleanQuery) return;

    router.push(`/products?q=${encodeURIComponent(cleanQuery)}`);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const closeSearch = () => {
    setOpen(false);
    setQuery('');
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
            type="text"
            value={query}
            autoComplete="off"
            onFocus={() => {
              if (query.trim()) setOpen(true);
            }}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Part Number..."
            className="min-w-0 flex-1 bg-transparent py-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 md:py-4 md:text-base"
          />
        </div>

        <button
          type="button"
          onClick={handleSearch}
          className="flex shrink-0 items-center gap-1 bg-gold-500 px-4 py-3 text-sm font-semibold text-navy-900 transition-colors hover:bg-gold-400 md:gap-2 md:px-6 md:py-4"
        >
          Search <ArrowRight size={16} />
        </button>
      </div>

      {open && query.trim() && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-navy-600 bg-navy-800 shadow-2xl shadow-black/60">
          {suggestions.length > 0 ? (
            <>
              <div className="border-b border-navy-700 px-3 py-2">
                <p className="text-xs font-medium text-slate-400">
                  {suggestions.length} result
                  {suggestions.length !== 1 ? 's' : ''} found
                </p>
              </div>

              {suggestions.map((p) => (
                <Link
                  key={p.id}
                  href={`/products/${p.slug}`}
                  onClick={closeSearch}
                  className="flex items-start gap-4 border-b border-navy-700 px-4 py-3 transition-colors last:border-0 hover:bg-navy-700"
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white">
                    <Image
                      src={p.imageUrl || '/placeholder-product.jpg'}
                      alt={p.name}
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-gold-500">
                        {p.partNumber}
                      </span>

                      <span className="text-xs font-medium text-slate-500">
                        {p.brand}
                      </span>

                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          p.condition === 'New'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : p.condition === 'Refurbished'
                            ? 'bg-sky-500/20 text-sky-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {p.condition}
                      </span>
                    </div>

                    <p className="mt-0.5 truncate text-sm text-slate-200">
                      {p.name}
                    </p>

                    <div className="mt-1 flex items-center gap-3">
                      <span className="text-xs text-slate-500">
                        {p.category}
                      </span>

                      <span
                        className={`flex items-center gap-1 text-xs ${
                          p.inStock ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            p.inStock ? 'bg-emerald-400' : 'bg-slate-500'
                          }`}
                        />
                        {p.inStock ? 'In Stock' : 'Check Availability'}
                      </span>
                    </div>
                  </div>

                  <span className="shrink-0 self-center text-xs text-gold-500">
                    View →
                  </span>
                </Link>
              ))}

              <button
                type="button"
                onClick={handleSearch}
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
                onClick={() => setOpen(false)}
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

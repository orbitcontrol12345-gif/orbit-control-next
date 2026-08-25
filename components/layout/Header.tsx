'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Menu, Search, X } from 'lucide-react';

import type { Product } from '@/lib/types';

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Products', href: '/products' },
  { label: 'Brands', href: '/brands' },
  { label: 'Categories', href: '/categories' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const submittedRef = useRef(false);

  const closeSearch = (clearQuery = false) => {
    abortControllerRef.current?.abort();
    setSearchOpen(false);
    setSuggestions([]);
    setSelectedIndex(-1);
    setLoading(false);

    if (clearQuery) {
      setSearchQuery('');
    }
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    submittedRef.current = true;
    closeSearch(true);
    setMobileOpen(false);
    inputRef.current?.blur();
  }, [pathname, searchParams]);

  useEffect(() => {
    const query = searchQuery.trim();

    if (submittedRef.current || query.length < 2) {
      if (query.length < 2) {
        setSuggestions([]);
        setSearchOpen(false);
        setSelectedIndex(-1);
      }
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
          `/api/search-products?q=${encodeURIComponent(query)}`,
          {
            signal: controller.signal,
            cache: 'no-store',
          }
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
        setSearchOpen(true);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        if (!submittedRef.current) {
          setSuggestions([]);
          setSelectedIndex(-1);
          setSearchOpen(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setSearchOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);

  const submitSearch = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    const query = searchQuery.trim();
    if (!query) return;

    submittedRef.current = true;
    closeSearch(true);
    inputRef.current?.blur();

    router.push(`/products?q=${encodeURIComponent(query)}`);
  };

  const openProduct = (product: Product) => {
    submittedRef.current = true;
    closeSearch(true);
    inputRef.current?.blur();
    router.push(`/products/${product.slug}`);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setSearchOpen(false);
      setSelectedIndex(-1);
      inputRef.current?.blur();
      return;
    }

    if (!searchOpen || suggestions.length === 0) {
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
    <header
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-navy-700 bg-navy-900/98 shadow-lg shadow-black/30 backdrop-blur-sm'
          : 'border-b border-navy-800 bg-navy-900/95 backdrop-blur-sm'
      }`}
    >
      <div className="hidden border-b border-navy-800 bg-navy-950 md:block">
        <div className="page-container flex items-center justify-between py-2">
          <p className="text-xs text-slate-400">
            Worldwide Industrial Automation Spare Parts Supplier — UAE
          </p>

          <div className="flex items-center gap-4 text-xs text-slate-400">
            <a
              href="https://wa.me/971554835199"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-gold-500"
            >
              +971 55 483 5199
            </a>

            <span>|</span>

            <a
              href="mailto:info@orbit-surplus.com"
              className="transition-colors hover:text-gold-500"
            >
              info@orbit-surplus.com
            </a>
          </div>
        </div>
      </div>

      <div className="page-container">
        <div className="flex h-20 items-center justify-between gap-4">
          <Link href="/" className="flex shrink-0 items-center">
            <Image
              src="/logo.png"
              alt="Orbit Control Automation"
              width={280}
              height={76}
              priority
              className="h-14 w-auto md:h-[68px]"
            />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded px-3 py-2 text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? 'bg-gold-500/10 text-gold-500'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <div ref={searchRef} className="relative">
              <form
                onSubmit={submitSearch}
                className="flex items-center overflow-hidden rounded-md border border-navy-500 bg-navy-700 transition-all focus-within:border-gold-500 focus-within:ring-1 focus-within:ring-gold-500"
              >
                <Search size={15} className="ml-3 shrink-0 text-slate-400" />

                <input
                  ref={inputRef}
                  name="q"
                  type="text"
                  autoComplete="off"
                  placeholder="Search part number..."
                  value={searchQuery}
                  onFocus={() => {
                    submittedRef.current = false;
                    if (searchQuery.trim() && suggestions.length > 0) {
                      setSearchOpen(true);
                    }
                  }}
                  onChange={(event) => {
                    submittedRef.current = false;
                    setSearchQuery(event.target.value);
                    setSelectedIndex(-1);
                  }}
                  onKeyDown={handleKeyDown}
                  className="w-52 bg-transparent px-2.5 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 xl:w-60"
                />
              </form>

              {searchOpen && searchQuery.trim() && (
                <div className="absolute right-0 top-full z-50 mt-2 w-[430px] overflow-hidden rounded-xl border border-navy-600 bg-navy-800 shadow-2xl shadow-black/50">
                  {loading ? (
                    <div className="px-4 py-5 text-center text-sm text-slate-400">
                      Searching...
                    </div>
                  ) : suggestions.length > 0 ? (
                    <>
                      {suggestions.map((product, index) => (
                        <button
                          key={product.id}
                          type="button"
                          onMouseEnter={() => setSelectedIndex(index)}
                          onClick={() => openProduct(product)}
                          className={`flex w-full items-start gap-3 border-b border-navy-700 px-4 py-3 text-left transition-colors last:border-0 ${
                            selectedIndex === index
                              ? 'bg-navy-700'
                              : 'hover:bg-navy-700'
                          }`}
                        >
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-navy-600 bg-white">
                            <Image
                              src={product.imageUrl || '/placeholder-product.jpg'}
                              alt={product.name}
                              fill
                              sizes="48px"
                              quality={60}
                              unoptimized
                              className="object-cover"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-gold-500">
                                {product.partNumber}
                              </span>
                              <span className="text-xs text-slate-500">
                                {product.brand}
                              </span>
                            </div>

                            <p className="truncate text-sm text-slate-200">
                              {product.name}
                            </p>

                            <div className="mt-0.5 flex items-center gap-2">
                              <span className="text-xs text-slate-500">
                                {product.category}
                              </span>
                              <span
                                className={`text-xs ${
                                  product.inStock
                                    ? 'text-emerald-400'
                                    : 'text-slate-500'
                                }`}
                              >
                                {product.inStock
                                  ? '● In Stock'
                                  : '○ Check availability'}
                              </span>
                            </div>
                          </div>

                          <span className="shrink-0 text-xs font-semibold text-gold-500">
                            View →
                          </span>
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => submitSearch()}
                        className="block w-full px-4 py-3 text-center text-xs font-semibold text-gold-500 transition-colors hover:bg-navy-700"
                      >
                        Search all results for &quot;{searchQuery}&quot; →
                      </button>
                    </>
                  ) : (
                    <div className="px-4 py-4 text-center">
                      <p className="text-sm font-semibold text-white">
                        No matching products found
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Submit an RFQ and we will help source this part.
                      </p>
                      <Link
                        href={`/rfq?part=${encodeURIComponent(searchQuery.trim())}`}
                        onClick={() => closeSearch(true)}
                        className="mt-3 inline-flex rounded-lg bg-gold-500 px-4 py-2 text-xs font-semibold text-navy-900 transition hover:bg-gold-400"
                      >
                        Submit RFQ
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Link href="/rfq" className="btn-gold px-5 py-2 text-sm">
              Request Quote
            </Link>
          </div>

          <button
            onClick={() => setMobileOpen((value) => !value)}
            className="p-2 text-slate-300 transition-colors hover:text-white lg:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="animate-fade-in border-t border-navy-700 bg-navy-800 lg:hidden">
          <div className="page-container space-y-1 py-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block rounded px-4 py-2.5 text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? 'bg-gold-500/10 text-gold-500'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}

            <Link
              href="/sell-surplus"
              className="block rounded px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              Sell Surplus
            </Link>

            <div className="border-t border-navy-700 pt-3">
              <Link href="/rfq" className="btn-gold w-full justify-center text-sm">
                Request a Quote
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

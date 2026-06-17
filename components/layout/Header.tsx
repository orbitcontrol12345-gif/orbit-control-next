'use client';

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Search } from 'lucide-react';

import type { Product } from '@/lib/types';

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Products', href: '/products' },
  { label: 'Brands', href: '/brands' },
  { label: 'Categories', href: '/categories' },
  { label: 'Sell Surplus', href: '/sell-surplus' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
    setSearchQuery('');
  }, [pathname]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSuggestions() {
      const q = searchQuery.trim();

      if (q.length < 1) {
        setSuggestions([]);
        setSearchOpen(false);
        return;
      }

      try {
        const res = await fetch(
          `/api/search-products?q=${encodeURIComponent(q)}`,
          {
            signal: controller.signal,
            cache: 'no-store',
          }
        );

        const data = await res.json();

        setSuggestions(Array.isArray(data) ? data : []);
        setSearchOpen(true);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setSearchOpen(true);
        }
      }
    }

    loadSuggestions();

    return () => controller.abort();
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const submitSearch = (e: React.FormEvent<HTMLFormElement>) => {
    if (!searchQuery.trim()) {
      e.preventDefault();
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
              href="mailto:info@xeltronic.com"
              className="transition-colors hover:text-gold-500"
            >
              info@xeltronic.com
            </a>
          </div>
        </div>
      </div>

      <div className="page-container">
        <div className="flex h-20 items-center justify-between">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <Image
  <Image
  src="/logo.png"
  alt="Orbit Control Automation"
  width={420}
  height={120}
  priority
  className="h-20 w-auto md:h-24"
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
                action="/products"
                onSubmit={submitSearch}
                className="flex items-center overflow-hidden rounded-md border border-navy-500 bg-navy-700 transition-all focus-within:border-gold-500 focus-within:ring-1 focus-within:ring-gold-500"
              >
                <Search size={15} className="ml-3 shrink-0 text-slate-400" />

                <input
                  name="q"
                  type="text"
                  autoComplete="off"
                  placeholder="Search part number..."
                  value={searchQuery}
                  onFocus={() => {
                    if (searchQuery.trim()) setSearchOpen(true);
                  }}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-56 bg-transparent px-2.5 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500"
                />
              </form>

              {searchOpen && searchQuery.trim() && (
                <div className="absolute right-0 top-full z-50 mt-2 w-[430px] overflow-hidden rounded-xl border border-navy-600 bg-navy-800 shadow-2xl shadow-black/50">
                  {suggestions.length > 0 ? (
                    <>
                      {suggestions.map((p) => (
                        <Link
                          key={p.id}
                          href={`/products/${p.slug}`}
                          onClick={() => {
                            setSearchOpen(false);
                            setSearchQuery('');
                          }}
                          className="flex items-start gap-3 border-b border-navy-700 px-4 py-3 transition-colors last:border-0 hover:bg-navy-700"
                        >
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-navy-600 bg-white">
                            <Image
                              src={p.imageUrl}
                              alt={p.name}
                              fill
                              sizes="48px"
                              className="object-cover"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-gold-500">
                                {p.partNumber}
                              </span>

                              <span className="text-xs text-slate-500">
                                {p.brand}
                              </span>
                            </div>

                            <p className="truncate text-sm text-slate-200">
                              {p.name}
                            </p>

                            <div className="mt-0.5 flex items-center gap-2">
                              <span className="text-xs text-slate-500">
                                {p.category}
                              </span>

                              <span
                                className={`text-xs ${
                                  p.inStock
                                    ? 'text-emerald-400'
                                    : 'text-slate-500'
                                }`}
                              >
                                {p.inStock
                                  ? '● In Stock'
                                  : '○ Check availability'}
                              </span>
                            </div>
                          </div>

                          <span className="shrink-0 text-xs font-semibold text-gold-500">
                            View →
                          </span>
                        </Link>
                      ))}

                      <Link
                        href={`/products?q=${encodeURIComponent(searchQuery)}`}
                        onClick={() => {
                          setSearchOpen(false);
                          setSearchQuery('');
                        }}
                        className="block px-4 py-3 text-center text-xs font-semibold text-gold-500 transition-colors hover:bg-navy-700"
                      >
                        Search all results for &quot;{searchQuery}&quot; →
                      </Link>
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
                        href={`/rfq?part=${encodeURIComponent(searchQuery)}`}
                        onClick={() => {
                          setSearchOpen(false);
                          setSearchQuery('');
                        }}
                        className="mt-3 inline-flex rounded-lg bg-gold-500 px-4 py-2 text-xs font-semibold text-navy-900 transition hover:bg-gold-400"
                      >
                        Submit RFQ
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Link href="/rfq" className="btn-gold px-4 py-2 text-sm">
              Request Quote
            </Link>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
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

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ChevronDown,
  Menu,
  Search,
  ShoppingBag,
  X,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Products', href: '/products' },
  { label: 'Brands', href: '/brands' },
  { label: 'Categories', href: '/categories' },
  { label: 'Industries', href: '/industries' },
  { label: 'RFQ', href: '/rfq' },
  { label: 'About Us', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

export default function HeaderV2() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';

    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'border-b border-white/10 bg-[#030914]/88 shadow-2xl shadow-black/30 backdrop-blur-2xl'
            : 'border-b border-white/[0.07] bg-[#030914]/72 backdrop-blur-xl'
        }`}
      >
        {/* Top bar */}
        <div className="hidden border-b border-white/[0.06] bg-black/20 lg:block">
          <div className="page-container flex h-8 items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-5">
              <span>Worldwide Supplier of Industrial Automation Parts</span>
              <span className="text-amber-300">•</span>
              <span>Fast RFQ Response</span>
              <span className="text-amber-300">•</span>
              <span>DHL & FedEx Shipping</span>
            </div>

            <div className="flex items-center gap-4">
              <span>Ajman, UAE</span>
              <span className="h-3 w-px bg-white/10" />
              <button
                type="button"
                className="flex items-center gap-1 transition hover:text-white"
              >
                English
                <ChevronDown size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Main navigation */}
        <div className="page-container flex h-[74px] items-center justify-between gap-6">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-3"
            aria-label="Orbit Control Home"
          >
            <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-amber-300/25 bg-amber-300/[0.08]">
              <div className="absolute h-7 w-7 rounded-full border-2 border-amber-300" />
              <div className="absolute h-[2px] w-10 -rotate-[28deg] bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />
              <div className="absolute right-1 top-2 h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.9)]" />
            </div>

            <div>
              <div className="text-[18px] font-black uppercase tracking-[0.08em] text-white">
                Orbit Control
              </div>
              <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.42em] text-slate-400">
                Automation
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 xl:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <Link
              href="/products"
              aria-label="Search products"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.08] hover:text-cyan-100"
            >
              <Search size={18} />
            </Link>

            <Link
              href="/rfq"
              aria-label="RFQ basket"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-amber-300/30 hover:bg-amber-300/[0.08] hover:text-amber-100"
            >
              <ShoppingBag size={18} />

              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-black text-[#111827]">
                0
              </span>
            </Link>

            <Link
              href="/rfq"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 px-5 text-sm font-black text-[#111827] shadow-lg shadow-amber-950/20 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-amber-900/30"
            >
              Request a Quote
            </Link>
          </div>

          <button
            type="button"
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.08] lg:hidden"
          >
            <Menu size={21} />
          </button>
        </div>
      </header>

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-[60] bg-black/65 backdrop-blur-sm transition duration-300 lg:hidden ${
          mobileOpen
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Mobile panel */}
      <aside
        className={`fixed right-0 top-0 z-[70] h-full w-[88%] max-w-sm border-l border-white/10 bg-[#06111d] shadow-2xl shadow-black/60 transition-transform duration-300 lg:hidden ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-[74px] items-center justify-between border-b border-white/10 px-5">
          <span className="font-black uppercase tracking-[0.08em] text-white">
            Orbit Control
          </span>

          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMobileOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          <div className="mb-5 flex items-center rounded-xl border border-white/10 bg-white/[0.04] px-4">
            <Search size={18} className="shrink-0 text-slate-500" />

            <input
              type="search"
              placeholder="Search part number..."
              className="h-12 w-full bg-transparent px-3 text-sm text-white outline-none placeholder:text-slate-600"
            />
          </div>

          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-between rounded-xl border border-transparent px-4 py-3.5 text-sm font-bold text-slate-300 transition hover:border-white/10 hover:bg-white/[0.05] hover:text-white"
              >
                {item.label}
                <span className="text-slate-600">→</span>
              </Link>
            ))}
          </nav>

          <Link
            href="/rfq"
            onClick={() => setMobileOpen(false)}
            className="mt-6 flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 text-sm font-black text-[#111827]"
          >
            Request a Quote
          </Link>

          <div className="mt-6 rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.05] p-4">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-cyan-200">
              Global Industrial Supply
            </p>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              PLCs, HMIs, VFDs, breakers, sensors, industrial boards and
              obsolete automation parts.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

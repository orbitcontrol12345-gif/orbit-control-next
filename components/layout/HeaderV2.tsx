'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ChevronDown,
  Globe2,
  MapPin,
  Menu,
  PackageCheck,
  Search,
  ShoppingBag,
  Truck,
  X,
  Zap,
} from 'lucide-react';

const NAV_ITEMS = [
  {
    label: 'Products',
    href: '/products',
    hasDropdown: true,
  },
  {
    label: 'Brands',
    href: '/brands',
  },
  {
    label: 'Categories',
    href: '/categories',
    hasDropdown: true,
  },
  {
    label: 'Industries',
    href: '/industries',
  },
  {
    label: 'RFQ',
    href: '/rfq',
  },
  {
    label: 'About Us',
    href: '/about',
  },
  {
    label: 'Contact',
    href: '/contact',
  },
];

const TOP_BAR_ITEMS = [
  {
    label: 'Worldwide Supplier of Industrial Automation Parts',
    icon: Globe2,
  },
  {
    label: 'Fast RFQ Response',
    icon: Zap,
  },
  {
    label: 'DHL & FedEx Shipping',
    icon: Truck,
  },
  {
    label: '14,000+ Parts In Stock',
    icon: PackageCheck,
  },
];

export default function HeaderV2() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 16);
    };

    handleScroll();

    window.addEventListener('scroll', handleScroll, {
      passive: true,
    });

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
            ? 'border-b border-cyan-400/15 bg-[#020711]/95 shadow-[0_15px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl'
            : 'border-b border-white/[0.07] bg-[#020711]/90 backdrop-blur-lg'
        }`}
      >
        {/* Top information bar */}
        <div className="hidden border-b border-white/[0.06] bg-black/35 xl:block">
          <div className="page-container flex h-10 items-center justify-between">
            <div className="flex items-center gap-8">
              {TOP_BAR_ITEMS.map(({ label, icon: Icon }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 text-[11px] font-medium text-slate-300"
                >
                  <Icon
                    size={13}
                    strokeWidth={2}
                    className="text-amber-400"
                  />

                  <span>{label}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4 text-[11px] text-slate-300">
              <div className="flex items-center gap-2">
                <MapPin size={13} className="text-cyan-400" />
                <span>Ajman, UAE</span>
              </div>

              <span className="h-4 w-px bg-white/10" />

              <button
                type="button"
                className="flex items-center gap-1.5 transition hover:text-white"
              >
                English
                <ChevronDown size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Main navigation */}
        <div className="page-container flex h-[76px] items-center justify-between gap-5 lg:h-[82px]">
          <Link
            href="/"
            aria-label="Orbit Control Automation Home"
            className="group flex shrink-0 items-center gap-3"
          >
            <div className="relative flex h-12 w-12 items-center justify-center">
              <div className="absolute inset-[5px] rounded-full border-2 border-amber-400 transition group-hover:shadow-[0_0_24px_rgba(251,191,36,0.35)]" />

              <div className="absolute h-[2px] w-[52px] -rotate-[38deg] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

              <div className="absolute right-0 top-1 h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.9)]" />

              <div className="h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.85)]" />
            </div>

            <div className="leading-none">
              <div className="text-[18px] font-black uppercase tracking-[0.07em] text-white lg:text-[20px]">
                Orbit Control
              </div>

              <div className="mt-2 text-[8px] font-bold uppercase tracking-[0.48em] text-slate-400">
                Automation
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-0.5 xl:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="group flex h-11 items-center gap-1 rounded-lg px-3 text-[13px] font-semibold text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
              >
                <span>{item.label}</span>

                {item.hasDropdown && (
                  <ChevronDown
                    size={13}
                    className="mt-0.5 text-slate-500 transition group-hover:text-amber-400"
                  />
                )}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link
              href="/products"
              aria-label="Search industrial parts"
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] text-slate-300 transition hover:border-cyan-400/40 hover:bg-cyan-400/[0.08] hover:text-cyan-200"
            >
              <Search size={18} />
            </Link>

            <Link
              href="/rfq"
              aria-label="Open RFQ basket"
              className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.035] text-slate-300 transition hover:border-amber-400/40 hover:bg-amber-400/[0.08] hover:text-amber-200"
            >
              <ShoppingBag size={18} />

              <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-[#020711] bg-amber-400 px-1 text-[9px] font-black leading-none text-black">
                0
              </span>
            </Link>

            <Link
              href="/rfq"
              className="ml-1 inline-flex h-11 items-center justify-center rounded-lg bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 px-5 text-[13px] font-black text-[#111827] shadow-[0_8px_30px_rgba(245,158,11,0.22)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_35px_rgba(245,158,11,0.35)]"
            >
              Request a Quote
            </Link>
          </div>

          <button
            type="button"
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.08] lg:hidden"
          >
            <Menu size={22} />
          </button>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />
      </header>

      {/* Mobile background */}
      <div
        aria-hidden="true"
        onClick={() => setMobileOpen(false)}
        className={`fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          mobileOpen
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Mobile navigation */}
      <aside
        className={`fixed right-0 top-0 z-[70] h-dvh w-[90%] max-w-sm overflow-y-auto border-l border-cyan-400/15 bg-[#030b16] shadow-2xl shadow-black/80 transition-transform duration-300 lg:hidden ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-[76px] items-center justify-between border-b border-white/10 px-5">
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3"
          >
            <div className="relative flex h-10 w-10 items-center justify-center">
              <div className="absolute inset-1 rounded-full border-2 border-amber-400" />
              <div className="absolute h-[2px] w-10 -rotate-[38deg] bg-cyan-400" />
              <div className="h-2 w-2 rounded-full bg-cyan-400" />
            </div>

            <div>
              <div className="text-sm font-black uppercase tracking-[0.08em] text-white">
                Orbit Control
              </div>

              <div className="mt-1 text-[7px] font-bold uppercase tracking-[0.4em] text-slate-500">
                Automation
              </div>
            </div>
          </Link>

          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMobileOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          <form
            action="/products"
            method="get"
            className="mb-5 flex overflow-hidden rounded-xl border border-cyan-400/20 bg-black/25"
          >
            <Search
              size={18}
              className="ml-4 shrink-0 self-center text-cyan-400"
            />

            <input
              type="search"
              name="search"
              placeholder="Search part number..."
              className="h-12 min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-slate-600"
            />
          </form>

          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="group flex items-center justify-between rounded-xl border border-transparent px-4 py-3.5 text-sm font-bold text-slate-300 transition hover:border-cyan-400/15 hover:bg-cyan-400/[0.05] hover:text-white"
              >
                <span>{item.label}</span>

                {item.hasDropdown ? (
                  <ChevronDown
                    size={15}
                    className="text-slate-600 group-hover:text-amber-400"
                  />
                ) : (
                  <span className="text-slate-600 group-hover:text-cyan-400">
                    →
                  </span>
                )}
              </Link>
            ))}
          </nav>

          <Link
            href="/rfq"
            onClick={() => setMobileOpen(false)}
            className="mt-6 flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 text-sm font-black text-[#111827] shadow-lg shadow-amber-950/30"
          >
            Request a Quote
          </Link>

          <div className="mt-6 border-t border-white/10 pt-5">
            <div className="space-y-4 text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <MapPin size={15} className="text-cyan-400" />
                <span>Ajman, United Arab Emirates</span>
              </div>

              <div className="flex items-center gap-3">
                <Truck size={15} className="text-amber-400" />
                <span>DHL & FedEx Worldwide Shipping</span>
              </div>

              <div className="flex items-center gap-3">
                <PackageCheck size={15} className="text-cyan-400" />
                <span>14,000+ Industrial Parts</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

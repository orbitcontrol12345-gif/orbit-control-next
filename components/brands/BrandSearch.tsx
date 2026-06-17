'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Search, Building2 } from 'lucide-react';
import { useState } from 'react';
import { BRANDS } from '@/lib/data';

export default function BrandSearch() {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const suggestions = BRANDS.filter((brand) =>
    brand.name.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 8);

  return (
    <div className="relative">
      <Search
        size={20}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
      />

      <input
        type="text"
        value={search}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        placeholder="Search ABB, Siemens, Schneider, Omron, Honeywell..."
        className="w-full rounded-xl border border-navy-600 bg-navy-900 py-4 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-gold-500"
      />

      {open && search && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-navy-600 bg-navy-800 shadow-xl">
          {suggestions.map((brand) => (
            <Link
              key={brand.slug}
              href={`/brands/${brand.slug}`}
              className="flex items-center gap-3 px-4 py-3 transition hover:bg-navy-700"
            >
              <div className="flex h-9 w-16 items-center justify-center rounded bg-white p-1.5">
                {brand.logo ? (
                  <Image
                    src={brand.logo}
                    alt={`${brand.name} logo`}
                    width={64}
                    height={32}
                    className="max-h-7 w-auto object-contain"
                  />
                ) : (
                  <Building2 size={18} className="text-gold-500" />
                )}
              </div>

              <div>
                <p className="text-sm font-semibold text-white">{brand.name}</p>
                <p className="text-xs text-slate-500">{brand.country}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
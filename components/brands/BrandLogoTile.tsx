import Image from 'next/image';
import Link from 'next/link';

type BrandLogoTileProps = {
  brand: {
    name: string;
    slug: string;
    logo?: string | null;
  };
};

/**
 * Give every manufacturer the same readable logo area and a text label.
 * Many original brand marks use dark colors, so they must not be dimmed
 * or displayed directly against the site's navy background.
 */
export default function BrandLogoTile({ brand }: BrandLogoTileProps) {
  return (
    <Link
      href={`/brands/${brand.slug}`}
      aria-label={`Browse ${brand.name} industrial automation parts`}
      className="group flex h-36 min-w-0 flex-col items-center justify-between gap-2 rounded-2xl border border-white/15 bg-navy-800 p-2.5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-gold-300/50 hover:bg-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 sm:h-40 sm:p-3"
    >
      <div className="flex h-[76px] w-full shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
        {brand.logo ? (
          <Image
            src={brand.logo}
            alt={`${brand.name} logo`}
            width={210}
            height={90}
            className="h-full max-h-[60px] w-full max-w-[180px] object-contain transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="text-center text-sm font-extrabold text-navy-900">
            {brand.name}
          </span>
        )}
      </div>

      <span className="flex min-h-8 max-w-full items-center justify-center break-words text-center text-[11px] font-extrabold leading-4 tracking-tight text-white sm:text-xs">
        {brand.name}
      </span>
    </Link>
  );
}

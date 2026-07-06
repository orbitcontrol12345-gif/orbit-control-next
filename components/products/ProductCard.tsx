import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle, XCircle, ExternalLink, FileText } from 'lucide-react';
import type { Product } from '@/lib/types';

interface ProductCardProps {
  product: Product;
}

function ConditionBadge({ condition }: { condition: Product['condition'] }) {
  const text = String(condition || '');

  const label =
    text.toLowerCase().includes('open box') ||
    text.toLowerCase().includes('without box')
      ? 'New'
      : text;

  return <span className="badge-condition-used">{label}</span>;
}

export default function ProductCard({ product }: ProductCardProps) {
  const productUrl = `/products/${product.slug}`;

  return (
    <div className="group relative z-0 flex flex-col overflow-hidden rounded-lg border border-navy-700 bg-navy-800 transition-all duration-300 hover:border-gold-500/50 hover:shadow-lg hover:shadow-black/30">
      <Link
        href={productUrl}
        aria-label={`View details for ${product.name}`}
        className="relative z-0 block h-44 overflow-hidden bg-white"
      >
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          className="z-0 object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          unoptimized
        />

        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/20 to-transparent" />

        <div className="absolute left-2 top-2 z-20">
          <ConditionBadge condition={product.condition} />
        </div>
      </Link>

      <div className="relative z-10 flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="truncate text-xs font-semibold uppercase tracking-wide text-gold-500">
            {product.brand}
          </span>
        </div>

        <p className="mb-1 text-xs font-mono text-slate-400">
          PN:{' '}
          <span className="font-semibold text-slate-300">
            {product.partNumber}
          </span>
        </p>

        <Link href={productUrl} className="mb-3 block flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-100 transition-colors group-hover:text-gold-400">
            {product.name}
          </h3>
        </Link>

        <div className="mb-4 flex items-center gap-1.5">
          {product.inStock ? (
            <>
              <CheckCircle size={13} className="text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">
                In Stock
              </span>
            </>
          ) : (
            <>
              <XCircle size={13} className="text-slate-500" />
              <span className="text-xs text-slate-500">
                Check Availability
              </span>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link
            href={productUrl}
            className="flex items-center justify-center gap-1.5 rounded border border-navy-600 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
          >
            <ExternalLink size={12} />
            Details
          </Link>

          <Link
            href={`/rfq?part=${encodeURIComponent(product.partNumber)}`}
            className="flex items-center justify-center gap-1.5 rounded bg-gold-500 px-3 py-2 text-xs font-semibold text-navy-900 transition-colors hover:bg-gold-400"
          >
            <FileText size={12} />
            Get Quote
          </Link>
        </div>
      </div>
    </div>
  );
}

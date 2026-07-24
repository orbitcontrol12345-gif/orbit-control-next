'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle,
  XCircle,
  ExternalLink,
  FileText,
} from 'lucide-react';

import type { Product } from '@/lib/types';

interface ProductCardProps {
  product: Product;
}

const FALLBACK_IMAGE = '/placeholder-product.jpg';

function ConditionBadge({
  condition,
}: {
  condition: Product['condition'];
}) {
  const text = String(condition || '');

  const label =
    text.toLowerCase().includes('open box') ||
    text.toLowerCase().includes('without box')
      ? 'New'
      : text;

  return (
    <span className="badge-condition-used">
      {label}
    </span>
  );
}

function cleanImageUrl(value: unknown): string {
  return String(value || '').trim();
}

export default function ProductCard({
  product,
}: ProductCardProps) {
  const productUrl = `/products/${product.slug}`;

  const imageCandidates = useMemo(() => {
    const candidates = [
      product.r2ImageUrl,
      ...(Array.isArray(product.r2GalleryUrls)
        ? product.r2GalleryUrls
        : []),
      product.imageUrl,
      ...(Array.isArray(product.ebayGalleryUrls)
        ? product.ebayGalleryUrls
        : []),
    ]
      .map(cleanImageUrl)
      .filter(
        (url) =>
          url.length > 0 &&
          /^https?:\/\//i.test(url)
      );

    return Array.from(new Set(candidates));
  }, [
    product.r2ImageUrl,
    product.r2GalleryUrls,
    product.imageUrl,
    product.ebayGalleryUrls,
  ]);

  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    setImageIndex(0);
  }, [imageCandidates]);

  const imageSrc =
    imageCandidates[imageIndex] || FALLBACK_IMAGE;

  function handleImageError() {
    setImageIndex((currentIndex) => {
      const nextIndex = currentIndex + 1;

      if (nextIndex < imageCandidates.length) {
        return nextIndex;
      }

      return imageCandidates.length;
    });
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border border-navy-700 bg-navy-800 transition-all duration-300 hover:border-gold-500/50 hover:shadow-lg hover:shadow-black/30">
      <Link
        href={productUrl}
        aria-label={`View details for ${product.name}`}
        className="relative block h-44 overflow-hidden bg-white"
      >
        <Image
          src={imageSrc}
          alt={product.name}
          fill
          unoptimized
          onError={handleImageError}
          sizes="(max-width:768px) 50vw, (max-width:1200px) 25vw, 300px"
          className="object-contain transition-transform duration-500 group-hover:scale-105"
        />

        <div className="absolute left-2 top-2">
          <ConditionBadge
            condition={product.condition}
          />
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
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

        <Link
          href={productUrl}
          className="mb-3 block flex-1"
        >
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-slate-100 transition-colors group-hover:text-gold-400">
            {product.name}
          </h3>
        </Link>

        <div className="mb-4 flex items-center gap-1.5">
          {product.inStock ? (
            <>
              <CheckCircle
                size={13}
                className="text-emerald-400"
              />
              <span className="text-xs font-medium text-emerald-400">
                In Stock
              </span>
            </>
          ) : (
            <>
              <XCircle
                size={13}
                className="text-slate-500"
              />
              <span className="text-xs text-slate-500">
                Check Availability
              </span>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link
            href={productUrl}
            className="flex items-center justify-center gap-1.5 rounded border border-navy-600 px-3 py-2 text-xs font-medium text-slate-300 hover:border-slate-500 hover:text-white"
          >
            <ExternalLink size={12} />
            Details
          </Link>

          <Link
            href={`/rfq?part=${encodeURIComponent(
              product.partNumber
            )}`}
            className="flex items-center justify-center gap-1.5 rounded bg-gold-500 px-3 py-2 text-xs font-semibold text-navy-900 hover:bg-gold-400"
          >
            <FileText size={12} />
            Get Quote
          </Link>
        </div>
      </div>
    </div>
  );
}

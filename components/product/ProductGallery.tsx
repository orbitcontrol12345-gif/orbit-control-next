'use client';

import Image from 'next/image';
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type ProductGalleryProps = {
  r2GalleryUrls?: string[] | null;
  ebayGalleryUrls?: string[] | null;
  mainImageUrl?: string | null;
  fallbackImageUrl?: string;
  alt?: string;
};

function cleanImages(images: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      images
        .filter(Boolean)
        .map((url) => String(url).trim())
        .filter((url) => url.startsWith('http') || url.startsWith('/'))
    )
  );
}

export default function ProductGallery({
  r2GalleryUrls,
  ebayGalleryUrls,
  mainImageUrl,
  fallbackImageUrl = '/placeholder-product.jpg',
  alt = 'Product image',
}: ProductGalleryProps) {
  const images = useMemo(() => {
    const gallery = cleanImages([
      ...(r2GalleryUrls ?? []),
      ...(ebayGalleryUrls ?? []),
      mainImageUrl,
    ]);

    return gallery.length > 0 ? gallery : [fallbackImageUrl];
  }, [r2GalleryUrls, ebayGalleryUrls, mainImageUrl, fallbackImageUrl]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);

  const activeImage = images[activeIndex] || images[0];

  const goNext = () => {
    setActiveIndex((current) => (current + 1) % images.length);
  };

  const goPrev = () => {
    setActiveIndex((current) =>
      current === 0 ? images.length - 1 : current - 1
    );
  };

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, images.length]);

  return (
    <>
      <div className="w-full">
        <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-white p-3 shadow-2xl shadow-black/30">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="group relative block h-[360px] w-full overflow-hidden rounded-2xl bg-white sm:h-[470px]"
            aria-label="Open product image gallery"
          >
            <Image
              src={activeImage}
              alt={alt}
              fill
              className="object-contain p-3 transition duration-300 group-hover:scale-[1.03]"
              sizes="(max-width: 1024px) 100vw, 45vw"
              priority
              unoptimized
            />

            <span className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-900 shadow-lg transition hover:scale-105">
              <Maximize2 size={19} />
            </span>
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="absolute left-5 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-lg transition hover:scale-105 md:flex"
                aria-label="Previous image"
              >
                <ChevronLeft size={24} />
              </button>

              <button
                type="button"
                onClick={goNext}
                className="absolute right-5 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-lg transition hover:scale-105 md:flex"
                aria-label="Next image"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}
        </div>

        {images.length > 1 && (
          <div className="mt-4 flex items-center gap-3 overflow-x-auto rounded-2xl border border-navy-700 bg-navy-800/80 p-3 pb-3">
            {images.map((image, index) => {
              const isActive = index === activeIndex;

              return (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`relative h-20 w-24 shrink-0 overflow-hidden rounded-xl border bg-white transition ${
                    isActive
                      ? 'border-gold-500 ring-2 ring-gold-500/50'
                      : 'border-white/20 opacity-80 hover:opacity-100'
                  }`}
                  aria-label={`View product image ${index + 1}`}
                >
                  <Image
                    src={image}
                    alt={`${alt} ${index + 1}`}
                    fill
                    className="object-contain p-1"
                    sizes="96px"
                    unoptimized
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="fixed right-5 top-5 z-[100000] flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-xl transition hover:bg-red-700"
            aria-label="Close image preview"
          >
            <X size={28} />
          </button>

          {images.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              className="fixed left-5 top-1/2 z-[100000] flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white shadow-xl transition hover:bg-white/25"
              aria-label="Previous image"
            >
              <ChevronLeft size={30} />
            </button>
          )}

          <div
            className="relative h-[78vh] w-[82vw] max-w-6xl rounded-2xl bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={activeImage}
              alt={alt}
              fill
              className="object-contain p-6"
              sizes="82vw"
              unoptimized
            />
          </div>

          {images.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              className="fixed right-5 top-1/2 z-[100000] flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white shadow-xl transition hover:bg-white/25"
              aria-label="Next image"
            >
              <ChevronRight size={30} />
            </button>
          )}
        </div>
      )}
    </>
  );
}

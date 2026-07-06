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
console.log('Gallery Images:', gallery);
    return gallery.length > 0 ? gallery : [fallbackImageUrl];
  }, [r2GalleryUrls, ebayGalleryUrls, mainImageUrl, fallbackImageUrl]);

  const imagesKey = images.join('|');
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setActiveIndex(0);
  }, [imagesKey]);

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
          <div className="mt-4 flex items-center gap-3 overflow-x-auto rounded-2xl border border-navy-700 bg-navy-800/80 p-3">
            {images.map((image, index) => {
              const isActive = index === activeIndex;

              return (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`h-20 w-24 shrink-0 overflow-hidden rounded-xl border bg-white transition ${
                    isActive
                      ? 'border-gold-500 ring-2 ring-gold-500/50'
                      : 'border-white/20 opacity-80 hover:opacity-100'
                  }`}
                  aria-label={`View product image ${index + 1}`}
                >
                  <img
                    src={image}
                    alt={`${alt} ${index + 1}`}
                    className="h-full w-full object-contain p-1"
                    loading="eager"
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
          <div
            className="relative flex h-[88vh] w-[90vw] max-w-7xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-white shadow-xl transition hover:bg-red-700"
              aria-label="Close image preview"
            >
              <X size={26} />
            </button>

            <div className="relative min-h-0 flex-1 bg-white p-5">
              {images.length > 1 && (
                <button
                  type="button"
                  onClick={goPrev}
                  className="absolute left-5 top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white shadow-xl backdrop-blur transition hover:bg-black/80"
                  aria-label="Previous image"
                >
                  <ChevronLeft size={30} />
                </button>
              )}

              <Image
                src={activeImage}
                alt={alt}
                fill
                className="object-contain p-10"
                sizes="90vw"
                unoptimized
              />

              {images.length > 1 && (
                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-5 top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white shadow-xl backdrop-blur transition hover:bg-black/80"
                  aria-label="Next image"
                >
                  <ChevronRight size={30} />
                </button>
              )}
            </div>

            {images.length > 1 && (
              <div className="h-28 shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-3">
                <div className="flex h-full items-center justify-center gap-3 overflow-x-auto">
                  {images.map((image, index) => {
                    const isActive = index === activeIndex;

                    return (
                      <button
                        key={`lightbox-${image}-${index}`}
                        type="button"
                        onClick={() => setActiveIndex(index)}
                        className={`h-20 w-24 shrink-0 overflow-hidden rounded-xl border bg-white transition ${
                          isActive
                            ? 'border-gold-500 ring-2 ring-gold-500/50'
                            : 'border-slate-300 hover:border-slate-500'
                        }`}
                        aria-label={`View product image ${index + 1}`}
                      >
                        <img
                          src={image}
                          alt={`${alt} ${index + 1}`}
                          className="h-full w-full object-contain p-1"
                          loading="eager"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

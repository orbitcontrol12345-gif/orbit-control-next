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
    const list = cleanImages([
      ...(r2GalleryUrls ?? []),
      ...(ebayGalleryUrls ?? []),
      mainImageUrl,
    ]);

    return list.length > 0 ? list : [fallbackImageUrl];
  }, [r2GalleryUrls, ebayGalleryUrls, mainImageUrl, fallbackImageUrl]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const activeImage = images[activeIndex] || images[0];

  function goPrev() {
    setActiveIndex((current) =>
      current === 0 ? images.length - 1 : current - 1
    );
  }

  function goNext() {
    setActiveIndex((current) => (current + 1) % images.length);
  }

  useEffect(() => {
    setActiveIndex(0);
  }, [images.join('|')]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
      if (event.key === 'ArrowLeft') goPrev();
      if (event.key === 'ArrowRight') goNext();
    }

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, images.length]);

  return (
    <>
      <div className="w-full">
        <div className="rounded-3xl border border-white/10 bg-white p-3 shadow-2xl shadow-black/30">
          <div className="relative h-[380px] overflow-hidden rounded-2xl bg-white sm:h-[470px]">
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="relative block h-full w-full"
              aria-label="Open product image"
            >
              <Image
                src={activeImage}
                alt={alt}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-contain p-4"
                unoptimized
              />
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-900 shadow-lg hover:bg-slate-100"
              aria-label="Enlarge image"
            >
              <Maximize2 size={19} />
            </button>

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  className="absolute left-4 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-lg hover:bg-white"
                  aria-label="Previous image"
                >
                  <ChevronLeft size={24} />
                </button>

                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-4 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-lg hover:bg-white"
                  aria-label="Next image"
                >
                  <ChevronRight size={24} />
                </button>
              </>
            )}
          </div>
        </div>

        {images.length > 1 && (
          <div className="mt-4 rounded-2xl border border-navy-700 bg-navy-800/80 p-3">
            <div className="flex gap-3 overflow-x-auto pb-1">
              {images.map((image, index) => {
                const active = index === activeIndex;

                return (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className={`relative h-20 w-24 shrink-0 overflow-hidden rounded-xl border bg-white transition ${
                      active
                        ? 'border-gold-500 ring-2 ring-gold-500/50'
                        : 'border-white/30 opacity-80 hover:opacity-100'
                    }`}
                    aria-label={`View image ${index + 1}`}
                  >
                    <Image
                      src={image}
                      alt={`${alt} ${index + 1}`}
                      fill
                      sizes="96px"
                      className="object-contain p-1"
                      unoptimized
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/95 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="relative flex h-[88vh] w-[92vw] max-w-7xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute right-4 top-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-white shadow-lg hover:bg-red-700"
              aria-label="Close image"
            >
              <X size={26} />
            </button>

            <div className="relative min-h-0 flex-1 bg-white">
              <Image
                src={activeImage}
                alt={alt}
                fill
                sizes="92vw"
                className="object-contain p-8"
                unoptimized
              />

              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goPrev}
                    className="absolute left-5 top-1/2 z-40 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white shadow-xl hover:bg-black/80"
                    aria-label="Previous image"
                  >
                    <ChevronLeft size={30} />
                  </button>

                  <button
                    type="button"
                    onClick={goNext}
                    className="absolute right-5 top-1/2 z-40 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white shadow-xl hover:bg-black/80"
                    aria-label="Next image"
                  >
                    <ChevronRight size={30} />
                  </button>
                </>
              )}
            </div>

            {images.length > 1 && (
              <div className="h-28 shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-3">
                <div className="flex h-full items-center justify-center gap-3 overflow-x-auto">
                  {images.map((image, index) => {
                    const active = index === activeIndex;

                    return (
                      <button
                        key={`modal-${image}-${index}`}
                        type="button"
                        onClick={() => setActiveIndex(index)}
                        className={`relative h-20 w-24 shrink-0 overflow-hidden rounded-xl border bg-white transition ${
                          active
                            ? 'border-gold-500 ring-2 ring-gold-500/50'
                            : 'border-slate-300 hover:border-slate-500'
                        }`}
                        aria-label={`View image ${index + 1}`}
                      >
                        <Image
                          src={image}
                          alt={`${alt} ${index + 1}`}
                          fill
                          sizes="96px"
                          className="object-contain p-1"
                          unoptimized
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

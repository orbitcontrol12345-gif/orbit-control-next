'use client';

import Image from 'next/image';
import { createPortal } from 'react-dom';
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
  const [mounted, setMounted] = useState(false);

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
    setMounted(true);
  }, []);

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

  const lightbox =
    isOpen && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/95 p-3"
            onClick={() => setIsOpen(false)}
          >
            <div
              className="relative flex h-[86vh] w-[94vw] max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="absolute right-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white shadow-lg hover:bg-red-700"
                aria-label="Close image"
              >
                <X size={24} />
              </button>

              <div className="relative min-h-0 flex-1 bg-white">
                <Image
                  src={activeImage}
                  alt={alt}
                  fill
                  sizes="94vw"
                  className="object-contain p-3 sm:p-6"
                  unoptimized
                />

                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={goPrev}
                      className="absolute left-3 top-1/2 z-40 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white shadow-xl hover:bg-black/80"
                    >
                      <ChevronLeft size={26} />
                    </button>

                    <button
                      type="button"
                      onClick={goNext}
                      className="absolute right-3 top-1/2 z-40 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white shadow-xl hover:bg-black/80"
                    >
                      <ChevronRight size={26} />
                    </button>
                  </>
                )}
              </div>

              {images.length > 1 && (
                <div className="h-20 shrink-0 border-t border-slate-200 bg-slate-50 px-3 py-2 sm:h-24">
                  <div className="flex h-full gap-2 overflow-x-auto">
                    {images.map((image, index) => {
                      const active = index === activeIndex;

                      return (
                        <button
                          key={`modal-${image}-${index}`}
                          type="button"
                          onClick={() => setActiveIndex(index)}
                          className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-white transition sm:h-20 sm:w-20 ${
                            active
                              ? 'border-gold-500 ring-2 ring-gold-500/50'
                              : 'border-slate-300'
                          }`}
                        >
                          <Image
                            src={image}
                            alt={`${alt} ${index + 1}`}
                            fill
                            sizes="80px"
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
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className="w-full">
        <div className="mx-auto w-full max-w-[430px] rounded-2xl border border-white/10 bg-white p-2 shadow-xl shadow-black/25 sm:rounded-3xl">
          <div className="relative h-[250px] w-full overflow-hidden rounded-xl bg-white sm:h-[300px] lg:h-[340px]">
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
                className="object-contain p-2 sm:p-3"
                unoptimized
              />
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-900 shadow-lg hover:bg-slate-100"
              aria-label="Enlarge image"
            >
              <Maximize2 size={18} />
            </button>

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  className="absolute left-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-lg hover:bg-white"
                >
                  <ChevronLeft size={23} />
                </button>

                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-lg hover:bg-white"
                >
                  <ChevronRight size={23} />
                </button>
              </>
            )}
          </div>
        </div>

        {images.length > 1 && (
          <div className="mx-auto mt-3 w-full max-w-[430px] rounded-xl border border-navy-700 bg-navy-800/80 p-2 sm:rounded-2xl">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((image, index) => {
                const active = index === activeIndex;

                return (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-white transition sm:h-16 sm:w-20 ${
                      active
                        ? 'border-gold-500 ring-2 ring-gold-500/50'
                        : 'border-white/30 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <Image
                      src={image}
                      alt={`${alt} ${index + 1}`}
                      fill
                      sizes="80px"
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

      {lightbox}
    </>
  );
}

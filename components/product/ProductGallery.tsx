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

         <div
  className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/95 p-2"
  onClick={() => setIsOpen(false)}
>
  <div
    className="relative inline-flex flex-col items-center"
    onClick={(e) => e.stopPropagation()}
  >
    <button
      type="button"
      onClick={() => setIsOpen(false)}
      className="absolute -top-2 -right-2 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-white shadow-xl"
    >
      <X size={24} />
    </button>

    <div className="relative">
      <Image
        src={activeImage}
        alt={alt}
        width={1400}
        height={1400}
        className="max-h-[82vh] w-auto max-w-[95vw] rounded-xl object-contain"
        unoptimized
      />

      {images.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white"
          >
            <ChevronLeft size={28} />
          </button>

          <button
            onClick={goNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white"
          >
            <ChevronRight size={28} />
          </button>
        </>
      )}
    </div>

    {images.length > 1 && (
      <div className="mt-4 flex max-w-[95vw] gap-2 overflow-x-auto">
        {images.map((image, index) => (
          <button
            key={index}
            onClick={() => setActiveIndex(index)}
            className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border ${
              index === activeIndex
                ? 'border-gold-500 ring-2 ring-gold-500/50'
                : 'border-white/20'
            }`}
          >
            <Image
              src={image}
              alt=""
              fill
              className="object-contain"
              unoptimized
            />
          </button>
        ))}
      </div>
    )}
  </div>
</div>

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

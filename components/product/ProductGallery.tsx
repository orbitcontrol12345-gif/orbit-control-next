'use client';

import Image from 'next/image';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
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

  function goNext() {
    setActiveIndex((current) => (current + 1) % images.length);
  }

  function goPrev() {
    setActiveIndex((current) =>
      current === 0 ? images.length - 1 : current - 1
    );
  }

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, images.length]);

  return (
    <>
      <div className="w-full">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative h-[360px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:h-[460px]"
        >
          <Image
            src={activeImage}
            alt={alt}
            fill
            className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 1024px) 100vw, 40vw"
            priority
            unoptimized
          />

          <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">
            Click to enlarge
          </span>
        </button>

        {images.length > 1 && (
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
            {images.map((image, index) => {
              const isActive = index === activeIndex;

              return (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border bg-white transition ${
                    isActive
                      ? 'border-[#C9A227] ring-2 ring-[#C9A227]/40'
                      : 'border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <Image
                    src={image}
                    alt={`${alt} ${index + 1}`}
                    fill
                    className="object-contain p-1"
                    sizes="80px"
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
    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4"
    onClick={() => setOpen(false)}
  >
    <button
  type="button"
  onClick={() => setOpen(false)}
  className="fixed right-6 top-24 z-[10000] flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-white shadow-xl hover:bg-red-700"
  aria-label="Close image preview"
>
  <X size={28} />
</button>

   <button
  type="button"
  onClick={() => setOpen(false)}
  className="fixed left-6 top-24 z-[10000] rounded-full bg-white px-5 py-3 text-sm font-bold text-black shadow-xl hover:bg-slate-200"
>
  Back to product
</button>

    {images.length > 1 && (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          goPrev();
        }}
        className="absolute left-5 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
      >
        <ChevronLeft size={30} />
      </button>
    )}

    <div
      className="relative h-[85vh] w-[90vw]"
      onClick={(e) => e.stopPropagation()}
    >
      <Image
        src={activeImage}
        alt={alt}
        fill
        className="object-contain"
        sizes="90vw"
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
        className="absolute right-5 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
      >
        <ChevronRight size={30} />
      </button>
    )}
  </div>
)}
    </>
  );
}

'use client';

import Image from 'next/image';
import { createPortal } from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

type ProductGalleryProps = {
  r2GalleryUrls?: string[] | null;
  ebayGalleryUrls?: string[] | null;
  mainImageUrl?: string | null;
  fallbackImageUrl?: string;
  alt?: string;
};

function cleanImages(
  images: Array<string | null | undefined>
) {
  return Array.from(
    new Set(
      images
        .filter(Boolean)
        .map((url) => String(url).trim())
        .filter(
          (url) =>
            url.startsWith('http') ||
            url.startsWith('/')
        )
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
    const r2Images = cleanImages(
      r2GalleryUrls ?? []
    );

    if (r2Images.length > 0) {
      return r2Images;
    }

    const ebayImages = cleanImages(
      ebayGalleryUrls ?? []
    );

    if (ebayImages.length > 0) {
      return ebayImages;
    }

    const fallbackImages = cleanImages([
      mainImageUrl,
      fallbackImageUrl,
    ]);

    return fallbackImages.length > 0
      ? fallbackImages
      : ['/placeholder-product.jpg'];
  }, [
    r2GalleryUrls,
    ebayGalleryUrls,
    mainImageUrl,
    fallbackImageUrl,
  ]);

  console.log(
    'PRODUCT GALLERY IMAGES:',
    JSON.stringify(images, null, 2)
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const activeImage =
    images[activeIndex] || images[0];

  function goPrev() {
    setActiveIndex((current) =>
      current === 0
        ? images.length - 1
        : current - 1
    );
  }

  function goNext() {
    setActiveIndex(
      (current) => (current + 1) % images.length
    );
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
      if (event.key === 'Escape') {
        setIsOpen(false);
      }

      if (event.key === 'ArrowLeft') {
        goPrev();
      }

      if (event.key === 'ArrowRight') {
        goNext();
      }
    }

    document.body.style.overflow = 'hidden';

    window.addEventListener(
      'keydown',
      handleKeyDown
    );

    return () => {
      document.body.style.overflow = '';

      window.removeEventListener(
        'keydown',
        handleKeyDown
      );
    };
  }, [isOpen, images.length]);

  const lightbox =
    isOpen && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/95 p-3"
            onClick={() => setIsOpen(false)}
          >
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="fixed right-4 top-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-white shadow-xl hover:bg-red-700"
              aria-label="Close image"
            >
              <X size={26} />
            </button>

            <div
              className="relative flex max-h-[94vh] max-w-[98vw] flex-col items-center justify-center"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <div className="relative h-[82vh] w-[94vw] max-w-[1500px] overflow-hidden rounded-xl">
  <Image
    src={activeImage}
    alt={alt}
    fill
    sizes="94vw"
    className="object-contain"
    unoptimized
  />

                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={goPrev}
                      className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white shadow-xl hover:bg-black/80 sm:-left-16"
                      aria-label="Previous image"
                    >
                      <ChevronLeft size={28} />
                    </button>

                    <button
                      type="button"
                      onClick={goNext}
                      className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white shadow-xl hover:bg-black/80 sm:-right-16"
                      aria-label="Next image"
                    >
                      <ChevronRight size={28} />
                    </button>
                  </>
                )}
              </div>

              {images.length > 1 && (
                <div className="mt-4 flex max-w-[94vw] gap-2 overflow-x-auto rounded-xl bg-black/50 p-2">
                  {images.map((image, index) => {
                    const active =
                      index === activeIndex;

                    return (
                      <button
                        key={`modal-${image}-${index}`}
                        type="button"
                        onClick={() =>
                          setActiveIndex(index)
                        }
                        className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-white transition sm:h-20 sm:w-20 ${
                          active
                            ? 'border-gold-500 ring-2 ring-gold-500/60'
                            : 'border-white/30 opacity-80 hover:opacity-100'
                        }`}
                        aria-label={`View image ${
                          index + 1
                        }`}
                      >
                        <Image
                          src={image}
                          alt={`${alt} ${index + 1}`}
                          fill
                          sizes="80px"
                          className="object-cover"
                          unoptimized
                        />
                      </button>
                    );
                  })}
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
        <div className="mx-auto w-full max-w-[520px] overflow-hidden rounded-2xl border border-white/10 bg-white shadow-xl shadow-black/25 sm:rounded-3xl">
          <div className="relative h-[300px] w-full overflow-hidden bg-white sm:h-[380px] lg:h-[430px]">
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
                sizes="(max-width: 1024px) 100vw, 520px"
                className="object-cover"
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
                  aria-label="Previous image"
                >
                  <ChevronLeft size={23} />
                </button>

                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-900 shadow-lg hover:bg-white"
                  aria-label="Next image"
                >
                  <ChevronRight size={23} />
                </button>
              </>
            )}
          </div>
        </div>

        {images.length > 1 && (
          <div className="mx-auto mt-3 w-full max-w-[520px] rounded-xl border border-navy-700 bg-navy-800/80 p-2 sm:rounded-2xl">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((image, index) => {
                const active =
                  index === activeIndex;

                return (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() =>
                      setActiveIndex(index)
                    }
                    className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-white transition sm:h-20 sm:w-24 ${
                      active
                        ? 'border-gold-500 ring-2 ring-gold-500/50'
                        : 'border-white/30 opacity-80 hover:opacity-100'
                    }`}
                    aria-label={`View image ${
                      index + 1
                    }`}
                  >
                    <Image
                      src={image}
                      alt={`${alt} ${index + 1}`}
                      fill
                      sizes="96px"
                      className="object-cover"
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

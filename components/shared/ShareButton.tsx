'use client';

import Image from 'next/image';
import { Check, Copy, Loader2, Mail, Share2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type ShareButtonProps = {
  title: string;
  text: string;
  url: string;
  label: string;
  mode?: 'website' | 'product';
  imageUrl?: string;
  imageName?: string;
  className?: string;
};

function getImageExtension(mimeType: string): string {
  const extensions: Record<string, string> = {
    'image/avif': 'avif',
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };

  return extensions[mimeType.toLowerCase()] || 'jpg';
}

function cleanFileName(value: string): string {
  const cleaned = value
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return cleaned || 'orbit-product';
}

function getOptimizedImageUrl(imageUrl: string): string {
  if (imageUrl.startsWith('/')) {
    return imageUrl;
  }

  return `/_next/image?url=${encodeURIComponent(imageUrl)}&w=1080&q=75`;
}

export default function ShareButton({
  title,
  text,
  url,
  label,
  mode = 'website',
  imageUrl,
  imageName = title,
  className = '',
}: ShareButtonProps) {
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageStatus, setImageStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >(imageUrl ? 'loading' : 'idle');
  const containerRef = useRef<HTMLDivElement>(null);
  const isProductShare = mode === 'product';

  useEffect(() => {
    setImageFile(null);
    setImageStatus(imageUrl ? 'loading' : 'idle');

    if (!imageUrl) return;

    const controller = new AbortController();

    async function prepareImage() {
      try {
        const response = await fetch(getOptimizedImageUrl(imageUrl as string), {
          cache: 'force-cache',
          signal: controller.signal,
        });

        if (!response.ok) {
          setImageStatus('error');
          return;
        }

        const blob = await response.blob();
        if (!blob.type.startsWith('image/')) {
          setImageStatus('error');
          return;
        }

        const extension = getImageExtension(blob.type);
        const file = new File(
          [blob],
          `${cleanFileName(imageName)}.${extension}`,
          { type: blob.type },
        );

        if (!controller.signal.aborted) {
          setImageFile(file);
          setImageStatus('ready');
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setImageFile(null);
          setImageStatus('error');
        }
      }
    }

    void prepareImage();

    return () => controller.abort();
  }, [imageName, imageUrl]);

  useEffect(() => {
    if (!fallbackOpen) return;

    const previousOverflow = document.body.style.overflow;

    if (isProductShare) {
      document.body.style.overflow = 'hidden';
    }

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setFallbackOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFallbackOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [fallbackOpen, isProductShare]);

  const shareNative = async () => {
    if (typeof navigator.share === 'function') {
      try {
        const message = `${text}\n\nView this exact product:\n${url}`;
        const shareData: ShareData = {
          title,
          text: message,
        };

        if (
          imageFile &&
          typeof navigator.canShare === 'function' &&
          navigator.canShare({ files: [imageFile] })
        ) {
          shareData.files = [imageFile];
        }

        await navigator.share(shareData);
        setFallbackOpen(false);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
      }
    }

    setFallbackOpen(true);
  };

  const share = () => {
    if (isProductShare) {
      setFallbackOpen(true);
      return;
    }

    void shareNative();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const message = `${text}\n\n${url}`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={share}
        className={className}
        aria-label={label}
        aria-haspopup={isProductShare ? 'dialog' : 'menu'}
        aria-expanded={fallbackOpen}
        data-share-mode={isProductShare ? 'product' : 'website'}
        data-share-url={url}
      >
        <Share2 size={17} />
        {label}
      </button>

      {fallbackOpen && isProductShare && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm sm:items-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setFallbackOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Share this product"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-gold-500/30 bg-navy-800 shadow-2xl shadow-black/70"
          >
            <div className="flex items-center justify-between border-b border-navy-600 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-white">Share this product</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  The photo and exact product link will be sent.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setFallbackOpen(false)}
                aria-label="Close share options"
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X size={19} />
              </button>
            </div>

            <div className="p-4">
              <div className="flex gap-3 rounded-xl border border-navy-600 bg-navy-900/70 p-3">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-white">
                  <Image
                    src={imageUrl || '/placeholder-product.jpg'}
                    alt={title}
                    fill
                    sizes="96px"
                    unoptimized
                    className="object-contain"
                  />
                </div>

                <div className="min-w-0 flex-1 py-1">
                  <p className="line-clamp-3 text-sm font-bold leading-5 text-white">
                    {title}
                  </p>
                  <p className="mt-2 break-all text-[11px] leading-4 text-cyan-300">
                    {url}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => void shareNative()}
                  disabled={imageStatus === 'loading'}
                  data-share-url={url}
                  data-share-image-ready={imageStatus === 'ready'}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold-500 px-4 py-3.5 text-sm font-black text-navy-950 transition hover:bg-gold-400 disabled:cursor-wait disabled:opacity-70"
                >
                  {imageStatus === 'loading' ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Share2 size={18} />
                  )}
                  {imageStatus === 'loading'
                    ? 'Preparing product photo…'
                    : imageStatus === 'ready'
                      ? 'Share photo + product link'
                      : 'Share exact product link'}
                </button>

                <p className="px-2 text-center text-xs leading-5 text-slate-400">
                  Choose WhatsApp, email, Bluetooth or any other app from your device.
                </p>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a
                    href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(message)}`}
                    className="flex items-center justify-center gap-2 rounded-xl border border-navy-600 px-3 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-400/50 hover:bg-white/5 hover:text-white"
                  >
                    <Mail size={17} className="text-cyan-300" />
                    Email link
                  </a>

                  <button
                    type="button"
                    onClick={copyLink}
                    className="flex items-center justify-center gap-2 rounded-xl border border-navy-600 px-3 py-3 text-sm font-semibold text-slate-200 transition hover:border-gold-400/50 hover:bg-white/5 hover:text-white"
                  >
                    {copied ? (
                      <Check size={17} className="text-emerald-400" />
                    ) : (
                      <Copy size={17} className="text-amber-300" />
                    )}
                    {copied ? 'Link copied' : 'Copy product link'}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {fallbackOpen && !isProductShare && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[70] mt-2 w-64 overflow-hidden rounded-xl border border-navy-600 bg-navy-800 p-2 shadow-2xl shadow-black/60"
        >
          <a
            role="menuitem"
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5 hover:text-white"
          >
            <Share2 size={17} className="text-emerald-400" />
            WhatsApp
          </a>

          <a
            role="menuitem"
            href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(message)}`}
            className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5 hover:text-white"
          >
            <Mail size={17} className="text-cyan-300" />
            Email
          </a>

          <button
            type="button"
            role="menuitem"
            onClick={copyLink}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/5 hover:text-white"
          >
            {copied ? (
              <Check size={17} className="text-emerald-400" />
            ) : (
              <Copy size={17} className="text-amber-300" />
            )}
            {copied ? 'Link copied' : 'Copy link'}
          </button>
        </div>
      )}
    </div>
  );
}

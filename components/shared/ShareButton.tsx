'use client';

import { Check, Copy, Mail, Share2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type ShareButtonProps = {
  title: string;
  text: string;
  url: string;
  label: string;
  className?: string;
};

export default function ShareButton({
  title,
  text,
  url,
  label,
  className = '',
}: ShareButtonProps) {
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!fallbackOpen) return;

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
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [fallbackOpen]);

  const share = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
      }
    }

    setFallbackOpen(true);
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

  const message = `${text}\n${url}`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={share}
        className={className}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={fallbackOpen}
      >
        <Share2 size={17} />
        {label}
      </button>

      {fallbackOpen && (
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

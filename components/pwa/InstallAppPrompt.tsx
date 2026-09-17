'use client';

import Image from 'next/image';
import { Download, Share2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}

const DISMISS_STORAGE_KEY = 'orbit-install-prompt-dismissed-at:v1';
const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000;

function wasRecentlyDismissed() {
  try {
    const dismissedAt = Number(
      window.localStorage.getItem(DISMISS_STORAGE_KEY)
    );

    return Number.isFinite(dismissedAt)
      && Date.now() - dismissedAt < DISMISS_FOR_MS;
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
  } catch {
    // Installation still works when storage is unavailable.
  }
}

export default function InstallAppPrompt() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const navigatorWithStandalone = window.navigator as Navigator & {
      standalone?: boolean;
    };
    const alreadyInstalled =
      window.matchMedia('(display-mode: standalone)').matches
      || navigatorWithStandalone.standalone === true;

    if (alreadyInstalled || wasRecentlyDismissed()) {
      return;
    }

    const iosDevice =
      /iPad|iPhone|iPod/.test(window.navigator.userAgent)
      || (window.navigator.platform === 'MacIntel'
        && window.navigator.maxTouchPoints > 1);
    setIsIos(iosDevice);

    let revealTimer: number | undefined;

    const reveal = () => {
      window.clearTimeout(revealTimer);
      revealTimer = window.setTimeout(() => setVisible(true), 1200);
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      reveal();
    };

    const handleInstalled = () => {
      setVisible(false);
      setInstallPrompt(null);
      try {
        window.localStorage.removeItem(DISMISS_STORAGE_KEY);
      } catch {
        // No cleanup is needed when storage is unavailable.
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    if (iosDevice) {
      reveal();
    }

    return () => {
      window.clearTimeout(revealTimer);
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const dismiss = () => {
    rememberDismissal();
    setVisible(false);
  };

  const install = async () => {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice.outcome === 'dismissed') {
      rememberDismissal();
    }

    setVisible(false);
    setInstallPrompt(null);
  };

  if (!visible || (!isIos && !installPrompt)) {
    return null;
  }

  return (
    <aside
      aria-label="Install Orbit Control"
      aria-live="polite"
      className="animate-fade-in fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-4 right-4 z-[60] mx-auto max-w-md overflow-hidden rounded-2xl border border-cyan-300/25 bg-[#0b1c2d]/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl md:bottom-6 md:left-6 md:right-auto md:mx-0"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="absolute right-2 top-2 rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-3 pr-7">
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={56}
          height={56}
          className="h-14 w-14 shrink-0 rounded-xl shadow-lg"
        />

        <div className="min-w-0">
          <p className="font-bold text-white">Install Orbit Control</p>
          <p className="mt-1 text-sm leading-5 text-slate-300">
            {isIos
              ? 'Tap Share, then “Add to Home Screen”.'
              : 'Add the site to your device for faster access.'}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          {isIos ? 'Got it' : 'Not now'}
        </button>

        {isIos ? (
          <span className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-200">
            <Share2 className="h-4 w-4" />
            Share
          </span>
        ) : (
          <button
            type="button"
            onClick={install}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-[#07111f] transition hover:bg-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1c2d]"
          >
            <Download className="h-4 w-4" />
            Install
          </button>
        )}
      </div>
    </aside>
  );
}

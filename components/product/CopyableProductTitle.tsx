"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

function copyWithSelection(text: string): boolean {
  const previousFocus = document.activeElement;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px";
  document.body.appendChild(textarea);

  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    return document.execCommand("copy");
  } finally {
    textarea.remove();
    if (previousFocus instanceof HTMLElement) {
      previousFocus.focus({ preventScroll: true });
    }
  }
}

export default function CopyableProductTitle({ title }: { title: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const feedbackId = useId();
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  async function copyTitle() {
    if (resetTimer.current) clearTimeout(resetTimer.current);

    try {
      try {
        await navigator.clipboard.writeText(title);
      } catch {
        if (!copyWithSelection(title)) throw new Error("Copy unavailable");
      }
      setStatus("copied");
    } catch {
      setStatus("error");
    }

    resetTimer.current = setTimeout(() => setStatus("idle"), 3000);
  }

  return (
    <div className="mb-3">
      <h1 className="text-4xl font-bold leading-tight text-white md:text-5xl">
        <button
          type="button"
          onClick={copyTitle}
          aria-label={`Copy full product title: ${title}`}
          aria-describedby={feedbackId}
          title="Copy full product title"
          className="block w-full cursor-copy select-all rounded-sm text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-500"
        >
          {title}
        </button>
      </h1>
      <p
        id={feedbackId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="mt-2 flex items-center gap-1.5 text-xs text-gold-400"
      >
        {status === "copied" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        {status === "copied"
          ? "Full title copied"
          : status === "error"
            ? "Could not copy. Select the title and choose Copy."
            : "Tap the title to copy it in full"}
      </p>
    </div>
  );
}

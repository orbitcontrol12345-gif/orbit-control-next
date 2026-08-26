'use client';

import { MessageCircle, Phone, Mail, X } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

export default function FloatingContact() {
  const [open, setOpen] = useState(false);

  const whatsappNumber = '971554835199'; // غيّر الرقم
  const phoneNumber = '+97167677094'; // غيّر الرقم

  return (
    <>
      {/* Desktop Floating Widget */}
      <div className="fixed bottom-6 right-6 z-50 hidden md:block">
        {open && (
          <div
            id="floating-contact-menu"
            className="mb-3 w-56 rounded-2xl border border-gray-200 bg-white p-3 shadow-2xl"
          >
            <a
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl p-3 text-gray-800 hover:bg-green-50"
            >
              <MessageCircle className="h-5 w-5 text-green-600" />
              WhatsApp
            </a>

            <Link
              href="/rfq"
              className="flex items-center gap-3 rounded-xl p-3 text-gray-800 hover:bg-yellow-50"
            >
              <Mail className="h-5 w-5 text-yellow-600" />
              Request Quote
            </Link>

            <a
              href={`tel:${phoneNumber}`}
              className="flex items-center gap-3 rounded-xl p-3 text-gray-800 hover:bg-blue-50"
            >
              <Phone className="h-5 w-5 text-blue-600" />
              Call Now
            </a>
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Close contact options' : 'Open contact options'}
          aria-expanded={open}
          aria-controls="floating-contact-menu"
          className="relative flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500 text-navy-900 shadow-2xl transition hover:bg-yellow-400"
        >
          <span
            aria-hidden="true"
            className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-20"
          />

  {open ? (
    <X className="h-7 w-7 relative z-10" />
  ) : (
    <MessageCircle className="h-8 w-8 relative z-10" />
  )}
        </button>
      </div>

      {/* Mobile Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-3 border-t border-gray-200 bg-white shadow-2xl md:hidden">
        <a
          href={`https://wa.me/${whatsappNumber}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center py-2 text-xs font-semibold text-green-700"
        >
          <MessageCircle className="mb-1 h-5 w-5" />
          WhatsApp
        </a>

        <a
          href={`tel:${phoneNumber}`}
          className="flex flex-col items-center justify-center py-2 text-xs font-semibold text-blue-600"
        >
          <Phone className="mb-1 h-5 w-5" />
          Call
        </a>

        <Link
          href="/rfq"
          className="flex flex-col items-center justify-center py-2 text-xs font-semibold text-amber-700"
        >
          <Mail className="mb-1 h-5 w-5" />
          RFQ
        </Link>
      </div>
    </>
  );
}

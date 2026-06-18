import Link from 'next/link';
import { Mail, Phone, MapPin, Globe } from 'lucide-react';
import Image from 'next/image';

const footerLinks = {
  company: [
  { label: 'About Us', href: '/about' },
  { label: 'Brands', href: '/brands' },
  { label: 'Manufacturers', href: '/manufacturers' },
  { label: 'Product Categories', href: '/categories' },
  { label: 'Sell Your Surplus', href: '/sell-surplus' },
  { label: 'Contact Us', href: '/contact' },
],
  ],
  policies: [
    { label: 'Shipping Policy', href: '/shipping-policy' },
    { label: 'Warranty & Returns', href: '/warranty-policy' },
    { label: 'Privacy Policy', href: '/privacy-policy' },
    { label: 'Legal Disclaimer', href: '/disclaimer' },
    { label: 'Request a Quote', href: '/rfq' },
  ],
  categories: [
    { label: 'PLCs', href: '/categories/plcs' },
    { label: 'HMIs', href: '/categories/hmis' },
    { label: 'Drives & VFDs', href: '/categories/drives-vfds' },
    { label: 'Sensors', href: '/categories/sensors' },
    { label: 'Circuit Breakers', href: '/categories/circuit-breakers' },
    { label: 'Obsolete Parts', href: '/categories/obsolete-parts' },
  ],


export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#050b14]">
      <div className="page-container py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link href="/" className="mb-5 flex items-center">
              <Image
                src="/logo.png"
                alt="Orbit Control Automation"
                width={360}
                height={110}
                className="h-20 w-auto object-contain"
              />
            </Link>

            <p className="mb-6 max-w-md text-sm leading-7 text-slate-400">
              Orbit Control Automation supplies industrial automation, electrical,
              obsolete and surplus spare parts worldwide, including PLCs, HMIs,
              VFDs, sensors, relays, circuit breakers and control system components.
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-3 text-sm text-slate-400">
                <MapPin size={16} className="mt-0.5 shrink-0 text-amber-400" />
                <span>United Arab Emirates, Ajman</span>
              </div>

              <div className="flex items-center gap-3 text-sm text-slate-400">
                <Mail size={16} className="shrink-0 text-amber-400" />
                <a
                  href="mailto:info@orbit-surplus.com"
                  className="transition-colors hover:text-amber-300"
                >
                  info@orbit-surplus.com
                </a>
              </div>

              <div className="flex items-center gap-3 text-sm text-slate-400">
                <Mail size={16} className="shrink-0 text-amber-400" />
                <a
                  href="mailto:sales@orbit-surplus.com"
                  className="transition-colors hover:text-amber-300"
                >
                  sales@orbit-surplus.com
                </a>
              </div>

              <div className="flex items-center gap-3 text-sm text-slate-400">
                <Phone size={16} className="shrink-0 text-amber-400" />
                <a
                  href="tel:+971676777094"
                  className="transition-colors hover:text-amber-300"
                >
                  +971 6 767 7094
                </a>
              </div>

              <div className="flex items-center gap-3 text-sm text-slate-400">
                <Phone size={16} className="shrink-0 text-amber-400" />
                <a
                  href="https://wa.me/971544272141"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-amber-300"
                >
                  WhatsApp: +971 54 427 2141
                </a>
              </div>

              <div className="flex items-center gap-3 text-sm text-slate-400">
                <Globe size={16} className="shrink-0 text-amber-400" />
                <span>Worldwide shipping via DHL &amp; FedEx</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">
              Company
            </h4>
            <ul className="space-y-2.5">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-400 transition-colors hover:text-amber-300"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">
              Categories
            </h4>
            <ul className="space-y-2.5">
              {footerLinks.categories.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-400 transition-colors hover:text-amber-300"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">
              Policies
            </h4>
            <ul className="space-y-2.5">
              {footerLinks.policies.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-400 transition-colors hover:text-amber-300"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="page-container flex flex-col items-center justify-between gap-3 py-4 text-xs text-slate-500 sm:flex-row">
          <p>
            © {new Date().getFullYear()} Orbit Control Automation. All rights
            reserved.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <span>www.orbit-surplus.com</span>
            <span>|</span>
            <span>Industrial Automation Spare Parts</span>
            <span>|</span>
            <span>United Arab Emirates</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

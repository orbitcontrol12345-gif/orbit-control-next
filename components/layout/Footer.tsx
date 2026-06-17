import Link from 'next/link';
import { Zap, Mail, Phone, MapPin, Linkedin, Globe, ArrowRight } from 'lucide-react';
import Image from 'next/image';
const footerLinks = {
  company: [
    { label: 'About Us', href: '/about' },
    { label: 'Brands We Carry', href: '/brands' },
    { label: 'Product Categories', href: '/categories' },
    { label: 'Sell Your Surplus', href: '/sell-surplus' },
    { label: 'Contact Us', href: '/contact' },
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
};

export default function Footer() {
  return (
    <footer className="bg-navy-950 border-t border-navy-800">
      

      {/* Main footer */}
      <div className="page-container py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 bg-gold-500 rounded flex items-center justify-center">
                <Image
  src="/logo.png"
  alt="Xeltronic Electrical Solution"
  width={170}
  height={55}
  className="h-5 w-auto"
/>
              </div>
            </Link>
            <p className="text-slate-400 text-sm leading-relaxed mb-6 max-w-xs">
              Global supplier of industrial automation and electrical spare parts. Specializing in PLCs, HMIs, drives, sensors, and obsolete automation components.
            </p>
            <div className="space-y-2.5">
              <div className="flex items-start gap-3 text-sm text-slate-400">
                <MapPin size={15} className="text-gold-500 shrink-0 mt-0.5" />
                <span>United Arab Emirates</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <Mail size={15} className="text-gold-500 shrink-0" />
                <a href="mailto:info@xeltronic.com" className="hover:text-gold-500 transition-colors">
                  info@xeltronic.com
                </a>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <Phone size={15} className="text-gold-500 shrink-0" />
                <span>+971 6 767 7094</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <Globe size={15} className="text-gold-500 shrink-0" />
                <span>Worldwide Shipping via DHL &amp; FedEx</span>
              </div>
            </div>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Company</h4>
            <ul className="space-y-2.5">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-400 hover:text-gold-500 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Categories</h4>
            <ul className="space-y-2.5">
              {footerLinks.categories.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-400 hover:text-gold-500 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Policies */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Policies</h4>
            <ul className="space-y-2.5">
              {footerLinks.policies.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-400 hover:text-gold-500 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-navy-800">
        <div className="page-container py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Xeltronic Electrical Solution. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span>Industrial Automation Spare Parts</span>
            <span>|</span>
            <span>United Arab Emirates</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

import Link from 'next/link';
import {
  Mail,
  MapPin,
  Phone,
  ArrowUpRight,
  Globe2,
  ShieldCheck,
  Truck,
} from 'lucide-react';

const companyLinks = [
  { label: 'About Us', href: '/about' },
  { label: 'Contact Us', href: '/contact' },
  { label: 'Request a Quote', href: '/rfq' },
  { label: 'Sell Your Surplus', href: '/sell-surplus' },
];

const productLinks = [
  { label: 'All Products', href: '/products' },
  { label: 'Brands', href: '/brands' },
  { label: 'Categories', href: '/categories' },
  { label: 'Obsolete Parts', href: '/products?category=Obsolete' },
];

const policyLinks = [
  { label: 'Shipping Policy', href: '/shipping-policy' },
  { label: 'Warranty Policy', href: '/warranty-policy' },
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Disclaimer', href: '/disclaimer' },
];

export default function FooterV2() {
  return (
    <footer className="relative overflow-hidden border-t border-white/[0.08] bg-[#020812]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.14) 1px, transparent 1px)',
          backgroundSize: '58px 58px',
        }}
      />

      <div className="pointer-events-none absolute bottom-0 left-1/2 h-72 w-[900px] -translate-x-1/2 rounded-full bg-cyan-400/[0.05] blur-[130px]" />

      <div className="page-container relative py-16">
        <div className="grid gap-12 lg:grid-cols-[1.35fr_0.75fr_0.75fr_0.85fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/[0.08] text-xl font-black text-amber-300">
                O
              </div>

              <div>
                <p className="text-lg font-black tracking-tight text-white">
                  ORBIT CONTROL
                </p>

                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">
                  Automation
                </p>
              </div>
            </Link>

            <p className="mt-6 max-w-md leading-7 text-slate-400">
              Global supplier of industrial automation, electrical control and
              obsolete industrial components for factories, OEMs, maintenance
              teams and system integrators.
            </p>

            <div className="mt-7 space-y-4 text-sm">
              <a
                href="mailto:info@orbit-surplus.com"
                className="flex w-fit items-center gap-3 text-slate-300 transition hover:text-cyan-300"
              >
                <Mail size={17} className="text-cyan-300" />
                info@orbit-surplus.com
              </a>

              <a
                href="tel:+971554835519"
                className="flex w-fit items-center gap-3 text-slate-300 transition hover:text-cyan-300"
              >
                <Phone size={17} className="text-cyan-300" />
                +971 55 483 5519
              </a>

              <div className="flex items-start gap-3 text-slate-300">
                <MapPin
                  size={17}
                  className="mt-0.5 shrink-0 text-cyan-300"
                />

                <span>Ajman, Jurf 1, United Arab Emirates</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-white">
              Company
            </h3>

            <div className="mt-6 space-y-4">
              {companyLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="flex w-fit items-center gap-2 text-sm text-slate-400 transition hover:text-cyan-300"
                >
                  {link.label}
                  <ArrowUpRight size={13} />
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-white">
              Products
            </h3>

            <div className="mt-6 space-y-4">
              {productLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="flex w-fit items-center gap-2 text-sm text-slate-400 transition hover:text-cyan-300"
                >
                  {link.label}
                  <ArrowUpRight size={13} />
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-white">
              Policies
            </h3>

            <div className="mt-6 space-y-4">
              {policyLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="flex w-fit items-center gap-2 text-sm text-slate-400 transition hover:text-cyan-300"
                >
                  {link.label}
                  <ArrowUpRight size={13} />
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-14 grid gap-4 border-y border-white/[0.07] py-7 md:grid-cols-3">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-300/[0.07] text-cyan-300">
              <Globe2 size={21} />
            </div>

            <div>
              <p className="text-sm font-bold text-white">Worldwide Supply</p>
              <p className="mt-1 text-xs text-slate-500">
                Serving customers in 65+ countries
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-300/[0.07] text-cyan-300">
              <Truck size={21} />
            </div>

            <div>
              <p className="text-sm font-bold text-white">Express Shipping</p>
              <p className="mt-1 text-xs text-slate-500">
                DHL and FedEx international delivery
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-300/[0.07] text-cyan-300">
              <ShieldCheck size={21} />
            </div>

            <div>
              <p className="text-sm font-bold text-white">Trusted Supplier</p>
              <p className="mt-1 text-xs text-slate-500">
                Genuine industrial automation parts
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-7 text-center text-xs text-slate-500 md:flex-row md:items-center md:justify-between md:text-left">
          <p>
            © {new Date().getFullYear()} Orbit Control Automation. All rights
            reserved.
          </p>

          <p>Industrial Automation Parts • Worldwide Supply</p>
        </div>
      </div>
    </footer>
  );
}

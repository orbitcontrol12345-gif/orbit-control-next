import {
  Globe2,
  Plane,
  MapPin,
  Package,
  Truck,
  ShieldCheck,
} from 'lucide-react';

const items = [
  {
    icon: Globe2,
    title: '65+ Countries',
    text: 'Supplying industrial automation parts worldwide.',
  },
  {
    icon: Plane,
    title: 'Express Shipping',
    text: 'DHL • FedEx • UPS international delivery.',
  },
  {
    icon: MapPin,
    title: 'Ajman, UAE',
    text: 'Strategic export hub for global customers.',
  },
  {
    icon: Package,
    title: '14,000+ Products',
    text: 'Large inventory ready for immediate RFQ.',
  },
  {
    icon: Truck,
    title: 'Fast Dispatch',
    text: 'Most orders shipped within 24–48 hours.',
  },
  {
    icon: ShieldCheck,
    title: 'Reliable Supply',
    text: 'Trusted sourcing for obsolete industrial parts.',
  },
];

export default function GlobalPresenceV2() {
  return (
    <section className="relative overflow-hidden border-y border-white/10 bg-[#05111d] py-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,.08),transparent_70%)]" />

      <div className="page-container relative">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.35em] text-amber-300">
            GLOBAL PRESENCE
          </p>

          <h2 className="text-4xl font-black text-white md:text-5xl">
            Delivering Worldwide
          </h2>

          <p className="mt-6 text-lg leading-8 text-slate-400">
            Orbit Control supports factories, OEMs and system integrators across
            the globe with reliable industrial automation sourcing.
          </p>
        </div>

        <div className="mb-14 flex justify-center">
          <div className="flex h-80 w-full max-w-5xl items-center justify-center rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-[#081827] to-[#06111d] text-center">
            <div>
              <Globe2 className="mx-auto mb-6 h-20 w-20 text-cyan-300" />
              <h3 className="text-3xl font-black text-white">
                Worldwide Industrial Supply Network
              </h3>
              <p className="mt-4 text-slate-400">
                (Interactive world map will be added later)
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition duration-300 hover:border-cyan-400/40 hover:-translate-y-1"
              >
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                  <Icon size={26} />
                </div>

                <h3 className="text-xl font-bold text-white">
                  {item.title}
                </h3>

                <p className="mt-3 leading-7 text-slate-400">
                  {item.text}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

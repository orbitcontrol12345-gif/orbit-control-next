import {
  Globe,
  PackageCheck,
  ShieldCheck,
  Clock3,
  Headset,
  BadgeCheck,
} from 'lucide-react';

const features = [
  {
    icon: PackageCheck,
    title: '14,000+ Industrial Parts',
    description:
      'Large inventory of new, surplus, refurbished and obsolete automation components ready for fast RFQ.',
  },
  {
    icon: Globe,
    title: 'Worldwide Shipping',
    description:
      'Fast international delivery with DHL, FedEx and trusted logistics partners worldwide.',
  },
  {
    icon: ShieldCheck,
    title: 'Tested & Genuine',
    description:
      'Every available product is carefully inspected to ensure quality and authenticity.',
  },
  {
    icon: Clock3,
    title: 'Fast RFQ Response',
    description:
      'Most quotations are prepared within hours by our experienced sales engineers.',
  },
  {
    icon: Headset,
    title: 'Technical Support',
    description:
      'Experienced automation specialists help identify compatible industrial parts.',
  },
  {
    icon: BadgeCheck,
    title: 'Trusted Supplier',
    description:
      'Serving customers worldwide with reliable sourcing and professional industrial solutions.',
  },
];

export default function WhyOrbit() {
  return (
    <section className="relative py-24">
      <div className="page-container">

        <div className="mx-auto mb-16 max-w-3xl text-center">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.35em] text-amber-300">
            WHY CHOOSE ORBIT CONTROL
          </p>

          <h2 className="text-4xl font-black tracking-tight text-white md:text-5xl">
            Built For Industrial Automation Professionals
          </h2>

          <p className="mt-6 text-lg text-slate-400 leading-8">
            We help maintenance teams, factories and system integrators source
            difficult industrial automation components quickly and reliably.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">

          {features.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-8 transition-all duration-300 hover:-translate-y-2 hover:border-cyan-400/40 hover:bg-white/[0.05]"
              >
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300 transition duration-300 group-hover:scale-110 group-hover:bg-cyan-400/20">
                  <Icon size={30} />
                </div>

                <h3 className="mb-3 text-2xl font-bold text-white">
                  {item.title}
                </h3>

                <p className="leading-7 text-slate-400">
                  {item.description}
                </p>
              </div>
            );
          })}

        </div>
      </div>
    </section>
  );
}

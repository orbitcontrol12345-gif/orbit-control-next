import {
  Factory,
  Cable,
  Droplets,
  Cpu,
  BatteryCharging,
  Building2,
} from 'lucide-react';

const industries = [
  {
    icon: Factory,
    title: 'Manufacturing',
    description: 'Production lines, machinery and factory automation.',
  },
  {
    icon: Cable,
    title: 'Oil & Gas',
    description: 'Industrial control systems for energy facilities.',
  },
  {
    icon: Droplets,
    title: 'Water Treatment',
    description: 'Pumps, PLCs, HMIs and monitoring equipment.',
  },
  {
    icon: Cpu,
    title: 'Machine Builders',
    description: 'Automation components for OEM machine manufacturers.',
  },
  {
    icon: BatteryCharging,
    title: 'Power & Utilities',
    description: 'Electrical protection and industrial infrastructure.',
  },
  {
    icon: Building2,
    title: 'System Integrators',
    description: 'Complete automation solutions and retrofit projects.',
  },
];

export default function IndustriesV2() {
  return (
    <section className="relative py-24">
      <div className="page-container">

        <div className="mx-auto mb-16 max-w-3xl text-center">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.35em] text-amber-300">
            INDUSTRIES WE SERVE
          </p>

          <h2 className="text-4xl font-black text-white md:text-5xl">
            Supporting Every Industrial Sector
          </h2>

          <p className="mt-6 text-lg leading-8 text-slate-400">
            Orbit Control supplies automation components for factories,
            utilities, OEMs and industrial facilities worldwide.
          </p>
        </div>

        <div className="grid gap-7 md:grid-cols-2 xl:grid-cols-3">
          {industries.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-8 transition duration-300 hover:-translate-y-2 hover:border-cyan-400/40"
              >
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300 transition duration-300 group-hover:scale-110">
                  <Icon size={30} />
                </div>

                <h3 className="text-2xl font-bold text-white">
                  {item.title}
                </h3>

                <p className="mt-4 leading-7 text-slate-400">
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

import {
  Boxes,
  Building2,
  Globe2,
  Clock3,
} from 'lucide-react';

const statistics = [
  {
    icon: Boxes,
    value: '14,000+',
    label: 'Industrial Parts',
    description: 'Automation and control components',
  },
  {
    icon: Building2,
    value: '200+',
    label: 'Global Brands',
    description: 'Leading industrial manufacturers',
  },
  {
    icon: Globe2,
    value: '65+',
    label: 'Countries Served',
    description: 'Worldwide B2B supply network',
  },
  {
    icon: Clock3,
    value: '24h',
    label: 'RFQ Target',
    description: 'Fast quotation response',
  },
];

export default function StatisticsV2() {
  return (
    <section className="relative overflow-hidden border-y border-white/[0.07] bg-[#06111d] py-16">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.14) 1px, transparent 1px)',
          backgroundSize: '58px 58px',
        }}
      />

      <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-[850px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/[0.06] blur-[120px]" />

      <div className="page-container relative">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {statistics.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                className="group relative overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.025] p-7 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/[0.045]"
              >
                <div className="absolute right-0 top-0 h-28 w-28 translate-x-8 -translate-y-8 rounded-full bg-cyan-300/[0.06] blur-3xl transition duration-300 group-hover:bg-cyan-300/[0.12]" />

                <div className="relative flex items-start gap-5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.07] text-cyan-300">
                    <Icon size={26} strokeWidth={1.8} />
                  </div>

                  <div>
                    <p className="text-3xl font-black tracking-tight text-white md:text-4xl">
                      {item.value}
                    </p>

                    <h3 className="mt-1 text-sm font-black uppercase tracking-[0.12em] text-cyan-200">
                      {item.label}
                    </h3>

                    <p className="mt-3 text-sm leading-6 text-slate-500">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

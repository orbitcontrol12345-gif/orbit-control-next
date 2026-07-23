
import Link from 'next/link';
import {
  Cpu,
  Monitor,
  Zap,
  Shield,
  Gauge,
  Radar,
  Battery,
  HardDrive,
  Wrench,
  Archive,
} from 'lucide-react';

const categories = [
  {
    title: 'PLC Systems',
    icon: Cpu,
    href: '/products?category=PLC',
    count: '2,800+',
  },
  {
    title: 'HMI Panels',
    icon: Monitor,
    href: '/products?category=HMI',
    count: '1,900+',
  },
  {
    title: 'Drives & VFDs',
    icon: Zap,
    href: '/products?category=Drives',
    count: '2,300+',
  },
  {
    title: 'Circuit Breakers',
    icon: Shield,
    href: '/products?category=Circuit+Breakers',
    count: '3,400+',
  },
  {
    title: 'Servo Motors',
    icon: Gauge,
    href: '/products?category=Servo',
    count: '950+',
  },
  {
    title: 'Sensors',
    icon: Radar,
    href: '/products?category=Sensors',
    count: '2,100+',
  },
  {
    title: 'Power Supplies',
    icon: Battery,
    href: '/products?category=Power+Supplies',
    count: '1,400+',
  },
  {
    title: 'Industrial PCs',
    icon: HardDrive,
    href: '/products?category=Industrial+PC',
    count: '700+',
  },
  {
    title: 'Test Equipment',
    icon: Wrench,
    href: '/products?category=Test+Equipment',
    count: '1,100+',
  },
  {
    title: 'Obsolete Parts',
    icon: Archive,
    href: '/products?category=Obsolete',
    count: '14,000+',
  },
];

export default function CategoriesV2() {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#10345d22,transparent_70%)]" />

      <div className="page-container relative">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.35em] text-amber-300">
            Browse Inventory
          </p>

          <h2 className="text-4xl font-black tracking-tight text-white md:text-5xl">
            Explore By Category
          </h2>

          <p className="mt-6 text-lg leading-8 text-slate-400">
            Discover thousands of industrial automation components organized
            into major product categories for faster sourcing.
          </p>
        </div>

        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {categories.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.title}
                href={item.href}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-7 transition-all duration-300 hover:-translate-y-2 hover:border-cyan-400/40 hover:bg-white/[0.05]"
              >
                <div className="absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100">
                  <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
                </div>

                <div className="relative">
                  <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-300 transition duration-300 group-hover:scale-110 group-hover:bg-cyan-400/20">
                    <Icon size={32} />
                  </div>

                  <h3 className="text-xl font-bold text-white">
                    {item.title}
                  </h3>

                  <p className="mt-2 text-sm text-slate-400">
                    {item.count} Products
                  </p>

                  <div className="mt-8 flex items-center text-sm font-semibold text-cyan-300">
                    Explore →
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

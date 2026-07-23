import Link from 'next/link';
import { ArrowRight, Mail, MessageCircle } from 'lucide-react';

export default function CtaSectionV2() {
  return (
    <section className="relative overflow-hidden py-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(250,204,21,0.08),transparent_65%)]" />

      <div className="page-container relative">
        <div className="overflow-hidden rounded-3xl border border-amber-300/15 bg-gradient-to-br from-[#0b1724] via-[#0d1b2a] to-[#09131f] p-12 md:p-16">

          <div className="mx-auto max-w-4xl text-center">

            <p className="mb-4 text-xs font-black uppercase tracking-[0.35em] text-amber-300">
              READY TO SOURCE YOUR PART?
            </p>

            <h2 className="text-4xl font-black text-white md:text-6xl">
              Get Your Quote Today
            </h2>

            <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-slate-300">
              Whether you need obsolete PLC modules, HMI panels, drives,
              circuit breakers or hard-to-find industrial automation parts,
              our team is ready to help.
            </p>

            <div className="mt-12 flex flex-col justify-center gap-5 sm:flex-row">

              <Link
                href="/rfq"
                className="inline-flex items-center justify-center gap-3 rounded-xl bg-amber-300 px-8 py-4 text-base font-black text-[#09131f] transition hover:-translate-y-1 hover:bg-amber-200"
              >
                <Mail size={20} />
                Request a Quote
              </Link>

              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/5 px-8 py-4 text-base font-black text-cyan-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/10"
              >
                <MessageCircle size={20} />
                Contact Sales
              </Link>

            </div>

          </div>

        </div>
      </div>
    </section>
  );
}

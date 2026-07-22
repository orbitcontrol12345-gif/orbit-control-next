import { Globe2, MapPin } from 'lucide-react';

const CONNECTION_POINTS = [
  { top: '22%', left: '55%', delay: '0s' },
  { top: '34%', left: '69%', delay: '0.7s' },
  { top: '51%', left: '73%', delay: '1.4s' },
  { top: '63%', left: '54%', delay: '2.1s' },
  { top: '43%', left: '31%', delay: '2.8s' },
  { top: '28%', left: '39%', delay: '3.5s' },
];

export default function HeroGlobe() {
  return (
    <div className="relative mx-auto flex min-h-[560px] w-full max-w-[650px] items-center justify-center">
      {/* خلفية الإضاءة */}
      <div className="absolute left-1/2 top-1/2 h-[470px] w-[470px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/[0.10] blur-[90px]" />

      <div className="absolute left-[54%] top-[48%] h-[330px] w-[330px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300/[0.06] blur-[75px]" />

      {/* الحلقات الخارجية */}
      <div className="absolute left-1/2 top-1/2 h-[530px] w-[530px] -translate-x-1/2 -translate-y-1/2 animate-[spin_45s_linear_infinite] rounded-full border border-cyan-300/[0.12]" />

      <div className="absolute left-1/2 top-1/2 h-[470px] w-[590px] -translate-x-1/2 -translate-y-1/2 rotate-[16deg] animate-[spin_34s_linear_infinite_reverse] rounded-[50%] border border-amber-300/[0.18]" />

      <div className="absolute left-1/2 top-1/2 h-[590px] w-[410px] -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] animate-[spin_40s_linear_infinite] rounded-[50%] border border-cyan-300/[0.10]" />

      {/* الكرة */}
      <div className="relative h-[440px] w-[440px] max-w-[82vw]">
        <div className="absolute inset-0 overflow-hidden rounded-full border border-cyan-200/25 bg-[#031426] shadow-[0_0_80px_rgba(14,165,233,0.20),inset_-35px_-25px_70px_rgba(0,0,0,0.75),inset_18px_10px_35px_rgba(56,189,248,0.15)]">
          {/* إضاءة داخلية */}
          <div className="absolute inset-[3%] rounded-full bg-[radial-gradient(circle_at_34%_27%,rgba(125,211,252,0.30),transparent_18%),radial-gradient(circle_at_62%_66%,rgba(14,165,233,0.14),transparent_31%),linear-gradient(145deg,rgba(8,47,73,0.90),rgba(1,8,18,0.98))]" />

          {/* خطوط الطول */}
          <div className="absolute inset-[8%] rounded-full border border-cyan-300/[0.16]" />

          <div className="absolute left-1/2 top-[8%] h-[84%] w-[38%] -translate-x-1/2 rounded-[50%] border border-cyan-300/[0.13]" />

          <div className="absolute left-1/2 top-[8%] h-[84%] w-[68%] -translate-x-1/2 rounded-[50%] border border-cyan-300/[0.10]" />

          <div className="absolute left-1/2 top-[8%] h-[84%] w-[92%] -translate-x-1/2 rounded-[50%] border border-cyan-300/[0.07]" />

          {/* خطوط العرض */}
          <div className="absolute left-[8%] top-[28%] h-[23%] w-[84%] rounded-[50%] border border-cyan-300/[0.12]" />

          <div className="absolute left-[7%] top-[42%] h-[18%] w-[86%] rounded-[50%] border border-cyan-300/[0.16]" />

          <div className="absolute left-[10%] top-[58%] h-[17%] w-[80%] rounded-[50%] border border-cyan-300/[0.10]" />

          {/* شكل القارات بشكل تجريدي */}
          <div className="absolute left-[25%] top-[19%] h-[82px] w-[98px] rotate-[-12deg] rounded-[48%_52%_62%_38%/45%_35%_65%_55%] border border-cyan-200/25 bg-cyan-300/[0.08] shadow-[0_0_30px_rgba(34,211,238,0.10)]" />

          <div className="absolute left-[42%] top-[29%] h-[145px] w-[96px] rotate-[12deg] rounded-[44%_56%_42%_58%/32%_49%_51%_68%] border border-cyan-200/25 bg-cyan-300/[0.09]" />

          <div className="absolute right-[16%] top-[23%] h-[92px] w-[114px] rotate-[18deg] rounded-[54%_46%_60%_40%/38%_61%_39%_62%] border border-cyan-200/20 bg-cyan-300/[0.07]" />

          <div className="absolute bottom-[14%] right-[22%] h-[62px] w-[78px] rotate-[-12deg] rounded-[60%_40%_48%_52%/50%_58%_42%_50%] border border-cyan-200/20 bg-cyan-300/[0.06]" />

          {/* نقاط الاتصال */}
          {CONNECTION_POINTS.map((point, index) => (
            <div
              key={index}
              className="absolute z-20"
              style={{
                top: point.top,
                left: point.left,
              }}
            >
              <span
                className="absolute -inset-3 animate-ping rounded-full bg-amber-300/35"
                style={{
                  animationDelay: point.delay,
                  animationDuration: '3s',
                }}
              />

              <span className="relative block h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_15px_rgba(252,211,77,0.95)]" />
            </div>
          ))}

          {/* مركز الإمارات */}
          <div className="absolute left-[61%] top-[43%] z-30">
            <span className="absolute -inset-5 animate-ping rounded-full border border-amber-300/40" />

            <span className="relative flex h-5 w-5 items-center justify-center rounded-full border border-white/60 bg-amber-300 shadow-[0_0_25px_rgba(252,211,77,0.95)]">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            </span>
          </div>

          {/* لمعان الكرة */}
          <div className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(110deg,rgba(255,255,255,0.12),transparent_28%,transparent_70%,rgba(14,165,233,0.08))]" />

          <div className="pointer-events-none absolute inset-0 animate-[spin_55s_linear_infinite] rounded-full border border-dashed border-cyan-200/[0.13]" />
        </div>

        {/* الحلقة السفلية */}
        <div className="absolute -bottom-10 left-1/2 h-20 w-[115%] -translate-x-1/2 rounded-[50%] border border-cyan-300/25 bg-cyan-400/[0.035] shadow-[0_0_40px_rgba(14,165,233,0.15)]" />

        <div className="absolute -bottom-5 left-1/2 h-10 w-[88%] -translate-x-1/2 rounded-[50%] border border-amber-300/25" />
      </div>

      {/* بطاقة الإمارات */}
      <div className="absolute right-0 top-[41%] z-40 hidden w-[205px] rounded-2xl border border-cyan-200/20 bg-[#061525]/90 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl xl:block">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/[0.08] text-amber-200">
            <MapPin size={19} />
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">
              Supply Hub
            </p>

            <p className="mt-1 font-black text-white">Ajman, UAE</p>

            <p className="mt-1 text-xs leading-5 text-slate-400">
              Worldwide industrial parts distribution.
            </p>
          </div>
        </div>
      </div>

      {/* النص السفلي */}
      <div className="absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-[#06111d]/85 px-4 py-2 text-xs font-bold text-slate-300 backdrop-blur-xl">
        <Globe2 size={15} className="text-cyan-200" />
        Global Industrial Supply Network
      </div>
    </div>
  );
}

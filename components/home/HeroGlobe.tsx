import { Globe2, MapPin } from 'lucide-react';

const CONNECTION_POINTS = [
  { top: '19%', left: '53%', delay: '0s' },
  { top: '29%', left: '68%', delay: '0.7s' },
  { top: '44%', left: '76%', delay: '1.4s' },
  { top: '61%', left: '61%', delay: '2.1s' },
  { top: '54%', left: '34%', delay: '2.8s' },
  { top: '31%', left: '32%', delay: '3.5s' },
];

export default function HeroGlobe() {
  return (
    <div className="relative mx-auto flex min-h-[610px] w-full max-w-[720px] items-center justify-center">
      {/* Main glow */}
      <div className="absolute left-1/2 top-[48%] h-[540px] w-[540px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/[0.12] blur-[105px]" />

      <div className="absolute left-[58%] top-[43%] h-[390px] w-[390px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300/[0.07] blur-[95px]" />

      {/* External orbits */}
      <div className="absolute left-1/2 top-[48%] h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 animate-[spin_48s_linear_infinite] rounded-full border border-cyan-300/[0.12]" />

      <div className="absolute left-1/2 top-[48%] h-[420px] w-[650px] -translate-x-1/2 -translate-y-1/2 rotate-[14deg] animate-[spin_38s_linear_infinite_reverse] rounded-[50%] border border-amber-300/[0.22]" />

      <div className="absolute left-1/2 top-[48%] h-[650px] w-[430px] -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] animate-[spin_44s_linear_infinite] rounded-[50%] border border-cyan-300/[0.11]" />

      <div className="absolute left-1/2 top-[48%] h-[485px] w-[680px] -translate-x-1/2 -translate-y-1/2 -rotate-[18deg] rounded-[50%] border border-amber-300/[0.08]" />

      {/* Globe */}
      <div className="relative h-[475px] w-[475px] max-w-[84vw]">
        <div className="absolute inset-0 overflow-hidden rounded-full border border-cyan-200/35 bg-[#031323] shadow-[0_0_100px_rgba(14,165,233,0.28),inset_-45px_-30px_85px_rgba(0,0,0,0.82),inset_20px_15px_50px_rgba(56,189,248,0.18)]">
          {/* Internal lighting */}
          <div className="absolute inset-[2%] rounded-full bg-[radial-gradient(circle_at_32%_23%,rgba(125,211,252,0.34),transparent_20%),radial-gradient(circle_at_62%_66%,rgba(14,165,233,0.18),transparent_34%),linear-gradient(145deg,rgba(7,42,69,0.95),rgba(1,8,18,0.99))]" />

          {/* Latitude and longitude */}
          <div className="absolute inset-[7%] rounded-full border border-cyan-300/[0.18]" />

          <div className="absolute left-1/2 top-[7%] h-[86%] w-[33%] -translate-x-1/2 rounded-[50%] border border-cyan-300/[0.16]" />

          <div className="absolute left-1/2 top-[7%] h-[86%] w-[60%] -translate-x-1/2 rounded-[50%] border border-cyan-300/[0.12]" />

          <div className="absolute left-1/2 top-[7%] h-[86%] w-[88%] -translate-x-1/2 rounded-[50%] border border-cyan-300/[0.08]" />

          <div className="absolute left-[7%] top-[24%] h-[24%] w-[86%] rounded-[50%] border border-cyan-300/[0.11]" />

          <div className="absolute left-[5%] top-[40%] h-[20%] w-[90%] rounded-[50%] border border-cyan-300/[0.18]" />

          <div className="absolute left-[8%] top-[58%] h-[18%] w-[84%] rounded-[50%] border border-cyan-300/[0.11]" />

          {/* Abstract continents */}
          <div className="absolute left-[20%] top-[19%] h-[90px] w-[118px] rotate-[-15deg] rounded-[48%_52%_65%_35%/42%_37%_63%_58%] border border-cyan-200/30 bg-cyan-300/[0.10] shadow-[0_0_35px_rgba(34,211,238,0.14)]" />

          <div className="absolute left-[39%] top-[28%] h-[158px] w-[106px] rotate-[10deg] rounded-[45%_55%_42%_58%/32%_51%_49%_68%] border border-cyan-200/30 bg-cyan-300/[0.10]" />

          <div className="absolute right-[13%] top-[22%] h-[102px] w-[126px] rotate-[15deg] rounded-[56%_44%_61%_39%/37%_62%_38%_63%] border border-cyan-200/25 bg-cyan-300/[0.08]" />

          <div className="absolute bottom-[12%] right-[19%] h-[70px] w-[88px] rotate-[-10deg] rounded-[60%_40%_48%_52%/50%_58%_42%_50%] border border-cyan-200/22 bg-cyan-300/[0.07]" />

          {/* Blue map highlights */}
          <div className="absolute left-[31%] top-[31%] h-[65px] w-[54px] rounded-full bg-cyan-400/[0.10] blur-sm" />

          <div className="absolute right-[25%] top-[35%] h-[82px] w-[70px] rounded-full bg-blue-400/[0.08] blur-sm" />

          {/* Connection points */}
          {CONNECTION_POINTS.map((point, index) => (
            <div
              key={`${point.top}-${point.left}`}
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

              <span className="relative block h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_18px_rgba(252,211,77,1)]" />
            </div>
          ))}

          {/* UAE point */}
          <div className="absolute left-[61%] top-[43%] z-30">
            <span className="absolute -inset-6 animate-ping rounded-full border border-amber-300/50" />

            <span className

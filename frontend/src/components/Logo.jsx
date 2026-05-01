import { Globe2, Mountain, Anchor } from "lucide-react";

export default function Logo({ size = "md", showText = true }) {
  const dims = {
    sm: { box: "h-8 w-8", icon: 14, title: "text-sm", sub: "text-[9px]" },
    md: { box: "h-10 w-10", icon: 18, title: "text-base", sub: "text-[10px]" },
    lg: { box: "h-14 w-14", icon: 24, title: "text-2xl", sub: "text-xs" },
    xl: { box: "h-20 w-20", icon: 36, title: "text-4xl md:text-5xl", sub: "text-sm" },
  }[size];

  return (
    <div className="flex items-center gap-3" data-testid="rap-logo">
      <div
        className={`relative ${dims.box} rounded-sm flex items-center justify-center`}
        style={{
          background: "linear-gradient(135deg, #1B4332 0%, #1A3C5E 100%)",
          boxShadow: "0 0 0 1px rgba(212, 160, 23, 0.4), inset 0 0 12px rgba(0,0,0,0.3)",
        }}
      >
        <Globe2 size={dims.icon} color="#D4A017" strokeWidth={1.5} className="absolute" />
        <div className="absolute -bottom-0.5 -right-0.5 flex">
          <Mountain size={dims.icon * 0.5} color="#D4A017" strokeWidth={2.2} />
        </div>
        <div className="absolute -bottom-0.5 -left-0.5">
          <Anchor size={dims.icon * 0.45} color="#27AE60" strokeWidth={2.2} />
        </div>
      </div>
      {showText && (
        <div className="flex flex-col leading-tight">
          <span className={`font-display font-black tracking-tight ${dims.title}`}>
            RESOURCES-ANALYZER
            <span style={{ color: "#D4A017" }}> PRO</span>
          </span>
          <span
            className={`uppercase tracking-[0.2em] ${dims.sub}`}
            style={{ color: "#D4A017" }}
          >
            Analyse · Convention · Souveraineté
          </span>
        </div>
      )}
    </div>
  );
}

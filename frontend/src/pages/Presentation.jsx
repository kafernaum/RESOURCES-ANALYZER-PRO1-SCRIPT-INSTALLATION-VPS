import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import {
  ChevronLeft, ChevronRight, X, Maximize2, Loader2,
  TrendingUp, AlertTriangle, FileWarning, Users, ScaleIcon, Scale, Trophy,
} from "lucide-react";

const COLORS = {
  primary: "#1B4332",
  gold: "#D4A017",
  navy: "#1A3C5E",
  alert: "#C0392B",
  warn: "#E67E22",
  green: "#27AE60",
  bg: "#0D1B12",
};

const NIVEAU_COLOR = {
  conforme: COLORS.green,
  attention: COLORS.warn,
  grave: COLORS.alert,
  critique: COLORS.alert,
};

export default function Presentation() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    api.get(`/projects/${id}/presentation`).then(({ data }) => setData(data));
  }, [id]);

  const next = useCallback(() => {
    setIdx((i) => Math.min(i + 1, (data?.slides?.length || 1) - 1));
  }, [data]);
  const prev = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") next();
      else if (e.key === "ArrowLeft" || e.key === "PageUp") prev();
      else if (e.key === "Escape") nav(`/projects/${id}`);
      else if (e.key === "f" || e.key === "F") {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev, nav, id]);

  if (!data) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: COLORS.bg, color: "white" }}>
        <Loader2 size={28} className="animate-spin" />
      </div>
    );
  }

  const slide = data.slides[idx];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" style={{ background: COLORS.bg, color: "white" }}>
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-3 z-10"
        style={{ background: "rgba(0,0,0,0.3)" }}>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs opacity-60">RESOURCES-ANALYZER PRO</span>
          <span className="font-mono text-xs" style={{ color: COLORS.gold }}>
            {data.project?.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs opacity-60">{idx + 1} / {data.slides.length}</span>
          <Button size="sm" variant="ghost" onClick={() => {
            if (document.fullscreenElement) document.exitFullscreen();
            else document.documentElement.requestFullscreen();
          }} className="text-white hover:bg-white/10" data-testid="present-fullscreen">
            <Maximize2 size={14} />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => nav(`/projects/${id}`)}
            className="text-white hover:bg-white/10" data-testid="present-close">
            <X size={16} />
          </Button>
        </div>
      </div>

      {/* Slide content */}
      <div className="h-full flex items-center justify-center px-12 py-16">
        <SlideRenderer slide={slide} project={data.project} />
      </div>

      {/* Nav */}
      <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-3 z-10">
        <Button size="sm" onClick={prev} disabled={idx === 0} variant="outline"
          className="rounded-sm bg-white/10 border-white/20 text-white hover:bg-white/20"
          data-testid="present-prev">
          <ChevronLeft size={14} />
        </Button>
        <div className="flex items-center gap-1">
          {data.slides.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className="w-8 h-1 rounded-full transition-colors"
              style={{ background: i === idx ? COLORS.gold : "rgba(255,255,255,0.3)" }}
              data-testid={`present-dot-${i}`} />
          ))}
        </div>
        <Button size="sm" onClick={next} disabled={idx === data.slides.length - 1} variant="outline"
          className="rounded-sm bg-white/10 border-white/20 text-white hover:bg-white/20"
          data-testid="present-next">
          <ChevronRight size={14} />
        </Button>
      </div>
      <div className="absolute bottom-2 left-0 right-0 text-center font-mono text-[10px] opacity-40">
        ← → flèches · F plein écran · Esc quitter
      </div>
    </div>
  );
}

function SlideRenderer({ slide, project }) {
  if (!slide) return null;
  switch (slide.kind) {
    case "cover": return <CoverSlide slide={slide} />;
    case "verdict": return <VerdictSlide slide={slide} />;
    case "alerts": return <AlertsSlide slide={slide} />;
    case "financial": return <FinancialSlide slide={slide} />;
    case "violations": return <ViolationsSlide slide={slide} />;
    case "abuses": return <AbusesSlide slide={slide} />;
    case "diagnostics": return <DiagnosticsSlide slide={slide} />;
    case "actions": return <ActionsSlide slide={slide} />;
    case "conclusion": return <ConclusionSlide slide={slide} project={project} />;
    default: return <div>Slide inconnue</div>;
  }
}

function CoverSlide({ slide }) {
  return (
    <div className="text-center max-w-5xl">
      <div className="font-mono text-xs uppercase tracking-[0.4em] opacity-60 mb-6">{slide.kicker}</div>
      <h1 className="font-display font-bold mb-6" style={{ fontSize: "5rem", lineHeight: 1.1, color: COLORS.gold }}>
        {slide.title}
      </h1>
      <div className="text-2xl opacity-80 mb-12">{slide.subtitle}</div>
      <div className="font-mono text-base opacity-70 italic">{slide.tagline}</div>
      <div className="mt-12 font-mono text-xs opacity-50">{slide.author}</div>
    </div>
  );
}

function VerdictSlide({ slide }) {
  const niv = (slide.niveau || "attention").toLowerCase();
  const color = NIVEAU_COLOR[niv] || COLORS.warn;
  return (
    <div className="text-center max-w-5xl w-full">
      <div className="font-mono text-xs uppercase tracking-[0.4em] opacity-60 mb-6">Verdict</div>
      <div className="font-display font-bold mb-3" style={{ fontSize: "12rem", lineHeight: 1, color }}>
        {slide.score_global}
      </div>
      <div className="text-3xl uppercase tracking-wider font-semibold mb-12" style={{ color }}>
        {niv}
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Juridique", val: slide.scores?.juridique },
          { label: "Environnement", val: slide.scores?.sec },
          { label: "Social", val: slide.scores?.ssc },
          { label: "Souveraineté", val: slide.scores?.sos },
        ].map((s, i) => (
          <div key={i} className="border rounded-sm p-5"
            style={{ borderColor: "rgba(212,160,23,0.3)", background: "rgba(212,160,23,0.05)" }}>
            <div className="text-xs uppercase tracking-wider opacity-70 mb-2">{s.label}</div>
            <div className="font-mono font-bold text-4xl" style={{ color: COLORS.gold }}>{s.val}</div>
            <div className="text-xs opacity-50">/100</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertsSlide({ slide }) {
  return (
    <div className="max-w-6xl w-full">
      <h2 className="font-display font-bold text-5xl mb-12 text-center" style={{ color: COLORS.gold }}>
        {slide.title}
      </h2>
      <div className="grid grid-cols-2 gap-6">
        {slide.items.map((it, i) => (
          <div key={i} className="border rounded-sm p-8"
            style={{ borderColor: it.color, background: "rgba(255,255,255,0.03)" }}>
            <AlertTriangle size={28} style={{ color: it.color }} className="mb-3" />
            <div className="font-mono font-bold mb-2" style={{ fontSize: "5rem", lineHeight: 1, color: it.color }}>
              {it.value}
            </div>
            <div className="text-base opacity-80">{it.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinancialSlide({ slide }) {
  return (
    <div className="max-w-6xl w-full">
      <h2 className="font-display font-bold text-5xl mb-12 text-center" style={{ color: COLORS.gold }}>
        {slide.title}
      </h2>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <BigNumber label="Valeur du gisement" val={slide.valeur_gisement_mrd} unit="Mrd USD" mono />
        <BigNumber label="Part de l'État" val={slide.part_etat_pct} unit="%" mono
          color={slide.part_etat_pct < 30 ? COLORS.alert : COLORS.green} />
        <BigNumber label="Élément don fiscal" val={slide.element_don_pct} unit="%" mono
          color={slide.cadeau_fiscal ? COLORS.alert : COLORS.green} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <BigNumber label="Manque à gagner annuel" val={slide.manque_a_gagner_an_m} unit="M USD"
          color={COLORS.alert} mono />
        <BigNumber label="Manque à gagner total" val={slide.manque_a_gagner_total_m} unit="M USD"
          color={COLORS.alert} mono />
      </div>
      {slide.cadeau_fiscal && (
        <div className="mt-6 text-center text-xl py-4" style={{ color: COLORS.alert, background: "rgba(192,57,43,0.1)" }}>
          ⚠ CADEAU FISCAL DÉTECTÉ
        </div>
      )}
    </div>
  );
}

function ViolationsSlide({ slide }) {
  return (
    <div className="max-w-6xl w-full">
      <h2 className="font-display font-bold text-4xl mb-8 text-center" style={{ color: COLORS.gold }}>
        {slide.title}
      </h2>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="text-xs uppercase tracking-wider opacity-70 mb-3">Droit international</div>
          {(slide.international || []).map((v, i) => (
            <div key={i} className="border rounded-sm p-3 mb-2"
              style={{ borderColor: "rgba(192,57,43,0.4)", background: "rgba(192,57,43,0.05)" }}>
              <div className="font-mono text-xs font-bold mb-1" style={{ color: COLORS.alert }}>
                {v.norme} · {v.gravite?.toUpperCase()}
              </div>
              <div className="text-sm font-semibold">{v.libelle}</div>
              <div className="text-xs opacity-70 mt-1">{v.nature?.slice(0, 120)}</div>
            </div>
          ))}
          {!slide.international?.length && <div className="text-sm opacity-50 italic">Aucune</div>}
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider opacity-70 mb-3">Droit national</div>
          {(slide.national || []).map((v, i) => (
            <div key={i} className="border rounded-sm p-3 mb-2"
              style={{ borderColor: "rgba(192,57,43,0.4)", background: "rgba(192,57,43,0.05)" }}>
              <div className="font-mono text-xs font-bold mb-1" style={{ color: COLORS.alert }}>
                {v.code} {v.article} · {v.gravite?.toUpperCase()}
              </div>
              <div className="text-xs opacity-80 mt-1">{v.nature?.slice(0, 140)}</div>
            </div>
          ))}
          {!slide.national?.length && <div className="text-sm opacity-50 italic">Aucune</div>}
        </div>
      </div>
    </div>
  );
}

function AbusesSlide({ slide }) {
  return (
    <div className="max-w-6xl w-full">
      <h2 className="font-display font-bold text-5xl mb-10 text-center" style={{ color: COLORS.gold }}>
        {slide.title}
      </h2>
      <div className="grid grid-cols-2 gap-4">
        {(slide.items || []).map((c, i) => (
          <div key={i} className="border rounded-sm p-4"
            style={{ borderColor: "rgba(212,160,23,0.3)", background: "rgba(212,160,23,0.05)" }}>
            <div className="font-mono text-xs font-bold mb-1" style={{ color: COLORS.gold }}>
              {c.type?.replace(/_/g, " ").toUpperCase()} · {c.gravite?.toUpperCase()}
            </div>
            <div className="text-sm opacity-90 mt-2">{c.analyse?.slice(0, 200)}</div>
          </div>
        ))}
      </div>
      {!slide.items?.length && <div className="text-center text-xl opacity-50">Aucune clause abusive détectée.</div>}
    </div>
  );
}

function DiagnosticsSlide({ slide }) {
  return (
    <div className="max-w-6xl w-full">
      <h2 className="font-display font-bold text-4xl mb-8 text-center" style={{ color: COLORS.gold }}>
        {slide.title}
      </h2>
      <div className="space-y-3">
        {(slide.items || []).map((d, i) => {
          const c = NIVEAU_COLOR[d.gravite] || COLORS.warn;
          return (
            <div key={i} className="border rounded-sm p-4 flex items-center justify-between gap-4"
              style={{ borderLeft: `4px solid ${c}`, background: "rgba(255,255,255,0.03)" }}>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-base">{d.anomalie}</div>
                <div className="font-mono text-xs opacity-70 mt-1">
                  Gravité: {d.gravite?.toUpperCase()} · Priorité: {d.priorite?.toUpperCase()}
                </div>
              </div>
              {d.impact > 0 && (
                <div className="text-right">
                  <div className="font-mono text-xl font-bold" style={{ color: COLORS.alert }}>
                    {(d.impact / 1e6).toFixed(1)} M
                  </div>
                  <div className="text-xs opacity-60">USD</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActionsSlide({ slide }) {
  return (
    <div className="max-w-6xl w-full">
      <h2 className="font-display font-bold text-5xl mb-10 text-center" style={{ color: COLORS.gold }}>
        {slide.title}
      </h2>
      <div className="grid grid-cols-3 gap-4">
        {slide.voies.map((v, i) => (
          <div key={i} className="border rounded-sm p-6 text-center"
            style={{ borderColor: "rgba(212,160,23,0.3)", background: "rgba(27,67,50,0.4)" }}>
            <div className="font-display text-2xl font-bold mb-2" style={{ color: COLORS.gold }}>
              {v.label.split(" ")[0]}
            </div>
            <div className="text-base">{v.label.split(" ").slice(1).join(" ")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConclusionSlide({ slide, project }) {
  const niv = (slide.niveau_global || "attention").toLowerCase();
  const color = NIVEAU_COLOR[niv] || COLORS.warn;
  return (
    <div className="text-center max-w-5xl">
      <div className="font-mono text-xs uppercase tracking-[0.4em] opacity-60 mb-6">Conclusion</div>
      <h2 className="font-display font-bold text-6xl mb-6" style={{ color }}>
        Niveau {niv.toUpperCase()}
      </h2>
      <div className="text-2xl opacity-90 mb-8">
        Manque à gagner total estimé :{" "}
        <span className="font-mono font-bold" style={{ color: COLORS.alert }}>
          {slide.manque_a_gagner_m} M USD
        </span>
      </div>
      <p className="text-xl opacity-80 leading-relaxed mb-12 max-w-3xl mx-auto">
        {slide.recommandation}
      </p>
      <div className="font-mono text-sm opacity-60 italic">{slide.tagline}</div>
      <div className="mt-8 font-mono text-xs opacity-40">
        Méthodologie : Ahmed ELY Mustapha · {project?.name}
      </div>
    </div>
  );
}

function BigNumber({ label, val, unit, color, mono }) {
  return (
    <div className="border rounded-sm p-6 text-center"
      style={{ borderColor: "rgba(212,160,23,0.3)", background: "rgba(255,255,255,0.03)" }}>
      <div className="text-xs uppercase tracking-wider opacity-70 mb-2">{label}</div>
      <div className={`font-bold text-5xl ${mono ? "font-mono" : ""}`}
        style={{ color: color || COLORS.gold }}>
        {val}
      </div>
      <div className="text-xs opacity-60 mt-1">{unit}</div>
    </div>
  );
}

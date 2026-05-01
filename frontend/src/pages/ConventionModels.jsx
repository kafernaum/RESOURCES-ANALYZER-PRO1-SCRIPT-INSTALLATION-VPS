import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { FileText, Award, AlertTriangle } from "lucide-react";

const SECTOR_BADGES = {
  mines: "#D4A017", petrole: "#1A3C5E", gaz: "#27AE60",
  maritime: "#1A3C5E", foret: "#1B4332", mixte: "#8b5cf6",
};

export default function ConventionModels() {
  const [models, setModels] = useState([]);
  const [demos, setDemos] = useState([]);
  useEffect(() => {
    api.get("/conventions/models").then(({ data }) => {
      setModels(data.items); setDemos(data.demos);
    });
  }, []);

  return (
    <div className="p-6" data-testid="convention-models-page">
      <h1 className="font-display text-3xl font-bold tracking-tight mb-1">Conventions modèles</h1>
      <p className="text-sm opacity-70 mb-6">
        6 modèles de bonne pratique (PSA AIPN, NRGI, CNUDM, REDD+, Vision minière UA, Joint-Venture CNUCED) +
        6 conventions de référence anonymisées.
      </p>

      <div className="grid lg:grid-cols-2 gap-4 mb-8">
        {models.map((m) => (
          <div key={m.id} className="rap-card p-5" data-testid={`model-${m.id}`}>
            <div className="flex items-start justify-between mb-2">
              <Award size={20} style={{ color: SECTOR_BADGES[m.sector] || "#D4A017" }} />
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm font-semibold"
                style={{ background: `${SECTOR_BADGES[m.sector]}22`, color: SECTOR_BADGES[m.sector] }}>
                {m.sector}
              </span>
            </div>
            <h3 className="font-display font-bold text-base mb-1">{m.name}</h3>
            <p className="text-xs opacity-60 mb-2">{m.source}</p>
            <p className="text-xs opacity-80 mb-3 leading-relaxed">{m.description}</p>
            <div className="grid grid-cols-2 gap-1 text-[11px]">
              {Object.entries(m.key_clauses).map(([k, v]) => (
                <div key={k} className="border rounded-sm px-2 py-1"
                  style={{ borderColor: "hsl(var(--border))" }}>
                  <span className="opacity-60 capitalize">{k.replace(/_/g, ' ')} :</span>{" "}
                  <b className="font-mono">{v}</b>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t flex items-center justify-between"
              style={{ borderColor: "hsl(var(--border))" }}>
              <span className="text-[10px] uppercase tracking-wider opacity-60">Score conformité</span>
              <span className="font-mono font-bold text-lg" style={{ color: "#27AE60" }}>{m.compliance_score}/100</span>
            </div>
          </div>
        ))}
      </div>

      <h2 className="font-display text-xl font-bold mb-3 flex items-center gap-2">
        <FileText size={18} style={{ color: "#D4A017" }} />
        Conventions de démonstration
      </h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {demos.map((d) => (
          <div key={d.id} className="rap-card p-4" data-testid={`demo-${d.id}`}>
            <div className="font-display font-bold text-sm mb-1">{d.name}</div>
            <div className="text-xs opacity-60 mb-2 font-mono">
              {d.country} · {d.sector} · {d.year}
            </div>
            <p className="text-xs opacity-80 mb-2">{d.company}</p>
            <div className="text-[10px] uppercase tracking-wider opacity-60 mb-1 mt-3">Issues détectées</div>
            <ul className="text-[11px] space-y-1">
              {d.issues_detected.slice(0, 4).map((iss, i) => (
                <li key={i} className="flex items-start gap-1">
                  <AlertTriangle size={10} style={{ color: "#E67E22" }} className="mt-0.5 flex-shrink-0" />
                  <span>{iss}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

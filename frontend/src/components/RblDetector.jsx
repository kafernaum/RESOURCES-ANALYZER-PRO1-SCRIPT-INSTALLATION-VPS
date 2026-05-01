import { useState } from "react";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Loader2, ShieldAlert, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function RblDetector({ projectId }) {
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState(null);

  const run = async () => {
    setBusy(true);
    try {
      const { data } = await api.get(`/projects/${projectId}/rbl-detector`);
      setData(data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally { setBusy(false); }
  };

  const colorByRisk = { faible: "#27AE60", modere: "#E67E22", eleve: "#C0392B" };

  return (
    <div className="rap-card p-5" data-testid="rbl-panel">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-display text-base font-bold flex items-center gap-2">
            <ShieldAlert size={18} style={{ color: "#D4A017" }} />
            Détecteur Resource-Backed Loan (RBL)
          </h3>
          <p className="text-xs opacity-70 mt-1">
            Identifie les clauses suggérant un prêt adossé aux ressources naturelles
            (risque de double aliénation, "Suite Ahmed ELY Mustapha").
          </p>
        </div>
        <Button onClick={run} disabled={busy} size="sm"
          className="rounded-sm font-semibold"
          style={{ background: "#1A3C5E", color: "white" }}
          data-testid="rbl-run-btn">
          {busy ? <Loader2 size={12} className="mr-1 animate-spin" /> : <ShieldAlert size={12} className="mr-1" />}
          Analyser
        </Button>
      </div>

      {data && (
        <div className="space-y-3" data-testid="rbl-result">
          <div className="flex items-center gap-4 p-4 border rounded-sm"
            style={{ borderColor: colorByRisk[data.risque], background: `${colorByRisk[data.risque]}10` }}>
            <div>
              <div className="font-mono text-3xl font-bold" style={{ color: colorByRisk[data.risque] }}>
                {data.score_rbl}
              </div>
              <div className="text-[10px] uppercase opacity-60">/100</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold" style={{ color: colorByRisk[data.risque] }}>
                Risque {data.risque}
              </div>
              <div className="text-xs opacity-80 mt-1">{data.markers.length} marqueur(s) détecté(s)</div>
            </div>
            {data.risque === "faible" ? (
              <CheckCircle2 size={28} style={{ color: colorByRisk[data.risque] }} className="ml-auto" />
            ) : (
              <AlertTriangle size={28} style={{ color: colorByRisk[data.risque] }} className="ml-auto" />
            )}
          </div>

          {data.markers.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider opacity-70 mb-2">Marqueurs RBL détectés</div>
              <div className="flex flex-wrap gap-2">
                {data.markers.map((m, i) => (
                  <span key={i} className="font-mono text-[11px] px-2 py-1 rounded-sm"
                    style={{ background: "rgba(192,57,43,0.1)", color: "#C0392B" }}>
                    {m.keyword} (+{m.weight})
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs opacity-80 leading-relaxed border-l-2 pl-3"
            style={{ borderColor: "rgba(212,160,23,0.5)" }}>
            {data.explanation}
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider opacity-70 mb-2">Recommandations</div>
            <ul className="text-xs space-y-1 list-disc list-inside opacity-90">
              {data.recommandations.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

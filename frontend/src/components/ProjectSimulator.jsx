import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Sliders, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";

export default function ProjectSimulator({ projectId }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [proposed, setProposed] = useState({
    royalty_rate: "",
    is_rate: "",
    state_share_psa: "",
    duration_years: "",
    production_annual: "",
    price: "",
  });

  const run = async (overrides = null) => {
    setBusy(true);
    try {
      const body = {};
      const src = overrides || proposed;
      Object.entries(src).forEach(([k, v]) => {
        if (v !== "" && v !== null && v !== undefined) body[k] = Number(v);
      });
      const { data } = await api.post(`/projects/${projectId}/simulator/run`, body);
      setResult(data);
      // Initial fill with baseline if needed
      if (!overrides) {
        const b = data.baseline_input || {};
        setProposed((p) => {
          const filled = { ...p };
          Object.entries(b).forEach(([k, v]) => {
            if (!filled[k]) filled[k] = v;
          });
          return filled;
        });
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur simulation");
    } finally { setBusy(false); }
  };

  // Auto-run baseline on mount
  useEffect(() => { run({}); }, []);

  const fields = [
    { key: "royalty_rate", label: "Royalties (%)", unit: "%" },
    { key: "is_rate", label: "Impôt sur les sociétés (%)", unit: "%" },
    { key: "state_share_psa", label: "Part État PSA (%)", unit: "%" },
    { key: "duration_years", label: "Durée (ans)", unit: "ans" },
    { key: "production_annual", label: "Production annuelle", unit: "unités" },
    { key: "price", label: "Prix de référence", unit: "USD" },
  ];

  return (
    <div className="space-y-4" data-testid="project-simulator">
      <div className="rap-card p-5">
        <h2 className="font-display text-lg font-bold mb-1 flex items-center gap-2">
          <Sliders size={18} style={{ color: "#D4A017" }} />
          Simulateur lié à ce projet
        </h2>
        <p className="text-xs opacity-70 mb-4">
          Modifiez les paramètres fiscaux et observez l'impact en temps réel sur les recettes
          de l'État (baseline = paramètres actuels de la convention).
        </p>
        <div className="grid md:grid-cols-3 gap-3 mb-4">
          {fields.map((f) => (
            <div key={f.key}>
              <Label className="text-[10px] uppercase tracking-wider opacity-70">{f.label}</Label>
              <Input type="number" step="0.1" className="rounded-sm mt-1"
                value={proposed[f.key]}
                onChange={(e) => setProposed((p) => ({ ...p, [f.key]: e.target.value }))}
                data-testid={`sim-input-${f.key}`} />
            </div>
          ))}
        </div>
        <Button onClick={() => run()} disabled={busy}
          className="rounded-sm font-semibold"
          style={{ background: "#1B4332", color: "white" }}
          data-testid="sim-run-btn">
          {busy ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Sliders size={14} className="mr-2" />}
          Simuler
        </Button>
      </div>

      {result && (
        <div className="rap-card p-5" data-testid="sim-result">
          <h3 className="font-display text-base font-bold mb-3">Impact proposé vs baseline</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <DiffCard label="Part de l'État" unit="%"
              base={result.diff?.part_etat_pct?.baseline}
              prop={result.diff?.part_etat_pct?.proposed}
              delta={result.diff?.part_etat_pct?.delta}
              deltaPct={result.diff?.part_etat_pct?.delta_pct}
              higherIsBetter />
            <DiffCard label="Recettes État annuelles" unit=" USD" divisor={1e6} suffix=" M"
              base={result.diff?.recettes_etat_annuelles?.baseline}
              prop={result.diff?.recettes_etat_annuelles?.proposed}
              delta={result.diff?.recettes_etat_annuelles?.delta}
              deltaPct={result.diff?.recettes_etat_annuelles?.delta_pct}
              higherIsBetter />
            <DiffCard label="Recettes État totales" unit=" USD" divisor={1e9} suffix=" Mrd"
              base={result.diff?.recettes_etat_totales?.baseline}
              prop={result.diff?.recettes_etat_totales?.proposed}
              delta={result.diff?.recettes_etat_totales?.delta}
              deltaPct={result.diff?.recettes_etat_totales?.delta_pct}
              higherIsBetter />
            <DiffCard label="Valeur totale gisement" unit=" USD" divisor={1e9} suffix=" Mrd"
              base={result.diff?.valeur_totale_gisement?.baseline}
              prop={result.diff?.valeur_totale_gisement?.proposed}
              delta={result.diff?.valeur_totale_gisement?.delta}
              deltaPct={result.diff?.valeur_totale_gisement?.delta_pct} />
          </div>
        </div>
      )}
    </div>
  );
}

function DiffCard({ label, base, prop, delta, deltaPct, unit = "", divisor = 1, suffix = "", higherIsBetter = false }) {
  const fmt = (v) => (v == null ? "—" : (v / divisor).toLocaleString("fr-FR", { maximumFractionDigits: 2 }));
  const good = higherIsBetter ? delta > 0 : delta < 0;
  const color = delta === 0 ? "#1A3C5E" : (good ? "#27AE60" : "#C0392B");
  const Arrow = delta > 0 ? TrendingUp : TrendingDown;
  return (
    <div className="border rounded-sm p-4" style={{ borderColor: "hsl(var(--border))" }}>
      <div className="text-[10px] uppercase tracking-wider opacity-70 mb-2">{label}</div>
      <div className="flex items-end gap-4">
        <div>
          <div className="text-[10px] opacity-60">Baseline</div>
          <div className="font-mono text-lg">{fmt(base)}{suffix}</div>
        </div>
        <div>
          <div className="text-[10px] opacity-60">Proposé</div>
          <div className="font-mono text-lg font-bold">{fmt(prop)}{suffix}</div>
        </div>
        {delta != null && delta !== 0 && (
          <div className="ml-auto flex items-center gap-1" style={{ color }}>
            <Arrow size={14} />
            <span className="font-mono text-sm font-bold">
              {delta > 0 ? "+" : ""}{deltaPct?.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

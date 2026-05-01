import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Slider } from "../components/ui/slider";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Sliders, RotateCcw, Loader2 } from "lucide-react";
import LegalDisclaimer from "../components/LegalDisclaimer";

const DEFAULTS = {
  royalty_rate: 5, is_rate: 25, local_content: 30,
  duration_years: 25, state_share_psa: 60,
  production_annual: 1_000_000, price: 100,
};

export default function Simulator() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [params, setParams] = useState(DEFAULTS);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/projects").then(({ data }) => setProjects(data));
  }, []);

  const update = (k, v) => setParams((p) => ({ ...p, [k]: Array.isArray(v) ? v[0] : v }));

  const run = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/simulator/run", {
        project_id: projectId || "demo",
        ...params,
      });
      setResult(data);
    } finally { setLoading(false); }
  };

  // auto-run
  useEffect(() => {
    const t = setTimeout(run, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [params]);

  return (
    <div className="p-6" data-testid="simulator-page">
      <h1 className="font-display text-3xl font-bold tracking-tight mb-1 flex items-center gap-2">
        <Sliders style={{ color: "#D4A017" }} />
        Simulateur de renégociation
      </h1>
      <p className="text-sm opacity-70 mb-4">
        Ajustez les paramètres en temps réel et observez l'impact sur les recettes de l'État.
      </p>
      <LegalDisclaimer compact />

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <div className="rap-card p-6 space-y-5">
          <SliderRow label="Royalties (%)" value={params.royalty_rate} onChange={(v) => update("royalty_rate", v)} min={0} max={30} step={0.5} unit="%" testid="slider-royalty" />
          <SliderRow label="Impôt sur les sociétés (%)" value={params.is_rate} onChange={(v) => update("is_rate", v)} min={0} max={50} step={1} unit="%" testid="slider-is" />
          <SliderRow label="Contenu local (%)" value={params.local_content} onChange={(v) => update("local_content", v)} min={0} max={100} step={5} unit="%" testid="slider-local-content" />
          <SliderRow label="Durée du contrat (années)" value={params.duration_years} onChange={(v) => update("duration_years", v)} min={5} max={75} step={1} unit=" ans" testid="slider-duration" />
          <SliderRow label="Part État dans le profit oil (%)" value={params.state_share_psa} onChange={(v) => update("state_share_psa", v)} min={0} max={90} step={1} unit="%" testid="slider-psa" />
          <SliderRow label="Production annuelle (unités)" value={params.production_annual} onChange={(v) => update("production_annual", v)} min={0} max={50_000_000} step={100_000} unit="" testid="slider-production" />
          <SliderRow label="Prix de référence (USD/unité)" value={params.price} onChange={(v) => update("price", v)} min={0} max={500} step={1} unit=" USD" testid="slider-price" />

          <div className="flex gap-2 pt-2">
            <Button onClick={() => setParams(DEFAULTS)} variant="outline" className="rounded-sm" data-testid="reset-params">
              <RotateCcw size={14} className="mr-1" /> Réinitialiser
            </Button>
            <Button onClick={run} disabled={loading} className="rounded-sm font-semibold"
              style={{ background: "#1B4332", color: "white" }} data-testid="recompute">
              {loading && <Loader2 size={14} className="mr-2 animate-spin" />}
              Recalculer
            </Button>
          </div>
        </div>

        <div className="rap-card p-6">
          <h2 className="font-display text-lg font-bold mb-4">Impact en temps réel</h2>
          {result ? (
            <div className="space-y-3" data-testid="simulator-results">
              <Result label="Revenus annuels"
                value={`${(result.revenus_annuels / 1e9).toFixed(2)} Mrd USD`}
                color="#1A3C5E" />
              <Result label="Valeur totale du gisement"
                value={`${(result.valeur_totale_gisement / 1e9).toFixed(2)} Mrd USD`} color="#D4A017" />
              <Result label="Recettes État annuelles"
                value={`${(result.recettes_etat_annuelles / 1e6).toFixed(1)} M USD`} color="#27AE60" />
              <Result label="Recettes État totales"
                value={`${(result.recettes_etat_totales / 1e9).toFixed(2)} Mrd USD`} color="#27AE60" />
              <div className="pt-3 border-t" style={{ borderColor: "hsl(var(--border))" }}>
                <Result label="Part de l'État"
                  value={`${result.part_etat_pct}%`}
                  color={result.part_etat_pct < 30 ? "#C0392B" : result.part_etat_pct < 50 ? "#E67E22" : "#27AE60"} large />
              </div>
              <div className="pt-3 border-t text-xs opacity-70 space-y-1 font-mono"
                style={{ borderColor: "hsl(var(--border))" }}>
                <div>Royalties / an : {(result.decomposition.royalty_an / 1e6).toFixed(2)} M USD</div>
                <div>IS / an : {(result.decomposition.is_an / 1e6).toFixed(2)} M USD</div>
                <div>PSA / an : {(result.decomposition.psa_an / 1e6).toFixed(2)} M USD</div>
              </div>
            </div>
          ) : (
            <div className="opacity-60 text-sm">Calcul en cours...</div>
          )}
        </div>
      </div>
    </div>
  );
}

function SliderRow({ label, value, onChange, min, max, step, unit, testid }) {
  return (
    <div data-testid={testid}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wider opacity-70">{label}</span>
        <span className="font-mono font-bold text-sm">{typeof value === "number" ? value.toLocaleString("fr-FR") : value}{unit}</span>
      </div>
      <Slider value={[value]} onValueChange={onChange} min={min} max={max} step={step} className="rap-slider" />
    </div>
  );
}

function Result({ label, value, color, large }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider opacity-60 mb-0.5">{label}</div>
      <div className={`font-mono font-bold ${large ? "text-3xl" : "text-lg"}`} style={{ color }}>{value}</div>
    </div>
  );
}

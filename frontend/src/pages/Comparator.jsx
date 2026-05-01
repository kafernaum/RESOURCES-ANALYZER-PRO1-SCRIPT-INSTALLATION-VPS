import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Loader2, GitCompareArrows, Trophy, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function Comparator() {
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.get("/projects").then(({ data }) => setProjects(data));
  }, []);

  const toggle = (id) => {
    setSelected((s) => s.includes(id)
      ? s.filter((x) => x !== id)
      : (s.length >= 4 ? s : [...s, id]));
  };

  const run = async () => {
    if (selected.length < 2) {
      toast.error("Sélectionnez au moins 2 projets.");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const { data } = await api.post("/comparator/run", { project_ids: selected });
      setResult(data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally { setBusy(false); }
  };

  return (
    <div className="p-6" data-testid="comparator-page">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-2">
          <GitCompareArrows size={28} style={{ color: "#D4A017" }} />
          Comparateur de conventions
        </h1>
        <p className="text-sm opacity-70 mt-1">
          Comparez 2 à 4 conventions côte à côte sur tous les indicateurs.
        </p>
      </div>

      <div className="rap-card p-5 mb-4">
        <h2 className="font-display text-lg font-bold mb-3">
          Sélectionnez les projets ({selected.length}/4)
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
          {projects.map((p) => {
            const isSel = selected.includes(p.id);
            return (
              <button key={p.id} onClick={() => toggle(p.id)}
                className="text-left border rounded-sm p-3 transition-all hover:shadow-sm"
                style={isSel
                  ? { borderColor: "#D4A017", background: "rgba(212, 160, 23, 0.1)" }
                  : { borderColor: "hsl(var(--border))" }}
                data-testid={`comp-select-${p.id}`}>
                <div className="font-semibold text-sm truncate">{p.name}</div>
                <div className="text-xs opacity-70 mt-1">
                  {p.country} · {p.sector} {p.resource_type ? `· ${p.resource_type}` : ""}
                </div>
              </button>
            );
          })}
        </div>
        <Button onClick={run} disabled={busy || selected.length < 2}
          title={selected.length < 2 ? "Sélectionnez au moins 2 projets" : ""}
          className="mt-4 rounded-sm font-semibold"
          style={{ background: "#1B4332", color: "white" }}
          data-testid="comp-run-btn">
          {busy ? <Loader2 size={14} className="mr-2 animate-spin" /> : <GitCompareArrows size={14} className="mr-2" />}
          Comparer
        </Button>
        {selected.length < 2 && (
          <span className="ml-3 text-xs opacity-60">Sélectionnez au moins 2 projets</span>
        )}
      </div>

      {result && <ComparisonView result={result} />}
    </div>
  );
}

function ComparisonView({ result }) {
  const items = result.comparisons || [];
  const ranking = result.ranking || [];
  const winner = ranking[0];

  const rows = [
    { label: "Score Global", get: (i) => i.summary?.score_global, suffix: "/100", best: "max" },
    { label: "Score Juridique", get: (i) => i.summary?.score_juridique, suffix: "/100", best: "max" },
    { label: "Score SEC", get: (i) => i.summary?.score_sec, suffix: "/100", best: "max" },
    { label: "Score SSC", get: (i) => i.summary?.score_ssc, suffix: "/100", best: "max" },
    { label: "Score Souveraineté", get: (i) => i.summary?.score_sos, suffix: "/100", best: "max" },
    { label: "Violations critiques", get: (i) => i.summary?.compteurs?.violations_critiques || 0, best: "min" },
    { label: "Violations graves", get: (i) => i.summary?.compteurs?.violations_graves || 0, best: "min" },
    { label: "Clauses abusives", get: (i) => i.summary?.compteurs?.clauses_abusives || 0, best: "min" },
    { label: "Royalties %", get: (i) => i.financier?.royalties_taux, suffix: "%", best: "max" },
    { label: "Part de l'État %", get: (i) => i.financier?.part_etat_pct, suffix: "%", best: "max" },
    { label: "Manque à gagner total (M USD)",
      get: (i) => Math.round((i.financier?.manque_a_gagner_total || 0) / 1e6 * 10) / 10,
      best: "min" },
    { label: "Élément don %",
      get: (i) => Math.round((i.financier?.element_don_fiscal || 0) * 1000) / 10,
      suffix: "%", best: "min" },
  ];

  const bestIndex = (row) => {
    const vals = items.map((it) => Number(row.get(it) ?? 0));
    if (row.best === "max") return vals.indexOf(Math.max(...vals));
    return vals.indexOf(Math.min(...vals));
  };

  return (
    <div className="space-y-4" data-testid="comp-result">
      <div className="rap-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={18} style={{ color: "#D4A017" }} />
          <h3 className="font-display text-base font-bold">
            Convention la plus équilibrée :{" "}
            <span style={{ color: "#27AE60" }}>
              {items.find((i) => i.project.id === winner)?.project.name}
            </span>
          </h3>
        </div>
        <p className="text-xs opacity-70">
          Classement basé sur le score global. Plus le score est élevé, plus la convention
          est conforme aux standards internationaux.
        </p>
      </div>

      <div className="rap-card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "#1B4332", color: "white" }}>
              <th className="text-left p-3 font-semibold">Indicateur</th>
              {items.map((it) => (
                <th key={it.project.id} className="text-center p-3 font-semibold">
                  <div className="text-xs">{it.project.name}</div>
                  <div className="text-[10px] opacity-80 font-normal">
                    {it.project.country} · {it.project.sector}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const best = bestIndex(r);
              return (
                <tr key={i} className="border-t" style={{ borderColor: "hsl(var(--border))" }}>
                  <td className="p-3 text-xs font-semibold opacity-80">{r.label}</td>
                  {items.map((it, j) => {
                    const val = r.get(it);
                    const isBest = j === best && items.length > 1;
                    return (
                      <td key={it.project.id} className="text-center p-3 font-mono text-xs"
                        style={isBest ? { background: "rgba(39, 174, 96, 0.12)", color: "#27AE60", fontWeight: "bold" } : {}}>
                        {val ?? "—"}{val !== null && val !== undefined ? (r.suffix || "") : ""}
                        {isBest && <span className="ml-1">★</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rap-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={16} style={{ color: "#E67E22" }} />
          <h3 className="font-display text-base font-bold">Lecture comparative</h3>
        </div>
        <ul className="text-xs space-y-2 opacity-90">
          <li>★ = meilleure valeur de la ligne (vert = favorable à l'État/peuple).</li>
          <li>Pour les <b>scores</b> : plus la valeur est élevée, mieux c'est.</li>
          <li>Pour les <b>violations</b>, <b>manque à gagner</b> et <b>élément don</b> : plus la valeur est faible, mieux c'est.</li>
          <li>Le <b>classement</b> agrège tous les indicateurs via le score global.</li>
        </ul>
      </div>
    </div>
  );
}

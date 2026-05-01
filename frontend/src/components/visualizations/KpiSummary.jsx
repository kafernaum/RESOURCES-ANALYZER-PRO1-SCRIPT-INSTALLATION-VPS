import { Scale, Sprout, Users, ShieldCheck, AlertTriangle, TrendingDown, Coins, Gauge } from "lucide-react";

const LEVEL_COLOR = {
  conforme: "#27AE60",
  attention: "#E67E22",
  grave: "#C0392B",
  critique: "#C0392B",
};

function ScorePill({ score, niveau, label, icon: Icon }) {
  const c = LEVEL_COLOR[niveau] || "#1A3C5E";
  return (
    <div className="rap-card p-4" data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider opacity-60">{label}</span>
        <Icon size={14} style={{ color: c }} />
      </div>
      <div className="font-mono text-3xl font-bold leading-none" style={{ color: c }}>
        {score || 0}
      </div>
      <div className="text-[10px] opacity-60 mt-1 font-mono">/100</div>
      <div className="mt-2 h-1.5 rounded-sm bg-secondary overflow-hidden">
        <div className="h-full rounded-sm transition-all"
          style={{ width: `${score || 0}%`, background: c }} />
      </div>
    </div>
  );
}

function CounterCard({ value, label, icon: Icon, color }) {
  return (
    <div className="rap-card p-4" data-testid={`counter-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider opacity-60">{label}</span>
        <Icon size={14} style={{ color }} />
      </div>
      <div className="font-mono text-3xl font-bold leading-none" style={{ color }}>{value || 0}</div>
    </div>
  );
}

export default function KpiSummary({ summary }) {
  if (!summary) return null;
  const c = summary.compteurs || {};
  const f = summary.indicateurs_financiers || {};
  const niv = (n) => (n >= 80 ? "conforme" : n >= 60 ? "attention" : n >= 40 ? "grave" : "critique");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="kpi-scores-row">
        <ScorePill score={summary.score_juridique} niveau={niv(summary.score_juridique)} label="Score Juridique" icon={Scale} />
        <ScorePill score={summary.score_sec} niveau={niv(summary.score_sec)} label="Score Environnement (SEC)" icon={Sprout} />
        <ScorePill score={summary.score_ssc} niveau={niv(summary.score_ssc)} label="Score Social (SSC)" icon={Users} />
        <ScorePill score={summary.score_sos} niveau={niv(summary.score_sos)} label="Score Souveraineté (SOS)" icon={ShieldCheck} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="kpi-financial-row">
        <CounterCard value={`${f.part_etat_pct || 0}%`} label="Part de l'État" icon={Coins} color="#D4A017" />
        <CounterCard value={`${((f.manque_a_gagner_an || 0) / 1e6).toFixed(1)}M`} label="Manque à gagner / an" icon={TrendingDown} color="#C0392B" />
        <CounterCard value={f.idc || 0} label="IDC" icon={Gauge} color="#1A3C5E" />
        <CounterCard value={Math.round(summary.score_global || 0)} label="Score Global" icon={ShieldCheck} color={LEVEL_COLOR[summary.niveau_global] || "#1B4332"} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="kpi-alerts-row">
        <CounterCard value={c.violations_critiques || 0} label="Violations critiques" icon={AlertTriangle} color="#C0392B" />
        <CounterCard value={c.violations_graves || 0} label="Violations graves" icon={AlertTriangle} color="#E67E22" />
        <CounterCard value={c.clauses_abusives || 0} label="Clauses abusives" icon={AlertTriangle} color="#E67E22" />
        <CounterCard value={c.violations_droit_national || 0} label="Violations droit national" icon={Scale} color="#C0392B" />
      </div>
    </div>
  );
}

import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line, ReferenceLine,
} from "recharts";

const COLORS = {
  primary: "#1B4332", secondary: "#D4A017", tertiary: "#1A3C5E",
  alert: "#C0392B", warning: "#E67E22", equilibrium: "#27AE60",
};

export default function VizGrid({ analyses, project }) {
  const fin = analyses?.financier;
  const env = analyses?.environnemental;
  const soc = analyses?.social;
  const sov = analyses?.souverainete;
  const desq = analyses?.desequilibre;
  const jur = analyses?.juridique;

  // Radar data
  const radarData = [
    { axis: "Fiscalité", convention: fin ? Math.min(100, (fin.part_etat_pct || 0) * 2) : 0, std: 60 },
    { axis: "Environnement", convention: env?.score_sec || 0, std: 80 },
    { axis: "Social", convention: soc?.score_ssc || 0, std: 80 },
    { axis: "Souveraineté", convention: sov?.score_sos || 0, std: 80 },
    { axis: "Droits communautés", convention: soc ? (soc.components?.find(c => c.code === "S6")?.score / 5 * 100 || 0) : 0, std: 80 },
    { axis: "Transparence", convention: 60, std: 90 },
  ];

  // Donut — partage revenus
  const donut = fin ? [
    { name: "Royalties (État)", value: fin.decomposition_recettes?.royalties_an || 0, color: COLORS.secondary },
    { name: "IS (État)", value: fin.decomposition_recettes?.is_an || 0, color: COLORS.tertiary },
    { name: "PSA (État)", value: fin.decomposition_recettes?.psa_an || 0, color: COLORS.equilibrium },
    { name: "Reste (Entreprise)", value: Math.max(0, (fin.revenus_annuels || 0) - (fin.recettes_etat_annuelles || 0)), color: COLORS.alert },
  ] : [];

  // Bar — benchmarking
  const bench = fin ? [
    { name: "Royalties Min", actual: fin.royalties_taux, bench: fin.royalties_benchmark_min, color: COLORS.alert },
    { name: "Royalties Max", actual: fin.royalties_taux, bench: fin.royalties_benchmark_max, color: COLORS.equilibrium },
  ] : [];

  // Scenarios
  const scenarios = fin?.scenarios_prix ? [
    { scenario: "Bas", recettes: (fin.scenarios_prix.bas?.recettes_etat_total || 0) / 1e9 },
    { scenario: "Central", recettes: (fin.scenarios_prix.central?.recettes_etat_total || 0) / 1e9 },
    { scenario: "Haut", recettes: (fin.scenarios_prix.haut?.recettes_etat_total || 0) / 1e9 },
  ] : [];

  // Violations bar
  const violationsByType = jur ? [
    { type: "Droit international", count: (jur.violations_droit_international || []).length, color: COLORS.alert },
    { type: "Droit national", count: (jur.violations_droit_national || []).length, color: COLORS.warning },
    { type: "Clauses abusives", count: (jur.clauses_abusives || []).length, color: COLORS.tertiary },
    { type: "Déséquilibres", count: (jur.desequilibres_contractuels || []).length, color: COLORS.secondary },
  ] : [];

  // IDC bars per dimension
  const idcDims = desq?.dimensions || [];

  if (!fin && !env && !soc && !sov && !jur) return null;

  return (
    <div className="grid lg:grid-cols-2 gap-4" data-testid="viz-grid">
      {/* Radar */}
      <ChartCard title="Profil de la convention (Radar 6 axes)" testid="viz-radar">
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="rgba(212, 160, 23, 0.3)" />
            <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "currentColor" }} />
            <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "currentColor" }} />
            <Radar name="Convention" dataKey="convention" stroke={COLORS.alert} fill={COLORS.alert} fillOpacity={0.4} />
            <Radar name="Standard de référence" dataKey="std" stroke={COLORS.secondary} fill={COLORS.secondary} fillOpacity={0.2} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Donut partage revenus */}
      {donut.length > 0 && (
        <ChartCard title="Partage annuel des revenus (donut)" testid="viz-donut">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={donut} dataKey="value" nameKey="name" cx="50%" cy="50%"
                innerRadius={70} outerRadius={110} paddingAngle={2}>
                {donut.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip formatter={(v) => `${(v / 1e6).toFixed(1)} M USD/an`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Benchmarking */}
      {bench.length > 0 && (
        <ChartCard title="Benchmarking royalties — Convention vs Référence" testid="viz-bench">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={[
              { name: "Convention", value: fin.royalties_taux, color: fin.royalties_taux < fin.royalties_benchmark_min ? COLORS.alert : COLORS.equilibrium },
              { name: "Min benchmark", value: fin.royalties_benchmark_min, color: COLORS.tertiary },
              { name: "Max benchmark", value: fin.royalties_benchmark_max, color: COLORS.secondary },
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 160, 23, 0.15)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "currentColor" }} />
              <YAxis unit="%" tick={{ fontSize: 11, fill: "currentColor" }} />
              <Tooltip />
              <Bar dataKey="value">
                {[
                  fin.royalties_taux < fin.royalties_benchmark_min ? COLORS.alert : COLORS.equilibrium,
                  COLORS.tertiary, COLORS.secondary,
                ].map((c, i) => (<Cell key={i} fill={c} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Scenarios */}
      {scenarios.length > 0 && (
        <ChartCard title="3 scénarios — Recettes État sur la durée (Mrd USD)" testid="viz-scenarios">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={scenarios}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 160, 23, 0.15)" />
              <XAxis dataKey="scenario" tick={{ fontSize: 11, fill: "currentColor" }} />
              <YAxis tick={{ fontSize: 11, fill: "currentColor" }} unit=" Mrd" />
              <Tooltip formatter={(v) => `${v.toFixed(2)} Mrd USD`} />
              <Line type="monotone" dataKey="recettes" stroke={COLORS.secondary} strokeWidth={3}
                dot={{ r: 6, fill: COLORS.secondary }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Violations by corpus */}
      {violationsByType.some(v => v.count > 0) && (
        <ChartCard title="Violations par corpus normatif" testid="viz-violations">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={violationsByType} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 160, 23, 0.15)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "currentColor" }} />
              <YAxis dataKey="type" type="category" tick={{ fontSize: 11, fill: "currentColor" }} width={150} />
              <Tooltip />
              <Bar dataKey="count">
                {violationsByType.map((v, i) => <Cell key={i} fill={v.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* IDC per dimension */}
      {idcDims.length > 0 && (
        <ChartCard title="Déséquilibre contractuel par dimension (IDC)" testid="viz-idc">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={idcDims}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 160, 23, 0.15)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "currentColor" }} angle={-15} textAnchor="end" height={60} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "currentColor" }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="etat" fill={COLORS.primary} name="Droits État" />
              <Bar dataKey="entreprise" fill={COLORS.secondary} name="Droits Entreprise" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* SEC components */}
      {env?.components && (
        <ChartCard title="Composantes SEC — Score Environnemental" testid="viz-sec">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={env.components} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 160, 23, 0.15)" />
              <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11, fill: "currentColor" }} />
              <YAxis dataKey="label" type="category" tick={{ fontSize: 10, fill: "currentColor" }} width={170} />
              <Tooltip />
              <Bar dataKey="score" fill={COLORS.equilibrium} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* SSC components */}
      {soc?.components && (
        <ChartCard title="Composantes SSC — Score Social" testid="viz-ssc">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={soc.components} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 160, 23, 0.15)" />
              <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11, fill: "currentColor" }} />
              <YAxis dataKey="label" type="category" tick={{ fontSize: 10, fill: "currentColor" }} width={170} />
              <Tooltip />
              <Bar dataKey="score" fill={COLORS.tertiary} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}

function ChartCard({ title, children, testid }) {
  return (
    <div className="rap-card p-4" data-testid={testid}>
      <h3 className="font-display text-sm font-bold mb-2">{title}</h3>
      <div className="rap-divider-gold w-12 mb-3" />
      {children}
    </div>
  );
}

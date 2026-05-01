import {
  Treemap, ScatterChart, Scatter, ZAxis, ResponsiveContainer, Tooltip,
  XAxis, YAxis, CartesianGrid, Cell,
  ComposedChart, Bar, Line, Area, AreaChart, ReferenceLine,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
} from "recharts";

const COLORS = {
  primary: "#1B4332", secondary: "#D4A017", tertiary: "#1A3C5E",
  alert: "#C0392B", warning: "#E67E22", equilibrium: "#27AE60",
};

export default function AdvancedViz({ analyses, project }) {
  const fin = analyses?.financier;
  const env = analyses?.environnemental;
  const soc = analyses?.social;
  const sov = analyses?.souverainete;
  const desq = analyses?.desequilibre;
  const jur = analyses?.juridique;

  // ----- Treemap of clauses -----
  const treemapData = jur ? [
    ...(jur.violations_droit_international || []).map((v) => ({
      name: `Intl: ${(v.norme_violee || "?")}`,
      size: v.gravite === "critique" ? 100 : v.gravite === "grave" ? 70 : 40,
      color: COLORS.alert,
    })),
    ...(jur.violations_droit_national || []).map((v) => ({
      name: `Nat: ${(v.code_national_viole || "?")}`,
      size: v.gravite === "critique" ? 90 : v.gravite === "grave" ? 60 : 30,
      color: COLORS.warning,
    })),
    ...(jur.clauses_abusives || []).map((c) => ({
      name: `Abus: ${c.type_abus || "?"}`,
      size: c.gravite === "critique" ? 80 : c.gravite === "grave" ? 50 : 25,
      color: COLORS.tertiary,
    })),
    ...(jur.desequilibres_contractuels || []).map((d) => ({
      name: `Déséq: ${d.type || "?"}`,
      size: 35, color: COLORS.secondary,
    })),
  ].filter(Boolean) : [];

  // ----- Scatter clauses abusives (gravité × impact) -----
  const gravityNum = { mineure: 1, moderee: 2, grave: 4, critique: 5 };
  const scatterData = jur ? [
    ...(jur.violations_droit_international || []).map((v, i) => ({
      x: gravityNum[v.gravite] || 2,
      y: 4,
      z: 200,
      name: `Int. ${i + 1}: ${(v.norme_violee || "")}`,
      type: "intl",
      color: COLORS.alert,
    })),
    ...(jur.violations_droit_national || []).map((v, i) => ({
      x: gravityNum[v.gravite] || 2,
      y: 3,
      z: 180,
      name: `Nat. ${i + 1}: ${(v.code_national_viole || "")}`,
      type: "nat",
      color: COLORS.warning,
    })),
    ...(jur.clauses_abusives || []).map((c, i) => ({
      x: gravityNum[c.gravite] || 2,
      y: 2,
      z: 150,
      name: `Abus ${i + 1}: ${(c.type_abus || "")}`,
      type: "abus",
      color: COLORS.tertiary,
    })),
  ] : [];

  // ----- Waterfall: flux de revenus État -----
  const waterfallData = fin ? buildWaterfall(fin) : [];

  // ----- Spider obligations sociales -----
  const spiderData = soc?.components?.map((c) => ({
    axis: c.label.replace("Quota ", "").slice(0, 24),
    value: (c.score / c.max) * 100,
    target: 80,
  })) || [];

  // ----- Heatmap obligations: convention timeline -----
  const duration = parseFloat(fin?.duree_contrat_ans) || 25;
  const heatmapYears = Array.from({ length: Math.min(30, duration) }, (_, i) => ({
    year: i + 1,
    obligations: 1 + Math.sin(i * 0.4) * 1 + (i < 3 ? 2 : i > duration - 3 ? 2 : 0.5),
  }));

  if (!fin && !env && !soc && !sov && !jur) return null;

  return (
    <div className="grid lg:grid-cols-2 gap-4" data-testid="advanced-viz">
      {/* Treemap */}
      {treemapData.length > 0 && (
        <ChartCard title="Anatomie de la convention — Treemap" testid="adv-treemap">
          <ResponsiveContainer width="100%" height={320}>
            <Treemap data={treemapData} dataKey="size" stroke="#0D1B12"
              content={<CustomTreemapContent />}>
              <Tooltip content={<CustomTooltip />} />
            </Treemap>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Scatter — Clauses abusives gravité vs impact */}
      {scatterData.length > 0 && (
        <ChartCard title="Cartographie des risques (gravité × type)" testid="adv-scatter">
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 160, 23, 0.15)" />
              <XAxis type="number" dataKey="x" name="Gravité" domain={[0, 6]}
                tick={{ fontSize: 11, fill: "currentColor" }}
                ticks={[1, 2, 4, 5]}
                tickFormatter={(v) => ({ 1: "Mineure", 2: "Modérée", 4: "Grave", 5: "Critique" }[v] || v)} />
              <YAxis type="number" dataKey="y" name="Type" domain={[0, 5]}
                tick={{ fontSize: 11, fill: "currentColor" }}
                ticks={[2, 3, 4]}
                tickFormatter={(v) => ({ 2: "Abus", 3: "Nat.", 4: "Intl." }[v] || "")} />
              <ZAxis type="number" dataKey="z" range={[60, 250]} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  if (active && payload?.[0]) {
                    return <div className="rap-card p-2 text-xs">
                      <div className="font-semibold">{payload[0].payload.name}</div>
                    </div>;
                  }
                  return null;
                }} />
              <Scatter data={scatterData}>
                {scatterData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Waterfall — Flux de revenus État */}
      {waterfallData.length > 0 && (
        <ChartCard title="Décomposition des recettes État (Waterfall, Mrd USD)" testid="adv-waterfall">
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={waterfallData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 160, 23, 0.15)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "currentColor" }} angle={-15} textAnchor="end" height={80} />
              <YAxis tick={{ fontSize: 11, fill: "currentColor" }} unit=" Mrd" />
              <Tooltip />
              <Bar dataKey="value">
                {waterfallData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
              <Line type="monotone" dataKey="cumul" stroke={COLORS.secondary} strokeWidth={2} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Spider obligations sociales */}
      {spiderData.length > 0 && (
        <ChartCard title="Obligations sociales — Spider chart" testid="adv-spider">
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={spiderData}>
              <PolarGrid stroke="rgba(212, 160, 23, 0.3)" />
              <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10, fill: "currentColor" }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "currentColor" }} />
              <Radar name="Convention" dataKey="value" stroke={COLORS.alert} fill={COLORS.alert} fillOpacity={0.4} />
              <Radar name="Cible (80)" dataKey="target" stroke={COLORS.equilibrium} fill={COLORS.equilibrium} fillOpacity={0.15} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Heatmap timeline (using bar chart with intensity) */}
      <ChartCard title={`Calendrier des obligations — durée ${duration} ans`} testid="adv-timeline">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={heatmapYears}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(212, 160, 23, 0.15)" />
            <XAxis dataKey="year" tick={{ fontSize: 10, fill: "currentColor" }} unit=" an" />
            <YAxis tick={{ fontSize: 11, fill: "currentColor" }} hide />
            <Tooltip />
            <Area type="monotone" dataKey="obligations" stroke={COLORS.secondary}
              fill={COLORS.secondary} fillOpacity={0.4} />
            <ReferenceLine y={2} stroke={COLORS.alert} strokeDasharray="3 3" label={{ value: "Seuil critique", fontSize: 10 }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Sankey-like simplified flow chart */}
      {fin && (
        <ChartCard title="Flux des ressources — État vs Entreprise" testid="adv-sankey">
          <SankeyFlow fin={fin} />
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

function CustomTreemapContent(props) {
  const { x, y, width, height, name, value, payload } = props;
  const fill = props.color || (payload && payload.color) || "#1B4332";
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#0D1B12" strokeWidth={2} />
      {width > 60 && height > 30 && (
        <text x={x + 6} y={y + 16} fill="#fff" fontSize="11" fontWeight="600">
          {(name || "").slice(0, Math.floor(width / 7))}
        </text>
      )}
    </g>
  );
}

function CustomTooltip({ active, payload }) {
  if (active && payload?.[0]) {
    const d = payload[0].payload;
    return (
      <div className="rap-card p-2 text-xs">
        <div className="font-semibold">{d.name}</div>
        <div className="opacity-70">Importance : {d.size}</div>
      </div>
    );
  }
  return null;
}

function buildWaterfall(fin) {
  const dr = fin.decomposition_recettes || {};
  const duree = fin.duree_contrat_ans || 25;
  const royaltiesTotal = (dr.royalties_an || 0) * duree / 1e9;
  const isTotal = (dr.is_an || 0) * duree / 1e9;
  const psaTotal = (dr.psa_an || 0) * duree / 1e9;
  const bonus = (dr.bonus_total || 0) / 1e9;
  let cumul = 0;
  const out = [];
  if (bonus > 0) { cumul += bonus; out.push({ name: "Bonus", value: bonus, cumul, color: "#D4A017" }); }
  if (royaltiesTotal > 0) { cumul += royaltiesTotal; out.push({ name: "Royalties", value: royaltiesTotal, cumul, color: "#27AE60" }); }
  if (isTotal > 0) { cumul += isTotal; out.push({ name: "IS", value: isTotal, cumul, color: "#1A3C5E" }); }
  if (psaTotal > 0) { cumul += psaTotal; out.push({ name: "PSA", value: psaTotal, cumul, color: "#1B4332" }); }
  out.push({ name: "Total État", value: cumul, cumul, color: "#D4A017" });
  return out;
}

function SankeyFlow({ fin }) {
  const totalRev = (fin.revenus_annuels || 0) * (fin.duree_contrat_ans || 25);
  const totalEtat = fin.recettes_etat_totales || 0;
  const totalEntr = totalRev - totalEtat;
  const pctEtat = totalRev > 0 ? (totalEtat / totalRev) * 100 : 0;
  const pctEntr = 100 - pctEtat;
  return (
    <div className="space-y-3 py-4">
      <div className="text-xs uppercase tracking-wider opacity-60 mb-2">Sur la durée du contrat</div>
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span>Valeur totale du gisement</span>
          <span className="font-mono font-bold">{(totalRev / 1e9).toFixed(2)} Mrd USD</span>
        </div>
        <div className="h-3 rounded-sm bg-secondary overflow-hidden flex">
          <div style={{ width: "100%", background: "#1A3C5E" }} className="transition-all" />
        </div>
      </div>
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span style={{ color: "#27AE60" }}>↓ Part État ({pctEtat.toFixed(1)}%)</span>
          <span className="font-mono font-bold">{(totalEtat / 1e9).toFixed(2)} Mrd USD</span>
        </div>
        <div className="h-6 rounded-sm flex">
          <div style={{ width: `${Math.max(2, pctEtat)}%`, background: "#27AE60" }} />
          <div style={{ width: `${Math.max(2, pctEntr)}%`, background: "#C0392B", opacity: 0.7 }} />
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span style={{ color: "#27AE60" }}>État</span>
          <span style={{ color: "#C0392B" }}>Entreprise ({pctEntr.toFixed(1)}%)</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs mt-3">
        <div className="border rounded-sm p-2" style={{ borderColor: "rgba(39, 174, 96, 0.4)", background: "rgba(39, 174, 96, 0.06)" }}>
          <div className="text-[10px] uppercase opacity-70" style={{ color: "#27AE60" }}>État</div>
          <div className="font-mono font-bold mt-1">{(totalEtat / 1e9).toFixed(2)} Mrd USD</div>
        </div>
        <div className="border rounded-sm p-2" style={{ borderColor: "rgba(192, 57, 43, 0.4)", background: "rgba(192, 57, 43, 0.06)" }}>
          <div className="text-[10px] uppercase opacity-70" style={{ color: "#C0392B" }}>Entreprise</div>
          <div className="font-mono font-bold mt-1">{(totalEntr / 1e9).toFixed(2)} Mrd USD</div>
        </div>
      </div>
    </div>
  );
}

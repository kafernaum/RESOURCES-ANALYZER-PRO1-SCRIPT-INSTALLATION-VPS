import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Plus, Folder, ArrowRight, Scale, AlertTriangle, FileText, BarChart3 } from "lucide-react";
import LegalDisclaimer from "../components/LegalDisclaimer";

const KPI = [
  { label: "Projets", icon: Folder, color: "#D4A017" },
  { label: "Documents", icon: FileText, color: "#1A3C5E" },
  { label: "Analyses", icon: Scale, color: "#27AE60" },
  { label: "Alertes", icon: AlertTriangle, color: "#C0392B" },
];

export default function Dashboard() {
  const nav = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ projects: 0, documents: 0, analyses: 0, alerts: 0 });

  useEffect(() => {
    api.get("/projects")
      .then(async ({ data }) => {
        setProjects(data);
        setStats((s) => ({ ...s, projects: data.length }));
        // count docs total
        let docs = 0; let analyses = 0; let alerts = 0;
        for (const p of data.slice(0, 10)) {
          try {
            const dash = await api.get(`/projects/${p.id}/dashboard`);
            docs += dash.data.documents_count || 0;
            analyses += Object.keys(dash.data.analyses || {}).length;
            const c = dash.data.summary?.compteurs || {};
            alerts += (c.violations_critiques || 0) + (c.violations_graves || 0);
          } catch {}
        }
        setStats({ projects: data.length, documents: docs, analyses, alerts });
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6" data-testid="dashboard-page">
      <LegalDisclaimer compact />

      <div className="flex items-end justify-between mb-6 mt-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="text-sm opacity-70 mt-1">
            Vue d'ensemble de vos analyses de conventions extractives.
          </p>
        </div>
        <Button
          onClick={() => nav("/projects/new")}
          className="rounded-sm font-semibold"
          style={{ background: "#D4A017", color: "#0D1B12" }}
          data-testid="dashboard-new-project"
        >
          <Plus size={16} className="mr-1" /> Nouveau projet
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8" data-testid="dashboard-kpi-strip">
        {KPI.map((k, i) => {
          const val = [stats.projects, stats.documents, stats.analyses, stats.alerts][i];
          return (
            <div
              key={k.label}
              className="rap-card p-4 flex items-center gap-3 hover:shadow-md transition-shadow"
              data-testid={`kpi-${k.label.toLowerCase()}`}
            >
              <div className="h-10 w-10 rounded-sm flex items-center justify-center"
                style={{ background: `${k.color}22`, color: k.color }}>
                <k.icon size={18} />
              </div>
              <div>
                <div className="font-mono text-2xl font-bold leading-none">{val}</div>
                <div className="text-xs uppercase tracking-wider opacity-60 mt-1">{k.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rap-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold">Projets récents</h2>
            <Button variant="ghost" size="sm" onClick={() => nav("/projects")} data-testid="dashboard-view-all-projects">
              Tous les projets <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
          {loading ? (
            <div className="text-sm opacity-60">Chargement...</div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm opacity-70 mb-3">Aucun projet pour le moment.</p>
              <Button
                onClick={() => nav("/projects/new")}
                className="rounded-sm"
                style={{ background: "#1B4332", color: "white" }}
                data-testid="dashboard-empty-cta"
              >
                Créer mon premier projet
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {projects.slice(0, 6).map((p) => (
                <button
                  key={p.id}
                  onClick={() => nav(`/projects/${p.id}`)}
                  className="w-full text-left p-3 rounded-sm border hover:bg-secondary transition-colors flex items-center justify-between"
                  style={{ borderColor: "hsl(var(--border))" }}
                  data-testid={`dashboard-project-${p.id}`}
                >
                  <div>
                    <div className="font-semibold text-sm">{p.name}</div>
                    <div className="text-xs opacity-60 mt-0.5 flex items-center gap-2">
                      <span style={{ color: "#D4A017" }}>{p.country}</span>
                      <span>·</span>
                      <span className="capitalize">{p.sector}</span>
                      {p.resource_type && (<><span>·</span><span>{p.resource_type}</span></>)}
                    </div>
                  </div>
                  <ArrowRight size={14} className="opacity-50" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rap-card p-6">
          <h2 className="font-display text-lg font-bold mb-3">Méthodologie</h2>
          <div className="rap-divider-gold w-12 mb-3" />
          <p className="text-sm opacity-80 leading-relaxed mb-4">
            La méthodologie RESOURCES-ANALYZER PRO confronte chaque convention au :
          </p>
          <ul className="text-xs space-y-2 opacity-90">
            <li>· Droit international des ressources naturelles (Rés. 1803, IFC, ITIE)</li>
            <li>· Droit régional africain (Charte africaine Art. 21, Vision minière UA)</li>
            <li>· Standards contractuels (PSA AIPN, ResourceContracts.org)</li>
            <li>· Doctrine juridique (Pacta sunt servanda vs Rebus sic stantibus)</li>
            <li>· Jurisprudence CIRDI / CIJ / Cour africaine</li>
          </ul>
          <div className="mt-4 p-3 rounded-sm text-xs" style={{ background: "rgba(212, 160, 23, 0.1)", color: "#D4A017" }}>
            <b>Ahmed ELY Mustapha</b> — Juriste, Expert en Finances Publiques, PMP I-PMP IBM Full Stack Developer.
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import {
  Upload, FileText, Loader2, CheckCircle2, AlertCircle, Sparkles,
  Scale, FileSearch, BarChart3, FileBarChart, AlertTriangle, MessageSquareText, Sliders,
  BookOpen, Globe,
} from "lucide-react";
import { toast } from "sonner";
import LegalDisclaimer from "../components/LegalDisclaimer";
import KpiSummary from "../components/visualizations/KpiSummary";
import VizGrid from "../components/visualizations/VizGrid";
import AdvancedViz from "../components/visualizations/AdvancedViz";
import ConcessionMap from "../components/visualizations/ConcessionMap";
import DiagnosticsList from "../components/DiagnosticsList";
import FreeQueryPanel from "../components/FreeQueryPanel";
import ReportsPanel from "../components/ReportsPanel";
import BlnPanel from "../components/BlnPanel";
import CollectionPanel from "../components/CollectionPanel";

export default function ProjectDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [project, setProject] = useState(null);
  const [docs, setDocs] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [busy, setBusy] = useState({});
  const fileRef = useRef(null);

  const setB = (k, v) => setBusy((b) => ({ ...b, [k]: v }));

  const refresh = async () => {
    try {
      const [p, d, dash] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/projects/${id}/documents`),
        api.get(`/projects/${id}/dashboard`).catch(() => ({ data: null })),
      ]);
      setProject(p.data);
      setDocs(d.data);
      setDashboard(dash.data);
    } catch (err) {
      toast.error("Projet introuvable");
      nav("/projects");
    }
  };

  useEffect(() => { refresh(); }, [id]);

  const onUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setB("upload", true);
    for (const f of files) {
      try {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("doc_type", "A1");
        await api.post(`/projects/${id}/documents`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success(`${f.name} importé`);
      } catch (err) {
        toast.error(`Erreur sur ${f.name}: ${err?.response?.data?.detail || err.message}`);
      }
    }
    setB("upload", false);
    e.target.value = "";
    refresh();
  };

  const extractDoc = async (docId) => {
    setB(`ext-${docId}`, true);
    try {
      await api.post(`/documents/${docId}/extract`);
      toast.success("Extraction GPT-4o terminée");
      refresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur extraction");
    } finally {
      setB(`ext-${docId}`, false);
    }
  };

  const runPureAnalyses = async () => {
    setB("pure", true);
    try {
      await api.post(`/projects/${id}/analyses/run`);
      toast.success("Analyses financière, env., sociale, IDC, SOS calculées.");
      refresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur analyses");
    } finally { setB("pure", false); }
  };

  const runJuridique = async () => {
    setB("jur", true);
    try {
      await api.post(`/projects/${id}/analyses/juridique`);
      toast.success("Analyse juridique GPT-4o terminée.");
      refresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur analyse juridique");
    } finally { setB("jur", false); }
  };

  const runDiagnostics = async () => {
    setB("diag", true);
    try {
      await api.post(`/projects/${id}/diagnostics/generate`);
      toast.success("Fiches diagnostic générées.");
      refresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur génération");
    } finally { setB("diag", false); }
  };

  if (!project) return <div className="p-6 opacity-60">Chargement...</div>;

  const summary = dashboard?.summary;
  const analyses = dashboard?.analyses || {};
  const hasExtracted = docs.some((d) => d.extracted_data);
  const hasJuridique = !!analyses.juridique;
  const hasPure = !!analyses.financier;
  const hasDiagnostics = !!analyses.diagnostic;

  return (
    <div className="p-6" data-testid="project-detail-page">
      {/* Header */}
      <div className="mb-4">
        <button onClick={() => nav("/projects")} className="text-xs opacity-60 hover:opacity-100 mb-2"
          data-testid="back-to-projects">← Tous les projets</button>
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">{project.name}</h1>
            <div className="text-sm opacity-70 mt-1 flex flex-wrap items-center gap-2">
              <span style={{ color: "#D4A017" }}>{project.country}</span>
              <span>·</span>
              <span className="capitalize">{project.sector}</span>
              {project.resource_type && (<><span>·</span><span>{project.resource_type}</span></>)}
              <span>·</span>
              <span className="font-mono text-xs">{new Date(project.created_at).toLocaleDateString("fr-FR")}</span>
            </div>
          </div>
        </div>
      </div>

      <LegalDisclaimer compact />

      <Tabs defaultValue="overview" className="mt-4">
        <TabsList className="rounded-sm flex-wrap h-auto">
          <TabsTrigger value="overview" data-testid="tab-overview"><BarChart3 size={14} className="mr-1" />Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents"><FileText size={14} className="mr-1" />Documents</TabsTrigger>
          <TabsTrigger value="analyses" data-testid="tab-analyses"><Scale size={14} className="mr-1" />Analyses</TabsTrigger>
          <TabsTrigger value="bln" data-testid="tab-bln"><BookOpen size={14} className="mr-1" />BLN nationale</TabsTrigger>
          <TabsTrigger value="diagnostics" data-testid="tab-diagnostics"><AlertTriangle size={14} className="mr-1" />Diagnostics</TabsTrigger>
          <TabsTrigger value="collection" data-testid="tab-collection"><Globe size={14} className="mr-1" />Collecte auto</TabsTrigger>
          <TabsTrigger value="freequery" data-testid="tab-freequery"><MessageSquareText size={14} className="mr-1" />Requête libre</TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports"><FileBarChart size={14} className="mr-1" />Rapports</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          {summary ? (
            <>
              <KpiSummary summary={summary} />
              <VizGrid analyses={analyses} project={project} />
            </>
          ) : (
            <div className="rap-card p-12 text-center">
              <Sparkles size={32} className="mx-auto mb-3 opacity-40" />
              <p className="opacity-70 text-sm mb-4">
                Aucune donnée encore. Commencez par téléverser une convention dans l'onglet "Documents".
              </p>
            </div>
          )}
        </TabsContent>

        {/* DOCUMENTS */}
        <TabsContent value="documents" className="mt-4">
          <div className="rap-card p-6">
            <h2 className="font-display text-lg font-bold mb-1">Bibliothèque documentaire</h2>
            <p className="text-xs opacity-70 mb-4">PDF, DOCX, XLSX, CSV, TXT — max 200 Mo par fichier</p>
            <input ref={fileRef} type="file" multiple
              accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt"
              onChange={onUpload} className="hidden" data-testid="doc-file-input" />
            <Button onClick={() => fileRef.current?.click()} disabled={busy.upload}
              className="rounded-sm font-semibold mb-4"
              style={{ background: "#1B4332", color: "white" }}
              data-testid="upload-button">
              {busy.upload ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Upload size={14} className="mr-2" />}
              Téléverser
            </Button>

            {docs.length === 0 ? (
              <p className="text-sm opacity-60">Aucun document téléversé.</p>
            ) : (
              <div className="space-y-2">
                {docs.map((d) => (
                  <div key={d.id} className="border rounded-sm p-3 flex items-center justify-between gap-3"
                    style={{ borderColor: "hsl(var(--border))" }}
                    data-testid={`doc-row-${d.id}`}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FileText size={16} className="opacity-60 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{d.filename}</div>
                        <div className="text-xs opacity-60 font-mono">
                          {(d.file_size / 1024).toFixed(0)} Ko · {d.doc_type}
                          {d.extracted_data && (
                            <> · <span style={{ color: "#27AE60" }}>extrait</span> ({d.quality_score}%)</>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {d.extracted_data ? (
                        <CheckCircle2 size={16} style={{ color: "#27AE60" }} />
                      ) : (
                        <Button size="sm" onClick={() => extractDoc(d.id)} disabled={busy[`ext-${d.id}`]}
                          className="rounded-sm text-xs"
                          style={{ background: "#D4A017", color: "#0D1B12" }}
                          data-testid={`extract-${d.id}`}>
                          {busy[`ext-${d.id}`] ? <Loader2 size={12} className="mr-1 animate-spin" /> : <Sparkles size={12} className="mr-1" />}
                          Extraire (GPT-4o)
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ANALYSES */}
        <TabsContent value="analyses" className="mt-4 space-y-4">
          <div className="rap-card p-6">
            <h2 className="font-display text-lg font-bold mb-3">Lancer les analyses</h2>
            <div className="grid md:grid-cols-3 gap-3">
              <ActionCard
                title="Analyses déterministes"
                desc="Financière, environnementale (SEC), sociale (SSC), déséquilibre (IDC), souveraineté (SOS) — ZERO LLM."
                icon={Scale}
                disabled={!hasExtracted || busy.pure}
                done={hasPure}
                busy={busy.pure}
                onClick={runPureAnalyses}
                testid="run-pure"
              />
              <ActionCard
                title="Analyse juridique"
                desc="1 appel GPT-4o groupé — violations droit international, droit national, clauses abusives."
                icon={FileSearch}
                disabled={!hasExtracted || busy.jur}
                done={hasJuridique}
                busy={busy.jur}
                onClick={runJuridique}
                testid="run-juridique"
              />
              <ActionCard
                title="Fiches diagnostic"
                desc="1 appel GPT-4o — qualifications, jurisprudence, solutions, 6 voies de dénonciation."
                icon={AlertTriangle}
                disabled={!hasJuridique || busy.diag}
                done={hasDiagnostics}
                busy={busy.diag}
                onClick={runDiagnostics}
                testid="run-diagnostics"
              />
            </div>
            {!hasExtracted && (
              <p className="text-xs mt-4 opacity-70">
                <AlertCircle size={12} className="inline mr-1" />
                Téléversez et extrayez au moins un document avant de lancer les analyses.
              </p>
            )}
          </div>

          {summary && <KpiSummary summary={summary} />}
          {analyses.financier && <FinancialDetails fin={analyses.financier} />}
          {(analyses.environnemental || analyses.social) && (
            <ScoreDetails env={analyses.environnemental} soc={analyses.social} sov={analyses.souverainete} />
          )}
          {analyses.juridique && <JuridicalDetails jur={analyses.juridique} />}
        </TabsContent>

        <TabsContent value="diagnostics" className="mt-4">
          <DiagnosticsList diagnostics={analyses.diagnostic} canGenerate={hasJuridique && !hasDiagnostics}
            onGenerate={runDiagnostics} busy={busy.diag} />
        </TabsContent>

        <TabsContent value="bln" className="mt-4">
          <BlnPanel projectId={id} />
        </TabsContent>

        <TabsContent value="collection" className="mt-4">
          <CollectionPanel projectId={id} />
        </TabsContent>

        <TabsContent value="freequery" className="mt-4">
          <FreeQueryPanel projectId={id} />
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <ReportsPanel projectId={id} hasData={!!summary} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ActionCard({ title, desc, icon: Icon, disabled, done, busy, onClick, testid }) {
  return (
    <div className="border rounded-sm p-4 flex flex-col" style={{ borderColor: "hsl(var(--border))" }}>
      <div className="flex items-start justify-between mb-2">
        <Icon size={18} style={{ color: "#D4A017" }} />
        {done && <CheckCircle2 size={16} style={{ color: "#27AE60" }} />}
      </div>
      <div className="font-semibold text-sm mb-1">{title}</div>
      <p className="text-xs opacity-70 flex-1 mb-3">{desc}</p>
      <Button onClick={onClick} disabled={disabled || done}
        size="sm" className="rounded-sm text-xs"
        style={done ? { background: "#27AE60", color: "white" } : { background: "#1B4332", color: "white" }}
        data-testid={testid}>
        {busy ? <Loader2 size={12} className="mr-1 animate-spin" /> : null}
        {done ? "Terminé" : busy ? "En cours..." : "Lancer"}
      </Button>
    </div>
  );
}

function FinancialDetails({ fin }) {
  if (!fin || fin.error) return null;
  return (
    <div className="rap-card p-6">
      <h2 className="font-display text-lg font-bold mb-3">Analyse financière & fiscale</h2>
      <div className="grid md:grid-cols-3 gap-3 text-sm">
        <Stat label="Valeur totale du gisement" val={`${(fin.valeur_totale_gisement / 1e9).toFixed(2)} Mrd USD`} mono />
        <Stat label="Part de l'État" val={`${fin.part_etat_pct}%`} mono color={fin.part_etat_pct < 30 ? "#C0392B" : "#27AE60"} />
        <Stat label="Royalties" val={`${fin.royalties_taux}%`} mono
          subtitle={`Bench ${fin.royalties_benchmark_min}-${fin.royalties_benchmark_max}%`}
          color={fin.statut_royalty === "sous_evaluation_critique" ? "#C0392B" : "#27AE60"} />
        <Stat label="Manque à gagner / an" val={`${(fin.manque_a_gagner_annuel / 1e6).toFixed(1)} M USD`} mono color={fin.manque_a_gagner_annuel > 0 ? "#C0392B" : undefined} />
        <Stat label="Manque à gagner total" val={`${(fin.manque_a_gagner_total / 1e6).toFixed(1)} M USD`} mono color={fin.manque_a_gagner_total > 0 ? "#C0392B" : undefined} />
        <Stat label="Élément don fiscal" val={`${(fin.element_don_fiscal * 100).toFixed(1)}%`} mono color={fin.cadeau_fiscal ? "#C0392B" : undefined} />
      </div>
    </div>
  );
}

function ScoreDetails({ env, soc, sov }) {
  return (
    <div className="grid md:grid-cols-3 gap-3">
      {env && <ScoreCard title="Score Environnemental (SEC)" score={env.score_sec} niveau={env.niveau_alerte} components={env.components} />}
      {soc && <ScoreCard title="Score Social (SSC)" score={soc.score_ssc} niveau={soc.niveau_alerte} components={soc.components} />}
      {sov && <ScoreCard title="Score Souveraineté (SOS)" score={sov.score_sos} niveau={sov.niveau_alerte} components={sov.components} />}
    </div>
  );
}

function ScoreCard({ title, score, niveau, components }) {
  const colorMap = {
    conforme: "#27AE60", preservee: "#27AE60",
    insuffisant: "#E67E22", attention: "#E67E22", partielle: "#E67E22",
    grave: "#C0392B", critique: "#C0392B", atteinte: "#C0392B",
  };
  const c = colorMap[niveau] || "#1A3C5E";
  return (
    <div className="rap-card p-5">
      <div className="text-xs uppercase tracking-wider opacity-70 mb-2">{title}</div>
      <div className="font-mono text-4xl font-bold mb-2" style={{ color: c }}>{score}</div>
      <div className="text-xs uppercase font-semibold mb-3" style={{ color: c }}>{niveau}</div>
      <div className="space-y-1">
        {components?.map((comp) => (
          <div key={comp.code} className="flex items-center justify-between text-xs">
            <span className="opacity-80 truncate flex-1 pr-2">{comp.label}</span>
            <span className="font-mono font-semibold flex-shrink-0">{comp.score}/{comp.max}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function JuridicalDetails({ jur }) {
  const violations_int = jur.violations_droit_international || [];
  const violations_nat = jur.violations_droit_national || [];
  const abus = jur.clauses_abusives || [];
  return (
    <div className="rap-card p-6">
      <h2 className="font-display text-lg font-bold mb-2">Analyse juridique synthétique</h2>
      <div className="font-mono text-3xl font-bold mb-1" style={{ color: "#D4A017" }}>
        {jur.score_conformite_global || 0}/100
      </div>
      <div className="text-xs uppercase font-semibold mb-3" style={{ color: "#C0392B" }}>{jur.niveau_alerte}</div>
      <p className="text-sm opacity-90 mb-4 leading-relaxed">{jur.synthese_juridique}</p>
      <div className="grid md:grid-cols-3 gap-3 text-xs">
        <div className="p-3 border rounded-sm" style={{ borderColor: "hsl(var(--border))" }}>
          <b style={{ color: "#C0392B" }}>{violations_int.length}</b> Violations droit international
        </div>
        <div className="p-3 border rounded-sm" style={{ borderColor: "hsl(var(--border))" }}>
          <b style={{ color: "#C0392B" }}>{violations_nat.length}</b> Violations droit national
        </div>
        <div className="p-3 border rounded-sm" style={{ borderColor: "hsl(var(--border))" }}>
          <b style={{ color: "#E67E22" }}>{abus.length}</b> Clauses abusives
        </div>
      </div>
    </div>
  );
}

function Stat({ label, val, mono, subtitle, color }) {
  return (
    <div className="border rounded-sm p-3" style={{ borderColor: "hsl(var(--border))" }}>
      <div className="text-[10px] uppercase tracking-wider opacity-60 mb-1">{label}</div>
      <div className={`text-xl font-bold ${mono ? "font-mono" : ""}`} style={color ? { color } : {}}>{val}</div>
      {subtitle && <div className="text-[10px] opacity-60 mt-1 font-mono">{subtitle}</div>}
    </div>
  );
}

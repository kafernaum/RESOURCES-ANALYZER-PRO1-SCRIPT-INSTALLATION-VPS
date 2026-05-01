import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Upload, Loader2, Search, Trash2, BookOpen, Scale, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";

const LAW_CODES = [
  { v: "constitution", l: "Constitution nationale" },
  { v: "mines", l: "Code minier" },
  { v: "hydro", l: "Code des hydrocarbures" },
  { v: "env", l: "Code de l'environnement" },
  { v: "eau", l: "Code de l'eau" },
  { v: "penal", l: "Code pénal" },
  { v: "invest", l: "Code de l'investissement" },
  { v: "travail", l: "Code du travail" },
  { v: "foncier", l: "Code foncier" },
  { v: "mp", l: "Code des marchés publics" },
  { v: "itie", l: "Loi transparence ITIE" },
  { v: "anticorruption", l: "Loi anti-corruption" },
];

export default function BlnPanel({ projectId }) {
  const [articles, setArticles] = useState({});
  const [total, setTotal] = useState(0);
  const [lawCode, setLawCode] = useState("mines");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [confront, setConfront] = useState(null);
  const [busyConfront, setBusyConfront] = useState(false);

  const refresh = () => {
    api.get(`/projects/${projectId}/bln/articles`)
      .then(({ data }) => { setArticles(data.by_code); setTotal(data.total); });
  };

  useEffect(() => { refresh(); }, [projectId]);

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("law_code", lawCode);
      const { data } = await api.post(`/projects/${projectId}/bln/upload`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(`${data.articles_indexed} articles indexés (${data.law_code})`);
      refresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur upload");
    } finally { setBusy(false); e.target.value = ""; }
  };

  const deleteCode = async (code) => {
    if (!window.confirm(`Supprimer tous les articles du code ${code} ?`)) return;
    await api.delete(`/projects/${projectId}/bln/code/${code}`);
    toast.success("Articles supprimés");
    refresh();
  };

  const search = async () => {
    if (!query.trim()) return;
    const { data } = await api.post(`/projects/${projectId}/bln/search`, { query, top_k: 10 });
    setResults(data.results);
  };

  const runConfrontation = async () => {
    setBusyConfront(true);
    try {
      const { data } = await api.post(`/projects/${projectId}/bln/confront`);
      setConfront(data.results);
      toast.success("Confrontation convention/loi terminée.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally { setBusyConfront(false); }
  };

  return (
    <div className="space-y-4" data-testid="bln-panel">
      <div className="rap-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <BookOpen size={18} style={{ color: "#D4A017" }} />
            Bibliothèque Législative Nationale (BLN)
          </h2>
          <span className="font-mono text-sm opacity-70">{total} articles indexés</span>
        </div>
        <p className="text-xs opacity-70 mb-4">
          Téléversez les codes nationaux (PDF/DOCX/TXT). Chaque texte est fragmenté par article et indexé pour recherche TF-IDF.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={lawCode} onValueChange={setLawCode}>
            <SelectTrigger className="rounded-sm w-64" data-testid="bln-law-code-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LAW_CODES.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="cursor-pointer" data-testid="bln-upload-label">
            <input type="file" accept=".pdf,.docx,.txt" onChange={onUpload} className="hidden" />
            <span className="inline-flex items-center px-3 py-2 rounded-sm font-semibold text-sm"
              style={{ background: "#1B4332", color: "white" }}>
              {busy ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Upload size={14} className="mr-2" />}
              Téléverser un texte législatif
            </span>
          </label>
        </div>
      </div>

      {Object.keys(articles).length > 0 && (
        <div className="rap-card p-5">
          <h3 className="font-display text-base font-bold mb-3">Codes indexés</h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(articles).map(([code, arr]) => {
              const label = LAW_CODES.find((c) => c.v === code)?.l || code;
              return (
                <div key={code} className="border rounded-sm p-3 flex items-center justify-between"
                  style={{ borderColor: "hsl(var(--border))" }}
                  data-testid={`bln-code-${code}`}>
                  <div>
                    <div className="font-semibold text-sm">{label}</div>
                    <div className="text-xs opacity-60 font-mono">{arr.length} articles</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => deleteCode(code)}
                    data-testid={`bln-delete-${code}`}>
                    <Trash2 size={12} />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rap-card p-5">
        <h3 className="font-display text-base font-bold mb-3 flex items-center gap-2">
          <Search size={16} style={{ color: "#D4A017" }} /> Recherche dans la BLN
        </h3>
        <div className="flex gap-2 mb-3">
          <Input value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Ex : royalties stabilisation fiscale article exception..."
            className="rounded-sm" data-testid="bln-search-input" />
          <Button onClick={search} className="rounded-sm font-semibold"
            style={{ background: "#1A3C5E", color: "white" }} data-testid="bln-search-btn">
            <Search size={14} className="mr-1" /> Rechercher
          </Button>
        </div>
        {results.length > 0 && (
          <div className="space-y-2 mt-3" data-testid="bln-search-results">
            {results.map((r, i) => (
              <div key={i} className="border rounded-sm p-3" style={{ borderColor: "hsl(var(--border))" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs px-2 py-0.5 rounded-sm font-bold"
                    style={{ background: "rgba(212, 160, 23, 0.15)", color: "#D4A017" }}>
                    {(LAW_CODES.find((c) => c.v === r.law_code)?.l || r.law_code)} · Art. {r.article_number}
                  </span>
                  <span className="text-[10px] opacity-60 font-mono">similarité {(r.similarity * 100).toFixed(1)}%</span>
                </div>
                <div className="text-xs font-semibold mb-1">{r.article_title}</div>
                <div className="text-xs opacity-80 leading-relaxed line-clamp-3">{r.article_text}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rap-card p-5">
        <h3 className="font-display text-base font-bold mb-2 flex items-center gap-2">
          <Scale size={16} style={{ color: "#D4A017" }} /> Confrontation convention / loi nationale
        </h3>
        <p className="text-xs opacity-70 mb-3">
          Pour chaque clause sensible de la convention, le système trouve les articles nationaux les plus
          pertinents (TF-IDF) et qualifie la conformité juridique via un appel groupé GPT-4o.
        </p>
        <Button onClick={runConfrontation} disabled={busyConfront || total === 0}
          className="rounded-sm font-semibold"
          style={{ background: "#D4A017", color: "#0D1B12" }}
          data-testid="bln-confront-btn">
          {busyConfront ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Sparkles size={14} className="mr-2" />}
          Lancer la confrontation
        </Button>
        {total === 0 && (
          <p className="text-xs mt-2 opacity-60">Téléversez au moins un texte national pour activer la confrontation.</p>
        )}

        {confront && (
          <div className="mt-4 space-y-3" data-testid="bln-confront-results">
            <div className="text-xs uppercase tracking-wider opacity-70">Confrontations</div>
            {(confront.confrontations || []).map((c, i) => (
              <div key={i} className="border rounded-sm p-3"
                style={{ borderColor: "hsl(var(--border))", borderLeft: `3px solid ${c.gravite === 'critique' || c.gravite === 'grave' ? '#C0392B' : '#D4A017'}` }}>
                <div className="font-semibold text-sm mb-1">{c.clause_convention}</div>
                <div className="text-xs opacity-80 mb-2">Conformité : <b style={{ color: c.conformite_droit_national === 'contraire' ? '#C0392B' : '#27AE60' }}>{c.conformite_droit_national}</b> · Gravité : {c.gravite}</div>
                <div className="text-xs leading-relaxed mb-2"><b>Qualification :</b> {c.qualification_juridique_precise}</div>
                {(c.articles_nationaux_applicables || []).map((a, j) => (
                  <div key={j} className="text-[11px] mt-1 opacity-90 pl-3 border-l-2"
                    style={{ borderColor: "rgba(212, 160, 23, 0.3)" }}>
                    <b>{a.code} {a.article}</b> ({a.type_relation}) — {(a.texte_article || "").slice(0, 200)}
                  </div>
                ))}
                {c.solution_judiciaire && (
                  <div className="text-xs mt-2 p-2 rounded-sm" style={{ background: "rgba(39, 174, 96, 0.08)", color: "#27AE60" }}>
                    <b>Solution judiciaire :</b> {c.solution_judiciaire} ({c.juridiction_nationale_competente}, {c.delai_prescription_national})
                  </div>
                )}
              </div>
            ))}
            {(confront.derogations_illegales || []).length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wider opacity-70 mt-4 mb-2">⚠ Dérogations illégales détectées</div>
                {confront.derogations_illegales.map((d, i) => (
                  <div key={i} className="border rounded-sm p-3 mb-2"
                    style={{ borderColor: "#C0392B", background: "rgba(192, 57, 43, 0.05)" }}>
                    <div className="text-sm font-semibold">{d.clause}</div>
                    <div className="text-xs mt-1"><b>{d.code_viole} {d.article_viole}</b> — {d.type_derogation}</div>
                    <div className="text-xs opacity-80 mt-1">{d.qualification_juridique}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

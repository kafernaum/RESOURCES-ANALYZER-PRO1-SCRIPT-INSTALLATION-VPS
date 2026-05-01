import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Upload, Loader2, Search, Trash2, Scale, Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function JurisprudencePanel({ projectId, juridique }) {
  const [decisions, setDecisions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [court, setCourt] = useState("Cour suprême");
  const [year, setYear] = useState(2020);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [argument, setArgument] = useState(null);
  const [busyArg, setBusyArg] = useState(false);
  const [selectedViolation, setSelectedViolation] = useState(null);

  const refresh = () => {
    api.get(`/projects/${projectId}/jurisprudence`)
      .then(({ data }) => setDecisions(data.items || []));
  };

  useEffect(() => { refresh(); }, [projectId]);

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("court", court);
      fd.append("year", String(year));
      await api.post(`/projects/${projectId}/jurisprudence/upload`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(`Décision indexée : ${file.name}`);
      refresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur upload");
    } finally { setBusy(false); e.target.value = ""; }
  };

  const onDelete = async (id) => {
    if (!window.confirm("Supprimer cette décision ?")) return;
    await api.delete(`/projects/${projectId}/jurisprudence/${id}`);
    refresh();
  };

  const search = async () => {
    if (!query.trim()) return;
    const { data } = await api.post(`/projects/${projectId}/jurisprudence/search`, { query, top_k: 10 });
    setResults(data.results || []);
  };

  const generateArg = async (violation) => {
    setBusyArg(true);
    setSelectedViolation(violation);
    setArgument(null);
    try {
      const { data } = await api.post(`/projects/${projectId}/jurisprudence/argument`, { violation });
      setArgument(data);
      if (data._warning) toast.warning(data._warning);
      else toast.success("Argumentaire généré.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally { setBusyArg(false); }
  };

  const violationsInt = juridique?.violations_droit_international || [];
  const violationsNat = juridique?.violations_droit_national || [];

  return (
    <div className="space-y-4" data-testid="jurisprudence-panel">
      <div className="rap-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <Scale size={18} style={{ color: "#D4A017" }} />
            Jurisprudence (Module 11)
          </h2>
          <span className="font-mono text-sm opacity-70">{decisions.length} décisions nationales</span>
        </div>
        <p className="text-xs opacity-70 mb-4">
          Téléversez les arrêts et jugements nationaux (PDF/DOCX/TXT). La jurisprudence
          internationale (CIRDI, CIJ, Cour IADH, Commission africaine) est pré-chargée et
          incluse automatiquement dans les recherches.
        </p>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-[10px] uppercase tracking-wider opacity-70 mb-1 block">Juridiction</label>
            <Input value={court} onChange={(e) => setCourt(e.target.value)} className="rounded-sm"
              placeholder="Cour suprême / Cour d'appel / Conseil constitutionnel"
              data-testid="jur-court-input" />
          </div>
          <div className="w-24">
            <label className="text-[10px] uppercase tracking-wider opacity-70 mb-1 block">Année</label>
            <Input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value || "2020"))}
              className="rounded-sm" data-testid="jur-year-input" />
          </div>
          <label className="cursor-pointer" data-testid="jur-upload-label">
            <input type="file" accept=".pdf,.docx,.txt" onChange={onUpload} className="hidden" />
            <span className="inline-flex items-center px-3 py-2 rounded-sm font-semibold text-sm"
              style={{ background: "#1B4332", color: "white" }}>
              {busy ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Upload size={14} className="mr-2" />}
              Téléverser une décision
            </span>
          </label>
        </div>
      </div>

      {decisions.length > 0 && (
        <div className="rap-card p-5">
          <h3 className="font-display text-base font-bold mb-3">Décisions indexées</h3>
          <div className="space-y-2">
            {decisions.map((d) => (
              <div key={d.id} className="border rounded-sm p-3 flex items-start justify-between"
                style={{ borderColor: "hsl(var(--border))" }}
                data-testid={`jur-decision-${d.id}`}>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{d.parties || d.case_number || d.filename}</div>
                  <div className="text-xs opacity-70 font-mono mt-1">
                    {d.court} · {d.year} · n°{d.case_number || "—"}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => onDelete(d.id)}
                  data-testid={`jur-delete-${d.id}`}>
                  <Trash2 size={12} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rap-card p-5">
        <h3 className="font-display text-base font-bold mb-3 flex items-center gap-2">
          <Search size={16} style={{ color: "#D4A017" }} /> Recherche jurisprudentielle
        </h3>
        <div className="flex gap-2 mb-3">
          <Input value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Ex : expropriation indirecte · stabilisation contractuelle · CLPE..."
            className="rounded-sm" data-testid="jur-search-input" />
          <Button onClick={search} className="rounded-sm font-semibold"
            style={{ background: "#1A3C5E", color: "white" }} data-testid="jur-search-btn">
            <Search size={14} className="mr-1" /> Rechercher
          </Button>
        </div>
        {results.length > 0 && (
          <div className="space-y-2 mt-3" data-testid="jur-search-results">
            {results.map((r, i) => (
              <div key={i} className="border rounded-sm p-3" style={{ borderColor: "hsl(var(--border))" }}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-xs px-2 py-0.5 rounded-sm font-bold"
                    style={{ background: "rgba(212, 160, 23, 0.15)", color: "#D4A017" }}>
                    {r.court} · {r.year}
                  </span>
                  <span className="text-[10px] opacity-60 font-mono">similarité {(r.similarity * 100).toFixed(1)}%</span>
                </div>
                <div className="text-xs font-semibold mb-1">{r.parties || r.case_number}</div>
                <div className="text-xs opacity-80 leading-relaxed line-clamp-3">{r.ratio_decidendi}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(violationsInt.length > 0 || violationsNat.length > 0) && (
        <div className="rap-card p-5">
          <h3 className="font-display text-base font-bold mb-3 flex items-center gap-2">
            <Sparkles size={16} style={{ color: "#D4A017" }} /> Argumentaire jurisprudentiel défendable
          </h3>
          <p className="text-xs opacity-70 mb-3">
            Sélectionnez une violation détectée par l'analyse juridique pour générer un
            argumentaire complet (jurisprudence applicable, doctrine, stratégie contentieuse).
          </p>
          <div className="grid md:grid-cols-2 gap-2 mb-4">
            {violationsInt.slice(0, 6).map((v, i) => (
              <Button key={`vi-${i}`} onClick={() => generateArg(v)} disabled={busyArg}
                size="sm" variant="outline" className="rounded-sm text-xs justify-start text-left h-auto py-2"
                data-testid={`jur-arg-int-${i}`}>
                <span className="truncate">
                  <b style={{ color: "#C0392B" }}>[{v.norme_violee}]</b> {v.norme_libelle?.slice(0, 60)}
                </span>
              </Button>
            ))}
            {violationsNat.slice(0, 6).map((v, i) => (
              <Button key={`vn-${i}`} onClick={() => generateArg(v)} disabled={busyArg}
                size="sm" variant="outline" className="rounded-sm text-xs justify-start text-left h-auto py-2"
                data-testid={`jur-arg-nat-${i}`}>
                <span className="truncate">
                  <b style={{ color: "#C0392B" }}>{v.code_national_viole}</b> {v.article_exact}
                </span>
              </Button>
            ))}
          </div>

          {busyArg && (
            <div className="flex items-center gap-2 text-sm opacity-70">
              <Loader2 size={14} className="animate-spin" /> Génération de l'argumentaire en cours...
            </div>
          )}

          {argument && !busyArg && (
            <div className="mt-4 space-y-3" data-testid="jur-argument-result">
              {argument._warning && (
                <div className="border rounded-sm p-3 text-xs" style={{ background: "rgba(230, 126, 34, 0.08)", borderColor: "#E67E22", color: "#E67E22" }}>
                  <AlertCircle size={12} className="inline mr-1" /> {argument._warning}
                </div>
              )}
              {argument.argument_principal && (
                <div className="border rounded-sm p-4" style={{ borderColor: "rgba(212, 160, 23, 0.4)", background: "rgba(212, 160, 23, 0.05)" }}>
                  <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">Argument principal</div>
                  <div className="font-semibold text-sm mb-2">{argument.argument_principal.reference_principale}</div>
                  <div className="text-xs mb-2"><b>Ratio decidendi :</b> {argument.argument_principal.ratio_decidendi_applicable}</div>
                  <div className="text-xs mb-2"><b>Analogie :</b> {argument.argument_principal.analogie_avec_cas_analyse}</div>
                  <div className="text-xs"><b>Force :</b> <span style={{ color: "#D4A017" }}>{argument.argument_principal.force_argument}</span></div>
                </div>
              )}
              {(argument.arguments_secondaires || []).length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider opacity-70 mb-2">Arguments secondaires</div>
                  {argument.arguments_secondaires.map((a, i) => (
                    <div key={i} className="border rounded-sm p-3 mb-2" style={{ borderColor: "hsl(var(--border))" }}>
                      <div className="font-semibold text-xs mb-1">{a.reference}</div>
                      <div className="text-xs opacity-80">{a.ratio_decidendi}</div>
                      {a.analogie && <div className="text-xs mt-1 italic">{a.analogie}</div>}
                    </div>
                  ))}
                </div>
              )}
              {(argument.contre_arguments_previsibles || []).length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider opacity-70 mb-2">Contre-arguments prévisibles</div>
                  {argument.contre_arguments_previsibles.map((c, i) => (
                    <div key={i} className="border rounded-sm p-3 mb-2"
                      style={{ borderColor: "rgba(192, 57, 43, 0.3)", background: "rgba(192, 57, 43, 0.05)" }}>
                      <div className="text-xs mb-1"><b>Argument adverse :</b> {c.argument}</div>
                      <div className="text-xs opacity-80"><b>Réponse :</b> {c.reponse_recommandee}</div>
                    </div>
                  ))}
                </div>
              )}
              {(argument.doctrine_applicable || []).length > 0 && (
                <div className="text-xs">
                  <b>Doctrines mobilisables :</b> {argument.doctrine_applicable.join(" · ")}
                </div>
              )}
              {argument.strategie_contentieuse && (
                <div className="border rounded-sm p-3" style={{ background: "rgba(39, 174, 96, 0.05)", borderColor: "rgba(39, 174, 96, 0.3)" }}>
                  <div className="text-xs"><b>Stratégie :</b> {argument.strategie_contentieuse}</div>
                  <div className="text-xs mt-1"><b>Juridiction optimale :</b> {argument.juridiction_optimale}</div>
                  <div className="text-xs mt-1"><b>Probabilité de succès :</b> <span style={{ color: "#D4A017" }}>{argument.probabilite_succes_estimee}</span></div>
                  {argument.prescription_a_respecter && (
                    <div className="text-xs mt-1"><b>Prescription :</b> {argument.prescription_a_respecter}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

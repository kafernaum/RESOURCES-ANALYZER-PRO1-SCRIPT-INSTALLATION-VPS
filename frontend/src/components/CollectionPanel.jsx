import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Globe, Loader2, ExternalLink, CheckCircle2, X, AlertTriangle, Building2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const TYPE_BADGES = {
  convention: { label: "Convention", color: "#D4A017" },
  jurisprudence: { label: "Jurisprudence", color: "#1A3C5E" },
  rapport_itie: { label: "Rapport ITIE", color: "#27AE60" },
  rapport_fmi: { label: "FMI", color: "#1A3C5E" },
  rapport_bm: { label: "Banque mondiale", color: "#1A3C5E" },
  rapport_societe_civile: { label: "Société civile", color: "#E67E22" },
  investigation: { label: "Investigation", color: "#C0392B" },
  legislation: { label: "Législation", color: "#1B4332" },
  doctrine: { label: "Doctrine", color: "#8b5cf6" },
};

export default function CollectionPanel({ projectId }) {
  const [bySource, setBySource] = useState({});
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [reputation, setReputation] = useState(null);
  const [busyRep, setBusyRep] = useState(false);

  const refresh = () => {
    api.get(`/projects/${projectId}/collection`)
      .then(({ data }) => { setBySource(data.by_source || {}); setTotal(data.total || 0); });
    api.get(`/projects/${projectId}/reputation`).then(({ data }) => {
      if (data.items?.[0]) setReputation(data.items[0]);
    });
  };

  useEffect(() => { refresh(); }, [projectId]);

  const runCollection = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/projects/${projectId}/collection/run`);
      toast.success(`${data.items_count} ressources collectées sur 10 sources.`);
      refresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally { setBusy(false); }
  };

  const fetchReputation = async () => {
    setBusyRep(true);
    try {
      const { data } = await api.post(`/projects/${projectId}/reputation`);
      setReputation(data);
      toast.success("Profil de réputation mis à jour.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally { setBusyRep(false); }
  };

  const updateStatus = async (id, status) => {
    await api.put(`/projects/${projectId}/collection/${id}/status`, null, { params: { status } });
    refresh();
  };

  return (
    <div className="space-y-4" data-testid="collection-panel">
      <div className="rap-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <Globe size={18} style={{ color: "#D4A017" }} />
            Collecte automatique de ressources documentaires
          </h2>
          <span className="font-mono text-sm opacity-70">{total} ressources</span>
        </div>
        <p className="text-xs opacity-70 mb-4">
          Sources surveillées : ResourceContracts.org · ITIE · FMI · Banque Mondiale · CIRDI · PWYP · Global Witness · Légifrance · OHADA · OpenAlex.
        </p>
        <Button onClick={runCollection} disabled={busy} className="rounded-sm font-semibold"
          style={{ background: "#1B4332", color: "white" }} data-testid="run-collection-btn">
          {busy ? <Loader2 size={14} className="mr-2 animate-spin" /> : <RefreshCw size={14} className="mr-2" />}
          Lancer la collecte
        </Button>
      </div>

      <div className="rap-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-base font-bold flex items-center gap-2">
            <Building2 size={16} style={{ color: "#D4A017" }} />
            Profil de réputation de l'entreprise contractante
          </h3>
          <Button size="sm" onClick={fetchReputation} disabled={busyRep}
            variant="outline" className="rounded-sm" data-testid="fetch-reputation-btn">
            {busyRep ? <Loader2 size={12} className="mr-1 animate-spin" /> : <RefreshCw size={12} className="mr-1" />}
            Rafraîchir
          </Button>
        </div>
        {reputation ? (
          <div className="grid md:grid-cols-2 gap-3 text-xs" data-testid="reputation-card">
            <Field k="Entreprise" v={reputation.company_name} />
            <Field k="Pays d'incorporation" v={reputation.country_incorporation} />
            <Field k="Niveau de risque" v={reputation.risk_level}
              color={reputation.risk_level === "élevé" ? "#C0392B" : reputation.risk_level === "modéré" ? "#E67E22" : "#1A3C5E"} />
            <Field k="Score ESG" v={reputation.esg_score} />
            <Field k="Sanctions actives" v={(reputation.sanctions || []).length === 0 ? "Aucune identifiée" : reputation.sanctions.join(", ")} />
            <Field k="Affaires CIRDI" v={(reputation.icsid_cases || []).length === 0 ? "Aucune identifiée" : `${reputation.icsid_cases.length} affaire(s)`} />
            {reputation._note && (
              <div className="md:col-span-2 p-2 rounded-sm text-[11px] italic"
                style={{ background: "rgba(212, 160, 23, 0.08)", color: "#D4A017" }}>
                {reputation._note}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs opacity-60">Aucun profil pour le moment. Lancez l'analyse après l'extraction d'un document.</p>
        )}
      </div>

      {Object.keys(bySource).length > 0 && (
        <div className="space-y-3">
          {Object.entries(bySource).map(([source, items]) => (
            <div key={source} className="rap-card p-4" data-testid={`source-${source.replace(/\s+/g, '-')}`}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-display font-bold text-sm">{source}</h4>
                <span className="text-[10px] uppercase tracking-wider font-mono opacity-60">{items.length} résultats</span>
              </div>
              <div className="space-y-2">
                {items.slice(0, 8).map((it, i) => {
                  const badge = TYPE_BADGES[it.type] || { label: it.type, color: "#1A3C5E" };
                  return (
                    <div key={i} className="border rounded-sm p-3 flex items-start gap-3"
                      style={{
                        borderColor: "hsl(var(--border))",
                        opacity: it.status === "ignored" ? 0.5 : 1,
                      }}>
                      <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-sm font-semibold flex-shrink-0"
                        style={{ background: `${badge.color}22`, color: badge.color }}>
                        {badge.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{it.title}</div>
                        <div className="text-[11px] opacity-70 mt-0.5 font-mono">
                          {it.year && `${it.year} · `}
                          {it.company && `${it.company} · `}
                          Pertinence {it.relevance || 0}%
                        </div>
                        {it.preview && <div className="text-[11px] opacity-80 mt-1 line-clamp-2">{it.preview}</div>}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {it.url && (
                          <a href={it.url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="ghost" className="rounded-sm">
                              <ExternalLink size={12} />
                            </Button>
                          </a>
                        )}
                        {it.status !== "added" && (
                          <Button size="sm" variant="ghost" onClick={() => updateStatus(it.id, "added")}>
                            <CheckCircle2 size={12} style={{ color: "#27AE60" }} />
                          </Button>
                        )}
                        {it.status !== "ignored" && (
                          <Button size="sm" variant="ghost" onClick={() => updateStatus(it.id, "ignored")}>
                            <X size={12} />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {total === 0 && (
        <div className="rap-card p-12 text-center">
          <AlertTriangle size={32} className="mx-auto mb-3 opacity-40" />
          <p className="opacity-70 text-sm">Aucune ressource collectée. Cliquez sur "Lancer la collecte" pour démarrer.</p>
        </div>
      )}
    </div>
  );
}

function Field({ k, v, color }) {
  return (
    <div className="border rounded-sm p-2" style={{ borderColor: "hsl(var(--border))" }}>
      <div className="text-[10px] uppercase tracking-wider opacity-60">{k}</div>
      <div className="font-semibold text-sm mt-0.5" style={color ? { color } : {}}>{v || "—"}</div>
    </div>
  );
}

import { useState } from "react";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Wand2, Loader2, AlertCircle, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export default function AmendmentDrafter({ projectId, juridique }) {
  const [original, setOriginal] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const draft = async () => {
    if (!original.trim()) {
      toast.error("Renseignez la clause originale.");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const { data } = await api.post(`/projects/${projectId}/amendment/rewrite`, {
        original, problem,
      });
      setResult(data);
      if (data._warning) toast.warning(data._warning);
      else toast.success("Amendement rédigé.");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally { setBusy(false); }
  };

  const fillFromAbus = (c) => {
    setOriginal(c.texte_exact || "");
    setProblem(c.analyse || c.type_abus || "");
  };

  const copyClause = () => {
    if (!result?.clause_proposee) return;
    navigator.clipboard.writeText(result.clause_proposee);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const abus = juridique?.clauses_abusives || [];

  return (
    <div className="space-y-4" data-testid="amendment-panel">
      <div className="rap-card p-5">
        <h2 className="font-display text-lg font-bold mb-1 flex items-center gap-2">
          <Wand2 size={18} style={{ color: "#D4A017" }} />
          Aide à la rédaction d'amendements
        </h2>
        <p className="text-xs opacity-70 mb-4">
          Réécrivez les clauses défavorables pour les rendre conformes aux standards
          internationaux (PSA AIPN, IFC PS5, Vision minière africaine, NRGI).
        </p>

        {abus.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-wider opacity-70 mb-2">Clauses abusives détectées — cliquez pour pré-remplir</div>
            <div className="grid md:grid-cols-2 gap-2">
              {abus.slice(0, 6).map((c, i) => (
                <Button key={i} onClick={() => fillFromAbus(c)} size="sm" variant="outline"
                  className="rounded-sm text-xs justify-start text-left h-auto py-2"
                  data-testid={`amend-fill-${i}`}>
                  <span className="truncate">
                    <b style={{ color: "#C0392B" }}>{c.type_abus}</b> ({c.gravite})
                  </span>
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider opacity-70 mb-1 block">Clause originale</label>
            <Textarea value={original} onChange={(e) => setOriginal(e.target.value)}
              rows={5} className="rounded-sm font-mono text-xs"
              placeholder="Collez ici le texte exact de la clause à réécrire..."
              data-testid="amend-original" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider opacity-70 mb-1 block">Problème identifié (optionnel)</label>
            <Textarea value={problem} onChange={(e) => setProblem(e.target.value)}
              rows={3} className="rounded-sm text-xs"
              placeholder="Ex : stabilisation excessive · royalties sous-évaluées · renonciation immunité..."
              data-testid="amend-problem" />
          </div>
          <Button onClick={draft} disabled={busy || !original.trim()}
            className="rounded-sm font-semibold"
            style={{ background: "#D4A017", color: "#0D1B12" }} data-testid="amend-draft-btn">
            {busy ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Wand2 size={14} className="mr-2" />}
            Rédiger l'amendement (GPT-4o)
          </Button>
        </div>
      </div>

      {result && (
        <div className="rap-card p-5" data-testid="amend-result">
          {result._warning && (
            <div className="border rounded-sm p-3 mb-3 text-xs"
              style={{ background: "rgba(230, 126, 34, 0.08)", borderColor: "#E67E22", color: "#E67E22" }}>
              <AlertCircle size={12} className="inline mr-1" /> {result._warning}
            </div>
          )}
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-display text-base font-bold">Clause réécrite</h3>
            <Button size="sm" variant="outline" onClick={copyClause}
              className="rounded-sm text-xs" data-testid="amend-copy">
              {copied ? <Check size={12} className="mr-1" /> : <Copy size={12} className="mr-1" />}
              {copied ? "Copié" : "Copier"}
            </Button>
          </div>
          <div className="border rounded-sm p-4 mb-4 font-mono text-xs whitespace-pre-wrap leading-relaxed"
            style={{ background: "rgba(212, 160, 23, 0.05)", borderColor: "rgba(212, 160, 23, 0.3)" }}>
            {result.clause_proposee}
          </div>

          {(result.modifications_clés || []).length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">Modifications clés</div>
              <ul className="text-xs space-y-1 list-disc list-inside opacity-90">
                {result.modifications_clés.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}

          {result.justification_juridique && (
            <div className="mb-3 text-xs">
              <b>Justification juridique :</b> {result.justification_juridique}
            </div>
          )}

          {(result.references_normatives || []).length > 0 && (
            <div className="mb-3 text-xs">
              <b>Références :</b>{" "}
              <span className="opacity-80">{result.references_normatives.join(" · ")}</span>
            </div>
          )}

          {(result.leviers_de_negociation || []).length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">Leviers de négociation</div>
              <ul className="text-xs space-y-1 list-disc list-inside opacity-90">
                {result.leviers_de_negociation.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </div>
          )}

          {(result.compromis_alternatifs || []).length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider opacity-70 mb-2">Compromis alternatifs</div>
              <div className="grid md:grid-cols-2 gap-2">
                {result.compromis_alternatifs.map((c, i) => (
                  <div key={i} className="border rounded-sm p-3 text-xs"
                    style={{ borderColor: "hsl(var(--border))" }}>
                    <div className="font-semibold mb-1">{c.variante}</div>
                    <div className="opacity-80"><b style={{ color: "#27AE60" }}>+</b> {c.avantage}</div>
                    <div className="opacity-80"><b style={{ color: "#C0392B" }}>−</b> {c.inconvenient}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

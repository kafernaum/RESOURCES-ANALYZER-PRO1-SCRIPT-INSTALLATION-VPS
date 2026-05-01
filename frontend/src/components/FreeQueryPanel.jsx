import { useState } from "react";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Loader2, MessageSquareText, Sparkles } from "lucide-react";
import { toast } from "sonner";

const SUGGESTED = [
  "Quels articles du code minier régissent les royalties dans ce secteur ?",
  "La clause de stabilisation est-elle légale au regard de la souveraineté ?",
  "Quelles décisions CIRDI traitent de clauses similaires ?",
  "Quel est le recours judiciaire le plus solide contre cette convention ?",
  "Génère un résumé exécutif pour un parlementaire en 200 mots.",
];

export default function FreeQueryPanel({ projectId }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  const submit = async (text) => {
    const question = (text || q).trim();
    if (!question) return;
    setLoading(true);
    try {
      const { data } = await api.post(`/projects/${projectId}/freequery`, { project_id: projectId, question });
      setHistory((h) => [{ q: data.question, a: data.answer, ts: Date.now() }, ...h]);
      setQ("");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4" data-testid="freequery-panel">
      <div className="rap-card p-6">
        <h2 className="font-display text-lg font-bold mb-2 flex items-center gap-2">
          <MessageSquareText size={18} style={{ color: "#D4A017" }} />
          Requête libre — Mode question/réponse
        </h2>
        <p className="text-xs opacity-70 mb-4">
          Posez toute question juridique, financière ou sociale concernant la convention.
          GPT-4o répond en français en s'appuyant sur les données extraites.
        </p>
        <Textarea value={q} onChange={(e) => setQ(e.target.value)} rows={3}
          placeholder="Ex : La clause de stabilisation fiscale est-elle conforme à la Constitution ?"
          className="rounded-sm mb-3 font-mono text-sm" data-testid="freequery-input" />
        <div className="flex flex-wrap gap-2 mb-3">
          {SUGGESTED.map((s, i) => (
            <button key={i} onClick={() => submit(s)} disabled={loading}
              className="text-[11px] px-2 py-1 rounded-sm border hover:bg-secondary"
              style={{ borderColor: "hsl(var(--border))" }}
              data-testid={`freequery-suggested-${i}`}>
              {s.slice(0, 50)}{s.length > 50 ? "..." : ""}
            </button>
          ))}
        </div>
        <Button onClick={() => submit()} disabled={loading || !q.trim()}
          className="rounded-sm font-semibold"
          style={{ background: "#1B4332", color: "white" }}
          data-testid="freequery-submit">
          {loading ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Sparkles size={14} className="mr-2" />}
          Poser la question
        </Button>
      </div>

      {history.length > 0 && (
        <div className="space-y-3">
          {history.map((h, i) => (
            <div key={i} className="rap-card p-5" data-testid={`freequery-history-${i}`}>
              <div className="text-xs uppercase tracking-wider opacity-60 mb-1">Question</div>
              <div className="font-semibold mb-3 text-sm">{h.q}</div>
              <div className="text-xs uppercase tracking-wider opacity-60 mb-1">
                Réponse <span style={{ color: "#D4A017" }}>· IA · à vérifier</span>
              </div>
              <div className="text-sm whitespace-pre-wrap leading-relaxed opacity-90">{h.a}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Input } from "../components/ui/input";
import { Shield, Search, Clock } from "lucide-react";

const ACTION_COLORS = {
  project_create: "#27AE60",
  project_delete: "#C0392B",
  document_upload: "#1A3C5E",
  document_extract: "#D4A017",
  report_pdf_generated: "#1B4332",
  simulator_linked_run: "#D4A017",
  suite_cross_check: "#1A3C5E",
  share_verdict_generated: "#27AE60",
};

const ACTION_LABELS = {
  project_create: "Projet créé",
  project_delete: "Projet supprimé",
  document_upload: "Document téléversé",
  document_extract: "Extraction GPT-4o",
  report_pdf_generated: "Rapport PDF",
  simulator_linked_run: "Simulation",
  suite_cross_check: "Cross-check suite",
  share_verdict_generated: "Verdict partagé",
};

export default function AuditLog() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/audit?limit=300").then(({ data }) => {
      setItems(data.items || []);
      setLoading(false);
    });
  }, []);

  const filtered = q.trim()
    ? items.filter((i) =>
        JSON.stringify(i).toLowerCase().includes(q.toLowerCase()))
    : items;

  return (
    <div className="p-6" data-testid="audit-page">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-2">
          <Shield size={28} style={{ color: "#D4A017" }} />
          Journal d'audit
        </h1>
        <p className="text-sm opacity-70 mt-1">
          Traçabilité de vos actions : projets, documents, analyses, rapports, simulations.
        </p>
      </div>

      <div className="rap-card p-5 mb-4">
        <div className="flex items-center gap-2">
          <Search size={14} className="opacity-60" />
          <Input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrer par projet, action..."
            className="rounded-sm max-w-md" data-testid="audit-search" />
          <span className="text-xs opacity-60 ml-auto font-mono">
            {filtered.length} / {items.length} entrées
          </span>
        </div>
      </div>

      {loading ? (
        <div className="text-sm opacity-60">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="rap-card p-12 text-center">
          <Clock size={32} className="mx-auto mb-3 opacity-40" />
          <p className="opacity-70 text-sm">Aucune entrée d'audit.</p>
        </div>
      ) : (
        <div className="rap-card p-0 overflow-x-auto">
          <table className="w-full text-sm" data-testid="audit-table">
            <thead>
              <tr style={{ background: "#1B4332", color: "white" }}>
                <th className="text-left p-3 font-semibold">Date</th>
                <th className="text-left p-3 font-semibold">Action</th>
                <th className="text-left p-3 font-semibold">Projet</th>
                <th className="text-left p-3 font-semibold">Détails</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => {
                const c = ACTION_COLORS[it.action] || "#1A3C5E";
                return (
                  <tr key={it.id} className="border-t hover:bg-secondary/50 transition-colors"
                    style={{ borderColor: "hsl(var(--border))" }}>
                    <td className="p-3 font-mono text-xs opacity-80">
                      {new Date(it.ts).toLocaleString("fr-FR")}
                    </td>
                    <td className="p-3">
                      <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-sm"
                        style={{ background: `${c}15`, color: c }}>
                        {ACTION_LABELS[it.action] || it.action}
                      </span>
                    </td>
                    <td className="p-3 text-xs">
                      {it.project_id ? (
                        <Link to={`/projects/${it.project_id}`} className="hover:underline"
                          style={{ color: "#D4A017" }}>
                          {it.project_name || it.project_id.slice(0, 8)}
                        </Link>
                      ) : <span className="opacity-40">—</span>}
                    </td>
                    <td className="p-3 text-xs opacity-80 font-mono max-w-md truncate">
                      {it.meta && Object.keys(it.meta).length > 0
                        ? Object.entries(it.meta).map(([k, v]) =>
                            `${k}=${typeof v === "object" ? JSON.stringify(v).slice(0, 40) : String(v).slice(0, 40)}`
                          ).join(" · ")
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

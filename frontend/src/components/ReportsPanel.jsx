import { useState } from "react";
import { Button } from "./ui/button";
import { api, API } from "../lib/api";
import { Download, FileBarChart, Loader2, Building, Scale, Users, Sprout, RefreshCw, GitCompareArrows, Award } from "lucide-react";
import { toast } from "sonner";

const PRESETS = [
  { id: "parlementaire", label: "Rapport Parlementaire", desc: "20 pages — score global, alertes, recommandations. Pour députés et commissions.", icon: Building },
  { id: "juridique", label: "Rapport Juridique Complet", desc: "60-80 pages — toutes les fiches diagnostic. Pour juristes et Cours des comptes.", icon: Scale },
  { id: "citoyen", label: "Rapport Citoyen / ONG", desc: "12 pages — infographies + chiffres clés. Pour société civile et journalistes.", icon: Users },
  { id: "environnemental", label: "Rapport Environnemental", desc: "25 pages — SEC détaillé, ODD, risques. Pour ministères et ONG vertes.", icon: Sprout },
  { id: "renegociation", label: "Rapport de Renégociation", desc: "30 pages — formulations alternatives clause par clause. Pour équipes de négociation.", icon: RefreshCw },
  { id: "comparatif", label: "Rapport Comparatif", desc: "40 pages — conventions multiples côte à côte (à venir).", icon: GitCompareArrows, disabled: true },
  { id: "rejd", label: "Rapport d'Expertise Juridique Défendable (REJD)", desc: "Produit phare — défendable devant les juridictions et tribunaux arbitraux.", icon: Award, hero: true },
];

export default function ReportsPanel({ projectId, hasData }) {
  const [busy, setBusy] = useState(null);

  const generate = async (preset) => {
    setBusy(preset);
    try {
      const token = localStorage.getItem("rap_token");
      const res = await fetch(`${API}/reports/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ project_id: projectId, preset }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Erreur génération");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rapport_${preset}_${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Rapport ${preset} téléchargé`);
    } catch (err) {
      toast.error(err.message || "Erreur");
    } finally { setBusy(null); }
  };

  if (!hasData) {
    return (
      <div className="rap-card p-12 text-center" data-testid="reports-empty">
        <FileBarChart size={32} className="mx-auto mb-3 opacity-40" />
        <p className="opacity-70 text-sm">
          Lancez d'abord les analyses pour pouvoir générer les rapports.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="reports-panel">
      <div className="rap-card p-5">
        <h2 className="font-display text-lg font-bold mb-1">Rapports exportables</h2>
        <p className="text-xs opacity-70">Choisissez le preset adapté à votre destinataire.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {PRESETS.map((p) => (
          <div key={p.id}
            className={`rap-card p-5 ${p.hero ? "ring-2" : ""}`}
            style={p.hero ? { boxShadow: "0 0 0 1px #D4A017", background: "linear-gradient(135deg, rgba(212, 160, 23, 0.05), rgba(27, 67, 50, 0.05))" } : {}}
            data-testid={`report-card-${p.id}`}>
            <div className="flex items-start justify-between mb-3">
              <p.icon size={20} style={{ color: p.hero ? "#D4A017" : "#1A3C5E" }} />
              {p.hero && (
                <span className="text-[9px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-sm font-semibold"
                  style={{ background: "#D4A017", color: "#0D1B12" }}>FLAGSHIP</span>
              )}
            </div>
            <h3 className="font-display font-bold text-sm mb-1">{p.label}</h3>
            <p className="text-xs opacity-70 mb-3 leading-relaxed">{p.desc}</p>
            <Button onClick={() => generate(p.id)} disabled={p.disabled || busy === p.id}
              size="sm" className="rounded-sm w-full"
              style={p.hero ? { background: "#D4A017", color: "#0D1B12" } : { background: "#1B4332", color: "white" }}
              data-testid={`generate-report-${p.id}`}>
              {busy === p.id ? <Loader2 size={12} className="mr-2 animate-spin" /> : <Download size={12} className="mr-2" />}
              {p.disabled ? "Bientôt disponible" : "Télécharger PDF"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

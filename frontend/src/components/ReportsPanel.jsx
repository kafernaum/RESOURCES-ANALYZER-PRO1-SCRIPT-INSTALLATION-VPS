import { useState } from "react";
import { Button } from "./ui/button";
import { api, API } from "../lib/api";
import { Download, FileBarChart, Loader2, Building, Scale, Users, Sprout, RefreshCw, Award, FileType, FileSpreadsheet, Archive, Share2, QrCode } from "lucide-react";
import { toast } from "sonner";

const PRESETS = [
  { id: "parlementaire", label: "Rapport Parlementaire", desc: "20 pages — score global, alertes, recommandations. Pour députés et commissions.", icon: Building },
  { id: "juridique", label: "Rapport Juridique Complet", desc: "60-80 pages — toutes les fiches diagnostic. Pour juristes et Cours des comptes.", icon: Scale },
  { id: "citoyen", label: "Rapport Citoyen / ONG", desc: "12 pages — infographies + chiffres clés. Pour société civile et journalistes.", icon: Users },
  { id: "environnemental", label: "Rapport Environnemental", desc: "25 pages — SEC détaillé, ODD, risques. Pour ministères et ONG vertes.", icon: Sprout },
  { id: "renegociation", label: "Rapport de Renégociation", desc: "30 pages — formulations alternatives clause par clause. Pour équipes de négociation.", icon: RefreshCw },
  { id: "rejd", label: "Rapport d'Expertise Juridique Défendable (REJD)", desc: "Produit phare — 8 parties + 8 annexes. Défendable devant les juridictions et tribunaux arbitraux.", icon: Award, hero: true },
];

export default function ReportsPanel({ projectId, hasData }) {
  const [busy, setBusy] = useState(null);

  const downloadFile = async (path, body, filename) => {
    const token = localStorage.getItem("rap_token");
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Erreur génération");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generate = async (preset, format = "pdf") => {
    setBusy(`${preset}-${format}`);
    try {
      const ext = { pdf: "pdf", word: "docx", excel: "xlsx", zip: "zip", "rejd-complete": "pdf", "share-verdict": "pdf" }[format];
      const path = format === "word" ? "/reports/generate-word"
                : format === "excel" ? "/reports/generate-excel"
                : format === "zip" ? "/reports/generate-zip"
                : format === "rejd-complete" ? "/reports/generate-rejd-complete"
                : format === "share-verdict" ? "/reports/generate-share-verdict"
                : "/reports/generate";
      await downloadFile(path, { project_id: projectId, preset },
        `rapport_${preset}_${format}_${Date.now()}.${ext}`);
      toast.success(`Rapport ${preset} (${format}) téléchargé`);
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
        <p className="text-xs opacity-70">Choisissez le preset adapté à votre destinataire. PDF, Word éditable, Excel multi-onglets ou Pack ZIP complet (REJD).</p>
      </div>

      <div className="rap-card p-5" style={{ background: "linear-gradient(135deg, rgba(212,160,23,0.08), rgba(26,60,94,0.08))", borderColor: "rgba(212,160,23,0.4)" }}>
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Share2 size={18} style={{ color: "#D4A017" }} />
              <h3 className="font-display font-bold">Partager le verdict</h3>
              <span className="text-[9px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-sm font-semibold"
                style={{ background: "#D4A017", color: "#0D1B12" }}>NOUVEAU</span>
            </div>
            <p className="text-xs opacity-80 mb-3 leading-relaxed">
              Mini-rapport PDF 1 page : score global, 3 alertes phares, impact économique, QR code
              vers l'analyse complète. Idéal pour députés, journalistes, thread Twitter.
            </p>
            <Button onClick={() => generate("rejd", "share-verdict")}
              disabled={busy === "rejd-share-verdict"}
              className="rounded-sm font-semibold"
              style={{ background: "#D4A017", color: "#0D1B12" }}
              data-testid="gen-share-verdict">
              {busy === "rejd-share-verdict"
                ? <Loader2 size={12} className="mr-1 animate-spin" />
                : <QrCode size={12} className="mr-1" />}
              Générer le PDF de partage
            </Button>
          </div>
        </div>
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
            <div className="grid grid-cols-2 gap-1.5">
              <FormatButton format="pdf" preset={p.id} disabled={p.disabled} busy={busy} onClick={() => generate(p.id, "pdf")} hero={p.hero} testid={`gen-${p.id}-pdf`}>
                <Download size={10} className="mr-1" /> PDF
              </FormatButton>
              <FormatButton format="word" preset={p.id} disabled={p.disabled} busy={busy} onClick={() => generate(p.id, "word")} testid={`gen-${p.id}-word`}>
                <FileType size={10} className="mr-1" /> Word
              </FormatButton>
              <FormatButton format="excel" preset={p.id} disabled={p.disabled} busy={busy} onClick={() => generate(p.id, "excel")} testid={`gen-${p.id}-excel`}>
                <FileSpreadsheet size={10} className="mr-1" /> Excel
              </FormatButton>
              {p.hero ? (
                <>
                  <FormatButton format="zip" preset={p.id} disabled={p.disabled} busy={busy} onClick={() => generate(p.id, "zip")} hero testid={`gen-${p.id}-zip`}>
                    <Archive size={10} className="mr-1" /> Pack ZIP
                  </FormatButton>
                  <FormatButton format="rejd-complete" preset={p.id} disabled={p.disabled} busy={busy} onClick={() => generate(p.id, "rejd-complete")} hero testid={`gen-${p.id}-complete`}>
                    <Award size={10} className="mr-1" /> REJD 8 parties
                  </FormatButton>
                </>
              ) : (
                <div />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FormatButton({ format, preset, disabled, busy, onClick, hero, children, testid }) {
  const isBusy = busy === `${preset}-${format}`;
  return (
    <Button onClick={onClick} disabled={disabled || isBusy}
      size="sm" className="rounded-sm text-[11px] h-8"
      style={hero ? { background: "#D4A017", color: "#0D1B12" } : { background: "#1B4332", color: "white" }}
      data-testid={testid}>
      {isBusy ? <Loader2 size={10} className="mr-1 animate-spin" /> : children}
    </Button>
  );
}


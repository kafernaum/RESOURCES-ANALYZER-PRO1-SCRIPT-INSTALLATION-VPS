import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Loader2, Link2, CheckCircle2, AlertCircle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export default function SuiteConnect({ projectId }) {
  const [status, setStatus] = useState(null);
  const [crossCheck, setCrossCheck] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/suite/status").then(({ data }) => setStatus(data));
  }, []);

  const runCross = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/projects/${projectId}/suite/cross-check`);
      setCrossCheck(data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4" data-testid="suite-connect">
      <div className="rap-card p-5">
        <h2 className="font-display text-lg font-bold mb-1 flex items-center gap-2">
          <Link2 size={18} style={{ color: "#D4A017" }} />
          Suite Ahmed ELY Mustapha
        </h2>
        <p className="text-xs opacity-70 mb-4">
          Croisement avec les applications sœurs :{" "}
          <b>VITAE-PUBLICA</b> (transparence de la vie publique) et{" "}
          <b>DEBT-ANALYZER PRO</b> (analyse de la dette publique, détection des prêts adossés).
        </p>
        {status && (
          <div className="grid md:grid-cols-2 gap-3 mb-4">
            {status.apps.map((a) => (
              <div key={a.key} className="border rounded-sm p-4"
                style={{
                  borderColor: a.connected ? "#27AE60" : "hsl(var(--border))",
                  background: a.connected ? "rgba(39,174,96,0.05)" : "rgba(0,0,0,0.02)",
                }}
                data-testid={`suite-app-${a.key}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-display font-bold text-sm">{a.name}</div>
                  {a.connected ? (
                    <CheckCircle2 size={14} style={{ color: "#27AE60" }} />
                  ) : (
                    <AlertCircle size={14} style={{ color: "#E67E22" }} />
                  )}
                </div>
                <div className="text-xs opacity-80 mb-2">{a.description}</div>
                <div className="font-mono text-[10px] uppercase"
                  style={{ color: a.connected ? "#27AE60" : "#E67E22" }}>
                  {a.connected ? "● connecté" : "○ non configuré"}
                </div>
              </div>
            ))}
          </div>
        )}
        {status?.hint && !status.apps.every((a) => a.connected) && (
          <div className="text-[11px] opacity-70 italic border-l-2 pl-3"
            style={{ borderColor: "rgba(212,160,23,0.4)" }}>
            {status.hint}
          </div>
        )}

        <Button onClick={runCross} disabled={busy} className="rounded-sm font-semibold mt-4"
          style={{ background: "#1B4332", color: "white" }}
          data-testid="suite-crosscheck-btn">
          {busy ? <Loader2 size={14} className="mr-2 animate-spin" /> : <ShieldAlert size={14} className="mr-2" />}
          Lancer le cross-check
        </Button>
      </div>

      {crossCheck && (
        <div className="grid md:grid-cols-2 gap-3" data-testid="suite-result">
          <CrossCheckCard title="VITAE-PUBLICA" data={crossCheck.vitae_publica}
            fields={[
              ["beneficial_owners", "Bénéficiaires effectifs"],
              ["pep_flags", "Personnes politiquement exposées"],
              ["conflicts", "Conflits d'intérêts"],
            ]} />
          <CrossCheckCard title="DEBT-ANALYZER PRO" data={crossCheck.debt_analyzer}
            fields={[
              ["rbl_matches", "Correspondances RBL"],
              ["concerning_loans", "Prêts problématiques"],
              ["debt_exposure_usd", "Exposition dette (USD)"],
            ]} />
        </div>
      )}
    </div>
  );
}

function CrossCheckCard({ title, data, fields }) {
  return (
    <div className="rap-card p-5">
      <h3 className="font-display text-base font-bold mb-2">{title}</h3>
      {data?.connected ? (
        <div className="space-y-2">
          {fields.map(([key, label]) => {
            const v = data[key];
            return (
              <div key={key} className="text-xs flex items-center justify-between border-b pb-1"
                style={{ borderColor: "hsl(var(--border))" }}>
                <span className="opacity-80">{label}</span>
                <span className="font-mono font-semibold">
                  {Array.isArray(v) ? `${v.length} trouvé(s)` : (v ?? "—")}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-xs opacity-70 italic">{data?.message || "Non configuré."}</div>
      )}
    </div>
  );
}

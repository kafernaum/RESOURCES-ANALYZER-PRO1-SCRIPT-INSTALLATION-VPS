import { Button } from "./ui/button";
import { Loader2, AlertTriangle, Sparkles, Scale, Gavel, Megaphone, Building2 } from "lucide-react";

const GRAVITE_COLOR = {
  mineure: "#1A3C5E", moderee: "#E67E22", grave: "#C0392B", critique: "#C0392B",
};

const PRIORITE_LABEL = {
  urgent: "URGENT — 3 mois", court_terme: "COURT TERME — 1 an",
  moyen_terme: "MOYEN TERME — 3 ans", long_terme: "LONG TERME",
};

const MOYEN_ICONS = {
  parlementaire: Building2, judiciaire_national: Scale,
  constitutionnel: Gavel, arbitral_international: Scale,
  international: Megaphone, penal: AlertTriangle,
};

export default function DiagnosticsList({ diagnostics, canGenerate, onGenerate, busy }) {
  const fiches = diagnostics?.fiches || [];

  if (!fiches.length) {
    return (
      <div className="rap-card p-12 text-center" data-testid="diagnostics-empty">
        <AlertTriangle size={32} className="mx-auto mb-3 opacity-40" />
        <p className="opacity-70 text-sm mb-4">
          Aucune fiche diagnostic n'a encore été générée pour ce projet.
        </p>
        {canGenerate && (
          <Button onClick={onGenerate} disabled={busy}
            className="rounded-sm font-semibold"
            style={{ background: "#D4A017", color: "#0D1B12" }}
            data-testid="generate-diagnostics-btn">
            {busy ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Sparkles size={14} className="mr-2" />}
            Générer les fiches diagnostic (GPT-4o)
          </Button>
        )}
        {!canGenerate && (
          <p className="text-xs opacity-60">
            Lancez d'abord l'analyse juridique dans l'onglet "Analyses".
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="diagnostics-list">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display text-lg font-bold">{fiches.length} fiches diagnostic</h2>
      </div>
      {fiches.map((f, i) => (
        <div key={i} className="rap-card p-5"
          data-testid={`diagnostic-fiche-${i}`}
          style={{ borderLeft: `3px solid ${GRAVITE_COLOR[f.gravite] || "#1A3C5E"}` }}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-wider mb-1 font-semibold" style={{ color: GRAVITE_COLOR[f.gravite] }}>
                Fiche #{i + 1} — {f.gravite}
              </div>
              <h3 className="font-display text-base font-bold leading-snug">{f.anomalie}</h3>
            </div>
            <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm flex-shrink-0"
              style={{ background: "rgba(212, 160, 23, 0.15)", color: "#D4A017" }}>
              {PRIORITE_LABEL[f.priorite] || f.priorite}
            </span>
          </div>

          <div className="text-xs opacity-80 mb-3 leading-relaxed">
            <b>Qualification :</b> {f.qualification_juridique}
          </div>

          <div className="grid md:grid-cols-2 gap-3 text-xs">
            <Block label="Argument jurisprudentiel principal">{f.argument_jurisprudentiel_principal}</Block>
            <Block label="Ratio decidendi">{f.ratio_decidendi}</Block>
          </div>

          {(f.normes_internationales_violees?.length > 0 || f.articles_nationaux_violes?.length > 0) && (
            <div className="mt-3 grid md:grid-cols-2 gap-3 text-xs">
              {f.normes_internationales_violees?.length > 0 && (
                <ListBlock label="Normes internationales violées" items={f.normes_internationales_violees} />
              )}
              {f.articles_nationaux_violes?.length > 0 && (
                <ListBlock label="Articles nationaux violés" items={f.articles_nationaux_violes} />
              )}
            </div>
          )}

          {f.qualification_penale_potentielle && (
            <div className="mt-3 p-3 rounded-sm text-xs"
              style={{ background: "rgba(192, 57, 43, 0.08)", color: "#C0392B" }}>
              <b>Qualification pénale potentielle :</b> {f.qualification_penale_potentielle}
            </div>
          )}

          {f.impact_financier_usd > 0 && (
            <div className="mt-3 text-sm font-mono">
              <b>Impact financier estimé :</b> {(f.impact_financier_usd / 1e6).toFixed(1)} M USD
            </div>
          )}

          {f.solutions?.length > 0 && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: "hsl(var(--border))" }}>
              <h4 className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: "#27AE60" }}>
                Solutions recommandées
              </h4>
              <div className="space-y-1.5">
                {f.solutions.map((s, j) => (
                  <div key={j} className="text-xs">
                    <b className="capitalize">{s.type?.replace(/_/g, ' ')} :</b> {s.description}
                    {s.probabilite_succes && (
                      <span className="ml-2 text-[10px] opacity-70">(succès : {s.probabilite_succes})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {f.moyens_denonciation?.length > 0 && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: "hsl(var(--border))" }}>
              <h4 className="text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: "#1A3C5E" }}>
                Moyens de dénonciation
              </h4>
              <div className="grid sm:grid-cols-2 gap-2">
                {f.moyens_denonciation.map((m, j) => {
                  const Icon = MOYEN_ICONS[m.type] || Megaphone;
                  return (
                    <div key={j} className="flex items-start gap-2 text-xs p-2 rounded-sm"
                      style={{ background: "hsl(var(--muted))" }}>
                      <Icon size={12} className="mt-0.5 flex-shrink-0" style={{ color: "#D4A017" }} />
                      <div>
                        <b className="capitalize">{m.type?.replace(/_/g, ' ')}</b>
                        <div className="opacity-80">{m.description}</div>
                        {m.autorite_competente && (
                          <div className="opacity-60 text-[10px] mt-0.5">{m.autorite_competente}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Block({ label, children }) {
  return (
    <div className="p-3 rounded-sm" style={{ background: "hsl(var(--muted))" }}>
      <div className="text-[10px] uppercase tracking-wider opacity-60 mb-1">{label}</div>
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

function ListBlock({ label, items }) {
  return (
    <div className="p-3 rounded-sm" style={{ background: "hsl(var(--muted))" }}>
      <div className="text-[10px] uppercase tracking-wider opacity-60 mb-1">{label}</div>
      <ul className="space-y-1 list-disc list-inside">
        {items.map((it, i) => <li key={i} className="text-xs">{it}</li>)}
      </ul>
    </div>
  );
}

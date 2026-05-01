import { ShieldAlert } from "lucide-react";

export default function LegalDisclaimer({ compact = false }) {
  if (compact) {
    return (
      <div
        className="rap-disclaimer flex items-start gap-2 px-3 py-2 text-xs rounded-sm"
        data-testid="legal-disclaimer-compact"
      >
        <ShieldAlert size={14} className="mt-0.5 flex-shrink-0" />
        <span>
          <b>DOCUMENT PÉDAGOGIQUE</b> — Cette analyse n'a aucune valeur juridictionnelle.
          Consultez un avocat qualifié avant toute action.
        </span>
      </div>
    );
  }
  return (
    <div
      className="rap-disclaimer px-4 py-3 text-sm rounded-sm flex items-start gap-3 mb-4"
      data-testid="legal-disclaimer"
    >
      <ShieldAlert size={18} className="mt-0.5 flex-shrink-0" />
      <div>
        <div className="font-semibold mb-0.5">DOCUMENT PÉDAGOGIQUE</div>
        <div className="opacity-90">
          Cette analyse est un outil d'aide à la réflexion juridique. Elle ne constitue pas un
          avis juridique et n'a aucune valeur juridictionnelle. Consultez un avocat qualifié
          avant toute action.
        </div>
      </div>
    </div>
  );
}

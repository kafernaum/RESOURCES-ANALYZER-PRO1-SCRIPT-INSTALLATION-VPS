import { Link } from "react-router-dom";
import { Construction } from "lucide-react";

export default function Placeholder({ title, subtitle, testid }) {
  return (
    <div className="p-6" data-testid={testid || "placeholder-page"}>
      <h1 className="font-display text-3xl font-bold tracking-tight mb-1">{title}</h1>
      {subtitle && <p className="text-sm opacity-70 mb-6">{subtitle}</p>}
      <div className="rap-card p-12 text-center">
        <Construction size={36} className="mx-auto mb-4" style={{ color: "#D4A017" }} />
        <h2 className="font-display text-xl font-bold mb-2">Module en développement</h2>
        <p className="text-sm opacity-70 max-w-md mx-auto mb-4">
          Cette section fait partie de la roadmap RESOURCES-ANALYZER PRO et sera disponible
          dans les prochains cycles. Ouvrez un projet pour accéder aux fonctionnalités déjà actives.
        </p>
        <Link to="/projects" className="text-sm font-semibold" style={{ color: "#D4A017" }}>
          → Mes projets
        </Link>
      </div>
    </div>
  );
}

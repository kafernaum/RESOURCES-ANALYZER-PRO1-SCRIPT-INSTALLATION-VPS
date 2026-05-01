import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Scale, Folder, ExternalLink } from "lucide-react";

export default function Jurisprudence() {
  const nav = useNavigate();
  const [projects, setProjects] = useState([]);
  const [intl, setIntl] = useState([]);

  useEffect(() => {
    api.get("/projects").then(({ data }) => setProjects(data));
    api.get("/normative/jurisprudence").then(({ data }) => setIntl(data.items || []));
  }, []);

  return (
    <div className="p-6" data-testid="jurisprudence-standalone">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-2">
          <Scale size={28} style={{ color: "#D4A017" }} />
          Jurisprudence
        </h1>
        <p className="text-sm opacity-70 mt-1">
          La jurisprudence nationale s'indexe par projet. La jurisprudence internationale
          (CIRDI, CIJ, IADH, Commission africaine) est pré-chargée et utilisée dans toutes
          les analyses.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rap-card p-5">
          <h2 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
            <Folder size={18} style={{ color: "#D4A017" }} />
            Vos projets
          </h2>
          <p className="text-xs opacity-70 mb-3">
            Téléversez les arrêts et jugements nationaux dans l'onglet "Jurisprudence" de chaque projet.
          </p>
          {projects.length === 0 ? (
            <div className="text-xs opacity-60">
              Aucun projet. <button onClick={() => nav("/projects/new")} className="underline">Créez-en un</button>.
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-auto">
              {projects.map((p) => (
                <button key={p.id} onClick={() => nav(`/projects/${p.id}`)}
                  className="w-full text-left border rounded-sm p-3 flex items-center justify-between hover:bg-secondary transition-colors"
                  style={{ borderColor: "hsl(var(--border))" }}
                  data-testid={`jur-link-project-${p.id}`}>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate">{p.name}</div>
                    <div className="text-xs opacity-70">
                      {p.country} · {p.sector}
                    </div>
                  </div>
                  <ExternalLink size={14} className="opacity-60 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rap-card p-5">
          <h2 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
            <Scale size={18} style={{ color: "#1A3C5E" }} />
            Jurisprudence internationale ({intl.length})
          </h2>
          <p className="text-xs opacity-70 mb-3">
            Affaires de référence pré-chargées et utilisées automatiquement dans les analyses.
          </p>
          <div className="space-y-2 max-h-[400px] overflow-auto">
            {intl.map((j, i) => (
              <div key={i} className="border rounded-sm p-3" style={{ borderColor: "hsl(var(--border))" }}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-xs px-2 py-0.5 rounded-sm font-bold"
                    style={{ background: "rgba(26, 60, 94, 0.1)", color: "#1A3C5E" }}>
                    {j.tribunal} · {j.year}
                  </span>
                  <span className="text-[10px] opacity-60 italic">{j.topic}</span>
                </div>
                <div className="font-semibold text-xs mb-1">{j.case_name}</div>
                <div className="text-xs opacity-80 leading-relaxed">{j.ratio}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

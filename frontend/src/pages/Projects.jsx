import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Plus, Trash2, ExternalLink, Folder } from "lucide-react";
import { toast } from "sonner";

export default function Projects() {
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    api.get("/projects").then(({ data }) => setItems(data)).finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  const onDelete = async (id) => {
    if (!window.confirm("Supprimer ce projet et toutes ses données associées ?")) return;
    try {
      await api.delete(`/projects/${id}`);
      toast.success("Projet supprimé");
      refresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    }
  };

  return (
    <div className="p-6" data-testid="projects-page">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Mes projets</h1>
          <p className="text-sm opacity-70 mt-1">Chaque projet correspond à une convention analysée.</p>
        </div>
        <Button onClick={() => nav("/projects/new")} className="rounded-sm font-semibold"
          style={{ background: "#D4A017", color: "#0D1B12" }} data-testid="projects-new">
          <Plus size={16} className="mr-1" /> Nouveau projet
        </Button>
      </div>

      {loading ? (
        <div className="opacity-60 text-sm">Chargement...</div>
      ) : items.length === 0 ? (
        <div className="rap-card p-12 text-center">
          <Folder size={36} className="mx-auto mb-4 opacity-40" />
          <p className="opacity-70 text-sm mb-4">Aucun projet pour le moment.</p>
          <Button onClick={() => nav("/projects/new")} className="rounded-sm"
            style={{ background: "#1B4332", color: "white" }}>
            Créer mon premier projet
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((p) => (
            <div key={p.id} className="rap-card p-5 hover:shadow-md transition-shadow"
              data-testid={`project-card-${p.id}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="font-display font-bold truncate flex-1">{p.name}</div>
                <span
                  className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm font-mono"
                  style={{ background: "rgba(212, 160, 23, 0.15)", color: "#D4A017" }}
                >
                  {p.sector}
                </span>
              </div>
              <div className="text-xs opacity-70 mb-3 space-y-1">
                <div><b>Pays :</b> {p.country || "—"}</div>
                {p.resource_type && <div><b>Ressource :</b> {p.resource_type}</div>}
                <div className="font-mono">{new Date(p.created_at).toLocaleDateString("fr-FR")}</div>
              </div>
              {p.description && <p className="text-xs opacity-80 mb-3 line-clamp-2">{p.description}</p>}
              <div className="flex gap-2 pt-2 border-t" style={{ borderColor: "hsl(var(--border))" }}>
                <Button size="sm" onClick={() => nav(`/projects/${p.id}`)}
                  className="flex-1 rounded-sm text-xs"
                  style={{ background: "#1B4332", color: "white" }}
                  data-testid={`project-open-${p.id}`}>
                  <ExternalLink size={12} className="mr-1" /> Ouvrir
                </Button>
                <Button size="sm" variant="outline" onClick={() => onDelete(p.id)}
                  className="rounded-sm" data-testid={`project-delete-${p.id}`}>
                  <Trash2 size={12} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

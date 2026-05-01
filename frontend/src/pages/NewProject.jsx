import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";

export default function NewProject() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    name: "", country: "", sector: "mines", resource_type: "", description: "",
  });
  const [loading, setLoading] = useState(false);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/projects", form);
      toast.success("Projet créé");
      nav(`/projects/${data.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl" data-testid="new-project-page">
      <h1 className="font-display text-3xl font-bold tracking-tight mb-2">Nouveau projet d'analyse</h1>
      <p className="text-sm opacity-70 mb-6">
        Un projet correspond à une convention spécifique (ou un groupe d'avenants liés).
      </p>

      <form onSubmit={onSubmit} className="rap-card p-6 space-y-4">
        <div>
          <Label htmlFor="name">Nom du projet *</Label>
          <Input id="name" required value={form.name} onChange={(e) => update("name", e.target.value)}
            placeholder="Ex : Convention Tasiast — Mauritanie 2017"
            className="rounded-sm mt-1" data-testid="np-name" />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="country">Pays *</Label>
            <Input id="country" required value={form.country} onChange={(e) => update("country", e.target.value)}
              placeholder="Ex : Mauritanie"
              className="rounded-sm mt-1" data-testid="np-country" />
          </div>
          <div>
            <Label htmlFor="sector">Secteur *</Label>
            <Select value={form.sector} onValueChange={(v) => update("sector", v)}>
              <SelectTrigger className="rounded-sm mt-1" data-testid="np-sector">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mines">Mines</SelectItem>
                <SelectItem value="petrole">Pétrole</SelectItem>
                <SelectItem value="gaz">Gaz</SelectItem>
                <SelectItem value="maritime">Maritime / Pêche</SelectItem>
                <SelectItem value="foret">Forêt</SelectItem>
                <SelectItem value="mixte">Mixte</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="resource_type">Ressource précise</Label>
          <Input id="resource_type" value={form.resource_type} onChange={(e) => update("resource_type", e.target.value)}
            placeholder="Ex : or, fer, phosphate, pétrole brut, gaz naturel..."
            className="rounded-sm mt-1" data-testid="np-resource" />
        </div>

        <div>
          <Label htmlFor="description">Description / Contexte</Label>
          <Textarea id="description" rows={4} value={form.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Brève description du contexte de la convention..."
            className="rounded-sm mt-1" data-testid="np-description" />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}
            className="rounded-sm font-semibold"
            style={{ background: "#D4A017", color: "#0D1B12" }}
            data-testid="np-submit">
            {loading ? "Création..." : "Créer le projet"}
          </Button>
          <Button type="button" variant="outline" onClick={() => nav("/projects")} className="rounded-sm">
            Annuler
          </Button>
        </div>
      </form>
    </div>
  );
}

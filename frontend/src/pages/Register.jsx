import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Logo from "../components/Logo";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    email: "", password: "", name: "", organization: "", country: "", role: "juriste",
  });
  const [loading, setLoading] = useState(false);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      toast.success("Compte créé. Bienvenue !");
      nav("/dashboard");
    } catch (err) {
      const d = err?.response?.data?.detail;
      const msg = Array.isArray(d)
        ? d.map((x) => `${x.loc?.slice(-1)[0] || ""}: ${x.msg}`).join(" · ")
        : (d || err?.message || "Erreur lors de la création (vérifiez votre connexion)");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 py-12"
      style={{ background: "linear-gradient(135deg, #0D1B12 0%, #1A3C5E 100%)" }}
      data-testid="register-page"
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-block mb-4"><Logo size="lg" /></div>
        </div>
        <div
          className="rounded-sm p-8 border"
          style={{
            background: "hsl(var(--card))",
            borderColor: "rgba(212, 160, 23, 0.3)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          }}
        >
          <h1 className="font-display text-2xl font-bold mb-1">Créer un compte</h1>
          <p className="text-sm opacity-70 mb-6">Rejoignez les défenseurs de la souveraineté.</p>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="name">Nom complet</Label>
                <Input id="name" required value={form.name} onChange={(e) => update("name", e.target.value)}
                  className="rounded-sm mt-1" data-testid="register-name" />
              </div>
              <div>
                <Label htmlFor="role">Rôle</Label>
                <Select value={form.role} onValueChange={(v) => update("role", v)}>
                  <SelectTrigger className="rounded-sm mt-1" data-testid="register-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="juriste">Juriste / Avocat</SelectItem>
                    <SelectItem value="parlementaire">Parlementaire</SelectItem>
                    <SelectItem value="gouvernement">Gouvernement</SelectItem>
                    <SelectItem value="ong">ONG / Société civile</SelectItem>
                    <SelectItem value="chercheur">Chercheur</SelectItem>
                    <SelectItem value="citoyen">Citoyen</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={form.email} onChange={(e) => update("email", e.target.value)}
                className="rounded-sm mt-1" data-testid="register-email" />
            </div>
            <div>
              <Label htmlFor="password">Mot de passe (min. 6 caractères)</Label>
              <Input id="password" type="password" required minLength={6} value={form.password}
                onChange={(e) => update("password", e.target.value)}
                className="rounded-sm mt-1" data-testid="register-password" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="organization">Organisation</Label>
                <Input id="organization" value={form.organization}
                  onChange={(e) => update("organization", e.target.value)}
                  className="rounded-sm mt-1" data-testid="register-org" />
              </div>
              <div>
                <Label htmlFor="country">Pays</Label>
                <Input id="country" value={form.country}
                  onChange={(e) => update("country", e.target.value)}
                  className="rounded-sm mt-1" data-testid="register-country" />
              </div>
            </div>
            <Button type="submit" disabled={loading}
              className="w-full rounded-sm font-semibold mt-2"
              style={{ background: "#1B4332", color: "white" }}
              data-testid="register-submit">
              {loading ? "Création..." : "Créer mon compte"}
            </Button>
          </form>
          <div className="text-center text-xs mt-6 opacity-70">
            Déjà un compte ?{" "}
            <Link to="/login" className="font-semibold" style={{ color: "#D4A017" }} data-testid="register-to-login">
              Se connecter
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

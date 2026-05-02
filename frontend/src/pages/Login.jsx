import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Logo from "../components/Logo";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Connexion réussie");
      nav("/dashboard");
    } catch (err) {
      const d = err?.response?.data?.detail;
      const msg = Array.isArray(d)
        ? d.map((x) => `${x.loc?.slice(-1)[0] || ""}: ${x.msg}`).join(" · ")
        : (d || err?.message || "Identifiants invalides (vérifiez votre connexion)");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "linear-gradient(135deg, #0D1B12 0%, #1A3C5E 100%)" }}
      data-testid="login-page"
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
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
          <h1 className="font-display text-2xl font-bold mb-1">Connexion</h1>
          <p className="text-sm opacity-70 mb-6">Accédez à votre espace souverain.</p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                className="rounded-sm mt-1"
                data-testid="login-email"
              />
            </div>
            <div>
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password" type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-sm mt-1"
                data-testid="login-password"
              />
            </div>
            <Button
              type="submit" disabled={loading}
              className="w-full rounded-sm font-semibold"
              style={{ background: "#1B4332", color: "white" }}
              data-testid="login-submit"
            >
              {loading ? "Connexion..." : "Se connecter"}
            </Button>
          </form>
          <div className="text-center text-xs mt-6 opacity-70">
            Pas de compte ?{" "}
            <Link to="/register" className="font-semibold" style={{ color: "#D4A017" }} data-testid="login-to-register">
              Créer un compte
            </Link>
          </div>
        </div>
        <div className="text-center text-[10px] mt-6 opacity-50" style={{ color: "#E2E8F0" }}>
          Méthodologie : Ahmed ELY Mustapha
        </div>
      </div>
    </div>
  );
}

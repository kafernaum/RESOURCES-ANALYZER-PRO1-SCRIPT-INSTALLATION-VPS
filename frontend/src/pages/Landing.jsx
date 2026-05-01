import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import Logo from "../components/Logo";
import {
  Scale, ShieldCheck, Sprout, FileSearch, ArrowRight, BarChart3,
  AlertTriangle, BookOpen, FileBarChart, Globe2,
} from "lucide-react";
import { Button } from "../components/ui/button";

const FEATURES = [
  { icon: FileSearch, title: "Extraction structurée", desc: "PDF, Word, Excel — extraction GPT-4o stricte de tous les paramètres juridiques, fiscaux, environnementaux et sociaux d'une convention." },
  { icon: Scale, title: "7 analyses fondamentales", desc: "Juridique, fiscale, environnementale (SEC), sociale (SSC), déséquilibre (IDC), souveraineté (SOS) — confrontation au droit national et international." },
  { icon: AlertTriangle, title: "Diagnostics défendables", desc: "Pour chaque anomalie : qualification, jurisprudence, impact, solutions et 6 voies de dénonciation." },
  { icon: BookOpen, title: "Référentiel intégré", desc: "Plus de 40 normes internationales, régionales africaines et standards contractuels pré-chargés." },
  { icon: BarChart3, title: "14 visualisations", desc: "Gauges, radar, donut, treemap, waterfall, sankey, scatter, heatmap, carte de concession — zéro donnée fictive." },
  { icon: FileBarChart, title: "Rapports REJD", desc: "Rapport d'Expertise Juridique Défendable, parlementaire, citoyen, environnemental, renégociation — exportables PDF." },
];

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/dashboard");
  }, [user, navigate]);

  return (
    <div className="min-h-screen" data-testid="landing-page" style={{ background: "var(--rap-dark-bg)" }}>
      {/* Header */}
      <header className="border-b" style={{ borderColor: "rgba(212, 160, 23, 0.2)" }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo size="md" />
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm hover:opacity-80 transition-opacity"
              style={{ color: "#E2E8F0" }}
              data-testid="landing-login-link"
            >
              Connexion
            </Link>
            <Link to="/register" data-testid="landing-register-link">
              <Button
                className="rounded-sm font-semibold"
                style={{ background: "#D4A017", color: "#0D1B12" }}
              >
                Créer un compte
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #0D1B12 0%, #112418 50%, #0D1B12 100%)",
          color: "#E2E8F0",
        }}
      >
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 50%, rgba(212, 160, 23, 0.15), transparent 40%), radial-gradient(circle at 80% 80%, rgba(26, 60, 94, 0.4), transparent 50%)",
          }}
        />
        <div className="relative max-w-7xl mx-auto px-6 py-20 md:py-28 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 rap-fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm mb-6 text-xs uppercase tracking-[0.2em] font-semibold"
              style={{ background: "rgba(212, 160, 23, 0.12)", color: "#D4A017", border: "1px solid rgba(212, 160, 23, 0.3)" }}>
              <ShieldCheck size={12} /> Expertise juridique souveraine
            </div>
            <h1 className="font-display font-black tracking-tight text-4xl sm:text-5xl lg:text-6xl mb-6 leading-[1.05]">
              La transparence contractuelle
              <br />
              <span style={{ color: "#D4A017" }}>au service du peuple.</span>
            </h1>
            <p className="text-base lg:text-lg max-w-2xl mb-8 leading-relaxed" style={{ color: "#cbd5e1" }}>
              <i>« Chaque ressource naturelle appartient au peuple — chaque convention doit le prouver. »</i>
              <br/><br/>
              Plateforme d'analyse souveraine des conventions d'exploitation minière, pétrolière, gazière, maritime et forestière.
              Détection des violations, des déséquilibres et des atteintes à la souveraineté — production de rapports d'expertise défendables.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/register" data-testid="hero-cta-primary">
                <Button
                  size="lg"
                  className="rounded-sm font-semibold rap-pulse-gold h-12 px-6"
                  style={{ background: "#D4A017", color: "#0D1B12" }}
                >
                  Analyser une convention
                  <ArrowRight size={16} className="ml-2" />
                </Button>
              </Link>
              <Link to="/login" data-testid="hero-cta-secondary">
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-sm h-12 px-6"
                  style={{
                    borderColor: "rgba(212, 160, 23, 0.4)",
                    color: "#E2E8F0",
                    background: "transparent",
                  }}
                >
                  Connexion à mon espace
                </Button>
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-6 max-w-lg">
              <div data-testid="stat-norms">
                <div className="font-mono text-3xl font-bold" style={{ color: "#D4A017" }}>40+</div>
                <div className="text-xs opacity-70 uppercase tracking-wider mt-1">Normes intégrées</div>
              </div>
              <div data-testid="stat-analyses">
                <div className="font-mono text-3xl font-bold" style={{ color: "#D4A017" }}>7</div>
                <div className="text-xs opacity-70 uppercase tracking-wider mt-1">Analyses</div>
              </div>
              <div data-testid="stat-reports">
                <div className="font-mono text-3xl font-bold" style={{ color: "#D4A017" }}>7</div>
                <div className="text-xs opacity-70 uppercase tracking-wider mt-1">Rapports</div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-5 hidden lg:flex justify-center">
            <div
              className="relative w-80 h-80 rounded-sm flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, rgba(27,67,50,0.5), rgba(26,60,94,0.5))",
                border: "1px solid rgba(212,160,23,0.3)",
                boxShadow: "0 0 80px rgba(212,160,23,0.15), inset 0 0 40px rgba(0,0,0,0.4)",
              }}
              data-testid="hero-emblem"
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <Globe2 size={200} color="rgba(212, 160, 23, 0.25)" strokeWidth={0.6} />
              </div>
              <div className="relative text-center">
                <Sprout size={48} color="#D4A017" className="mx-auto mb-2" />
                <div className="font-display text-xl font-bold" style={{ color: "#D4A017" }}>
                  RESOURCES
                </div>
                <div className="font-display text-xl font-bold" style={{ color: "#E2E8F0" }}>
                  ANALYZER PRO
                </div>
                <div className="rap-divider-gold w-32 mx-auto my-3" />
                <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "#27AE60" }}>
                  Souveraineté
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6" style={{ background: "#0D1B12", color: "#E2E8F0" }}>
        <div className="max-w-7xl mx-auto">
          <div className="mb-12 max-w-3xl">
            <div className="rap-divider-gold w-20 mb-4" />
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 leading-tight">
              Une expertise juridique <span style={{ color: "#D4A017" }}>défendable sans faille</span>
            </h2>
            <p className="text-base opacity-80">
              Conçue pour les juristes, parlementaires, gouvernements, ONG, journalistes et chercheurs
              qui exigent rigueur, traçabilité et puissance argumentaire.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="p-6 rounded-sm border transition-all hover:translate-y-[-2px]"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  borderColor: "rgba(212, 160, 23, 0.15)",
                }}
                data-testid={`feature-${f.title.replace(/\s+/g, '-').toLowerCase()}`}
              >
                <f.icon size={24} color="#D4A017" />
                <h3 className="font-display text-lg font-bold mt-4 mb-2">{f.title}</h3>
                <p className="text-sm opacity-75 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="py-16 px-6 text-center"
        style={{ background: "linear-gradient(135deg, #1B4332 0%, #1A3C5E 100%)", color: "#fff" }}
      >
        <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 max-w-3xl mx-auto leading-tight">
          La souveraineté commence par la <span style={{ color: "#D4A017" }}>connaissance des contrats</span>.
        </h2>
        <p className="opacity-80 mb-8 max-w-2xl mx-auto">
          Téléversez votre première convention et obtenez en quelques minutes un diagnostic complet,
          des graphiques avancés et un rapport d'expertise prêt à l'emploi.
        </p>
        <Link to="/register" data-testid="footer-cta">
          <Button
            size="lg"
            className="rounded-sm font-semibold h-12 px-8"
            style={{ background: "#D4A017", color: "#0D1B12" }}
          >
            Commencer gratuitement
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer
        className="py-8 px-6 text-center text-xs"
        style={{ background: "#0a140e", color: "rgba(226,232,240,0.6)" }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="mb-2">
            <b style={{ color: "#D4A017" }}>RESOURCES-ANALYZER PRO</b> — Méthodologie : Ahmed ELY Mustapha,
            Juriste, Expert en Finances Publiques, PMP I-PMP IBM Full Stack Developer.
          </div>
          <div className="opacity-70">
            DOCUMENT PÉDAGOGIQUE — Les analyses produites n'ont aucune valeur juridictionnelle.
            Consultez un avocat qualifié avant toute action.
          </div>
        </div>
      </footer>
    </div>
  );
}

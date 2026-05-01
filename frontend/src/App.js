import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import NewProject from "@/pages/NewProject";
import ProjectDetail from "@/pages/ProjectDetail";
import Normative from "@/pages/Normative";
import Glossary from "@/pages/Glossary";
import Simulator from "@/pages/Simulator";
import Placeholder from "@/pages/Placeholder";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="App">
          <Toaster position="top-right" richColors closeButton />
          <BrowserRouter>
            <Routes>
              {/* Public */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Protected */}
              <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/projects/new" element={<NewProject />} />
                <Route path="/projects/:id" element={<ProjectDetail />} />
                <Route path="/library" element={<Placeholder title="Bibliothèque documentaire globale" subtitle="Téléversez vos documents depuis chaque projet pour le moment." testid="library-page" />} />
                <Route path="/normative" element={<Normative />} />
                <Route path="/jurisprudence" element={<Placeholder title="Jurisprudence" subtitle="Consultez la jurisprudence internationale dans le Référentiel normatif." testid="jurisprudence-page" />} />
                <Route path="/analyses" element={<Placeholder title="Analyses" subtitle="Ouvrez un projet pour lancer les analyses." testid="analyses-page" />} />
                <Route path="/diagnostics" element={<Placeholder title="Diagnostics" subtitle="Ouvrez un projet pour consulter les fiches diagnostic." testid="diagnostics-page" />} />
                <Route path="/visualizations" element={<Placeholder title="Visualisations" subtitle="Ouvrez un projet pour accéder aux 14 visualisations." testid="visualizations-page" />} />
                <Route path="/reports" element={<Placeholder title="Rapports" subtitle="Ouvrez un projet pour générer un rapport." testid="reports-page" />} />
                <Route path="/simulator" element={<Simulator />} />
                <Route path="/comparator" element={<Placeholder title="Comparateur de conventions" subtitle="Disponible dans une prochaine version." testid="comparator-page" />} />
                <Route path="/glossary" element={<Glossary />} />
                <Route path="/settings" element={<Placeholder title="Paramètres" subtitle="Profil utilisateur et préférences." testid="settings-page" />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

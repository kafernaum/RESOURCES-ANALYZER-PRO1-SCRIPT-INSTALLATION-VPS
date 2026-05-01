import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home, FolderKanban, Plus, FileText, BookOpen, Scale, Landmark,
  Search, AlertTriangle, BarChart3, FileBarChart, Globe, Settings,
  HelpCircle, Sliders, GitCompareArrows, ChevronLeft, ChevronRight,
} from "lucide-react";
import Logo from "./Logo";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: Home, testid: "nav-dashboard" },
  { to: "/projects", label: "Mes projets", icon: FolderKanban, testid: "nav-projects" },
  { to: "/projects/new", label: "Nouveau projet", icon: Plus, testid: "nav-new-project" },
  { type: "div" },
  { to: "/library", label: "Bibliothèque documentaire", icon: FileText, testid: "nav-library" },
  { to: "/normative", label: "Référentiel normatif", icon: BookOpen, testid: "nav-normative" },
  { to: "/jurisprudence", label: "Jurisprudence", icon: Scale, testid: "nav-jurisprudence" },
  { to: "/analyses", label: "Analyses", icon: Search, testid: "nav-analyses" },
  { to: "/diagnostics", label: "Diagnostics", icon: AlertTriangle, testid: "nav-diagnostics" },
  { to: "/visualizations", label: "Visualisations", icon: BarChart3, testid: "nav-visualizations" },
  { to: "/reports", label: "Rapports", icon: FileBarChart, testid: "nav-reports" },
  { type: "div" },
  { to: "/simulator", label: "Simulateur de renégociation", icon: Sliders, testid: "nav-simulator" },
  { to: "/comparator", label: "Comparateur multi-conventions", icon: GitCompareArrows, testid: "nav-comparator" },
  { to: "/models", label: "Conventions modèles", icon: GitCompareArrows, testid: "nav-models" },
  { to: "/glossary", label: "Glossaire", icon: HelpCircle, testid: "nav-glossary" },
];

export default function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation();

  return (
    <aside
      className="border-r flex flex-col transition-[width] duration-200"
      style={{
        width: collapsed ? 64 : 260,
        background: "linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--muted)) 100%)",
        borderColor: "hsl(var(--border))",
      }}
      data-testid="sidebar"
    >
      <div className="h-16 flex items-center justify-between px-3 border-b" style={{ borderColor: "hsl(var(--border))" }}>
        {!collapsed && <Logo size="sm" showText />}
        {collapsed && <Logo size="sm" showText={false} />}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-sm p-1 hover:bg-secondary transition-colors"
          data-testid="sidebar-toggle"
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV.map((item, i) => {
          if (item.type === "div") {
            return (
              <div
                key={`d-${i}`}
                className="my-2 mx-3 h-px"
                style={{ background: "hsl(var(--border))" }}
              />
            );
          }
          const Icon = item.icon;
          const active = location.pathname === item.to ||
            (item.to !== "/dashboard" && location.pathname.startsWith(item.to));
          return (
            <Link
              key={item.to}
              to={item.to}
              data-testid={item.testid}
              className={`flex items-center gap-3 px-3 py-2 mx-2 rounded-sm text-sm transition-colors ${
                active
                  ? "font-semibold"
                  : "hover:bg-secondary"
              }`}
              style={
                active
                  ? {
                      background: "rgba(212, 160, 23, 0.15)",
                      color: "#D4A017",
                      borderLeft: "2px solid #D4A017",
                      paddingLeft: collapsed ? 10 : 10,
                    }
                  : {}
              }
              title={collapsed ? item.label : ""}
            >
              <Icon size={16} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      <div
        className="p-3 border-t text-[10px] uppercase tracking-wider opacity-60"
        style={{ borderColor: "hsl(var(--border))" }}
      >
        {!collapsed && (
          <div data-testid="sidebar-footer-credit">
            Méthodologie<br />
            <span style={{ color: "#D4A017" }} className="font-semibold">Ahmed ELY Mustapha</span>
          </div>
        )}
      </div>
    </aside>
  );
}

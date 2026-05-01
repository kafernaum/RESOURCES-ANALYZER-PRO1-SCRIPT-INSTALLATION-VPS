import { Sun, Moon, LogOut, User, Settings } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export default function Header() {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header
      className="h-16 border-b px-6 flex items-center justify-between"
      style={{
        background: "hsl(var(--card))",
        borderColor: "hsl(var(--border))",
      }}
      data-testid="app-header"
    >
      <div>
        <h1 className="font-display text-base md:text-lg">
          Tableau de bord — <span style={{ color: "#D4A017" }}>Souveraineté contractuelle</span>
        </h1>
        <p className="text-xs opacity-60">La transparence contractuelle au service du peuple</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="h-9 w-9 rounded-sm border flex items-center justify-center hover:bg-secondary transition-colors"
          style={{ borderColor: "hsl(var(--border))" }}
          aria-label="Toggle theme"
          data-testid="theme-toggle"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="h-9 px-3 rounded-sm border flex items-center gap-2 hover:bg-secondary transition-colors text-sm"
            style={{ borderColor: "hsl(var(--border))" }}
            data-testid="user-menu-trigger"
          >
            <User size={14} />
            <span className="font-mono text-xs">{user?.name || user?.email || "User"}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" data-testid="user-menu-content">
            <DropdownMenuLabel>
              <div className="text-xs opacity-70">{user?.email}</div>
              <div className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: "#D4A017" }}>
                {user?.role || "juriste"}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")} data-testid="user-menu-settings">
              <Settings size={14} className="mr-2" />Paramètres
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => { logout(); navigate("/login"); }}
              data-testid="user-menu-logout"
            >
              <LogOut size={14} className="mr-2" />Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

// settings icon imported from lucide-react above

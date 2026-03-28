import { Link, useMatches } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Tableau de bord", icon: "🏠" },
  { to: "/medicament", label: "Médicament", icon: "💊" },
  { to: "/agenda", label: "Agenda", icon: "📅" },
  { to: "/aide", label: "Aide", icon: "❓" },
  { to: "/ordonnance", label: "Ordonnance", icon: "📝" },
  { to: "/patients", label: "Patients", icon: "👥" },
  { to: "/parametres", label: "Paramètres", icon: "⚙️" },
] as const;

export function Sidebar({ className }: { className?: string }) {
  const matches = useMatches();

  return (
    <aside
      className={cn(
        "flex flex-col w-64 h-full border-r bg-card text-card-foreground",
        className
      )}
    >
      <nav className="flex flex-col gap-1 p-4">
        {navItems.map((item) => {
          const isActive = matches.some(
            (m) => m.pathname?.startsWith(item.to) && item.to !== "/dashboard"
          ) || (item.to === "/dashboard" && matches[0]?.pathname === "/dashboard");

          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
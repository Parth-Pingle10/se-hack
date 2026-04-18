import { BarChart3, GitCompare, AlertTriangle, FileCheck2, Scale, Share2, TrendingUp, Settings as SettingsIcon, type LucideIcon } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/settings";

const itemsConfig = [
  { title: "Benford Analysis",    url: "/dashboard/benford",        icon: BarChart3, module: "benford" },
  { title: "Fuzzy Matching",      url: "/dashboard/fuzzy",          icon: GitCompare, module: "fuzzy" },
  { title: "Anomaly Detection",   url: "/dashboard/anomalies",      icon: AlertTriangle, module: "anomalies" },
  { title: "Bank Reconciliation", url: "/dashboard/reconciliation", icon: Scale, module: "reconciliation" },
  { title: "Risk Network",        url: "/dashboard/network",        icon: Share2, module: "riskNetwork" },
  { title: "Monte Carlo",         url: "/dashboard/monte-carlo",    icon: TrendingUp, module: "monteCarlo" },
  { title: "Final Conclusion",    url: "/dashboard/summary",        icon: FileCheck2, module: undefined },
];

const config = [
  { title: "Settings",            url: "/dashboard/settings",       icon: SettingsIcon, module: undefined },
];

export function AppSidebar() {
  const { pathname } = useLocation();
  const { settings } = useSettings();

  const renderItem = (item: { title: string; url: string; icon: LucideIcon; module?: string }) => {
    // Check if module is disabled
    if (item.module && !settings.modules[item.module as keyof typeof settings.modules]) {
      return null;
    }

    const active = pathname === item.url;
    return (
      <li key={item.url}>
        <NavLink
          to={item.url}
          data-active={active}
          className={cn(
            "sidebar-link",
            active
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
              : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
          )}
        >
          <item.icon
            className={cn(
              "h-4 w-4 shrink-0 transition-colors duration-200",
              active ? "text-sidebar-primary" : "text-sidebar-foreground/60 group-hover:text-sidebar-primary"
            )}
          />
          <span className="font-medium">{item.title}</span>
          {active && (
            <div className="absolute right-2 h-1.5 w-1.5 rounded-full bg-sidebar-primary" />
          )}
        </NavLink>
      </li>
    );
  };

  const enabledItems = itemsConfig.filter((item) => !item.module || settings.modules[item.module as keyof typeof settings.modules]);

  return (
    <aside className="hidden md:flex w-[260px] shrink-0 flex-col bg-sidebar border-r border-sidebar-border sticky top-0 h-screen">
      <div className="h-16 flex items-center px-5 border-b border-sidebar-border">
        <Logo variant="light" size="md" />
      </div>

      <nav className="flex-1 px-3 py-5 flex flex-col overflow-auto">
        <p className="px-3 mb-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-sidebar-foreground/40">
          Analysis
        </p>
        <ul className="space-y-0.5">{itemsConfig.map(renderItem).filter(Boolean)}</ul>

        <p className="px-3 mt-7 mb-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-sidebar-foreground/40">
          Configuration
        </p>
        <ul className="space-y-0.5">{config.map(renderItem).filter(Boolean)}</ul>
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2 text-[10px] text-sidebar-foreground/40">
          <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
          v0.1 · Offline mode
        </div>
      </div>
    </aside>
  );
}

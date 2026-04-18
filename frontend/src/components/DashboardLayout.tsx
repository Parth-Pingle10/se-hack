import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, Plus } from "lucide-react";

const titles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard/benford":        { title: "Benford Analysis",       subtitle: "Distribution of leading digits across the ledger" },
  "/dashboard/fuzzy":          { title: "Fuzzy Matching",         subtitle: "Vendor name similarity across the master file" },
  "/dashboard/anomalies":      { title: "Anomaly Detection",      subtitle: "Transactions flagged by the outlier model" },
  "/dashboard/reconciliation": { title: "Bank Reconciliation",    subtitle: "Compare ledger entries to bank statement records" },
  "/dashboard/network":        { title: "Risk Network",           subtitle: "Relational map of vendors, employees and accounts" },
  "/dashboard/summary":        { title: "Final Conclusion",       subtitle: "Consolidated audit findings and memo" },
  "/dashboard/settings":       { title: "Settings",               subtitle: "Thresholds, risk sensitivity, and module toggles" },
};

export default function DashboardLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const meta = titles[pathname] ?? { title: "Dashboard", subtitle: "" };
  const [confirmOpen, setConfirmOpen] = useState(false);

  const startNewAnalysis = () => {
    // Reset uploaded session data; preserve user-saved settings.
    try {
      sessionStorage.clear();
      // remove any session-specific localStorage keys (settings under SETTINGS_KEY are preserved)
      Object.keys(localStorage)
        .filter((k) => k.startsWith("ledgerspy:session"))
        .forEach((k) => localStorage.removeItem(k));
    } catch { /* noop */ }
    setConfirmOpen(false);
    navigate("/upload");
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header bar */}
        <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-6 sm:px-8 sticky top-0 z-20">
          <div className="min-w-0">
            <h1 className="text-base font-bold text-foreground truncate">{meta.title}</h1>
            <p className="text-xs text-muted-foreground truncate -mt-0.5">{meta.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2 rounded-lg text-xs">
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <Button size="sm" onClick={() => setConfirmOpen(true)} className="gap-2 rounded-lg text-xs shadow-sm">
              <Plus className="h-3.5 w-3.5" />
              New Analysis
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 sm:p-8 overflow-auto">
          <div key={pathname} className="fade-in max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new analysis?</AlertDialogTitle>
            <AlertDialogDescription>
              Current session data will be cleared. Your saved settings will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={startNewAnalysis} className="rounded-lg">Start new analysis</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

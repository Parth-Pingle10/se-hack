import { Activity, AlertTriangle, ShieldAlert, TrendingUp, type LucideIcon } from "lucide-react";
import { networkRisk, vendorRisks } from "@/lib/risk";
import { anomalies } from "@/lib/mockData";
import { RiskBadge } from "./RiskBadge";
import { cn } from "@/lib/utils";

export function GlobalInsightPanel({ className }: { className?: string }) {
  const net = networkRisk();
  const vendors = vendorRisks();
  const topVendor = vendors[0];
  const totalAnoms = anomalies.length;
  const highCount = vendors.filter((v) => v.band === "high").length;

  return (
    <div className={cn("card-elevated overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border">
        <div>
          <h3 className="text-sm font-bold text-foreground">Global Risk Overview</h3>
          <p className="text-xs text-muted-foreground mt-0.5">System-wide forensic indicators.</p>
        </div>
        <RiskBadge score={net.score} band={net.band} />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border">
        <Stat icon={ShieldAlert}   label="Network risk"      value={`${net.score}/100`}        hint={`${net.highVendors} high-risk vendors`} />
        <Stat icon={AlertTriangle} label="Anomalies"         value={String(totalAnoms)}        hint={`${net.txnHigh} high-risk`} />
        <Stat icon={Activity}      label="Top risky vendor"  value={topVendor?.vendor ?? "—"}  hint={topVendor ? `score ${topVendor.score}` : ""} />
        <Stat icon={TrendingUp}    label="Recon pressure"    value={`${net.reconPressure}%`}   hint="Unmatched share" />
      </div>

      {/* Active fraud indicators */}
      <div className="p-6 border-t border-border bg-muted/20">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Active fraud indicators</p>
        <ul className="space-y-2 text-sm text-foreground">
          {highCount > 0 && (
            <li className="flex gap-2.5">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
              {highCount} vendor{highCount > 1 ? "s" : ""} in the high-risk band — recommend manual review.
            </li>
          )}
          {net.benfordPressure > 30 && (
            <li className="flex gap-2.5">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-warning shrink-0" />
              Benford deviation pressure at {net.benfordPressure} — possible digit manipulation.
            </li>
          )}
          {net.reconPressure > 20 && (
            <li className="flex gap-2.5">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-warning shrink-0" />
              {net.reconPressure}% of reconciliation rows are not fully matched.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint?: string }) {
  return (
    <div className="p-5 transition-colors duration-200 hover:bg-muted/30">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-base font-bold text-foreground truncate">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-0.5 truncate">{hint}</p>}
    </div>
  );
}

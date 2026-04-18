import { cn } from "@/lib/utils";
import type { RiskBreakdown as RB } from "@/lib/risk";
import { RiskBadge } from "./RiskBadge";

const factorColors: Record<string, string> = {
  amount: "hsl(var(--destructive))",
  timing: "hsl(var(--warning))",
  vendor: "hsl(var(--accent))",
  struct: "hsl(var(--primary))",
};

export function RiskBreakdown({ data, className }: { data: RB; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5", className)} style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Risk Breakdown</p>
          <p className="text-sm font-bold text-foreground mt-1">
            Total Risk Score · <span className="tabular-nums">{data.score}</span>/100
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <RiskBadge score={data.score} band={data.band} />
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {data.confidence}% conf.
          </span>
        </div>
      </div>

      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted mb-4">
        {data.factors.map((f) => (
          <div
            key={f.key}
            title={`${f.label} · ${Math.round(f.weight * 100)}%`}
            className="transition-all duration-300"
            style={{ width: `${f.weight * 100}%`, background: factorColors[f.key] ?? "hsl(var(--muted-foreground))" }}
          />
        ))}
      </div>

      <ul className="space-y-2">
        {data.factors.map((f) => (
          <li key={f.key} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2.5 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded" style={{ background: factorColors[f.key] ?? "hsl(var(--muted-foreground))" }} />
              {f.label}
            </span>
            <span className="tabular-nums font-bold text-foreground">{Math.round(f.weight * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WhyFlagged({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-muted/30 p-5", className)} style={{ boxShadow: "var(--shadow-sm)" }}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Why flagged</p>
      <p className="text-sm text-foreground leading-relaxed">{text}</p>
    </div>
  );
}

import { cn } from "@/lib/utils";
import type { RiskBand } from "@/lib/risk";

const tones: Record<RiskBand, string> = {
  low:    "bg-success-soft text-success border-success/20",
  medium: "bg-warning-soft text-warning border-warning/20",
  high:   "bg-destructive/10 text-destructive border-destructive/20",
};

const labels: Record<RiskBand, string> = {
  low: "Low", medium: "Medium", high: "High",
};

export function RiskBadge({
  score, band, showScore = true, className,
}: { score: number; band: RiskBand; showScore?: boolean; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-md tabular-nums border",
      tones[band], className,
    )}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {labels[band]}{showScore && ` · ${score}`}
    </span>
  );
}

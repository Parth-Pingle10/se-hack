import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "destructive";
}

const toneClasses = {
  default:     "bg-muted/70 text-muted-foreground",
  success:     "bg-success-soft text-success",
  warning:     "bg-warning-soft text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

export function StatCard({ label, value, hint, icon: Icon, tone = "default" }: StatCardProps) {
  return (
    <div className="card-elevated p-5 group">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
        {Icon && (
          <div className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-110",
            toneClasses[tone]
          )}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

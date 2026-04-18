import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface InsightCardProps {
  title?: string;
  insights: string[];
  tone?: "default" | "warning" | "destructive";
  className?: string;
}

const toneClasses = {
  default:     "border-border bg-card",
  warning:     "border-warning/20 bg-warning-soft/30",
  destructive: "border-destructive/20 bg-destructive/5",
};

const dotClasses = {
  default:     "bg-accent",
  warning:     "bg-warning",
  destructive: "bg-destructive",
};

export function InsightCard({ title = "Explainable Insight", insights, tone = "default", className }: InsightCardProps) {
  return (
    <div className={cn("card-elevated p-6", toneClasses[tone], className)}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="h-7 w-7 rounded-lg bg-accent/10 flex items-center justify-center">
          <Lightbulb className="h-3.5 w-3.5 text-accent" />
        </div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
      </div>
      <ul className="space-y-2.5">
        {insights.map((t, i) => (
          <li key={i} className="text-sm text-foreground leading-relaxed flex gap-3">
            <span className={cn("mt-2 h-1.5 w-1.5 rounded-full shrink-0", dotClasses[tone])} />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

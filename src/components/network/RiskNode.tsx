import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Building2, User, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NetNodeType } from "@/lib/network";

export type RiskNodeData = {
  label: string;
  type: NetNodeType;
  riskScore: number;
  dimmed?: boolean;
  inCycle?: boolean;
  selected?: boolean;
};

const typeStyles: Record<NetNodeType, { ring: string; bg: string; icon: any; tone: string }> = {
  vendor:   { ring: "ring-[hsl(224,50%,45%)]", bg: "bg-[hsl(224,50%,45%)]/10",  icon: Building2, tone: "text-[hsl(224,50%,35%)]" },
  employee: { ring: "ring-[hsl(270,45%,55%)]", bg: "bg-[hsl(270,45%,55%)]/10",  icon: User,      tone: "text-[hsl(270,45%,45%)]" },
  account:  { ring: "ring-muted-foreground",   bg: "bg-muted",                  icon: Landmark,  tone: "text-muted-foreground" },
};

function RiskNodeBase({ data, selected }: NodeProps) {
  const d = data as unknown as RiskNodeData;
  const style = typeStyles[d.type];
  const Icon = style.icon;
  // size 56..104 by risk
  const size = 56 + Math.round((d.riskScore / 100) * 48);
  // glow strength 0..28
  const glow = Math.round((d.riskScore / 100) * 28);
  const glowColor =
    d.riskScore >= 75 ? "hsl(var(--destructive))"
    : d.riskScore >= 45 ? "hsl(var(--warning))"
    : "hsl(var(--muted-foreground))";

  return (
    <div
      className={cn(
        "relative rounded-full border bg-card flex flex-col items-center justify-center",
        "ring-2 ring-offset-2 ring-offset-background",
        "transition-all duration-300 ease-out",
        style.ring,
        d.dimmed && "opacity-20",
        d.inCycle && "ring-[hsl(var(--warning))]",
        selected && "ring-[hsl(var(--accent))]",
      )}
      style={{
        width: size,
        height: size,
        boxShadow: `0 0 ${glow}px ${glow / 2}px ${glowColor}30`,
        filter: d.dimmed ? "grayscale(0.5)" : "none",
      }}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Icon className={cn("h-4 w-4 mb-0.5", style.tone)} />
      <span className="text-[10px] font-semibold text-foreground leading-tight px-1 text-center max-w-[90%] truncate">
        {d.label}
      </span>
      <span className="text-[9px] text-muted-foreground tabular-nums font-medium">{d.riskScore}</span>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}

export const RiskNode = memo(RiskNodeBase);

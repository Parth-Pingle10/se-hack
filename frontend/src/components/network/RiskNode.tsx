import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Building2, User, Landmark, type LucideIcon } from "lucide-react";
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

const typeIcons: Record<NetNodeType, LucideIcon> = {
  vendor:   Building2,
  employee: User,
  account:  Landmark,
};

/** Linearly interpolate between two [r,g,b] triplets. t = 0..1 */
function lerpColor(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

/**
 * Maps risk 0-100 → a smooth color gradient:
 *   0   → safe green  [52, 168, 100]
 *   50  → amber       [245, 158, 11]
 *   100 → deep red    [220, 38, 38]
 */
function riskToColor(score: number): { fill: string; border: string; glow: string } {
  const t = Math.min(1, score / 100);
  const safe:   [number, number, number] = [52,  168, 100];
  const mid:    [number, number, number] = [245, 158, 11];
  const danger: [number, number, number] = [220, 38,  38];

  let fill: string;
  if (t <= 0.5) {
    fill = lerpColor(safe, mid, t * 2);
  } else {
    fill = lerpColor(mid, danger, (t - 0.5) * 2);
  }

  // Border is slightly darker (70% brightness of fill)
  const bt = Math.min(1, t);
  let border: string;
  if (bt <= 0.5) {
    border = lerpColor([30, 120, 70], [200, 120, 5], bt * 2);
  } else {
    border = lerpColor([200, 120, 5], [160, 20, 20], (bt - 0.5) * 2);
  }

  return { fill, border, glow: fill };
}


function RiskNodeBase({ data, selected }: NodeProps) {
  const d = data as unknown as RiskNodeData;
  const Icon = typeIcons[d.type];

  // Size: 48px (safe) → 96px (max risk)
  const size = 48 + Math.round((d.riskScore / 100) * 48);

  // Glow radius scales with risk
  const glowRadius = Math.round((d.riskScore / 100) * 32);

  const { fill, border, glow } = riskToColor(d.riskScore);

  // Text is white on high-risk nodes, dark on low-risk
  const textColor = d.riskScore >= 50 ? "#fff" : "#1e293b";
  const subTextColor = d.riskScore >= 50 ? "rgba(255,255,255,0.75)" : "rgba(30,41,59,0.55)";

  return (
    <div
      className={cn(
        "relative rounded-full flex flex-col items-center justify-center",
        "transition-all duration-300 ease-out",
        d.dimmed && "opacity-20",
      )}
      style={{
        width: size,
        height: size,
        background: fill,
        border: `2px solid ${selected ? "#f59e0b" : d.inCycle ? "#f59e0b" : border}`,
        boxShadow: glowRadius > 4
          ? `0 0 ${glowRadius}px ${glowRadius / 2}px ${glow}55, inset 0 1px 2px rgba(255,255,255,0.15)`
          : "0 1px 4px rgba(0,0,0,0.12)",
        filter: d.dimmed ? "grayscale(0.6)" : "none",
        outline: selected ? `3px solid #f59e0b` : "none",
        outlineOffset: "2px",
      }}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <Icon style={{ color: textColor, opacity: 0.9 }} className="h-3.5 w-3.5 mb-0.5 shrink-0" />
      <span
        className="text-[10px] font-bold leading-tight px-1 text-center max-w-[90%] truncate"
        style={{ color: textColor }}
      >
        {d.label}
      </span>
      <span
        className="text-[9px] tabular-nums font-semibold"
        style={{ color: subTextColor }}
      >
        {d.riskScore}
      </span>
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}

export const RiskNode = memo(RiskNodeBase);

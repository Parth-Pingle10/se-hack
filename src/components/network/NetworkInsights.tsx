import { topRiskyNodes, mostConnectedNode, cycles } from "@/lib/network";
import { RiskBadge } from "@/components/RiskBadge";
import { bandOf } from "@/lib/risk";

export function NetworkInsights({ onSelect }: { onSelect?: (id: string) => void }) {
  const top = topRiskyNodes(5);
  const mc = mostConnectedNode();

  return (
    <div className="grid gap-4">
      {/* Top 5 risky entities */}
      <div className="card-elevated p-5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Top 5 risky entities</p>
        <ul className="space-y-1">
          {top.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => onSelect?.(n.id)}
                className="w-full flex items-center justify-between text-xs hover:bg-muted/50 rounded-lg px-3 py-2 transition-colors duration-200"
              >
                <span className="text-foreground truncate font-medium">{n.label}</span>
                <RiskBadge score={n.riskScore} band={bandOf(n.riskScore)} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Most connected entity */}
      <div className="card-elevated p-5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Most connected entity</p>
        {mc.node && (
          <button
            onClick={() => onSelect?.(mc.node!.id)}
            className="text-sm font-bold text-foreground hover:text-accent transition-colors duration-200"
          >
            {mc.node.label}
          </button>
        )}
        <p className="text-xs text-muted-foreground mt-1">{mc.degree} connections</p>
      </div>

      {/* Detected cycles */}
      <div className="card-elevated p-5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Detected cycles</p>
        <p className="text-sm font-bold text-foreground">{cycles.length} circular flows</p>
        <p className="text-xs text-muted-foreground mt-1">
          Total value circulated: ${cycles.reduce((s, c) => s + c.totalValue, 0).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

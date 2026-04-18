import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "@/components/RiskBadge";
import { RiskBreakdown } from "@/components/RiskBreakdown";
import { bandOf, type RiskBreakdown as RB } from "@/lib/risk";
import { connectedNodeIds, nodeById, netEdges, type NetNode } from "@/lib/network";

function buildBreakdown(n: NetNode): RB {
  // Approximate factor mix from connected edges
  const incident = netEdges.filter((e) => e.source === n.id || e.target === n.id);
  const cycleShare = incident.filter((e) => e.isCycle).length / Math.max(1, incident.length);
  const paymentVol = incident.reduce((s, e) => s + (e.amount || 0), 0);
  const amountW = Math.min(0.55, 0.2 + paymentVol / 1_000_000);
  const structW = Math.min(0.35, 0.1 + cycleShare * 0.4);
  const vendorW = n.type === "vendor" ? 0.2 : 0.1;
  const timingW = Math.max(0.05, 1 - amountW - structW - vendorW);
  return {
    score: n.riskScore,
    band: bandOf(n.riskScore),
    confidence: 70,
    factors: [
      { key: "amount", label: "Unusual amount",      weight: amountW },
      { key: "struct", label: "Circular pattern",    weight: structW },
      { key: "vendor", label: "Entity similarity",   weight: vendorW },
      { key: "timing", label: "Timing anomaly",      weight: timingW },
    ].sort((a, b) => b.weight - a.weight),
    why:
      cycleShare > 0
        ? `Participates in ${incident.filter((e) => e.isCycle).length} circular edge(s); aggregate flow $${paymentVol.toLocaleString()}.`
        : `High aggregate transaction volume ($${paymentVol.toLocaleString()}) across ${incident.length} relationships.`,
  };
}

export function NodeDetailPanel({ nodeId, onClose }: { nodeId: string; onClose: () => void }) {
  const n = nodeById(nodeId);
  if (!n) return null;
  const conns = connectedNodeIds(nodeId).map((id) => nodeById(id)!).filter(Boolean);
  const rb = buildBreakdown(n);

  return (
    <aside className="w-[340px] shrink-0 border-l border-border bg-card flex flex-col h-full slide-in-left">
      <div className="flex items-center justify-between px-5 h-14 border-b border-border">
        <p className="text-sm font-bold text-foreground truncate">{n.label}</p>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-5 space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{n.type}</span>
          <RiskBadge score={n.riskScore} band={bandOf(n.riskScore)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border p-3.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total transactions</p>
            <p className="text-lg font-bold tabular-nums mt-0.5">{n.totalTxns ?? 0}</p>
          </div>
          <div className="rounded-xl border border-border p-3.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Connections</p>
            <p className="text-lg font-bold tabular-nums mt-0.5">{conns.length}</p>
          </div>
        </div>

        <RiskBreakdown data={rb} />

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5">Connected entities</p>
          <ul className="space-y-1">
            {conns.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors duration-200">
                <span className="text-foreground truncate font-medium">{c.label}</span>
                <RiskBadge score={c.riskScore} band={bandOf(c.riskScore)} showScore={false} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cycles, nodeById, netEdges } from "@/lib/network";

export function CyclePanel({ cycleId, onClose, onSelectCycle }: {
  cycleId: string | null;
  onClose: () => void;
  onSelectCycle: (id: string) => void;
}) {
  return (
    <aside className="w-[340px] shrink-0 border-l border-border bg-card flex flex-col h-full slide-in-left">
      <div className="flex items-center justify-between px-5 h-14 border-b border-border">
        <p className="text-sm font-bold text-foreground">Circular Flows</p>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {cycles.map((c) => {
          const active = c.id === cycleId;
          const entities = c.nodes.map((id) => nodeById(id)?.label ?? id);
          const insight = `Circular flow of $${c.totalValue.toLocaleString()} across ${c.nodes.length} entities over ${c.spanMonths} months`;
          return (
            <button
              key={c.id}
              onClick={() => onSelectCycle(c.id)}
              className={`w-full text-left rounded-xl border-2 p-4 transition-all duration-250 ${
                active ? "border-[hsl(var(--warning))] bg-warning-soft/30 shadow-sm" : "border-border hover:bg-muted/30 hover:border-border/80"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-foreground">Cycle {c.id}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-warning">{c.loops} loops</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2.5">{entities.join(" → ")} → {entities[0]}</p>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <p className="text-muted-foreground">Value</p>
                  <p className="font-bold tabular-nums text-foreground">${(c.totalValue / 1000).toFixed(0)}k</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Entities</p>
                  <p className="font-bold tabular-nums text-foreground">{c.nodes.length}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Span</p>
                  <p className="font-bold tabular-nums text-foreground">{c.spanMonths}mo</p>
                </div>
              </div>
              <p className="mt-2.5 text-[11px] text-foreground/70 leading-relaxed">{insight}</p>
            </button>
          );
        })}
        {cycles.length === 0 && (
          <p className="text-xs text-muted-foreground">No cycles detected.</p>
        )}
      </div>
    </aside>
  );
}

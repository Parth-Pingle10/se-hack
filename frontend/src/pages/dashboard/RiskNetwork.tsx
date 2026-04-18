import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge, type NodeTypes,
  useNodesState, useEdgesState, MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { netNodes, netEdges, cycles, type NetNodeType } from "@/lib/network";
import { RiskNode, type RiskNodeData } from "@/components/network/RiskNode";
import { NodeDetailPanel } from "@/components/network/NodeDetailPanel";
import { CyclePanel } from "@/components/network/CyclePanel";
import { NetworkInsights } from "@/components/network/NetworkInsights";

const nodeTypes: NodeTypes = { risk: RiskNode };

// Deterministic radial layout grouped by type
function layoutNodes(): Node<RiskNodeData>[] {
  const groups: Record<NetNodeType, typeof netNodes> = { vendor: [], employee: [], account: [] };
  netNodes.forEach((n) => groups[n.type].push(n));

  const positions: Record<string, { x: number; y: number }> = {};
  // vendors: large outer ring
  groups.vendor.forEach((n, i, arr) => {
    const a = (i / arr.length) * Math.PI * 2;
    positions[n.id] = { x: 480 + Math.cos(a) * 300, y: 320 + Math.sin(a) * 240 };
  });
  // accounts: inner cluster (right)
  groups.account.forEach((n, i, arr) => {
    const a = (i / arr.length) * Math.PI * 2;
    positions[n.id] = { x: 480 + Math.cos(a) * 110, y: 320 + Math.sin(a) * 90 };
  });
  // employees: left column
  groups.employee.forEach((n, i) => {
    positions[n.id] = { x: 60, y: 140 + i * 120 };
  });

  return netNodes.map((n) => ({
    id: n.id,
    type: "risk",
    position: positions[n.id],
    data: { label: n.label, type: n.type, riskScore: n.riskScore },
  }));
}

export default function RiskNetwork() {
  const initialNodes = useMemo(layoutNodes, []);
  const initialEdges: Edge[] = useMemo(
    () =>
      netEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(215 14% 55%)" },
        data: { isCycle: e.isCycle, cycleId: e.cycleId, kind: e.kind, amount: e.amount },
        style: { stroke: "hsl(215 14% 70%)", strokeWidth: 1.2 },
      })),
    [],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const [tab, setTab] = useState<"network" | "cycles">("network");
  const [highlightCycles, setHighlightCycles] = useState(false);
  const [riskMin, setRiskMin] = useState(0);
  const [highOnly, setHighOnly] = useState(false);
  const [types, setTypes] = useState<NetNodeType[]>(["vendor", "employee", "account"]);

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<string | null>(null);

  const cycleHighlightActive = tab === "cycles" || highlightCycles;

  // Apply filtering + cycle highlight to nodes/edges
  const filteredNodes: Node<RiskNodeData>[] = useMemo(() => {
    return nodes.map((n) => {
      const meta = netNodes.find((x) => x.id === n.id)!;
      const visible =
        types.includes(meta.type) &&
        meta.riskScore >= riskMin &&
        (!highOnly || meta.riskScore >= 75);

      const inCycle = cycles.some((c) =>
        selectedCycle ? c.id === selectedCycle && c.nodes.includes(n.id) : c.nodes.includes(n.id),
      );

      const dimmed =
        !visible ||
        (cycleHighlightActive && !inCycle && tab === "cycles") ||
        (cycleHighlightActive && selectedCycle && !inCycle);

      return {
        ...n,
        hidden: !visible,
        data: { ...n.data, dimmed: !!dimmed, inCycle: cycleHighlightActive && inCycle },
      };
    });
  }, [nodes, types, riskMin, highOnly, cycleHighlightActive, selectedCycle, tab]);

  const filteredEdges: Edge[] = useMemo(() => {
    const visibleIds = new Set(filteredNodes.filter((n) => !n.hidden).map((n) => n.id));
    return edges.map((e) => {
      const data = e.data as { isCycle?: boolean; cycleId?: string };
      const isCycle = !!data?.isCycle;
      const inSelected = selectedCycle ? data?.cycleId === selectedCycle : true;
      const visible = visibleIds.has(e.source) && visibleIds.has(e.target);

      let stroke = "hsl(215 14% 75%)";
      let width = 1.2;
      let opacity = 1;

      if (cycleHighlightActive) {
        if (isCycle && inSelected) {
          stroke = "hsl(36 82% 52%)";
          width = 2.4;
        } else if (tab === "cycles") {
          opacity = 0.15;
        } else {
          opacity = 0.35;
        }
      }

      return {
        ...e,
        hidden: !visible,
        style: { stroke, strokeWidth: width, opacity, transition: "all 0.3s ease" },
        markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
        animated: cycleHighlightActive && isCycle && inSelected,
      };
    });
  }, [edges, filteredNodes, cycleHighlightActive, selectedCycle, tab]);

  const onNodeClick = useCallback((_: any, n: Node) => {
    setSelectedNode(n.id);
    setSelectedCycle(null);
  }, []);

  const toggleType = (t: NetNodeType) => {
    setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  };

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => { setTab(v as any); setSelectedCycle(null); }}>
          <TabsList className="rounded-lg">
            <TabsTrigger value="network" className="rounded-md text-xs font-semibold">Network View</TabsTrigger>
            <TabsTrigger value="cycles" className="rounded-md text-xs font-semibold">Circular Flows</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-3">
          <Label htmlFor="hl" className="text-xs text-muted-foreground cursor-pointer font-medium">
            Highlight Circular Trading
          </Label>
          <Switch id="hl" checked={highlightCycles} onCheckedChange={setHighlightCycles} />
        </div>
      </div>

      {/* Filters bar */}
      <div className="card-elevated p-5 grid gap-5 md:grid-cols-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
            Min risk score · <span className="text-foreground">{riskMin}</span>
          </p>
          <Slider value={[riskMin]} min={0} max={100} step={1} onValueChange={(v) => setRiskMin(v[0])} />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5">Entity type</p>
          <ToggleGroup type="multiple" size="sm" value={types} onValueChange={(v) => v.length && setTypes(v as NetNodeType[])}>
            <ToggleGroupItem value="vendor" className="text-xs rounded-lg">Vendors</ToggleGroupItem>
            <ToggleGroupItem value="employee" className="text-xs rounded-lg">Employees</ToggleGroupItem>
            <ToggleGroupItem value="account" className="text-xs rounded-lg">Accounts</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="flex items-center gap-2">
            <Switch id="ho" checked={highOnly} onCheckedChange={setHighOnly} />
            <Label htmlFor="ho" className="text-xs text-muted-foreground cursor-pointer font-medium">
              High-risk nodes only
            </Label>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs rounded-lg"
            onClick={() => { setRiskMin(0); setHighOnly(false); setTypes(["vendor","employee","account"]); }}
          >
            Reset
          </Button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="card-elevated overflow-hidden flex" style={{ height: 620 }}>
          <div className="flex-1 relative">
            <ReactFlow
              nodes={filteredNodes}
              edges={filteredEdges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onPaneClick={() => { setSelectedNode(null); }}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              proOptions={{ hideAttribution: true }}
              minZoom={0.3}
              maxZoom={1.8}
            >
              <Background gap={16} size={1} color="hsl(216 16% 90%)" />
              <Controls showInteractive={false} className="!bg-card !border-border !rounded-lg" />
              <MiniMap
                pannable zoomable
                nodeColor={(n) => {
                  const meta = netNodes.find((x) => x.id === n.id);
                  if (!meta) return "hsl(215 14% 70%)";
                  return meta.type === "vendor" ? "hsl(224 50% 45%)"
                    : meta.type === "employee" ? "hsl(270 45% 55%)"
                    : "hsl(215 14% 55%)";
                }}
                maskColor="hsl(214 25% 97% / 0.6)"
                className="!bg-card !border !border-border !rounded-lg"
              />
            </ReactFlow>
          </div>

          {tab === "cycles" ? (
            <CyclePanel
              cycleId={selectedCycle}
              onClose={() => setSelectedCycle(null)}
              onSelectCycle={(id) => setSelectedCycle((cur) => (cur === id ? null : id))}
            />
          ) : selectedNode ? (
            <NodeDetailPanel nodeId={selectedNode} onClose={() => setSelectedNode(null)} />
          ) : null}
        </div>

        <div>
          <NetworkInsights onSelect={(id) => { setTab("network"); setSelectedNode(id); }} />
        </div>
      </div>
    </div>
  );
}

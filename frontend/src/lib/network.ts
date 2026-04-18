// Risk Network mock graph + cycle detection.
// Nodes: vendors, employees, accounts. Edges: payments / approvals / shared-account / similarity.

export type NetNodeType = "vendor" | "employee" | "account";

export type NetNode = {
  id: string;
  label: string;
  type: NetNodeType;
  riskScore: number; // 0..100
  totalTxns?: number;
};

export type NetEdge = {
  id: string;
  source: string;
  target: string;
  amount: number;
  frequency: number;
  isCycle: boolean;
  cycleId?: string;
  kind: "payment" | "approval" | "shared-account" | "similarity";
};

export type Cycle = {
  id: string;
  nodes: string[];      // ordered loop, last == first omitted
  edgeIds: string[];
  totalValue: number;
  loops: number;        // detected repetitions over time
  spanMonths: number;
};

// --- Mock data (fallback) -------------------------------------------------

const mockNetNodes: NetNode[] = [
  // vendors
  { id: "v-acme",     label: "Acme Corp",          type: "vendor",   riskScore: 88, totalTxns: 42 },
  { id: "v-globex",   label: "Globex Inc",         type: "vendor",   riskScore: 81, totalTxns: 36 },
  { id: "v-initech",  label: "Initech LLC",        type: "vendor",   riskScore: 72, totalTxns: 28 },
  { id: "v-wayne",    label: "Wayne Enterprises",  type: "vendor",   riskScore: 64, totalTxns: 19 },
  { id: "v-soylent",  label: "Soylent Foods",      type: "vendor",   riskScore: 41, totalTxns: 14 },
  { id: "v-umbrella", label: "Umbrella Logistics", type: "vendor",   riskScore: 55, totalTxns: 22 },
  { id: "v-stark",    label: "Stark Industries",   type: "vendor",   riskScore: 68, totalTxns: 17 },
  { id: "v-hooli",    label: "Hooli",              type: "vendor",   riskScore: 22, totalTxns: 9 },
  // employees
  { id: "e-jdoe",     label: "J. Doe (AP)",        type: "employee", riskScore: 74, totalTxns: 51 },
  { id: "e-msmith",   label: "M. Smith (Mgr)",     type: "employee", riskScore: 38, totalTxns: 33 },
  { id: "e-rkhan",    label: "R. Khan (Auditor)",  type: "employee", riskScore: 18, totalTxns: 12 },
  // accounts
  { id: "a-001",      label: "BoA ••4421",         type: "account",  riskScore: 80, totalTxns: 88 },
  { id: "a-002",      label: "Chase ••9912",       type: "account",  riskScore: 35, totalTxns: 47 },
  { id: "a-003",      label: "HSBC ••2210",        type: "account",  riskScore: 60, totalTxns: 31 },
];

// Two circular trading loops are pre-encoded:
// Cycle C1: v-acme -> v-globex -> v-initech -> v-acme  (vendor↔vendor round-trip via shared accounts)
// Cycle C2: v-stark -> a-003 -> v-umbrella -> v-stark
const mockRawEdges: Omit<NetEdge, "id">[] = [
  // approvals
  { source: "e-jdoe",     target: "v-acme",     amount: 0,        frequency: 12, isCycle: false, kind: "approval" },
  { source: "e-jdoe",     target: "v-globex",   amount: 0,        frequency: 9,  isCycle: false, kind: "approval" },
  { source: "e-msmith",   target: "v-wayne",    amount: 0,        frequency: 4,  isCycle: false, kind: "approval" },
  { source: "e-rkhan",    target: "v-hooli",    amount: 0,        frequency: 2,  isCycle: false, kind: "approval" },

  // payments — main flows
  { source: "v-acme",     target: "a-001",      amount: 184320,   frequency: 14, isCycle: false, kind: "payment" },
  { source: "v-globex",   target: "a-001",      amount: 49999,    frequency: 8,  isCycle: false, kind: "payment" },
  { source: "v-initech",  target: "a-001",      amount: 8750,     frequency: 6,  isCycle: false, kind: "payment" },
  { source: "v-wayne",    target: "a-002",      amount: 7600,     frequency: 3,  isCycle: false, kind: "payment" },
  { source: "v-soylent",  target: "a-002",      amount: 2300,     frequency: 5,  isCycle: false, kind: "payment" },
  { source: "v-hooli",    target: "a-002",      amount: 980,      frequency: 11, isCycle: false, kind: "payment" },

  // similarity
  { source: "v-acme",     target: "v-globex",   amount: 0,        frequency: 0,  isCycle: false, kind: "similarity" },
  { source: "v-acme",     target: "v-initech",  amount: 0,        frequency: 0,  isCycle: false, kind: "similarity" },
  { source: "v-soylent",  target: "v-umbrella", amount: 0,        frequency: 0,  isCycle: false, kind: "similarity" },

  // === CYCLE 1: v-acme -> v-globex -> v-initech -> v-acme ===
  { source: "v-acme",     target: "v-globex",   amount: 120000,   frequency: 6,  isCycle: true, cycleId: "C1", kind: "payment" },
  { source: "v-globex",   target: "v-initech",  amount: 95000,    frequency: 5,  isCycle: true, cycleId: "C1", kind: "payment" },
  { source: "v-initech",  target: "v-acme",     amount: 110000,   frequency: 4,  isCycle: true, cycleId: "C1", kind: "payment" },

  // === CYCLE 2: v-stark -> a-003 -> v-umbrella -> v-stark ===
  { source: "v-stark",    target: "a-003",      amount: 78000,    frequency: 4,  isCycle: true, cycleId: "C2", kind: "payment" },
  { source: "a-003",      target: "v-umbrella", amount: 72000,    frequency: 4,  isCycle: true, cycleId: "C2", kind: "payment" },
  { source: "v-umbrella", target: "v-stark",    amount: 70000,    frequency: 3,  isCycle: true, cycleId: "C2", kind: "payment" },

  // shared account
  { source: "v-stark",    target: "a-001",      amount: 15000,    frequency: 2,  isCycle: false, kind: "shared-account" },
  { source: "v-umbrella", target: "a-002",      amount: 11000,    frequency: 3,  isCycle: false, kind: "shared-account" },
];

const mockNetEdges: NetEdge[] = mockRawEdges.map((e, i) => ({
  ...e,
  id: `e-${i}-${e.source}-${e.target}`,
}));

const mockCycles: Cycle[] = [
  {
    id: "C1",
    nodes: ["v-acme", "v-globex", "v-initech"],
    edgeIds: mockNetEdges.filter((e) => e.cycleId === "C1").map((e) => e.id),
    totalValue: 325000,
    loops: 4,
    spanMonths: 18,
  },
  {
    id: "C2",
    nodes: ["v-stark", "a-003", "v-umbrella"],
    edgeIds: mockNetEdges.filter((e) => e.cycleId === "C2").map((e) => e.id),
    totalValue: 220000,
    loops: 3,
    spanMonths: 12,
  },
];

// --- Reactive data -------------------------------------------------------

export let netNodes: NetNode[] = mockNetNodes;
export let netEdges: NetEdge[] = mockNetEdges;
export let cycles: Cycle[] = mockCycles;

// Use this to update all exports at once (e.g., from RiskNetwork)
export function updateNetworkData(nodes: any[], edges: any[], cycleList: Cycle[]) {
  netNodes = nodes;
  netEdges = edges;
  cycles = cycleList;
}

// --- Helpers ---------------------------------------------------------------

export function connectedNodeIds(nodeId: string): string[] {
  const set = new Set<string>();
  for (const e of netEdges) {
    if (e.source === nodeId) set.add(e.target);
    if (e.target === nodeId) set.add(e.source);
  }
  return Array.from(set);
}

export function nodeById(id: string) {
  return netNodes.find((n) => n.id === id);
}

export function mostConnectedNode() {
  const counts = new Map<string, number>();
  for (const e of netEdges) {
    counts.set(e.source, (counts.get(e.source) ?? 0) + 1);
    counts.set(e.target, (counts.get(e.target) ?? 0) + 1);
  }
  let topId = ""; let top = 0;
  counts.forEach((v, k) => { if (v > top) { top = v; topId = k; } });
  return { node: nodeById(topId), degree: top };
}

export function topRiskyNodes(n = 5) {
  return [...netNodes].sort((a, b) => b.riskScore - a.riskScore).slice(0, n);
}

import { useMemo, useState } from "react";
import { reconciliation, reconStatusDistribution, reconTrend, type ReconRow, type ReconStatus } from "@/lib/mockData";
import { StatCard } from "@/components/StatCard";
import { InsightCard } from "@/components/InsightCard";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, XCircle, FileSearch, Search } from "lucide-react";
import {
  Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend,
  CartesianGrid, Line, LineChart, XAxis, YAxis,
} from "recharts";

const PIE_COLORS: Record<string, string> = {
  Matched:   "hsl(var(--success))",
  Partial:   "hsl(var(--warning))",
  Unmatched: "hsl(var(--destructive))",
};

const fmt = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const statusMeta: Record<ReconStatus, { label: string; row: string; pill: string; dot: string }> = {
  matched: {
    label: "Matched",
    row: "hover:bg-success-soft/30",
    pill: "bg-success-soft text-success border border-success/20",
    dot: "bg-success",
  },
  partial: {
    label: "Partial",
    row: "bg-warning-soft/15 hover:bg-warning-soft/30",
    pill: "bg-warning-soft text-warning border border-warning/20",
    dot: "bg-warning",
  },
  unmatched: {
    label: "Unmatched",
    row: "bg-destructive/[0.03] hover:bg-destructive/[0.06]",
    pill: "bg-destructive/10 text-destructive border border-destructive/20",
    dot: "bg-destructive",
  },
};

export default function Reconciliation() {
  const [selected, setSelected] = useState<ReconRow | null>(null);
  const [filter, setFilter] = useState<"all" | ReconStatus>("all");
  const [query, setQuery] = useState("");
  const [onlyAnomalies, setOnlyAnomalies] = useState(false);

  const totals = useMemo(() => {
    const matched = reconciliation.filter((r) => r.status === "matched").length;
    const partial = reconciliation.filter((r) => r.status === "partial").length;
    const unmatched = reconciliation.filter((r) => r.status === "unmatched").length;
    return { total: reconciliation.length, matched, partial, unmatched };
  }, []);

  const rows = useMemo(() => {
    return reconciliation.filter((r) => {
      if (onlyAnomalies && r.status === "matched") return false;
      if (filter !== "all" && r.status !== filter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay = `${r.ledgerDescription ?? ""} ${r.bankDescription ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [filter, query, onlyAnomalies]);

  return (
    <>
      {/* Summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger-children">
        <StatCard label="Total Compared" value={String(totals.total)} icon={FileSearch} />
        <StatCard label="Fully Matched" value={String(totals.matched)} icon={CheckCircle2} tone="success" />
        <StatCard label="Partially Matched" value={String(totals.partial)} icon={AlertCircle} tone="warning" />
        <StatCard label="Unmatched" value={String(totals.unmatched)} icon={XCircle} tone="destructive" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Pie chart */}
        <div className="card-elevated">
          <div className="p-6 border-b border-border">
            <h2 className="text-sm font-bold text-foreground">Match Distribution</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Share of reconciled vs. flagged entries.</p>
          </div>
          <div className="p-6">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={reconStatusDistribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={75} paddingAngle={3} strokeWidth={0}>
                    {reconStatusDistribution.map((s) => (
                      <Cell key={s.name} fill={PIE_COLORS[s.name]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 10,
                    fontSize: 12,
                    boxShadow: "var(--shadow-lg)",
                  }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Line chart */}
        <div className="lg:col-span-2 card-elevated">
          <div className="p-6 border-b border-border">
            <h2 className="text-sm font-bold text-foreground">Mismatches Over Time</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Monthly trend across the engagement period.</p>
          </div>
          <div className="p-6">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={reconTrend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 10,
                    fontSize: 12,
                    boxShadow: "var(--shadow-lg)",
                  }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                  <Line type="monotone" dataKey="matched"   name="Matched"   stroke="hsl(var(--success))"     strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="partial"   name="Partial"   stroke="hsl(var(--warning))"     strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="unmatched" name="Unmatched" stroke="hsl(var(--destructive))" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <InsightCard
        className="mb-6"
        tone="warning"
        insights={[
          "Spike in unmatched entries during December — investigate cut-off and timing differences.",
          `${totals.unmatched} unmatched and ${totals.partial} partial entries account for the majority of exposure.`,
          "Recurring partial-match pattern with Initech LLC suggests a standing fee or rounding adjustment.",
        ]}
      />

      {/* Controls + Table */}
      <div className="card-elevated">
        <div className="p-6 border-b border-border flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-foreground">Bank Statement Reconciliation</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Compare ledger entries against bank records. Click a row to inspect discrepancies.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search vendor or description"
                className="h-9 w-56 pl-9 text-sm rounded-lg"
              />
            </div>

            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="h-9 w-40 text-sm rounded-lg">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="matched">Matched</SelectItem>
                <SelectItem value="partial">Partially Matched</SelectItem>
                <SelectItem value="unmatched">Unmatched</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 pl-3 border-l border-border">
              <Switch id="anom" checked={onlyAnomalies} onCheckedChange={setOnlyAnomalies} />
              <Label htmlFor="anom" className="text-xs text-muted-foreground cursor-pointer font-medium">
                Anomalies only
              </Label>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm table-premium">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="text-left">
                <th className="w-28">Date</th>
                <th>Ledger</th>
                <th>Bank</th>
                <th className="text-right">Ledger Amt</th>
                <th className="text-right">Bank Amt</th>
                <th className="text-right">Difference</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No transactions match the current filters.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const meta = statusMeta[r.status];
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className={cn(
                      "cursor-pointer",
                      meta.row,
                    )}
                  >
                    <td className="tabular-nums text-muted-foreground">{r.date}</td>
                    <td className="text-foreground">
                      {r.ledgerDescription ?? <span className="text-muted-foreground italic">— missing —</span>}
                    </td>
                    <td className="text-foreground">
                      {r.bankDescription ?? <span className="text-muted-foreground italic">— missing —</span>}
                    </td>
                    <td className="text-right tabular-nums">{fmt(r.ledgerAmount)}</td>
                    <td className="text-right tabular-nums">{fmt(r.bankAmount)}</td>
                    <td className={cn(
                      "text-right tabular-nums font-semibold",
                      r.difference === 0 ? "text-muted-foreground" : "text-foreground",
                    )}>
                      {r.difference === 0 ? "—" : fmt(r.difference)}
                    </td>
                    <td>
                      <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-md", meta.pill)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                        {meta.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border border-border rounded-md px-2 py-0.5">
                    Explainable Insight
                  </span>
                </div>
                <SheetTitle className="text-base font-bold">Transaction · {selected.date}</SheetTitle>
                <SheetDescription className="text-xs">
                  Reconciliation entry #{selected.id}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                {/* Side-by-side compare */}
                <div className="grid grid-cols-2 gap-3">
                  <CompareBox
                    title="Ledger"
                    description={selected.ledgerDescription}
                    amount={selected.ledgerAmount}
                  />
                  <CompareBox
                    title="Bank"
                    description={selected.bankDescription}
                    amount={selected.bankAmount}
                  />
                </div>

                {/* Discrepancy */}
                <div className={cn(
                  "rounded-xl border p-5",
                  selected.status === "matched"
                    ? "border-success/20 bg-success-soft/30"
                    : selected.status === "partial"
                    ? "border-warning/20 bg-warning-soft/30"
                    : "border-destructive/20 bg-destructive/5",
                )}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Discrepancy
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {selected.note ?? "No discrepancies detected. Ledger and bank record are in full agreement."}
                  </p>
                  {selected.difference !== 0 && (
                    <p className="text-xs text-muted-foreground mt-2 tabular-nums">
                      Net difference: <span className="font-bold text-foreground">{fmt(selected.difference)}</span>
                    </p>
                  )}
                </div>

                {/* History */}
                {selected.history && selected.history.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      Related Historical Transactions
                    </p>
                    <div className="rounded-xl border border-border overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40">
                          <tr className="text-left text-muted-foreground">
                            <th className="font-semibold px-3 py-2.5">Date</th>
                            <th className="font-semibold px-3 py-2.5">Description</th>
                            <th className="font-semibold px-3 py-2.5 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selected.history.map((h, i) => (
                            <tr key={i} className="border-t border-border">
                              <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{h.date}</td>
                              <td className="px-3 py-2.5 text-foreground">{h.description}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{fmt(h.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function CompareBox({
  title, description, amount,
}: { title: string; description: string | null; amount: number | null }) {
  const missing = description === null && amount === null;
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
      {missing ? (
        <p className="text-sm italic text-destructive mt-1">No matching record</p>
      ) : (
        <>
          <p className="text-sm font-semibold text-foreground mt-1 leading-snug">
            {description ?? "—"}
          </p>
          <p className="text-sm tabular-nums text-foreground mt-2">{fmt(amount)}</p>
        </>
      )}
    </div>
  );
}

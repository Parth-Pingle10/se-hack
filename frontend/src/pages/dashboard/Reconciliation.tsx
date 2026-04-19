import { useEffect, useMemo, useState } from "react";
import { StatCard } from "@/components/StatCard";
import { InsightCard } from "@/components/InsightCard";
import { AiInsightBlock } from "@/components/AiInsightBlock";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, XCircle, FileSearch, Search, Loader2 } from "lucide-react";
import {
  Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend,
} from "recharts";
import { fetchReconciliation, type ReconRow, type ReconStatus, type ReconResult } from "@/lib/api";
import { useSettings } from "@/lib/settings";

const PIE_COLORS: Record<string, string> = {
  Matched:   "hsl(var(--success))",
  Partial:   "hsl(var(--warning))",
  Unmatched: "hsl(var(--destructive))",
};

const fmt = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("en-IN", { style: "currency", currency: "INR" });

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
  const { settings } = useSettings();
  const [data, setData] = useState<ReconResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReconRow | null>(null);
  const [filter, setFilter] = useState<"all" | ReconStatus>("all");
  const [query, setQuery] = useState("");
  const [onlyAnomalies, setOnlyAnomalies] = useState(false);

  // Convert similarity threshold from percentage to decimal
  const similarityThreshold = settings.match.partialMin / 100;

  useEffect(() => {
    setLoading(true);
    fetchReconciliation(3, similarityThreshold)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [similarityThreshold]);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.rows.filter((r) => {
      if (onlyAnomalies && r.status === "matched") return false;
      if (filter !== "all" && r.status !== filter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay = `${r.ledgerDescription ?? ""} ${r.bankDescription ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [filter, query, onlyAnomalies, data]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  return (
    <>
      {/* Summary strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger-children">
        <StatCard label="Total Compared"     value={String(data.total)}     icon={FileSearch} />
        <StatCard label="Fully Matched"      value={String(data.matched)}   icon={CheckCircle2} tone="success" />
        <StatCard label="Partially Matched"  value={String(data.partial)}   icon={AlertCircle}  tone="warning" />
        <StatCard label="Unmatched"          value={String(data.unmatched)} icon={XCircle}      tone="destructive" />
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
                  <Pie data={data.status_distribution} dataKey="value" nameKey="name" innerRadius={50} outerRadius={75} paddingAngle={3} strokeWidth={0}>
                    {data.status_distribution.map((s) => (
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

        {/* Error score panel */}
        <div className="lg:col-span-2 card-elevated">
          <div className="p-6 border-b border-border">
            <h2 className="text-sm font-bold text-foreground">Reconciliation Summary</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Overall quality metrics for this reconciliation run.</p>
          </div>
          <div className="p-6 grid grid-cols-2 gap-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Error Score</p>
              <p className="text-4xl font-bold tabular-nums text-foreground">{data.error_score}%</p>
              <p className="text-xs text-muted-foreground mt-1">% of total volume unmatched</p>
              <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    data.error_score > 30 ? "bg-destructive" : data.error_score > 10 ? "bg-warning" : "bg-success"
                  )}
                  style={{ width: `${Math.min(100, data.error_score)}%` }}
                />
              </div>
            </div>
            <div className="space-y-3">
              <SummaryRow label="Match rate" value={`${data.total > 0 ? ((data.matched / data.total) * 100).toFixed(1) : 0}%`} good />
              <SummaryRow label="Partial rate" value={`${data.total > 0 ? ((data.partial / data.total) * 100).toFixed(1) : 0}%`} good={data.partial === 0} />
              <SummaryRow label="Unmatched entries" value={String(data.unmatched)} good={data.unmatched === 0} />
              <SummaryRow label="Ledger rows" value={String(data.total)} good />
            </div>
          </div>
        </div>
      </div>

      <InsightCard
        className="mb-6"
        tone={data.error_score > 20 ? "warning" : "default"}
        insights={[
          data.unmatched > 0
            ? `${data.unmatched} unmatched entr${data.unmatched === 1 ? "y" : "ies"} found — investigate for missing invoices or bank records.`
            : "All ledger entries have corresponding bank records.",
          data.partial > 0
            ? `${data.partial} partial match${data.partial === 1 ? "" : "es"} detected — amount or description discrepancies exist.`
            : "No partial matches — all amounts align perfectly.",
          `Overall error score: ${data.error_score}% of total transaction volume is unreconciled.`,
        ]}
      />

      {/* AI-generated forensic insight */}
      <AiInsightBlock
        endpoint="/insights/reconciliation"
        label="Generate AI Reconciliation Insight"
        className="mb-6"
      />

      {/* Controls + Table */}
      <div className="card-elevated">
        <div className="p-6 border-b border-border flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-foreground">Bank Statement Reconciliation</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Compare ledger entries against bank records. Click a row to inspect.
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
            <thead className="sticky top-0 bg-muted z-10">
              <tr className="text-left">
                <th className="w-28">Date</th>
                <th>Ledger / Vendor</th>
                <th>Bank Description</th>
                <th className="text-right">Ledger Amt</th>
                <th className="text-right">Bank Amt</th>
                <th>Category</th>
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
                    className={cn("cursor-pointer", meta.row)}
                  >
                    <td className="tabular-nums text-muted-foreground">{r.date}</td>
                    <td className="text-foreground">
                      {r.ledgerDescription ?? <span className="text-muted-foreground italic">— missing —</span>}
                    </td>
                    <td className="text-foreground">
                      {r.bankDescription ?? (r.status === "unmatched" ? <span className="text-muted-foreground italic">— missing —</span> : "—")}
                    </td>
                    <td className="text-right tabular-nums">{fmt(r.ledgerAmount)}</td>
                    <td className="text-right tabular-nums">{fmt(r.bankAmount)}</td>
                    <td className="text-muted-foreground">{r.category || "—"}</td>
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
                    Reconciliation Detail
                  </span>
                </div>
                <SheetTitle className="text-base font-bold">Transaction · {selected.date}</SheetTitle>
                <SheetDescription className="text-xs">Entry #{selected.id}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <CompareBox title="Ledger" description={selected.ledgerDescription} amount={selected.ledgerAmount} />
                  <CompareBox title="Bank"   description={selected.bankDescription}   amount={selected.bankAmount}   />
                </div>

                {/* Status */}
                <div className={cn(
                  "rounded-xl border p-5",
                  selected.status === "matched"
                    ? "border-success/20 bg-success-soft/30"
                    : selected.status === "partial"
                    ? "border-warning/20 bg-warning-soft/30"
                    : "border-destructive/20 bg-destructive/5",
                )}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Status Detail</p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {selected.status === "matched"
                      ? "Full match — ledger and bank records agree on amount and description."
                      : selected.status === "partial"
                      ? "Partial match — description fuzzy-matched but amounts may differ, or vice versa."
                      : "No matching bank record found for this ledger entry, or unmatched bank credit."}
                  </p>
                  {selected.difference !== 0 && (
                    <p className="text-xs text-muted-foreground mt-2 tabular-nums">
                      Net difference: <span className="font-bold text-foreground">{fmt(selected.difference)}</span>
                    </p>
                  )}
                </div>

                {selected.category && (
                  <div className="rounded-lg bg-muted/30 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category</p>
                    <p className="text-sm font-semibold text-foreground mt-1">{selected.category}</p>
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

function SummaryRow({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-xs font-bold tabular-nums", good ? "text-success" : "text-warning")}>{value}</span>
    </div>
  );
}

function CompareBox({ title, description, amount }: { title: string; description: string | null; amount: number | null }) {
  const missing = description === null && amount === null;
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
      {missing ? (
        <p className="text-sm italic text-destructive mt-1">No matching record</p>
      ) : (
        <>
          <p className="text-sm font-semibold text-foreground mt-1 leading-snug">{description ?? "—"}</p>
          <p className="text-sm tabular-nums text-foreground mt-2">
            {amount !== null ? amount.toLocaleString("en-IN", { style: "currency", currency: "INR" }) : "—"}
          </p>
        </>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-80 gap-4 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin text-accent" />
      <p className="text-sm">Running reconciliation…</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-80 gap-3 text-destructive">
      <AlertCircle className="h-8 w-8" />
      <p className="text-sm font-semibold">Failed to load reconciliation</p>
      <p className="text-xs text-muted-foreground max-w-sm text-center">{message}</p>
      <p className="text-xs text-muted-foreground">Make sure you uploaded both a ledger and bank statement first.</p>
    </div>
  );
}

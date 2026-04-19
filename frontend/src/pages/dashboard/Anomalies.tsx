import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, ReferenceArea,
} from "recharts";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { InsightCard } from "@/components/InsightCard";
import { AiInsightBlock } from "@/components/AiInsightBlock";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle } from "lucide-react";
import { fetchAnomalies, type AnomalyRecord, type AnomalyResult } from "@/lib/api";
import { useSettings } from "@/lib/settings";

function riskTone(r: number) {
  if (r >= 0.75) return { label: "High", bar: "bg-destructive", text: "text-destructive", bg: "bg-destructive/10" };
  if (r >= 0.45) return { label: "Medium", bar: "bg-warning", text: "text-warning", bg: "bg-warning-soft" };
  return { label: "Low", bar: "bg-success", text: "text-success", bg: "bg-success-soft" };
}

const fmt = (n: number) => n.toLocaleString("en-IN", { style: "currency", currency: "INR" });

export default function Anomalies() {
  const { settings } = useSettings();
  const [data, setData] = useState<AnomalyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AnomalyRecord | null>(null);

  // Convert sensitivity (0-100) to contamination (0.01-0.5)
  const contamination = Math.max(0.01, Math.min(0.5, (100 - settings.risk.outlier) / 200));

  useEffect(() => {
    setLoading(true);
    fetchAnomalies(contamination)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [contamination]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const maxAmount = Math.max(...(data.scatter.map((p) => p.amount)), 1);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 stagger-children">
        {/* Amount distribution */}
        <div className="card-elevated">
          <div className="p-6 border-b border-border">
            <h2 className="text-sm font-bold text-foreground">Transaction Amount Distribution</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Frequency by amount band.</p>
          </div>
          <div className="p-6">
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.amount_histogram} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 10,
                    fontSize: 12,
                    boxShadow: "var(--shadow-lg)",
                  }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {data.amount_histogram.map((b, i) => (
                      <Cell key={i} fill={b.bucket === "75k+" ? "hsl(var(--destructive))" : "hsl(var(--primary))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Scatter plot */}
        <div className="card-elevated">
          <div className="p-6 border-b border-border">
            <h2 className="text-sm font-bold text-foreground">Amount vs. Day (Scatter)</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Red dots are flagged outliers.</p>
          </div>
          <div className="p-6">
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" dataKey="day" name="Day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} unit="d" />
                  <YAxis type="number" dataKey="amount" name="Amount" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                  <ZAxis range={[40, 40]} />
                  <ReferenceArea y1={maxAmount * 0.7} y2={maxAmount * 1.05} fill="hsl(var(--destructive) / 0.05)" stroke="hsl(var(--destructive) / 0.2)" strokeDasharray="3 3" />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 10,
                      fontSize: 12,
                      boxShadow: "var(--shadow-lg)",
                    }}
                    formatter={(v: unknown, n: string) =>
                      n === "Amount" ? fmt(Number(v)) : String(v)
                    } />
                  <Scatter data={data.scatter} fill="hsl(var(--primary))">
                    {data.scatter.map((p, i) => (
                      <Cell key={i} fill={p.risk >= 0.75 ? "hsl(var(--destructive))" : p.risk >= 0.45 ? "hsl(var(--warning))" : "hsl(var(--primary))"} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <InsightCard
        className="mb-6"
        tone="warning"
        insights={[
          `${data.total_flagged} transactions flagged out of ${data.total_records} total records.`,
          data.anomalies.filter((a) => a.risk >= 0.75).length > 0
            ? `${data.anomalies.filter((a) => a.risk >= 0.75).length} high-risk outlier(s) detected — review immediately.`
            : "No high-risk outliers detected.",
          "Transactions with odd-hour timestamps accumulate an additional risk penalty.",
        ]}
      />

      {/* AI-generated forensic insight */}
      <AiInsightBlock
        endpoint="/insights/anomalies"
        label="Generate AI Risk Analysis"
        className="mb-6"
      />

      {/* Outlier detection table */}
      <div className="card-elevated">
        <div className="p-6 border-b border-border">
          <h2 className="text-sm font-bold text-foreground">Outlier Detection ({data.total_flagged} flagged)</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Click a transaction to view detail.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm table-premium">
            <thead>
              <tr className="text-left">
                <th>Date</th>
                <th>Vendor</th>
                <th>Employee</th>
                <th>Category</th>
                <th className="text-right">Amount</th>
                <th>Risk Score</th>
              </tr>
            </thead>
            <tbody>
              {data.anomalies.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground text-sm">
                    No anomalies detected with current contamination threshold.
                  </td>
                </tr>
              )}
              {data.anomalies.map((a) => {
                const tone = riskTone(a.risk);
                return (
                  <tr
                    key={a.id}
                    onClick={() => setSelected(a)}
                    className="cursor-pointer"
                  >
                    <td className="tabular-nums text-muted-foreground">{a.date}</td>
                    <td className="font-semibold text-foreground">{a.vendor}</td>
                    <td className="text-muted-foreground">{a.employee || "—"}</td>
                    <td className="text-muted-foreground">{a.category || "—"}</td>
                    <td className="text-right tabular-nums font-bold text-foreground">{fmt(a.amount)}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all duration-300", tone.bar)} style={{ width: `${a.risk * 100}%` }} />
                        </div>
                        <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-md", tone.bg, tone.text)}>
                          {tone.label} · {(a.risk * 100).toFixed(0)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-base font-bold">Anomaly Detail</SheetTitle>
                <SheetDescription className="text-xs">Transaction {selected.transaction_id}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date" value={selected.date} />
                  <Field label="Vendor" value={selected.vendor} />
                  <Field label="Amount" value={fmt(selected.amount)} />
                  <Field label="Hour" value={`${selected.hour}:00`} />
                  <Field label="Employee" value={selected.employee || "—"} />
                  <Field label="Category" value={selected.category || "—"} />
                </div>

                {/* Risk bar */}
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Risk Score</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", riskTone(selected.risk).bar)}
                        style={{ width: `${selected.risk * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold tabular-nums">{(selected.risk * 100).toFixed(0)} / 100</span>
                  </div>
                </div>

                <div className={cn(
                  "rounded-xl border p-4 space-y-3",
                  selected.risk >= 0.75
                    ? "border-destructive/20 bg-destructive/5"
                    : selected.risk >= 0.45
                      ? "border-warning/20 bg-warning-soft/30"
                      : "border-success/20 bg-success-soft/30"
                )}>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Why Flagged</p>
                    <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wide font-medium">Rule-based analysis</span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">
                    {selected.reason || "Flagged as a statistical outlier by the Isolation Forest model."}
                  </p>
                  {/* Factor breakdown pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selected.reason?.split("; ").map((factor, i) => (
                      <span key={i} className={cn(
                        "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                        selected.risk >= 0.75
                          ? "bg-destructive/10 border-destructive/20 text-destructive"
                          : selected.risk >= 0.45
                            ? "bg-warning/10 border-warning/20 text-warning"
                            : "bg-success/10 border-success/20 text-success"
                      )}>
                        {factor}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/30 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground tabular-nums mt-1">{value}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-80 gap-4 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin text-accent" />
      <p className="text-sm">Running anomaly detection…</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-80 gap-3 text-destructive">
      <AlertCircle className="h-8 w-8" />
      <p className="text-sm font-semibold">Failed to load anomaly analysis</p>
      <p className="text-xs text-muted-foreground max-w-sm text-center">{message}</p>
      <p className="text-xs text-muted-foreground">Make sure you uploaded a ledger file first.</p>
    </div>
  );
}

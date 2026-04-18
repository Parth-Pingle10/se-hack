import { useState } from "react";
import { anomalies, amountHistogram, anomalyScatter, type Anomaly } from "@/lib/mockData";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { InsightCard } from "@/components/InsightCard";
import { RiskBreakdown, WhyFlagged } from "@/components/RiskBreakdown";
import { scoreTransaction } from "@/lib/risk";
import { cn } from "@/lib/utils";
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Scatter, ScatterChart,
  Tooltip, XAxis, YAxis, ZAxis, ReferenceArea,
} from "recharts";

function riskTone(r: number) {
  if (r >= 0.75) return { label: "High",   bar: "bg-destructive",      text: "text-destructive",      bg: "bg-destructive/10" };
  if (r >= 0.45) return { label: "Medium", bar: "bg-warning",          text: "text-warning",          bg: "bg-warning-soft" };
  return            { label: "Low",    bar: "bg-success",          text: "text-success",          bg: "bg-success-soft" };
}

const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function Anomalies() {
  const [selected, setSelected] = useState<Anomaly | null>(null);

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
                <BarChart data={amountHistogram} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
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
                    {amountHistogram.map((b, i) => (
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
            <h2 className="text-sm font-bold text-foreground">Amount vs. Date</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Outlier zone shaded above the amount threshold.</p>
          </div>
          <div className="p-6">
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" dataKey="day" name="Day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} unit="d" />
                  <YAxis type="number" dataKey="amount" name="Amount" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}
                         tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`} />
                  <ZAxis range={[60, 60]} />
                  <ReferenceArea y1={50000} y2={200000} fill="hsl(var(--destructive) / 0.05)" stroke="hsl(var(--destructive) / 0.2)" strokeDasharray="3 3" />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }}
                           contentStyle={{
                             background: "hsl(var(--popover))",
                             border: "1px solid hsl(var(--border))",
                             borderRadius: 10,
                             fontSize: 12,
                             boxShadow: "var(--shadow-lg)",
                           }}
                           formatter={(v: any, n) => n === "amount" ? fmt(Number(v)) : v} />
                  <Scatter data={anomalyScatter} fill="hsl(var(--primary))">
                    {anomalyScatter.map((p, i) => (
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
          "Transactions above $50,000 fall outside the normal range and dominate the high-risk band.",
          "High-value transactions show abnormal clustering early in the period under review.",
          "Three vendors account for the majority of anomaly score.",
        ]}
      />

      {/* Outlier detection table */}
      <div className="card-elevated">
        <div className="p-6 border-b border-border">
          <h2 className="text-sm font-bold text-foreground">Outlier Detection</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Click a transaction to view the explainable insight.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm table-premium">
            <thead>
              <tr className="text-left">
                <th>Date</th>
                <th>Vendor</th>
                <th className="text-right">Amount</th>
                <th>Risk Score</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((a) => {
                const tone = riskTone(a.risk);
                return (
                  <tr
                    key={a.id}
                    onClick={() => setSelected(a)}
                    className="cursor-pointer"
                  >
                    <td className="tabular-nums text-muted-foreground">{a.date}</td>
                    <td className="font-semibold text-foreground">{a.vendor}</td>
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
          {selected && (() => {
            const breakdown = scoreTransaction(selected);
            return (
              <>
                <SheetHeader>
                  <SheetTitle className="text-base font-bold">Explainable Insight</SheetTitle>
                  <SheetDescription className="text-xs">Transaction #{selected.id}</SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Date"   value={selected.date} />
                    <Field label="Vendor" value={selected.vendor} />
                    <Field label="Amount" value={fmt(selected.amount)} />
                    <Field label="Risk"   value={`${breakdown.score} / 100`} />
                  </div>

                  <RiskBreakdown data={breakdown} />
                  <WhyFlagged text={breakdown.why} />
                </div>
              </>
            );
          })()}
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

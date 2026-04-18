import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Input } from "@/components/ui/input";
import { Search, Users } from "lucide-react";
import { fuzzyMatches, similarityHistogram, vendorClusters } from "@/lib/mockData";
import { InsightCard } from "@/components/InsightCard";
import { cn } from "@/lib/utils";

export default function Fuzzy() {
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return fuzzyMatches;
    return fuzzyMatches.filter(
      (r) => r.vendorA.toLowerCase().includes(term) || r.vendorB.toLowerCase().includes(term)
    );
  }, [q]);

  return (
    <div className="space-y-6 stagger-children">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Similarity histogram */}
        <div className="lg:col-span-2 card-elevated">
          <div className="p-6 border-b border-border">
            <h2 className="text-sm font-bold text-foreground">Similarity Score Distribution</h2>
            <p className="text-xs text-muted-foreground mt-0.5">How vendor pairs are spread across similarity bands.</p>
          </div>
          <div className="p-6">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={similarityHistogram} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
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
                  <Bar dataKey="count" name="Vendor pairs" radius={[4, 4, 0, 0]}>
                    {similarityHistogram.map((b, i) => (
                      <Cell key={i} fill={b.bucket.startsWith("0.8") || b.bucket.startsWith("0.9") ? "hsl(var(--warning))" : "hsl(var(--primary))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Vendor clusters */}
        <div className="card-elevated">
          <div className="p-6 border-b border-border">
            <h2 className="text-sm font-bold text-foreground">Vendor Clusters</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Groups of likely-duplicate vendors.</p>
          </div>
          <div className="p-5 space-y-3">
            {vendorClusters.map((c) => (
              <div key={c.id} className="rounded-xl border border-border bg-background p-4 transition-colors duration-200 hover:bg-muted/30">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-accent-soft text-accent flex items-center justify-center">
                      <Users className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">{c.label}</p>
                  </div>
                  <span className="text-xs font-bold tabular-nums text-foreground bg-muted px-2 py-0.5 rounded">{c.avgScore.toFixed(2)}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {c.members.map((m) => (
                    <span key={m} className="text-[11px] px-2 py-0.5 rounded-md bg-muted/80 text-muted-foreground font-medium">{m}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <InsightCard
        tone="warning"
        insights={[
          `${vendorClusters.length} vendor clusters show high naming similarity, suggesting possible duplicate master records.`,
          "Pairs above 0.85 should be reviewed for consolidation before payment runs.",
          "Naming variants like 'Inc' vs 'Incorporated' are the most common source of duplication.",
        ]}
      />

      {/* Similarity table */}
      <div className="card-elevated">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-6 border-b border-border">
          <div>
            <h2 className="text-sm font-bold text-foreground">Vendor Similarity Analysis</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Pairs ranked by string similarity score (0–1).</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search vendor…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9 h-9 text-sm rounded-lg"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm table-premium">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="text-left">
                <th>Vendor A</th>
                <th>Vendor B</th>
                <th className="text-right">Similarity</th>
                <th className="w-32">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const high = r.score >= 0.85;
                return (
                  <tr
                    key={r.id}
                    className={cn(
                      high && "bg-warning-soft/20"
                    )}
                  >
                    <td className="font-semibold text-foreground">{r.vendorA}</td>
                    <td className="text-muted-foreground">{r.vendorB}</td>
                    <td className="text-right tabular-nums font-bold text-foreground">
                      {r.score.toFixed(2)}
                    </td>
                    <td>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-300", high ? "bg-warning" : "bg-primary/60")}
                          style={{ width: `${r.score * 100}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-muted-foreground text-sm">No matches.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

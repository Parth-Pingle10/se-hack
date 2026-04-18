import { Bar, BarChart, CartesianGrid, Cell, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { benfordData, benfordDeviation } from "@/lib/mockData";
import { StatCard } from "@/components/StatCard";
import { InsightCard } from "@/components/InsightCard";
import { RiskBadge } from "@/components/RiskBadge";
import { benfordForensic } from "@/lib/risk";
import { TrendingUp, AlertTriangle, Activity, ShieldAlert } from "lucide-react";

export default function Benford() {
  const topSuspect = [...benfordDeviation]
    .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))
    .slice(0, 3);

  const forensic = benfordForensic();
  const sigCount = forensic.rows.filter((r) => r.significant).length;

  return (
    <div className="space-y-6 stagger-children">
      {/* Risk score banner */}
      <div className="card-elevated p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-warning-soft text-warning flex items-center justify-center">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Benford Risk Score</p>
            <p className="text-lg font-bold text-foreground tabular-nums">{forensic.score} / 100</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <RiskBadge score={forensic.score} band={forensic.band} />
          <span className="text-xs text-muted-foreground">
            {sigCount} digit{sigCount === 1 ? "" : "s"} statistically significant (|z| ≥ 1.96)
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Records analyzed" value="12,481" icon={Activity} />
        <StatCard label="Chi-square"        value="14.7"   hint="Above expected threshold" icon={TrendingUp} tone="warning" />
        <StatCard label="Suspect digits"    value={String(sigCount)} hint="By Z-score significance" icon={AlertTriangle} tone="warning" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main distribution chart */}
        <div className="lg:col-span-2 card-elevated">
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div>
              <h2 className="text-sm font-bold text-foreground">Benford's Law Distribution</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Expected vs. actual frequency of leading digits.</p>
            </div>
          </div>
          <div className="p-6">
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={benfordData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="digit" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 10,
                      fontSize: 12,
                      boxShadow: "var(--shadow-lg)",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} iconType="circle" />
                  <Bar dataKey="expected" name="Expected" fill="hsl(var(--muted-foreground) / 0.25)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual"   name="Actual"   fill="hsl(var(--primary))"                  radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Top suspicious digits */}
        <div className="card-elevated">
          <div className="p-6 border-b border-border">
            <h2 className="text-sm font-bold text-foreground">Top Suspicious Digits</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Largest deviations from expected.</p>
          </div>
          <div className="p-5 space-y-3">
            {topSuspect.map((d) => {
              const over = d.deviation > 0;
              return (
                <div key={d.digit} className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 transition-colors duration-200 hover:bg-muted/30">
                  <div className="flex items-center gap-3.5">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center text-sm font-bold ${over ? "bg-warning-soft text-warning" : "bg-accent-soft text-accent"}`}>
                      {d.digit}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Digit {d.digit}</p>
                      <p className="text-xs text-muted-foreground">{d.ratio}× expected</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${over ? "text-warning" : "text-accent"}`}>
                    {over ? "+" : ""}{d.deviation}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Deviation chart */}
      <div className="card-elevated">
        <div className="p-6 border-b border-border">
          <h2 className="text-sm font-bold text-foreground">Deviation Summary</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Signed difference between actual and expected per digit.</p>
        </div>
        <div className="p-6">
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={benfordDeviation} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="digit" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 10,
                  fontSize: 12,
                  boxShadow: "var(--shadow-lg)",
                }} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <Bar dataKey="deviation" name="Deviation" radius={[4, 4, 0, 0]}>
                  {benfordDeviation.map((d) => (
                    <Cell key={d.digit} fill={Math.abs(d.deviation) > 1.5 ? "hsl(var(--warning))" : "hsl(var(--muted-foreground) / 0.25)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <InsightCard
        tone="warning"
        insights={[
          "Digit 9 occurs ~1.5× more often than expected — manipulation indicator.",
          "Digit 7 is materially under-represented relative to Benford's expectation.",
          "Overall conformity is moderate; segment by vendor or business unit for finer detection.",
        ]}
      />
    </div>
  );
}

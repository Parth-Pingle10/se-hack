import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { StatCard } from "@/components/StatCard";
import { InsightCard } from "@/components/InsightCard";
import { AiInsightBlock } from "@/components/AiInsightBlock";
import { RiskBadge } from "@/components/RiskBadge";
import type { RiskBand } from "@/lib/risk";
import { TrendingUp, AlertTriangle, Activity, ShieldAlert, Loader2, AlertCircle } from "lucide-react";
import { fetchBenford, type BenfordResult } from "@/lib/api";
import { useSettings } from "@/lib/settings";

function toBand(band: string): RiskBand {
  const b = band.toLowerCase();
  if (b === "high") return "high";
  if (b === "moderate" || b === "medium") return "medium";
  return "low";
}

export default function Benford() {
  const { settings } = useSettings();
  const [data, setData] = useState<BenfordResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchBenford()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const topSuspect = [...data.chart_data]
    .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))
    .slice(0, 3);

  const sigCount = data.significant_digits.length;

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
            <p className="text-lg font-bold text-foreground tabular-nums">{data.benford_score} / 100</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <RiskBadge score={data.benford_score} band={toBand(data.band)} />
          <span className="text-xs text-muted-foreground">
            {sigCount} digit{sigCount === 1 ? "" : "s"} deviate by &gt;1.5% from expected
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Records analyzed" value={data.records_analyzed.toLocaleString()} icon={Activity} />
        <StatCard
          label="Chi-square"
          value={String(data.chi_square)}
          hint={data.chi_square > 15 ? "Above expected threshold" : "Within normal range"}
          icon={TrendingUp}
          tone={data.chi_square > 15 ? "warning" : undefined}
        />
        <StatCard
          label="Suspect digits"
          value={String(sigCount)}
          hint="By deviation significance (>1.5%)"
          icon={AlertTriangle}
          tone={sigCount > 2 ? "warning" : undefined}
        />
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
                <BarChart data={data.chart_data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
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
                    formatter={(v: number, name: string) => [`${Number(v).toFixed(2)}%`, name]}
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
              <BarChart data={data.chart_data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
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
                  {data.chart_data.map((d) => (
                    <Cell key={d.digit} fill={Math.abs(d.deviation) > 1.5 ? "hsl(var(--warning))" : "hsl(var(--muted-foreground) / 0.25)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <InsightCard
        tone={data.benford_score >= 60 ? "warning" : "default"}
        insights={[
          sigCount > 0
            ? `${sigCount} digit(s) deviate significantly from Benford's expected distribution.`
            : "All digits conform closely to Benford's Law — data appears unmanipulated.",
          data.chi_square > 15
            ? `Chi-square statistic (${data.chi_square}) exceeds the typical threshold — review manually.`
            : `Chi-square (${data.chi_square}) is within normal range.`,
          "Segment by vendor or category for a finer-grained Benford analysis.",
        ]}
      />

      {/* AI-generated forensic insight */}
      <AiInsightBlock
        endpoint="/insights/benford"
        label="Generate AI Forensic Analysis"
      />
    </div>
  );
}


function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-80 gap-4 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin text-accent" />
      <p className="text-sm">Running Benford analysis…</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-80 gap-3 text-destructive">
      <AlertCircle className="h-8 w-8" />
      <p className="text-sm font-semibold">Failed to load Benford analysis</p>
      <p className="text-xs text-muted-foreground max-w-sm text-center">{message}</p>
      <p className="text-xs text-muted-foreground">Make sure you uploaded a ledger file first.</p>
    </div>
  );
}

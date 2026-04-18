import { useEffect, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, ComposedChart, Line,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import { StatCard } from "@/components/StatCard";
import { InsightCard } from "@/components/InsightCard";
import { TrendingUp, AlertTriangle, Zap, Activity, Loader2, AlertCircle, Target } from "lucide-react";
import { fetchMonteCarlo, type MonteCarloResult } from "@/lib/api";
import { RiskBadge } from "@/components/RiskBadge";
import type { RiskBand } from "@/lib/risk";

function getRiskBand(survivalRate: number): RiskBand {
  if (survivalRate >= 85) return "low";
  if (survivalRate >= 70) return "medium";
  return "high";
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function MonteCarlo() {
  const [data, setData] = useState<MonteCarloResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchMonteCarlo()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const survivalRate = data.survival_rate;
  const insolvencyRisk = data.insolvency_risk;
  const currentBalance = data.current_balance;
  const endingBalance = data.chart_data[data.chart_data.length - 1]?.p50 || 0;

  const riskBand = getRiskBand(survivalRate);
  const riskScore = Math.max(0, Math.min(100, 100 - survivalRate));

  // Generate insights based on simulation results
  const insights = [];
  
  if (survivalRate >= 85) {
    insights.push("Strong cash position with low insolvency risk over 12 months.");
  } else if (survivalRate >= 70) {
    insights.push("Moderate cash flow stability; monitor cash reserves closely.");
  } else {
    insights.push("Significant liquidity risk detected. Immediate action recommended.");
  }

  if (insolvencyRisk > 20) {
    insights.push(`${insolvencyRisk}% of scenarios touch insolvency threshold during projection period.`);
  }

  const volatility = data.monthly_volatility;
  if (volatility > Math.abs(data.avg_monthly_drift) * 2) {
    insights.push("High cash flow volatility detected. Consider establishing a cash reserve.");
  }

  if (data.avg_monthly_drift < 0) {
    insights.push("Negative average monthly drift indicates cash outflows exceed inflows.");
  } else {
    insights.push("Positive average monthly drift suggests cash accumulation trend.");
  }

  return (
    <div className="space-y-6 stagger-children">
      {/* Risk Score Banner */}
      <div className="card-elevated p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              12-Month Survival Rate
            </p>
            <p className="text-lg font-bold text-foreground tabular-nums">
              {survivalRate.toFixed(1)}%
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <RiskBadge score={riskScore} band={riskBand} />
          <span className="text-xs text-muted-foreground">
            {insolvencyRisk.toFixed(1)}% insolvency risk
          </span>
        </div>
      </div>

      {/* Insights Card */}
      <InsightCard insights={insights.slice(0, 4)} />

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Current Balance"
          value={formatCurrency(currentBalance)}
          icon={Activity}
          tone={currentBalance > 0 ? "success" : "warning"}
        />
        <StatCard
          label="Projected Median (Month 12)"
          value={formatCurrency(endingBalance)}
          icon={TrendingUp}
          tone={endingBalance > currentBalance ? "success" : endingBalance > 0 ? "warning" : "destructive"}
        />
        <StatCard
          label="Avg Monthly Drift"
          value={formatCurrency(data.avg_monthly_drift)}
          icon={Zap}
          tone={data.avg_monthly_drift > 0 ? "success" : "warning"}
        />
        <StatCard
          label="Cash Flow Volatility"
          value={formatCurrency(data.monthly_volatility)}
          hint="Monthly standard deviation"
          icon={AlertTriangle}
          tone="warning"
        />
      </div>

      {/* Chart Section */}
      <div className="card-elevated">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-sm font-bold text-foreground">
              12-Month Cash Flow Projection
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Monte Carlo simulation with percentile bands (1,000 iterations)
            </p>
          </div>
        </div>

        <div className="p-6">
          <div className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={data.chart_data}
                margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatCurrency}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value: number) => [formatCurrency(value), ""]}
                />
                <Legend />

                {/* Safe Zone (75-95) */}
                <Area
                  type="monotone"
                  dataKey="p95"
                  fill="rgba(34, 197, 94, 0.15)"
                  stroke="none"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="p75"
                  fill="rgba(34, 197, 94, 0.3)"
                  stroke="rgba(34, 197, 94, 0.6)"
                  strokeWidth={1.5}
                  name="Safe Zone (75–95th percentile)"
                  isAnimationActive={false}
                />

                {/* Warning Zone (25-75) */}
                <Area
                  type="monotone"
                  dataKey="p50"
                  fill="rgba(251, 146, 60, 0.15)"
                  stroke="none"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="p25"
                  fill="rgba(251, 146, 60, 0.3)"
                  stroke="rgba(251, 146, 60, 0.6)"
                  strokeWidth={1.5}
                  name="Warning Zone (25–75th percentile)"
                  isAnimationActive={false}
                />

                {/* Critical Zone (5-25) */}
                <Area
                  type="monotone"
                  dataKey="p5"
                  fill="rgba(239, 68, 68, 0.3)"
                  stroke="rgba(239, 68, 68, 0.8)"
                  strokeWidth={1.5}
                  name="Critical Zone (5–25th percentile)"
                  isAnimationActive={false}
                />

                {/* Median Line */}
                <Line
                  type="monotone"
                  dataKey="p50"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={2.5}
                  dot={false}
                  name="Median Path"
                  isAnimationActive={false}
                />

                {/* Insolvency Threshold */}
                <ReferenceLine
                  y={0}
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  label={{
                    value: "Insolvency Limit",
                    position: "right",
                    fill: "hsl(var(--destructive))",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Scenario Explanation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-elevated p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-3 w-3 rounded-full bg-success" />
            <h3 className="text-sm font-bold text-foreground">Safe Scenario</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            75–95th percentile range. Strong cash position with adequate liquidity cushion.
          </p>
        </div>

        <div className="card-elevated p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-3 w-3 rounded-full bg-warning" />
            <h3 className="text-sm font-bold text-foreground">Warning Scenario</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            25–75th percentile range. Moderate stress; cash remains positive but declining.
          </p>
        </div>

        <div className="card-elevated p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-3 w-3 rounded-full bg-destructive" />
            <h3 className="text-sm font-bold text-foreground">Critical Scenario</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            5–25th percentile range. Severe stress; risk of negative cash balance.
          </p>
        </div>
      </div>

      {/* Methodology */}
      <div className="card-elevated p-6 border border-border">
        <h3 className="text-sm font-bold text-foreground mb-3">Methodology</h3>
        <ul className="space-y-2 text-xs text-muted-foreground">
          <li>
            • <strong>Model:</strong> Geometric Brownian Motion-inspired simulation with monthly time steps
          </li>
          <li>
            • <strong>Input:</strong> Historical monthly cash flows from ledger data
          </li>
          <li>
            • <strong>Parameters:</strong> 1,000 Monte Carlo iterations over 12 months
          </li>
          <li>
            • <strong>Output:</strong> Probability distributions of ending cash balance and insolvency risk
          </li>
          <li>
            • <strong>Use Case:</strong> Assess going-concern viability and liquidity risk under historical volatility assumptions
          </li>
        </ul>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">Running simulation...</p>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="card-elevated p-6 border-l-4 border-destructive bg-destructive/5">
      <div className="flex gap-3">
        <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-sm text-foreground mb-1">Analysis Error</h3>
          <p className="text-xs text-muted-foreground">{message}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Please ensure a ledger file has been uploaded.
          </p>
        </div>
      </div>
    </div>
  );
}

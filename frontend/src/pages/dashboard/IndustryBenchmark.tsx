import { useEffect, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend,
  ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine
} from "recharts";
import { StatCard } from "@/components/StatCard";
import { RiskBadge } from "@/components/RiskBadge";
import type { RiskBand } from "@/lib/risk";
import { Loader2, AlertCircle, PieChart, Info, Building2, Percent } from "lucide-react";
import { fetchBenchmark, type BenchmarkResult } from "@/lib/api";

function getRiskBandFromClassification(cls: string): RiskBand {
    const c = cls.toLowerCase();
    if (c.includes("significantly")) return "high";
    if (c.includes("above") || c.includes("below")) return "medium";
    return "low";
}

const SECTORS = [
    "Technology",
    "Retail",
    "Healthcare",
    "Financial Services",
    "Manufacturing"
];

export default function IndustryBenchmark() {
  const [data, setData] = useState<BenchmarkResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [sector, setSector] = useState("Technology");
  const [clientValue, setClientValue] = useState(2.8);

  const loadData = () => {
    setLoading(true);
    fetchBenchmark(clientValue, sector)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sector]);

  if (error) return <ErrorState message={error} />;

  // Chart data formatting
  const chartData = data ? [
      {
          name: "Distribution",
          "Ideal Range (Low)": data.ideal_range[0],
          "P25 to Median": data.industry_median - data.ideal_range[0],
          "Median to P75": data.ideal_range[1] - data.industry_median,
          "P75 to P90 (High Risk)": data.p90_threshold - data.ideal_range[1],
      }
  ] : [];

  return (
    <div className="space-y-6 stagger-children">
      {/* Risk score banner with Inputs native style */}
      <div className="card-elevated p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
            <PieChart className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Industry Benchmarking</p>
            <p className="text-lg font-bold text-foreground truncate max-w-[250px] sm:max-w-none">
              Client vs {sector} Peers
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
            <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Sector</label>
                <select 
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="h-9 px-3 py-1 rounded-md border border-border bg-background text-sm font-medium focus:ring-1 focus:ring-ring outline-none"
                >
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            
            <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Entity Metric (%)</label>
                <div className="flex items-center gap-2">
                    <input 
                        type="number" 
                        step="0.1"
                        value={clientValue}
                        onChange={(e) => setClientValue(parseFloat(e.target.value) || 0)}
                        onBlur={loadData}
                        onKeyDown={(e) => e.key === 'Enter' && loadData()}
                        className="h-9 w-24 px-3 py-1 rounded-md border border-border bg-background text-sm font-medium focus:ring-1 focus:ring-ring outline-none"
                    />
                    <button 
                        onClick={loadData}
                        className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
                    >
                        Analyze
                    </button>
                </div>
            </div>
        </div>
      </div>

      {loading && !data && <LoadingState />}

      {data && (
          <>
            {/* Classification & Quick view */}
            <div className="card-elevated p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <RiskBadge 
                      score={getRiskBandFromClassification(data.classification) === 'high' ? 90 : getRiskBandFromClassification(data.classification) === 'medium' ? 60 : 10} 
                      band={getRiskBandFromClassification(data.classification)} 
                  />
                  <p className="text-sm font-semibold text-foreground">
                      Status: <span className="font-bold">{data.classification}</span>
                  </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                 <Building2 className="w-3.5 h-3.5" /> Client metric represents {data.client_value}% error/anomaly rate
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard 
                  label="Industry Median" 
                  value={`${data.industry_median}%`} 
                  icon={Building2} 
              />
              <StatCard
                label="Ideal Range (P25 - P75)"
                value={`${data.ideal_range[0]}% - ${data.ideal_range[1]}%`}
                hint="Expected bounds for healthy operations"
                icon={Info}
              />
              <StatCard
                label="Critical Threshold (P90)"
                value={`${data.p90_threshold}%`}
                hint="Rates above this signify severe risk"
                icon={AlertCircle}
                tone="warning"
              />
            </div>

            {/* Charts row */}
            <div className="card-elevated">
                <div className="flex items-center justify-between p-6 border-b border-border">
                  <div>
                    <h2 className="text-sm font-bold text-foreground">Distribution Analysis</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Where the client falls among industry peers.</p>
                  </div>
                </div>
                <div className="p-6">
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                          layout="vertical"
                          data={chartData} 
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} unit="%" />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }} axisLine={false} tickLine={false} hide />
                        <Tooltip
                            cursor={{ fill: "transparent" }}
                            contentStyle={{
                              background: "hsl(var(--popover))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: 10,
                              fontSize: 12,
                              boxShadow: "var(--shadow-lg)",
                            }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} iconType="circle" />
                        
                        <Bar dataKey="Ideal Range (Low)" stackId="a" fill="transparent" />
                        <Bar dataKey="P25 to Median" stackId="a" fill="hsl(var(--primary) / 0.5)" radius={[4, 0, 0, 4]} />
                        <Bar dataKey="Median to P75" stackId="a" fill="hsl(var(--primary))" />
                        <Bar dataKey="P75 to P90 (High Risk)" stackId="a" fill="hsl(var(--warning) / 0.7)" radius={[0, 4, 4, 0]} />
                        
                        <ReferenceLine 
                            x={data.client_value} 
                            stroke="hsl(var(--accent))" 
                            strokeWidth={3}
                            label={{ position: 'top', value: 'Client Metric', fill: 'hsl(var(--accent))', fontSize: 12, fontWeight: 'bold' }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="mt-4 p-4 rounded-xl border border-border bg-muted/20 flex flex-col gap-2 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-accent"></div>
                      <h3 className="text-sm font-bold text-foreground">Forensic Insights</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                          The client's measured rate of <strong>{data.client_value}%</strong> is classified as <strong>{data.classification}</strong>. 
                          {data.client_value > data.p90_threshold && " Immediate review of anomalous entries is recommended as the volume exceeds 90% of industry peers."}
                          {data.client_value > data.ideal_range[1] && data.client_value <= data.p90_threshold && " Elevated error rates suggest operational friction or potentially aggressive accounting practices."}
                          {data.client_value >= data.ideal_range[0] && data.client_value <= data.ideal_range[1] && " Overall operations align with historical sector baselines."}
                          {data.client_value < data.ideal_range[0] && " Abnormally low error rates may signify omitted transactions or highly restrictive internal controls."}
                      </p>
                  </div>
                </div>
            </div>
          </>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-80 gap-4 text-muted-foreground card-elevated">
      <Loader2 className="h-8 w-8 animate-spin text-accent" />
      <p className="text-sm">Retrieving benchmark data…</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-80 gap-3 text-destructive card-elevated">
      <AlertCircle className="h-8 w-8" />
      <p className="text-sm font-semibold">Failed to load Benchmark analysis</p>
      <p className="text-xs text-muted-foreground max-w-sm text-center">{message}</p>
    </div>
  );
}

// LedgerSpy — FastAPI client
// All endpoints live at http://localhost:8000

const BASE = "http://localhost:8000";

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Upload ──────────────────────────────────────────────────────────────────

export interface UploadResult {
  status: string;
  rows: number;
  columns: string[];
  null_rows: number;
  duplicate_rows: number;
  readiness_score: number;
}

export async function uploadLedger(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  return request<UploadResult>("/upload/ledger", { method: "POST", body: form });
}

export async function uploadBank(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  return request<UploadResult>("/upload/bank", { method: "POST", body: form });
}

// ─── Benford ──────────────────────────────────────────────────────────────────

export interface BenfordChartRow {
  digit: string;
  expected: number;
  actual: number;
  deviation: number;
  ratio: number;
}

export interface BenfordResult {
  records_analyzed: number;
  chart_data: BenfordChartRow[];
  chi_square: number;
  significant_digits: BenfordChartRow[];
  benford_score: number;
  band: "Low" | "Moderate" | "High";
}

export async function fetchBenford(): Promise<BenfordResult> {
  return request<BenfordResult>("/analysis/benford");
}

// ─── Anomalies ───────────────────────────────────────────────────────────────

export interface AnomalyRecord {
  id: number;
  date: string;
  vendor: string;
  amount: number;
  hour: number;
  risk: number;
  category: string;
  employee: string;
  transaction_id: string;
}

export interface ScatterPoint {
  day: number;
  amount: number;
  risk: number;
  vendor: string;
  date: string;
}

export interface AnomalyResult {
  total_flagged: number;
  total_records: number;
  anomalies: AnomalyRecord[];
  amount_histogram: { bucket: string; count: number }[];
  scatter: ScatterPoint[];
}

export async function fetchAnomalies(contamination = 0.05): Promise<AnomalyResult> {
  return request<AnomalyResult>(`/analysis/anomalies?contamination=${contamination}`);
}

// ─── Fuzzy ────────────────────────────────────────────────────────────────────

export interface FuzzyMatch {
  id: number;
  vendorA: string;
  vendorB: string;
  score: number;
}

export interface VendorCluster {
  id: string;
  label: string;
  members: string[];
  avgScore: number;
}

export interface FuzzyResult {
  total_vendors: number;
  flagged_pairs: number;
  matches: FuzzyMatch[];
  similarity_histogram: { bucket: string; count: number }[];
  vendor_clusters: VendorCluster[];
}

export async function fetchFuzzy(threshold = 0.7): Promise<FuzzyResult> {
  return request<FuzzyResult>(`/analysis/fuzzy?threshold=${threshold}`);
}

// ─── Reconciliation ──────────────────────────────────────────────────────────

export type ReconStatus = "matched" | "partial" | "unmatched";

export interface ReconRow {
  id: number;
  date: string;
  ledgerDescription: string | null;
  bankDescription: string | null;
  ledgerAmount: number | null;
  bankAmount: number | null;
  status: ReconStatus;
  difference: number;
  category: string;
  employee: string;
}

export interface ReconResult {
  error_score: number;
  total: number;
  matched: number;
  partial: number;
  unmatched: number;
  rows: ReconRow[];
  status_distribution: { name: string; value: number }[];
}

export async function fetchReconciliation(
  dateWindow = 3,
  similarityThreshold = 0.6
): Promise<ReconResult> {
  return request<ReconResult>(
    `/analysis/reconciliation?date_window=${dateWindow}&similarity_threshold=${similarityThreshold}`
  );
}

// ─── Risk Network ────────────────────────────────────────────────────────────

export interface NetworkNode {
  id: string;
  label: string;
  type: "vendor" | "employee" | "account";
  riskScore: number; // 0..100
  totalTxns?: number;
}

export interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  amount: number;
  frequency: number;
  isCycle: boolean;
  cycleId?: string;
  kind: "payment" | "approval" | "shared-account" | "similarity";
}

export interface NetworkCycle {
  id: string;
  nodes: string[];
  edgeIds: string[];
  totalValue: number;
  loops: number;
  spanMonths: number;
}

export interface NetworkResult {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  cycles: NetworkCycle[];
}

export async function fetchNetwork(): Promise<NetworkResult> {
  return request<NetworkResult>("/analysis/network");
}

// ─── Monte Carlo ──────────────────────────────────────────────────────────

export interface MonteCarloChartPoint {
  month: string;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

export interface MonteCarloResult {
  survival_rate: number;
  insolvency_risk: number;
  current_balance: number;
  avg_monthly_drift: number;
  monthly_volatility: number;
  chart_data: MonteCarloChartPoint[];
}

export async function fetchMonteCarlo(
  iterations: number = 1000,
  months: number = 12
): Promise<MonteCarloResult> {
  return request<MonteCarloResult>(
    `/analysis/monte-carlo?iterations=${iterations}&months=${months}`
  );
}

// ─── Health ──────────────────────────────────────────────────────────────────

export async function fetchHealth(): Promise<{
  status: string;
  ledger_loaded: boolean;
  bank_loaded: boolean;
}> {
  return request("/health");
}

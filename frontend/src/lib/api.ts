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

// ─── Memo Generation ─────────────────────────────────────────────────────

export interface GenerateMemoResult {
  status: string;
  memo: string;
}

export async function generateAuditMemo(): Promise<GenerateMemoResult> {
  return request<GenerateMemoResult>("/analysis/generate-memo");
}

// ─── AI Section Generator (for Summary page panels) ──────────────────────────

export interface SectionResult {
  text: string;
  bullets: string[];
}

export async function fetchSection(
  section: "findings" | "risks" | "observations" | "conclusion",
  benford: object | null,
  anomalies: object | null,
  fuzzy: object | null,
  reconciliation: object | null,
  monte_carlo?: object | null
): Promise<SectionResult> {
  return request<SectionResult>("/analysis/section", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ section, benford, anomalies, fuzzy, reconciliation, monte_carlo }),
  });
}

/** Raw UTF-8 stream (no word-splitting) — use for Ollama token streams. */
async function readRawUtf8Stream(
  res: Response,
  onChunk: (chunk: string) => void,
  onDone: () => void
): Promise<boolean> {
  const reader = res.body?.getReader();
  if (!reader) {
    return false;
  }
  const dec = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const s = dec.decode(value, { stream: true });
      if (s) onChunk(s);
    }
    onDone();
    return true;
  } catch {
    return false;
  }
}

export type SummarySectionKind = "findings" | "risks" | "observations" | "conclusion";

/** Token-stream one Summary section from POST /analysis/section/stream. Returns false on HTTP/body failure (onDone not called). */
export async function streamSectionAnalysis(
  section: SummarySectionKind,
  benford: object | null,
  anomalies: object | null,
  fuzzy: object | null,
  reconciliation: object | null,
  monte_carlo: object | null | undefined,
  onChunk: (chunk: string) => void,
  onDone: () => void
): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/analysis/section/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, benford, anomalies, fuzzy, reconciliation, monte_carlo }),
    });
    if (!res.ok) {
      return false;
    }
    return await readRawUtf8Stream(res, onChunk, onDone);
  } catch {
    return false;
  }
}

/** Token-stream full audit memo from GET /analysis/generate-memo/stream */
export async function streamGenerateAuditMemo(
  onChunk: (chunk: string) => void,
  onDone: () => void
): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/analysis/generate-memo/stream`, { method: "GET" });
    if (!res.ok) {
      return false;
    }
    return await readRawUtf8Stream(res, onChunk, onDone);
  } catch {
    return false;
  }
}

// ─── Shared plain-text stream reader ─────────────────────────────────────────

async function readPlainStream(
  res: Response,
  onToken: (t: string) => void,
  onDone: () => void,
  onError: (e: string) => void
): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) { onError("No response body"); return; }
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split(/(\s+)/);
    buf = parts.pop() ?? "";
    for (const p of parts) { if (p.trim()) onToken(p + " "); }
  }
  if (buf.trim()) onToken(buf + " ");
  onDone();
}

// ─── Per-module AI Insight Stream ────────────────────────────────────────────

export async function streamInsight(
  endpoint: string,
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (err: string) => void
): Promise<void> {
  try {
    const res = await fetch(`${BASE}${endpoint}`, { method: "GET" });
    if (!res.ok) {
      const b = await res.json().catch(() => ({ detail: res.statusText }));
      onError(b.detail ?? `HTTP ${res.status}`);
      return;
    }
    await readPlainStream(res, onToken, onDone, onError);
  } catch (e) { onError(e instanceof Error ? e.message : "Unknown error"); }
}

// ─── Chat (RAG-based, persistent history) ────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export async function chatWithAI(
  message: string,
  history: ChatMessage[],
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (err: string) => void
): Promise<void> {
  try {
    const res = await fetch(`${BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history }),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({ detail: res.statusText }));
      onError(b.detail ?? `HTTP ${res.status}`);
      return;
    }
    await readPlainStream(res, onToken, onDone, onError);
  } catch (e) { onError(e instanceof Error ? e.message : "Unknown error"); }
}

// ─── Benchmarking ──────────────────────────────────────────────────────────────

export interface BenchmarkResult {
  client_value: number;
  industry_median: number;
  ideal_range: [number, number];
  p90_threshold: number;
  classification: string;
}

export async function fetchBenchmark(clientValue: number, sector: string = "Technology"): Promise<BenchmarkResult> {
  return request<BenchmarkResult>(`/analysis/benchmark?client_value=${clientValue}&sector=${encodeURIComponent(sector)}`);
}

// ─── Health ──────────────────────────────────────────────────────────────────

export async function fetchHealth(): Promise<{
  status: string;
  ledger_loaded: boolean;
  bank_loaded: boolean;
}> {
  return request("/health");
}

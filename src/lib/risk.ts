// Deterministic risk scoring model for LedgerSpy.
// Same inputs always produce the same scores — drives every dashboard's risk layer.

import { anomalies, benfordDeviation, fuzzyMatches, reconciliation, vendorClusters } from "./mockData";

export type RiskBand = "low" | "medium" | "high";

export type RiskFactor = {
  key: string;
  label: string;
  weight: number; // 0..1 share of total
};

export type RiskBreakdown = {
  score: number; // 0..100
  band: RiskBand;
  confidence: number; // 0..100
  factors: RiskFactor[]; // weights sum to ~1
  why: string; // plain-language explanation
};

export const bandOf = (score: number): RiskBand =>
  score >= 75 ? "high" : score >= 45 ? "medium" : "low";

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

// --- Transaction-level scoring ---------------------------------------------

const AMOUNT_BASELINE = 5000; // historical mean used by mock model
const HIGH_AMOUNT = 50000;

export function scoreTransaction(a: {
  amount: number;
  vendor: string;
  date: string;
  risk?: number; // base flag
}): RiskBreakdown {
  // Amount z-ish factor
  const ratio = a.amount / AMOUNT_BASELINE;
  const amountScore = clamp(Math.log10(Math.max(ratio, 1)) * 55);

  // Vendor similarity overlap
  const vendorMatch = fuzzyMatches.find(
    (m) => m.vendorA === a.vendor || m.vendorB === a.vendor,
  );
  const vendorScore = vendorMatch ? clamp(vendorMatch.score * 80) : 10;

  // Timing — weekend posts and clustering at month edges
  const d = new Date(a.date);
  const dow = d.getUTCDay();
  const dom = d.getUTCDate();
  const timingScore = clamp(
    (dow === 0 || dow === 6 ? 60 : 15) + (dom >= 28 || dom <= 2 ? 20 : 0),
  );

  // Threshold-avoidance pattern (just-below round numbers)
  const mod = a.amount % 10000;
  const justBelow = mod >= 9500 && mod <= 9999;
  const structScore = justBelow ? 85 : 20;

  // Weighted blend
  const wAmount = 0.45;
  const wTiming = 0.2;
  const wVendor = 0.2;
  const wStruct = 0.15;

  const raw =
    amountScore * wAmount +
    timingScore * wTiming +
    vendorScore * wVendor +
    structScore * wStruct;

  const score = Math.round(clamp(raw + (a.risk ? a.risk * 8 : 0)));
  const total =
    amountScore * wAmount + timingScore * wTiming + vendorScore * wVendor + structScore * wStruct;

  const factors: RiskFactor[] = [
    { key: "amount", label: "Unusual amount",       weight: (amountScore * wAmount) / total },
    { key: "timing", label: "Timing anomaly",       weight: (timingScore * wTiming) / total },
    { key: "vendor", label: "Vendor similarity",    weight: (vendorScore * wVendor) / total },
    { key: "struct", label: "Threshold avoidance",  weight: (structScore * wStruct) / total },
  ].sort((x, y) => y.weight - x.weight);

  const top = factors[0];
  const why =
    `Flagged primarily due to ${top.label.toLowerCase()} ` +
    `(${Math.round(top.weight * 100)}% of total signal). ` +
    (amountScore > 60
      ? `Amount of $${a.amount.toLocaleString()} is ${ratio.toFixed(1)}× the historical baseline. `
      : "") +
    (vendorScore > 60 ? "Vendor name resembles other entities in the master file. " : "") +
    (justBelow ? "Amount sits just below a common approval threshold. " : "") +
    (timingScore > 50 ? "Posted outside normal business operating window." : "");

  const confidence = Math.round(clamp(60 + (vendorMatch ? 15 : 0) + (justBelow ? 15 : 0)));

  return { score, band: bandOf(score), confidence, factors, why: why.trim() };
}

// --- Vendor-level scoring --------------------------------------------------

export type VendorRisk = {
  vendor: string;
  score: number;
  band: RiskBand;
  flaggedTxns: number;
  totalAmount: number;
  cluster?: string;
};

export function vendorRisks(): VendorRisk[] {
  const map = new Map<string, VendorRisk>();
  for (const a of anomalies) {
    const br = scoreTransaction(a);
    const cur = map.get(a.vendor) ?? {
      vendor: a.vendor,
      score: 0,
      band: "low" as RiskBand,
      flaggedTxns: 0,
      totalAmount: 0,
    };
    cur.flaggedTxns += 1;
    cur.totalAmount += a.amount;
    cur.score = Math.max(cur.score, br.score);
    map.set(a.vendor, cur);
  }
  // Cluster bump
  for (const c of vendorClusters) {
    for (const m of c.members) {
      const v = map.get(m);
      if (v) {
        v.cluster = c.label;
        v.score = clamp(v.score + 8);
      }
    }
  }
  return Array.from(map.values())
    .map((v) => ({ ...v, band: bandOf(v.score) }))
    .sort((a, b) => b.score - a.score);
}

// --- Network-level (system) scoring ---------------------------------------

export function networkRisk() {
  const vendors = vendorRisks();
  const highVendors = vendors.filter((v) => v.band === "high").length;
  const txnHigh = anomalies.filter((a) => scoreTransaction(a).band === "high").length;
  const benfordPressure = clamp(
    benfordDeviation.reduce((s, d) => s + Math.abs(d.deviation), 0) * 8,
  );
  const reconPressure = clamp(
    (reconciliation.filter((r) => r.status !== "matched").length / reconciliation.length) * 100,
  );
  const score = Math.round(
    clamp(highVendors * 12 + txnHigh * 8 + benfordPressure * 0.4 + reconPressure * 0.3),
  );
  return {
    score,
    band: bandOf(score),
    highVendors,
    txnHigh,
    benfordPressure: Math.round(benfordPressure),
    reconPressure: Math.round(reconPressure),
  };
}

// --- Benford forensic upgrade ---------------------------------------------

export type BenfordDigitMetric = {
  digit: string;
  expected: number;
  actual: number;
  deviation: number;
  zScore: number;
  significant: boolean;
};

export function benfordForensic(records = 12481) {
  const rows: BenfordDigitMetric[] = benfordDeviation.map((d) => {
    const expectedFreq = (benfordDeviation.find((x) => x.digit === d.digit)!.deviation + 0) || 0;
    const exp = (Math.log10(1 + 1 / Number(d.digit)) * 100); // theoretical expected %
    const act = exp + d.deviation;
    // Approx Z = (actual - expected) / sqrt(expected*(100-expected)/N) — pct units
    const se = Math.sqrt((exp * (100 - exp)) / records);
    const z = se > 0 ? (act - exp) / se : 0;
    return {
      digit: d.digit,
      expected: +exp.toFixed(2),
      actual: +act.toFixed(2),
      deviation: d.deviation,
      zScore: +z.toFixed(2),
      significant: Math.abs(z) >= 1.96,
    };
  });
  // Risk score: weighted by |z|, capped
  const total = rows.reduce((s, r) => s + Math.abs(r.zScore), 0);
  const score = Math.round(clamp(total * 4));
  return { rows, score, band: bandOf(score) };
}

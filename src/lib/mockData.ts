// Mock data for LedgerSpy — replace with API responses when backend is integrated.

export const benfordData = [
  { digit: "1", expected: 30.1, actual: 31.2 },
  { digit: "2", expected: 17.6, actual: 17.1 },
  { digit: "3", expected: 12.5, actual: 12.9 },
  { digit: "4", expected: 9.7,  actual: 9.4 },
  { digit: "5", expected: 7.9,  actual: 8.0 },
  { digit: "6", expected: 6.7,  actual: 6.5 },
  { digit: "7", expected: 5.8,  actual: 3.1 },
  { digit: "8", expected: 5.1,  actual: 5.0 },
  { digit: "9", expected: 4.6,  actual: 6.8 },
];

export const fuzzyMatches = [
  { id: 1, vendorA: "Acme Corp",            vendorB: "Acme Corporation",      score: 0.96 },
  { id: 2, vendorA: "Globex Inc",           vendorB: "Globex Incorporated",   score: 0.94 },
  { id: 3, vendorA: "Initech LLC",          vendorB: "Initech Limited",       score: 0.91 },
  { id: 4, vendorA: "Soylent Foods",        vendorB: "Soylent Food Co.",      score: 0.88 },
  { id: 5, vendorA: "Umbrella Logistics",   vendorB: "Umbrela Logistics",     score: 0.83 },
  { id: 6, vendorA: "Wayne Enterprises",    vendorB: "Wayne Enterprize",      score: 0.78 },
  { id: 7, vendorA: "Stark Industries",     vendorB: "Stark Industies LLC",   score: 0.74 },
  { id: 8, vendorA: "Hooli",                vendorB: "Hooli Tech",            score: 0.61 },
  { id: 9, vendorA: "Pied Piper",           vendorB: "Piped Piper",           score: 0.58 },
];

export type Anomaly = {
  id: number;
  date: string;
  vendor: string;
  amount: number;
  risk: number; // 0..1
  reason: string;
};

export const anomalies: Anomaly[] = [
  { id: 1, date: "2024-11-03", vendor: "Acme Corp",          amount: 184320.55, risk: 0.92, reason: "Transaction amount is 14× the historical average for this vendor." },
  { id: 2, date: "2024-11-12", vendor: "Globex Inc",         amount: 49999.00,  risk: 0.81, reason: "Just-below-threshold pattern detected (rounding to avoid approval limits)." },
  { id: 3, date: "2024-11-19", vendor: "Initech LLC",        amount: 12750.00,  risk: 0.74, reason: "Posted on a weekend; falls outside normal business operating window." },
  { id: 4, date: "2024-12-01", vendor: "Wayne Enterprises",  amount: 7600.00,   risk: 0.62, reason: "Vendor master record was modified within 24 hours of this payment." },
  { id: 5, date: "2024-12-04", vendor: "Soylent Foods",      amount: 2300.00,   risk: 0.41, reason: "Duplicate invoice number detected across two months." },
  { id: 6, date: "2024-12-15", vendor: "Hooli",              amount: 980.00,    risk: 0.22, reason: "Minor deviation from monthly seasonality baseline." },
];

export type ReconStatus = "matched" | "partial" | "unmatched";

export type ReconRow = {
  id: number;
  date: string;
  ledgerDescription: string | null;
  bankDescription: string | null;
  ledgerAmount: number | null;
  bankAmount: number | null;
  status: ReconStatus;
  difference: number;
  note?: string;
  history?: { date: string; description: string; amount: number }[];
};

export const reconciliation: ReconRow[] = [
  {
    id: 1, date: "2024-11-02",
    ledgerDescription: "Acme Corp - Invoice #4421", bankDescription: "ACME CORP PAYMENT 4421",
    ledgerAmount: 12500.00, bankAmount: 12500.00,
    status: "matched", difference: 0,
  },
  {
    id: 2, date: "2024-11-05",
    ledgerDescription: "Globex Inc - Office Supplies", bankDescription: "GLOBEX INCORPORATED",
    ledgerAmount: 3420.50, bankAmount: 3420.50,
    status: "matched", difference: 0,
  },
  {
    id: 3, date: "2024-11-08",
    ledgerDescription: "Initech LLC - Consulting", bankDescription: "INITECH LIMITED CONSULT",
    ledgerAmount: 8750.00, bankAmount: 8730.00,
    status: "partial", difference: -20.00,
    note: "Amount mismatch of $20.00 between ledger and bank record. Vendor name fuzzy-matched.",
    history: [
      { date: "2024-09-08", description: "Initech LLC - Consulting", amount: 8750.00 },
      { date: "2024-10-08", description: "Initech LLC - Consulting", amount: 8750.00 },
    ],
  },
  {
    id: 4, date: "2024-11-12",
    ledgerDescription: "Soylent Foods - Catering", bankDescription: "SOYLENT FOOD CO",
    ledgerAmount: 1250.00, bankAmount: 1250.00,
    status: "matched", difference: 0,
  },
  {
    id: 5, date: "2024-11-14",
    ledgerDescription: "Wayne Enterprises - Equipment", bankDescription: null,
    ledgerAmount: 7600.00, bankAmount: null,
    status: "unmatched", difference: -7600.00,
    note: "Ledger entry has no corresponding bank transaction. Possible unrecorded payment or duplicate.",
    history: [
      { date: "2024-08-14", description: "Wayne Enterprises - Equipment", amount: 4200.00 },
      { date: "2024-09-30", description: "Wayne Enterprises - Equipment", amount: 5100.00 },
    ],
  },
  {
    id: 6, date: "2024-11-19",
    ledgerDescription: null, bankDescription: "STARK INDUSTRIES TRF",
    ledgerAmount: null, bankAmount: 4990.00,
    status: "unmatched", difference: 4990.00,
    note: "Bank credit with no matching ledger entry. Investigate for missing invoice.",
  },
  {
    id: 7, date: "2024-11-22",
    ledgerDescription: "Hooli - SaaS Subscription", bankDescription: "HOOLI TECH SUBSCRIPT",
    ledgerAmount: 499.00, bankAmount: 499.00,
    status: "matched", difference: 0,
  },
  {
    id: 8, date: "2024-11-25",
    ledgerDescription: "Umbrella Logistics - Freight", bankDescription: "UMBRELA LOGISTICS",
    ledgerAmount: 2300.00, bankAmount: 2330.00,
    status: "partial", difference: 30.00,
    note: "Bank amount exceeds ledger by $30.00. Possible bank fee or rounding discrepancy.",
    history: [
      { date: "2024-10-25", description: "Umbrella Logistics - Freight", amount: 2300.00 },
    ],
  },
  {
    id: 9, date: "2024-11-28",
    ledgerDescription: "Pied Piper - Hosting", bankDescription: "PIED PIPER CLOUD",
    ledgerAmount: 1100.00, bankAmount: 1100.00,
    status: "matched", difference: 0,
  },
  {
    id: 10, date: "2024-12-01",
    ledgerDescription: "Globex Inc - Q4 Retainer", bankDescription: "GLOBEX INC RETAINER",
    ledgerAmount: 49999.00, bankAmount: 49999.00,
    status: "partial", difference: 0,
    note: "Amounts match but flagged: just-below-threshold pattern detected (potential structuring).",
    history: [
      { date: "2024-08-01", description: "Globex Inc - Q3 Retainer", amount: 25000.00 },
      { date: "2024-05-01", description: "Globex Inc - Q2 Retainer", amount: 25000.00 },
    ],
  },
  {
    id: 11, date: "2024-12-04",
    ledgerDescription: "Acme Corp - Invoice #4502", bankDescription: "ACME CORP 4502",
    ledgerAmount: 6800.00, bankAmount: 6800.00,
    status: "matched", difference: 0,
  },
  {
    id: 12, date: "2024-12-07",
    ledgerDescription: "Initech LLC - Maintenance", bankDescription: null,
    ledgerAmount: 1500.00, bankAmount: null,
    status: "unmatched", difference: -1500.00,
    note: "Missing bank record for posted ledger entry.",
  },
];

export const auditSummary = {
  findings: [
    "Significant deviation from Benford's Law in leading digits 7 and 9, suggesting potential digit manipulation.",
    "9 vendor pairs flagged with similarity > 0.70, indicating possible duplicate vendor master records.",
    "6 anomalous transactions surfaced totaling $257,949.55, with 3 classified as high risk.",
  ],
  risks: [
    "High-value transaction with Acme Corp ($184,320.55) materially exceeds historical baseline.",
    "Just-below-threshold payment pattern detected (Globex Inc, $49,999.00).",
    "Vendor master modification preceded a payment to Wayne Enterprises by less than 24 hours.",
  ],
  observations: [
    "Overall ledger format quality is acceptable (readiness score 82%).",
    "Bank statement reconciliation coverage is 94.6%; 12 unmatched line items remain.",
    "No structural format issues blocked the analysis.",
  ],
};

// === Extra insight datasets ===

// Benford: signed deviation (actual − expected) per digit
export const benfordDeviation = benfordData.map((d) => ({
  digit: d.digit,
  deviation: +(d.actual - d.expected).toFixed(2),
  ratio: +(d.actual / d.expected).toFixed(2),
}));

// Fuzzy: similarity score histogram (0.5–1.0 in 0.05 buckets) and clusters
export const similarityHistogram = [
  { bucket: "0.50–0.59", count: 1 },
  { bucket: "0.60–0.69", count: 2 },
  { bucket: "0.70–0.79", count: 2 },
  { bucket: "0.80–0.89", count: 2 },
  { bucket: "0.90–1.00", count: 3 },
];

export const vendorClusters = [
  { id: "c1", label: "Acme / Globex / Initech", members: ["Acme Corp", "Acme Corporation", "Globex Inc", "Globex Incorporated", "Initech LLC", "Initech Limited"], avgScore: 0.94 },
  { id: "c2", label: "Soylent / Umbrella",       members: ["Soylent Foods", "Soylent Food Co.", "Umbrella Logistics", "Umbrela Logistics"],                          avgScore: 0.86 },
  { id: "c3", label: "Wayne / Stark / Hooli",    members: ["Wayne Enterprises", "Wayne Enterprize", "Stark Industries", "Stark Industies LLC", "Hooli", "Hooli Tech"], avgScore: 0.71 },
];

// Anomaly: histogram of transaction amounts (log buckets) + scatter (date vs amount)
export const amountHistogram = [
  { bucket: "<1k",      count: 1 },
  { bucket: "1k–5k",    count: 2 },
  { bucket: "5k–25k",   count: 2 },
  { bucket: "25k–75k",  count: 0 },
  { bucket: "75k+",     count: 1 },
];

export const anomalyScatter = anomalies.map((a) => ({
  // numeric x for scatter (days from period start)
  day: Math.round((new Date(a.date).getTime() - new Date("2024-11-01").getTime()) / 86_400_000),
  date: a.date,
  amount: a.amount,
  risk: a.risk,
  vendor: a.vendor,
}));

// Reconciliation: status distribution + monthly trend
export const reconStatusDistribution = [
  { name: "Matched",   value: reconciliation.filter((r) => r.status === "matched").length },
  { name: "Partial",   value: reconciliation.filter((r) => r.status === "partial").length },
  { name: "Unmatched", value: reconciliation.filter((r) => r.status === "unmatched").length },
];

export const reconTrend = [
  { month: "Sep", matched: 38, partial: 2, unmatched: 1 },
  { month: "Oct", matched: 41, partial: 3, unmatched: 2 },
  { month: "Nov", matched: 36, partial: 4, unmatched: 3 },
  { month: "Dec", matched: 28, partial: 5, unmatched: 6 },
];

// === Time-series & entity data (powers risk trends + Risk Network in Phase 2) ===

export const riskTrend = [
  { month: "Jul", anomalies: 2, mismatches: 1, riskScore: 28 },
  { month: "Aug", anomalies: 3, mismatches: 2, riskScore: 34 },
  { month: "Sep", anomalies: 2, mismatches: 3, riskScore: 31 },
  { month: "Oct", anomalies: 4, mismatches: 5, riskScore: 46 },
  { month: "Nov", anomalies: 5, mismatches: 7, riskScore: 58 },
  { month: "Dec", anomalies: 6, mismatches: 11, riskScore: 71 },
];

export type Entity = {
  id: string;
  label: string;
  type: "vendor" | "employee" | "account" | "transaction";
  riskScore: number; // 0..100
};

export type Edge = {
  source: string;
  target: string;
  kind: "payment" | "approval" | "shared-account" | "similarity";
  amount?: number;
};

export const entities: Entity[] = [
  { id: "v-acme",     label: "Acme Corp",          type: "vendor",   riskScore: 88 },
  { id: "v-globex",   label: "Globex Inc",         type: "vendor",   riskScore: 81 },
  { id: "v-initech",  label: "Initech LLC",        type: "vendor",   riskScore: 72 },
  { id: "v-wayne",    label: "Wayne Enterprises",  type: "vendor",   riskScore: 64 },
  { id: "v-soylent",  label: "Soylent Foods",      type: "vendor",   riskScore: 41 },
  { id: "v-hooli",    label: "Hooli",              type: "vendor",   riskScore: 22 },
  { id: "e-jdoe",     label: "J. Doe (AP)",        type: "employee", riskScore: 74 },
  { id: "e-msmith",   label: "M. Smith (Mgr)",     type: "employee", riskScore: 38 },
  { id: "a-001",      label: "BoA ••4421",         type: "account",  riskScore: 80 },
  { id: "a-002",      label: "Chase ••9912",       type: "account",  riskScore: 35 },
];

export const edges: Edge[] = [
  { source: "e-jdoe", target: "v-acme",    kind: "approval" },
  { source: "v-acme", target: "a-001",     kind: "payment", amount: 184320.55 },
  { source: "v-globex", target: "a-001",   kind: "payment", amount: 49999 },
  { source: "v-initech", target: "a-001",  kind: "payment", amount: 8750 },
  { source: "v-wayne", target: "a-002",    kind: "payment", amount: 7600 },
  { source: "a-001", target: "v-globex",   kind: "payment", amount: 12000 }, // cycle
  { source: "v-globex", target: "v-acme",  kind: "similarity" },
  { source: "v-acme", target: "v-initech", kind: "similarity" },
  { source: "e-msmith", target: "v-wayne", kind: "approval" },
];



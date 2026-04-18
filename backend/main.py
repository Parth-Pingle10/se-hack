import io
import numpy as np
import pandas as pd
from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Optional

from benford_module import get_benford_analysis
from outlier_module import detect_outliers
from fuzzy_module import calculate_levenshtein, get_similarity_matrix
from reconciliation_module import run_reconciliation
from map import preprocess_data, compute_benford_scores, compute_anomaly_scores, fuzzy_matching, compute_risk_scores, generate_graph

app = FastAPI(title="LedgerSpy API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── In-memory session storage ────────────────────────────────────────────────
session: dict = {
    "ledger_df": None,
    "bank_df": None,
}

# ─── Helpers ──────────────────────────────────────────────────────────────────

def read_uploaded_csv(file_bytes: bytes) -> pd.DataFrame:
    return pd.read_csv(io.BytesIO(file_bytes))


def require_ledger():
    if session["ledger_df"] is None:
        raise HTTPException(status_code=400, detail="No ledger file uploaded yet. POST /upload/ledger first.")
    return session["ledger_df"]


def require_bank():
    if session["bank_df"] is None:
        raise HTTPException(status_code=400, detail="No bank statement uploaded yet. POST /upload/bank first.")
    return session["bank_df"]


# ─── Upload endpoints ──────────────────────────────────────────────────────────

@app.post("/upload/ledger")
async def upload_ledger(file: UploadFile = File(...)):
    """Upload the financial ledger CSV."""
    raw = await file.read()
    try:
        df = read_uploaded_csv(raw)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse ledger file: {e}")

    # Normalise column names
    df.columns = [c.strip() for c in df.columns]
    required = {"Date", "Amount", "VendorName"}
    missing = required - set(df.columns)
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Ledger is missing required columns: {missing}. Found: {list(df.columns)}"
        )

    df["Amount"] = pd.to_numeric(df["Amount"], errors="coerce")
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    df = df.dropna(subset=["Amount"])

    session["ledger_df"] = df

    # Basic quality report
    total = len(df)
    nulls = int(df.isnull().any(axis=1).sum())
    dups = int(df.duplicated().sum())
    readiness = round(((total - nulls - dups) / total) * 100, 1) if total > 0 else 0

    return {
        "status": "ok",
        "rows": total,
        "columns": list(df.columns),
        "null_rows": nulls,
        "duplicate_rows": dups,
        "readiness_score": readiness,
    }


@app.post("/upload/bank")
async def upload_bank(file: UploadFile = File(...)):
    """Upload the bank statement CSV."""
    raw = await file.read()
    try:
        df = read_uploaded_csv(raw)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse bank file: {e}")

    df.columns = [c.strip() for c in df.columns]
    required = {"Date", "Amount", "Description"}
    missing = required - set(df.columns)
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Bank statement is missing required columns: {missing}. Found: {list(df.columns)}"
        )

    df["Amount"] = pd.to_numeric(df["Amount"], errors="coerce")
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    df = df.dropna(subset=["Amount"])

    session["bank_df"] = df

    total = len(df)
    nulls = int(df.isnull().any(axis=1).sum())
    dups = int(df.duplicated().sum())
    readiness = round(((total - nulls - dups) / total) * 100, 1) if total > 0 else 0

    return {
        "status": "ok",
        "rows": total,
        "columns": list(df.columns),
        "null_rows": nulls,
        "duplicate_rows": dups,
        "readiness_score": readiness,
    }


# ─── Analysis endpoints ────────────────────────────────────────────────────────

@app.get("/analysis/benford")
def analysis_benford(column: str = Query("Amount", description="Column to run Benford analysis on")):
    """
    Benford's Law distribution analysis.
    Returns per-digit expected vs actual frequencies and deviation metrics.
    """
    df = require_ledger()
    if column not in df.columns:
        column = "Amount"

    try:
        digits, expected, actual = get_benford_analysis(df, column_name=column)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Build chart-ready data
    chart_data = []
    for d, e, a in zip(digits, expected, actual):
        exp_pct = round(e * 100, 2)
        act_pct = round(a * 100, 2)
        chart_data.append({
            "digit": str(d),
            "expected": exp_pct,
            "actual": act_pct,
            "deviation": round(act_pct - exp_pct, 2),
            "ratio": round(act_pct / exp_pct, 2) if exp_pct > 0 else 0,
        })

    # 1. Ensure inputs are numpy arrays of proportions (0.0 to 1.0)
    actual_arr = np.array(actual)   # Proportions from your data
    expected_arr = np.array(expected) # Theoretical Benford proportions

    # 2. Calculate Mean Absolute Deviation (MAD)
    # This is the average absolute difference between actual and expected proportions
    mad = np.mean(np.abs(actual_arr - expected_arr))

    # 3. Calculate Chi-square (Optional: keep for stats, but don't use for score)
    n = len(df[column].dropna())
    observed_counts = actual_arr * n
    expected_counts = expected_arr * n
    chi_sq = float(np.sum((observed_counts - expected_counts) ** 2 / np.where(expected_counts > 0, expected_counts, 1)))
    chi_sq = round(chi_sq, 2)

    # 4. Map MAD to a 0-100 "Benford Score"
    # Forensic Thresholds for MAD:
    # < 0.006: Close Conformity (Low Risk)
    # 0.006 - 0.012: Acceptable (Medium Risk)
    # 0.012 - 0.015: Marginal (High Risk)
    # > 0.015: Non-Conformity (Critical/Fraud Risk)

    # We use 0.015 as our "100% Risk" anchor point
    benford_score = min(100, round((mad / 0.015) * 100))

    # 5. Significant digits (Keep your 1.5% deviation check for UI flags)
    sig_digits = [d for d in chart_data if abs(d["deviation"]) > 1.5]

    return {
        "records_analyzed": n,
        "chart_data": chart_data,
        "chi_square": chi_sq,
        "significant_digits": sig_digits,
        "benford_score": benford_score,
        "band": "High" if benford_score >= 60 else "Moderate" if benford_score >= 30 else "Low",
    }


@app.get("/analysis/anomalies")
def analysis_anomalies(contamination: float = Query(0.05, ge=0.01, le=0.5)):
    """
    Isolation Forest anomaly detection.
    Returns flagged transactions with risk scores.
    """
    df = require_ledger()

    df_work = df.copy()

    # Require Time column for Hour extraction; fallback to 12 if absent
    if "Time" in df_work.columns:
        try:
            df_work["Hour"] = pd.to_datetime(df_work["Time"], format="%H:%M", errors="coerce").dt.hour
        except Exception:
            df_work["Hour"] = 12
    else:
        df_work["Hour"] = 12

    df_work["Hour"] = df_work["Hour"].fillna(12).astype(int)

    try:
        detected = detect_outliers(df_work, contamination=contamination)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Outliers = Is_Outlier == -1
    outliers = detected[detected["Is_Outlier"] == -1].copy()
    normal = detected[detected["Is_Outlier"] == 1].copy()

    # Compute risk score as normalized deviation from mean
    mean_amt = detected["Amount"].mean()
    std_amt = detected["Amount"].std() or 1

    def risk_score(row):
        z = abs((row["Amount"] - mean_amt) / std_amt)
        hr_penalty = 0.15 if (row["Hour"] < 6 or row["Hour"] > 22) else 0
        r = min(1.0, (z / 6) + hr_penalty)
        return round(r, 3)

    records = []
    for i, (_, row) in enumerate(outliers.iterrows(), start=1):
        records.append({
            "id": i,
            "date": str(row.get("Date", ""))[:10] if pd.notna(row.get("Date", None)) else "",
            "vendor": str(row.get("VendorName", row.get("vendor", "Unknown"))),
            "amount": float(row["Amount"]),
            "hour": int(row["Hour"]),
            "risk": risk_score(row),
            "category": str(row.get("Category", "")),
            "employee": str(row.get("EmployeeID", "")),
            "transaction_id": str(row.get("TransactionID", str(i))),
        })

    # Amount histogram (log buckets)
    def bucket_label(a):
        if a < 1000: return "<1k"
        if a < 5000: return "1k–5k"
        if a < 25000: return "5k–25k"
        if a < 75000: return "25k–75k"
        return "75k+"
    BUCKETS = ["<1k", "1k–5k", "5k–25k", "25k–75k", "75k+"]
    bucket_counts = {b: 0 for b in BUCKETS}
    for _, row in detected.iterrows():
        bucket_counts[bucket_label(abs(row["Amount"]))] += 1
    amount_histogram = [{"bucket": k, "count": v} for k, v in bucket_counts.items()]

    # Scatter data (all records: day index + risk)
    if not detected.empty and "Date" in detected.columns:
        min_date = detected["Date"].min()
        scatter = []
        for _, row in detected.iterrows():
            try:
                day = int((row["Date"] - min_date).days)
            except Exception:
                day = 0
            is_out = row["Is_Outlier"] == -1
            r = risk_score(row) if is_out else round(min(0.3, abs((row["Amount"] - mean_amt) / std_amt) / 10), 3)
            scatter.append({
                "day": day,
                "amount": float(row["Amount"]),
                "risk": r,
                "vendor": str(row.get("VendorName", row.get("vendor", ""))),
                "date": str(row.get("Date", ""))[:10],
            })
    else:
        scatter = []

    return {
        "total_flagged": len(outliers),
        "total_records": len(detected),
        "anomalies": records,
        "amount_histogram": amount_histogram,
        "scatter": scatter,
    }


@app.get("/analysis/fuzzy")
def analysis_fuzzy(
    threshold: float = Query(0.7, ge=0.0, le=1.0),
    max_vendors: int = Query(60, ge=5, le=200),
):
    """
    Fuzzy vendor name matching using Levenshtein similarity.
    Returns vendor pairs ranked by string similarity.
    """
    df = require_ledger()

    vendor_col = "VendorName" if "VendorName" in df.columns else "vendor"
    vendors = df[vendor_col].dropna().astype(str).unique().tolist()

    # Limit for performance
    vendors = vendors[:max_vendors]
    n = len(vendors)

    pairs = []
    for i in range(n):
        for j in range(i + 1, n):
            v1, v2 = vendors[i], vendors[j]
            dist = calculate_levenshtein(v1, v2)
            max_l = max(len(v1), len(v2))
            score = round(1 - dist / max_l, 3) if max_l > 0 else 1.0
            if score >= threshold:
                pairs.append({"vendorA": v1, "vendorB": v2, "score": score})

    # Sort descending by score
    pairs.sort(key=lambda x: x["score"], reverse=True)
    for idx, p in enumerate(pairs, start=1):
        p["id"] = idx

    # Similarity histogram
    buckets = {
        "0.50–0.59": 0, "0.60–0.69": 0, "0.70–0.79": 0,
        "0.80–0.89": 0, "0.90–1.00": 0,
    }
    for p in pairs:
        s = p["score"]
        if s >= 0.90: buckets["0.90–1.00"] += 1
        elif s >= 0.80: buckets["0.80–0.89"] += 1
        elif s >= 0.70: buckets["0.70–0.79"] += 1
        elif s >= 0.60: buckets["0.60–0.69"] += 1
        elif s >= 0.50: buckets["0.50–0.59"] += 1
    similarity_histogram = [{"bucket": k, "count": v} for k, v in buckets.items()]

    # Build clusters using simple union-find
    parent = {v: v for v in vendors}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    for p in pairs:
        if p["score"] >= 0.80:
            union(p["vendorA"], p["vendorB"])

    cluster_map: dict = {}
    for v in vendors:
        root = find(v)
        cluster_map.setdefault(root, []).append(v)

    vendor_clusters = []
    for cid, (root, members) in enumerate(
        sorted(cluster_map.items(), key=lambda x: -len(x[1])), start=1
    ):
        if len(members) < 2:
            continue
        # avg score within cluster
        cluster_pairs = [p for p in pairs if p["vendorA"] in members and p["vendorB"] in members]
        avg = round(sum(p["score"] for p in cluster_pairs) / len(cluster_pairs), 2) if cluster_pairs else 0.80
        vendor_clusters.append({
            "id": f"c{cid}",
            "label": f"Cluster {cid}: {members[0][:20]}…" if len(members[0]) > 20 else f"Cluster {cid}: {members[0]}",
            "members": members,
            "avgScore": avg,
        })

    return {
        "total_vendors": len(vendors),
        "flagged_pairs": len(pairs),
        "matches": pairs,
        "similarity_histogram": similarity_histogram,
        "vendor_clusters": vendor_clusters,
    }


@app.get("/analysis/reconciliation")
def analysis_reconciliation(
    date_window: int = Query(3, ge=0, le=30),
    similarity_threshold: float = Query(0.6, ge=0.0, le=1.0),
):
    """
    Bank statement reconciliation against ledger entries.
    Returns match status for each ledger row and unmatched bank entries.
    """
    ledger_df = require_ledger()
    bank_df = require_bank()

    try:
        matched_ledger, unmatched_bank, error_score = run_reconciliation(
            ledger_df, bank_df,
            date_window=date_window,
            similarity_threshold=similarity_threshold,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Build table rows for the ledger side
    rows = []
    for i, (_, row) in enumerate(matched_ledger.iterrows(), start=1):
        status_raw = str(row.get("MatchStatus", "No Match"))
        if status_raw == "Full Match":
            status = "matched"
        elif status_raw == "Partial Match":
            status = "partial"
        else:
            status = "unmatched"

        vendor = str(row.get("VendorName", row.get("vendor", "")))
        ledger_amt = float(row["Amount"])
        
        # Get matched bank data (filled for matched and partial statuses)
        bank_desc = None
        bank_amt = None
        if status in ["matched", "partial"]:
            bank_desc = row.get("MatchedBankDescription")
            bank_amt = row.get("MatchedBankAmount")
            if pd.notna(bank_desc):
                bank_desc = str(bank_desc)
            else:
                bank_desc = None
            if pd.notna(bank_amt):
                bank_amt = float(bank_amt)
            else:
                bank_amt = None

        rows.append({
            "id": i,
            "date": str(row.get("Date", ""))[:10] if pd.notna(row.get("Date")) else "",
            "ledgerDescription": vendor,
            "bankDescription": bank_desc,
            "ledgerAmount": ledger_amt,
            "bankAmount": bank_amt,
            "status": status,
            "difference": bank_amt - ledger_amt if bank_amt is not None else 0,
            "category": str(row.get("Category", "")),
            "employee": str(row.get("EmployeeID", "")),
        })

    # Append unmatched bank entries
    for j, (_, brow) in enumerate(unmatched_bank.iterrows(), start=len(rows) + 1):
        rows.append({
            "id": j,
            "date": str(brow.get("Date", ""))[:10] if pd.notna(brow.get("Date")) else "",
            "ledgerDescription": None,
            "bankDescription": str(brow.get("Description", "")),
            "ledgerAmount": None,
            "bankAmount": float(brow["Amount"]),
            "status": "unmatched",
            "difference": float(brow["Amount"]),
            "category": "",
            "employee": "",
        })

    # Counts
    matched_count = sum(1 for r in rows if r["status"] == "matched")
    partial_count = sum(1 for r in rows if r["status"] == "partial")
    unmatched_count = sum(1 for r in rows if r["status"] == "unmatched")

    status_distribution = [
        {"name": "Matched",   "value": matched_count},
        {"name": "Partial",   "value": partial_count},
        {"name": "Unmatched", "value": unmatched_count},
    ]

    return {
        "error_score": round(error_score, 2),
        "total": len(rows),
        "matched": matched_count,
        "partial": partial_count,
        "unmatched": unmatched_count,
        "rows": rows,
        "status_distribution": status_distribution,
    }




@app.get("/analysis/network")
def analysis_network():
    """
    Risk network graph analysis.
    Returns nodes (vendors, employees, accounts) and edges (payments, approvals, similarities, cycles).
    Uses integrated Benford, Anomaly, and Fuzzy analysis to compute risk scores.
    """
    df = require_ledger()
    
    try:
        # Preprocess data (rename columns and ensure required fields)
        df_work = df.copy()
        df_work.columns = [c.strip() for c in df_work.columns]
        
        # Rename to match map.py expectations
        rename_map = {}
        if "VendorName" in df_work.columns:
            rename_map["VendorName"] = "vendor"
        if "EmployeeID" in df_work.columns:
            rename_map["EmployeeID"] = "employee"
        elif "Employee" in df_work.columns:
            rename_map["Employee"] = "employee"
        if "Amount" in df_work.columns:
            rename_map["Amount"] = "amount"
        
        df_work = df_work.rename(columns=rename_map)
        
        # Ensure required columns exist
        if "employee" not in df_work.columns:
            df_work["employee"] = "Unknown"
        if "vendor" not in df_work.columns:
            raise HTTPException(status_code=422, detail="Missing required 'VendorName' or 'vendor' column")
        if "amount" not in df_work.columns:
            raise HTTPException(status_code=422, detail="Missing required 'Amount' column")
        
        # Handle Date/Time
        if "Date" in df_work.columns and "Time" not in df_work.columns:
            df_work["Time"] = "12:00"
        
        if "Date" in df_work.columns and "Time" in df_work.columns:
            # Convert Date to string first (in case it's already datetime), then concat with Time
            date_str = df_work["Date"].astype(str)
            df_work["time"] = pd.to_datetime(date_str + " " + df_work["Time"].astype(str), errors="coerce")
        elif "Date" in df_work.columns:
            df_work["time"] = pd.to_datetime(df_work["Date"], errors="coerce")
        else:
            df_work["time"] = pd.Timestamp.now()
        
        df_work["hour"] = df_work["time"].dt.hour
        
        # Ensure numeric and remove nulls
        df_work["amount"] = pd.to_numeric(df_work["amount"], errors="coerce")
        df_work = df_work.dropna(subset=["employee", "vendor", "amount"])
        
        if len(df_work) == 0:
            raise HTTPException(status_code=422, detail="No valid data rows after preprocessing")
        
        # Compute risk components
        b = compute_benford_scores(df_work)  # benford scores per vendor
        a = compute_anomaly_scores(df_work)  # anomaly scores per vendor/employee
        f, matches = fuzzy_matching(df_work)  # fuzzy flags and match pairs
        
        # Aggregate risk scores
        risk = compute_risk_scores(b, a, f)
        
        # Generate network graph
        graph = generate_graph(df_work, risk, matches)
        
        # Transform into frontend-compatible format
        # Map backend node types to frontend NetNodeType
        nodes = []
        edges = []
        
        for node in graph["nodes"]:
            node_type = node["type"]  # Already "vendor" or "employee" from generate_graph
            nodes.append({
                "id": node["id"],
                "label": node["label"],
                "type": node_type,
                "riskScore": round(min(100, node["riskScore"] * 100), 0),  # Convert 0-1 to 0-100
                "totalTxns": len(df_work[df_work["vendor"] == node["id"]]) if node_type == "vendor" else len(df_work[df_work["employee"] == node["id"]])
            })
        
        # Track processed edges to avoid duplicates
        seen_edges = set()
        
        for edge in graph["links"]:
            edge_key = tuple(sorted([edge["source"], edge["target"]]))
            if edge_key in seen_edges:
                continue
            seen_edges.add(edge_key)
            
            edges.append({
                "id": f"e-{edge['source']}-{edge['target']}",
                "source": edge["source"],
                "target": edge["target"],
                "amount": float(edge["amount"]),
                "frequency": 1,
                "isCycle": False,
                "kind": "payment" if edge["amount"] > 0 else "similarity"
            })
        
        return {
            "nodes": nodes,
            "edges": edges,
            "cycles": []
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Network analysis failed: {str(e)}")


@app.get("/health")
def health():
    return {"status": "ok", "ledger_loaded": session["ledger_df"] is not None, "bank_loaded": session["bank_df"] is not None}

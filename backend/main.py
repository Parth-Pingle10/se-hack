import io
import json
import numpy as np
import pandas as pd
from fastapi import FastAPI, File, UploadFile, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from typing import Optional

from llm import llm
from langchain_core.messages import HumanMessage
from benford_module import get_benford_analysis
from outlier_module import detect_outliers
from fuzzy_module import calculate_levenshtein, get_similarity_matrix
from reconciliation_module import run_reconciliation
from monte_carlo import run_monte_carlo_stress_test
from memo_generator import (
    generate_audit_memo,
    generate_benford_insight,
    generate_anomaly_insight,
    generate_fuzzy_insight,
    generate_reconciliation_insight,
    generate_section,
    iter_section_stream,
    iter_audit_memo_stream,
    _fmt_benford, _fmt_anomaly, _fmt_fuzzy, _fmt_recon,
)
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
    
    # Check for new schema first (IncomingAmount/OutgoingAmount), then old schema (Amount)
    has_incoming_outgoing = "IncomingAmount" in df.columns and "OutgoingAmount" in df.columns
    has_amount = "Amount" in df.columns
    
    if not (has_incoming_outgoing or has_amount):
        raise HTTPException(
            status_code=422,
            detail="Ledger must have either 'Amount' column or both 'IncomingAmount' and 'OutgoingAmount' columns"
        )
    
    # Check for vendor/counterparty column
    has_counterparty = "CounterpartyName" in df.columns
    has_vendor = "VendorName" in df.columns
    
    if not (has_counterparty or has_vendor):
        raise HTTPException(
            status_code=422,
            detail="Ledger must have either 'CounterpartyName' or 'VendorName' column"
        )
    
    # Check for date column
    if "TransactionDate" not in df.columns and "Date" not in df.columns:
        raise HTTPException(
            status_code=422,
            detail="Ledger must have either 'TransactionDate' or 'Date' column"
        )

    # Normalize date column
    date_col = "TransactionDate" if "TransactionDate" in df.columns else "Date"
    df = df.rename(columns={date_col: "Date"})
    
    # Normalize vendor column
    vendor_col = "CounterpartyName" if has_counterparty else "VendorName"
    df = df.rename(columns={vendor_col: "VendorName"})
    
    # Create unified Amount column if using new schema
    if has_incoming_outgoing:
        df["IncomingAmount"] = pd.to_numeric(df["IncomingAmount"], errors="coerce").fillna(0)
        df["OutgoingAmount"] = pd.to_numeric(df["OutgoingAmount"], errors="coerce").fillna(0)
        df["Amount"] = df["IncomingAmount"] - df["OutgoingAmount"]
    else:
        df["Amount"] = pd.to_numeric(df["Amount"], errors="coerce")
    
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    df = df.dropna(subset=["Amount", "VendorName"])

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
    
    # Check for new schema first (DebitAmount/CreditAmount), then old schema (Amount)
    has_debit_credit = "DebitAmount" in df.columns and "CreditAmount" in df.columns
    has_amount = "Amount" in df.columns
    
    if not (has_debit_credit or has_amount):
        raise HTTPException(
            status_code=422,
            detail="Bank statement must have either 'Amount' column or both 'DebitAmount' and 'CreditAmount' columns"
        )
    
    # Check for vendor/description column
    has_vendor = "VendorName" in df.columns
    has_description = "Description" in df.columns
    
    if not (has_vendor or has_description):
        raise HTTPException(
            status_code=422,
            detail="Bank statement must have either 'VendorName' or 'Description' column"
        )
    
    # Check for date column
    if "TransactionDate" not in df.columns and "Date" not in df.columns:
        raise HTTPException(
            status_code=422,
            detail="Bank statement must have either 'TransactionDate' or 'Date' column"
        )
    
    # Normalize date column
    date_col = "TransactionDate" if "TransactionDate" in df.columns else "Date"
    df = df.rename(columns={date_col: "Date"})
    
    # Normalize vendor/description column to 'Description'
    vendor_col = "VendorName" if has_vendor else "Description"
    if vendor_col != "Description":
        df = df.rename(columns={vendor_col: "Description"})
    
    # Create unified Amount column if using new schema
    if has_debit_credit:
        df["DebitAmount"] = pd.to_numeric(df["DebitAmount"], errors="coerce").fillna(0)
        df["CreditAmount"] = pd.to_numeric(df["CreditAmount"], errors="coerce").fillna(0)
        # For bank statements: we treat as signed amounts (Credit positive, Debit negative)
        # But for reconciliation to work, we use absolute value or proper sign handling
        df["Amount"] = df["CreditAmount"] - df["DebitAmount"]
    else:
        df["Amount"] = pd.to_numeric(df["Amount"], errors="coerce")
    
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    df = df.dropna(subset=["Amount", "Description"])

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
        # Bank description is normalized to 'Description' column during upload
        bank_desc = str(brow.get("Description", ""))
        rows.append({
            "id": j,
            "date": str(brow.get("Date", ""))[:10] if pd.notna(brow.get("Date")) else "",
            "ledgerDescription": None,
            "bankDescription": bank_desc,
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
        
        # Rename to match map.py expectations - handle both old and new schema
        rename_map = {}
        
        # Handle vendor column
        if "CounterpartyName" in df_work.columns:
            rename_map["CounterpartyName"] = "vendor"
        elif "VendorName" in df_work.columns:
            rename_map["VendorName"] = "vendor"
        
        # Handle employee column
        if "EmployeeID" in df_work.columns:
            rename_map["EmployeeID"] = "employee"
        elif "Employee" in df_work.columns:
            rename_map["Employee"] = "employee"
        
        # Handle amount - already normalized during upload but be defensive
        if "Amount" in df_work.columns:
            rename_map["Amount"] = "amount"
        
        # Handle date columns
        if "TransactionDate" in df_work.columns and "Date" not in df_work.columns:
            rename_map["TransactionDate"] = "Date"
        
        # Handle time columns
        if "TransactionTime" in df_work.columns and "Time" not in df_work.columns:
            rename_map["TransactionTime"] = "Time"
        
        df_work = df_work.rename(columns=rename_map)
        
        # Ensure required columns exist
        if "employee" not in df_work.columns:
            df_work["employee"] = "Unknown"
        if "vendor" not in df_work.columns:
            raise HTTPException(status_code=422, detail="Missing required 'CounterpartyName'/'VendorName' column")
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


@app.get("/analysis/monte-carlo")
def analysis_monte_carlo(iterations: int = Query(1000, ge=100, le=10000), months: int = Query(12, ge=1, le=36)):
    """
    Monte Carlo stress test for cash flow projection.
    Returns 12-month projection with percentile bands (5th, 25th, 50th, 75th, 95th).
    """
    df = require_ledger()
    
    try:
        result = run_monte_carlo_stress_test(df, iterations=iterations, months=months)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Monte Carlo analysis failed: {str(e)}")


@app.get("/analysis/generate-memo")
def analysis_generate_memo():
    """
    Build Benford, anomaly, fuzzy, reconciliation, and Monte Carlo outputs from the
    uploaded ledger and bank data, then generate a full audit memo with the local
    Ollama model (see backend/llm.py). Falls back to a deterministic template if the LLM fails.
    """
    require_ledger()
    require_bank()

    benford_d = analysis_benford()
    anomaly_d = analysis_anomalies()
    fuzzy_d = analysis_fuzzy()
    recon_d = analysis_reconciliation()

    mc_d = None
    try:
        mc_d = analysis_monte_carlo()
    except HTTPException:
        pass
    except Exception:
        pass

    try:
        memo_text = generate_audit_memo(benford_d, anomaly_d, fuzzy_d, recon_d, mc_d)
    except Exception:
        memo_text = _generate_fallback_memo(
            benford_d, anomaly_d, fuzzy_d, recon_d, mc_d if isinstance(mc_d, dict) else {}
        )

    return {"status": "success", "memo": memo_text}


@app.get("/analysis/generate-memo/stream")
def analysis_generate_memo_stream():
    """
    Same data pipeline as /analysis/generate-memo, but streams the memo from Ollama
    token-by-token as text/plain (UTF-8). On LLM failure, streams the fallback memo in one chunk.
    """
    require_ledger()
    require_bank()

    benford_d = analysis_benford()
    anomaly_d = analysis_anomalies()
    fuzzy_d = analysis_fuzzy()
    recon_d = analysis_reconciliation()

    mc_d = None
    try:
        mc_d = analysis_monte_carlo()
    except HTTPException:
        pass
    except Exception:
        pass

    def gen():
        try:
            for piece in iter_audit_memo_stream(benford_d, anomaly_d, fuzzy_d, recon_d, mc_d):
                yield piece
        except Exception:
            memo_text = _generate_fallback_memo(
                benford_d, anomaly_d, fuzzy_d, recon_d, mc_d if isinstance(mc_d, dict) else {}
            )
            yield memo_text

    return StreamingResponse(
        gen(),
        media_type="text/plain; charset=utf-8",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )



def _generate_fallback_memo(benford_data, anomaly_data, fuzzy_data, recon_data, mc_data):
    """Generate a professional memo using template when LLM is unavailable."""
    benford_score = benford_data.get('benford_score', 0)
    anomaly_count = anomaly_data.get('total_flagged', 0)
    fuzzy_pairs = fuzzy_data.get('flagged_pairs', 0)
    recon_match = recon_data.get('matched', 0)
    recon_total = recon_data.get('total', 0)
    match_pct = (recon_match / recon_total * 100) if recon_total > 0 else 0
    
    memo = f"""PROFESSIONAL AUDIT MEMO

SUMMARY OF PROCEDURES
The organization's financial transactions were analyzed using advanced digital audit analytics tools. 
Procedures included Benford's Law conformity testing, isolation forest anomaly detection, fuzzy vendor 
name matching, bank reconciliation analysis, and cash flow stress testing.

KEY FINDINGS
- Benford's Law Analysis: Score {benford_score}/100, indicating a {benford_data.get('band', 'Unknown')} risk band
- Anomaly Detection: {anomaly_count} transactions flagged as statistical outliers from {anomaly_data.get('total_records', 0)} total records
- Vendor Matching: {fuzzy_pairs} vendor name pairs identified with similarity scores above 0.70
- Bank Reconciliation: {recon_match} of {recon_total:,} ledger entries matched ({match_pct:.1f}% match rate)

RISK HIGHLIGHTS
The analysis identified several material observations requiring management attention:
1. Digital anomaly detection flagged {anomaly_count} transactions exceeding statistical norms
2. Vendor master contained {fuzzy_pairs} pairs with >70% name similarity, indicating possible duplicate records
3. Bank reconciliation error score: {recon_data.get('error_score', 0):.1f}%

OBSERVATIONS
- Transactional data exhibits {'acceptable' if benford_score < 60 else 'elevated'} conformity with Benford's Law
- {'Multiple' if anomaly_count > 5 else 'Limited'} high-risk transactions require detailed investigation
- Vendor master data quality shows {'significant' if fuzzy_pairs > 5 else 'minor'} duplication patterns

RECOMMENDATIONS
1. Investigate flagged high-risk transactions for supporting documentation and business justification
2. Consolidate identified duplicate vendor records and implement master data governance
3. Review reconciliation exceptions and investigate unmatched items
4. Strengthen internal controls over vendor creation and payment approval thresholds

CONCLUSION
Based on the comprehensive analysis performed, the organization's transaction processing and vendor 
management demonstrate {['HIGH', 'MODERATE', 'LOW'][min(2, max(0, int(benford_score/30)))]} risk exposure. 
Immediate attention is recommended for the flagged transactions and control gaps identified above.

Prepared using LedgerSpy Digital Audit Analytics Platform
"""
    return memo


@app.get("/health")
def health():
    return {"status": "ok", "ledger_loaded": session["ledger_df"] is not None, "bank_loaded": session["bank_df"] is not None}


# ─── Streaming helper ─────────────────────────────────────────────────────────

def _word_stream(text: str):
    """Yield words one by one for smooth frontend streaming."""
    words = text.split()
    for i, w in enumerate(words):
        yield w + (" " if i < len(words) - 1 else "")


def _streaming_response(text_fn) -> StreamingResponse:
    """Run text_fn() then stream result word-by-word."""
    def generator():
        try:
            text = text_fn()
            yield from _word_stream(text)
        except Exception as e:
            yield f"[Error: {e}]"
    return StreamingResponse(generator(), media_type="text/event-stream",
                              headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ─── Per-module AI insight endpoints ─────────────────────────────────────────

@app.get("/insights/benford")
def insight_benford():
    """Stream AI-generated Benford's Law insight."""
    df = require_ledger()
    try:
        _, expected, actual = get_benford_analysis(df, "Amount")
        actual_arr = np.array(actual); expected_arr = np.array(expected)
        mad   = float(np.mean(np.abs(actual_arr - expected_arr)))
        score = min(100, round((mad / 0.015) * 100))
        n     = len(df["Amount"].dropna())
        chi   = float(np.sum((actual_arr * n - expected_arr * n) ** 2 / np.where(expected_arr * n > 0, expected_arr * n, 1)))
        sigs  = []
        for i, (a, e) in enumerate(zip(actual, expected), 1):
            dev = round((a - e) * 100, 2)
            if abs(dev) > 1.5:
                sigs.append({"digit": str(i), "actual": round(a * 100, 2), "expected": round(e * 100, 2), "deviation": dev})
        data = {"benford_score": score, "band": "High" if score >= 60 else "Moderate" if score >= 30 else "Low",
                "chi_square": round(chi, 2), "records_analyzed": n, "significant_digits": sigs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return _streaming_response(lambda: generate_benford_insight(data))


@app.get("/insights/anomalies")
def insight_anomalies():
    """Stream AI-generated anomaly detection insight."""
    df = require_ledger()
    try:
        df_w = df.copy(); df_w["Hour"] = 12
        if "Time" in df_w.columns:
            df_w["Hour"] = pd.to_datetime(df_w["Time"], format="%H:%M", errors="coerce").dt.hour.fillna(12).astype(int)
        det = detect_outliers(df_w, contamination=0.05)
        out = det[det["Is_Outlier"] == -1]
        mean_a = det["Amount"].mean(); std_a = det["Amount"].std() or 1
        anomalies = []
        for i, (_, row) in enumerate(out.iterrows(), 1):
            z  = abs((row["Amount"] - mean_a) / std_a)
            hr = int(row.get("Hour", 12))
            anomalies.append({"id": i, "date": str(row.get("Date", ""))[:10],
                               "vendor": str(row.get("VendorName", "Unknown")),
                               "amount": float(row["Amount"]), "hour": hr,
                               "risk": round(min(1.0, z / 6 + (0.15 if hr < 6 or hr > 22 else 0)), 3)})
        data = {"total_flagged": len(out), "total_records": len(det), "anomalies": anomalies}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return _streaming_response(lambda: generate_anomaly_insight(data))


@app.get("/insights/fuzzy")
def insight_fuzzy_endpoint():
    """Stream AI-generated fuzzy vendor matching insight."""
    df = require_ledger()
    try:
        vendors = df["VendorName"].dropna().astype(str).unique().tolist()[:60]
        pairs = []
        for i in range(len(vendors)):
            for j in range(i + 1, len(vendors)):
                v1, v2 = vendors[i], vendors[j]
                ml = max(len(v1), len(v2))
                sc = round(1 - calculate_levenshtein(v1, v2) / ml, 3) if ml > 0 else 1.0
                if sc >= 0.70:
                    pairs.append({"vendorA": v1, "vendorB": v2, "score": sc})
        pairs.sort(key=lambda x: -x["score"])
        data = {"total_vendors": len(vendors), "flagged_pairs": len(pairs),
                "matches": pairs, "vendor_clusters": []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return _streaming_response(lambda: generate_fuzzy_insight(data))


@app.get("/insights/reconciliation")
def insight_reconciliation():
    """Stream AI-generated bank reconciliation insight."""
    ledger_df = require_ledger(); bank_df = require_bank()
    try:
        ml, _, err = run_reconciliation(ledger_df, bank_df)
        matched   = int((ml["MatchStatus"] == "Full Match").sum())
        partial   = int((ml["MatchStatus"] == "Partial Match").sum())
        unmatched = int((ml["MatchStatus"] == "No Match").sum())
        data = {"total": len(ml), "matched": matched, "partial": partial,
                "unmatched": unmatched, "error_score": round(float(err), 2)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return _streaming_response(lambda: generate_reconciliation_insight(data))


@app.get("/insights/summary")
def insight_summary():
    """Stream a full AI audit conclusion across all modules."""
    df = require_ledger()
    # Silently run all analyses
    benford_d, anomaly_d, fuzzy_d, recon_d, mc_d = {}, {}, {}, {}, None
    try:
        _, expected, actual = get_benford_analysis(df, "Amount")
        actual_arr = np.array(actual); expected_arr = np.array(expected)
        mad   = float(np.mean(np.abs(actual_arr - expected_arr)))
        score = min(100, round((mad / 0.015) * 100))
        n     = len(df["Amount"].dropna())
        chi   = float(np.sum((actual_arr * n - expected_arr * n) ** 2 / np.where(expected_arr * n > 0, expected_arr * n, 1)))
        sigs  = []
        for i, (a, e) in enumerate(zip(actual, expected), 1):
            dev = round((a - e) * 100, 2)
            if abs(dev) > 1.5:
                sigs.append({"digit": str(i), "actual": round(a * 100, 2), "expected": round(e * 100, 2), "deviation": dev})
        benford_d = {"benford_score": score, "band": "High" if score >= 60 else "Moderate" if score >= 30 else "Low",
                     "chi_square": round(chi, 2), "records_analyzed": n, "significant_digits": sigs}
    except Exception: pass
    try:
        df_w = df.copy(); df_w["Hour"] = 12
        det = detect_outliers(df_w, contamination=0.05)
        out = det[det["Is_Outlier"] == -1]
        mean_a = det["Amount"].mean(); std_a = det["Amount"].std() or 1
        anomalies = []
        for i, (_, row) in enumerate(out.iterrows(), 1):
            z = abs((row["Amount"] - mean_a) / std_a)
            anomalies.append({"date": str(row.get("Date", ""))[:10],
                               "vendor": str(row.get("VendorName", "Unknown")),
                               "amount": float(row["Amount"]),
                               "risk": round(min(1.0, z / 6), 3)})
        anomaly_d = {"total_flagged": len(out), "total_records": len(det), "anomalies": anomalies}
    except Exception: pass
    try:
        vendors = df["VendorName"].dropna().astype(str).unique().tolist()[:50]
        pairs = []
        for i in range(len(vendors)):
            for j in range(i + 1, len(vendors)):
                v1, v2 = vendors[i], vendors[j]
                ml2 = max(len(v1), len(v2))
                sc  = round(1 - calculate_levenshtein(v1, v2) / ml2, 3) if ml2 > 0 else 1.0
                if sc >= 0.70: pairs.append({"vendorA": v1, "vendorB": v2, "score": sc})
        fuzzy_d = {"total_vendors": len(vendors), "flagged_pairs": len(pairs), "matches": pairs, "vendor_clusters": []}
    except Exception: pass
    if session["bank_df"] is not None:
        try:
            ml2, _, err = run_reconciliation(df, session["bank_df"])
            recon_d = {"total": len(ml2),
                       "matched":   int((ml2["MatchStatus"] == "Full Match").sum()),
                       "partial":   int((ml2["MatchStatus"] == "Partial Match").sum()),
                       "unmatched": int((ml2["MatchStatus"] == "No Match").sum()),
                       "error_score": round(float(err), 2)}
        except Exception: pass
    return _streaming_response(
        lambda: generate_section("conclusion", benford_d, anomaly_d, fuzzy_d, recon_d, mc_d)
    )


# ─── Structured section endpoint (JSON, for Summary page panels) ──────────────

@app.post("/analysis/section")
def analysis_section(body: dict = Body(...)):
    """
    Generate AI text for a specific Summary page section.
    Body: { "section": "findings"|"risks"|"observations"|"conclusion",
            "benford": {...}, "anomalies": {...}, "fuzzy": {...},
            "reconciliation": {...}, "monte_carlo": {...} }
    Returns: { "text": "...", "bullets": ["...", "..."] }
    """
    section = body.get("section", "findings")
    benford_d = body.get("benford", {}) or {}
    anomaly_d = body.get("anomalies", {}) or {}
    fuzzy_d   = body.get("fuzzy", {}) or {}
    recon_d   = body.get("reconciliation", {}) or {}
    mc_d      = body.get("monte_carlo", None)
    try:
        text = generate_section(section, benford_d, anomaly_d, fuzzy_d, recon_d, mc_d)
        # Parse bullet lines
        bullets = [
            line.lstrip("-• ").strip()
            for line in text.split("\n")
            if line.strip().startswith(("-", "•", "*"))
        ]
        if not bullets:
            # Treat as paragraph — split by sentence
            bullets = [s.strip() for s in text.split(".") if len(s.strip()) > 20][:5]
        return {"text": text, "bullets": bullets}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analysis/section/stream")
def analysis_section_stream(body: dict = Body(...)):
    """
    Same body as POST /analysis/section; streams the model output as raw UTF-8 text chunks
    (token streaming from Ollama via LangChain). Client accumulates bytes into the final section.
    """
    section = body.get("section", "findings")
    benford_d = body.get("benford", {}) or {}
    anomaly_d = body.get("anomalies", {}) or {}
    fuzzy_d = body.get("fuzzy", {}) or {}
    recon_d = body.get("reconciliation", {}) or {}
    mc_d = body.get("monte_carlo", None)

    def gen():
        try:
            for piece in iter_section_stream(section, benford_d, anomaly_d, fuzzy_d, recon_d, mc_d):
                yield piece
        except Exception as e:
            yield f"\n[Error: {e}]\n"

    return StreamingResponse(
        gen(),
        media_type="text/plain; charset=utf-8",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─── RAG Chatbot endpoint ─────────────────────────────────────────────────────

@app.post("/chat")
def chat_endpoint(body: dict = Body(...)):
    """
    Context-aware chatbot.
    Body: { "message": "...", "history": [{"role":"user"|"assistant","content":"..."}] }
    Streams plain-text word-by-word.
    """
    message = (body.get("message") or "").strip()
    history = body.get("history", []) or []
    if not message:
        raise HTTPException(status_code=400, detail="message is required")

    df = session.get("ledger_df")

    # Build data context
    data_ctx = ""
    if df is not None:
        total = len(df)
        total_amt = df["Amount"].sum() if "Amount" in df.columns else 0
        vendors = df["VendorName"].nunique() if "VendorName" in df.columns else "N/A"
        data_ctx = (
            f"\nThe user has uploaded a ledger with {total} transactions "
            f"({vendors} unique vendors, ₹{total_amt:,.2f} net).\n"
        )

    # Build conversation history
    history_txt = ""
    for turn in history[-8:]:
        role = "User" if turn.get("role") == "user" else "Assistant"
        history_txt += f"{role}: {turn.get('content','')}\n"

    prompt = (
        "You are a helpful AI audit assistant for the LedgerSpy platform. "
        "Answer questions about audit findings, fraud risks, and uploaded financial data. "
        "Use ₹ for currency. Be precise, professional, and concise.\n"
        f"{data_ctx}\n"
        f"Conversation so far:\n{history_txt}\n"
        f"User: {message}\n\nAssistant:"
    )

    return _streaming_response(lambda: llm.invoke([HumanMessage(content=prompt)]).content.strip())


# ─── Server startup ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,  # Disabled to prevent session loss
        log_level="info",
    )

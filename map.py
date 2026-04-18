import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from rapidfuzz import fuzz
from collections import defaultdict
import json

# =========================
# 1. PREPROCESS
# =========================

def preprocess_data(file):
    df = pd.read_csv(file, dtype=str)

    df.columns = [col.strip() for col in df.columns]

    df = df.rename(columns={
        "EmployeeID": "employee",
        "VendorName": "vendor",
        "Amount": "amount"
    })

    # Combine Date + Time
    if "Date" in df.columns and "Time" in df.columns:
        df["time"] = df["Date"] + " " + df["Time"]
    else:
        df["time"] = df["Date"]

    df["amount"] = pd.to_numeric(df["amount"], errors="coerce")
    df["time"] = pd.to_datetime(df["time"], errors="coerce", format="mixed")

    df["hour"] = df["time"].dt.hour

    df = df.dropna(subset=["employee", "vendor", "amount", "hour"])

    return df


# =========================
# 2. BENFORD
# =========================

def compute_benford_scores(df):
    expected = np.log10(1 + 1 / np.arange(1, 10))
    scores = {}

    for entity, group in df.groupby("vendor"):
        if len(group) < 5:
            scores[entity] = 0.0
            continue

        values = group["amount"].abs()
        digits = values.astype(str).str.replace(r"[^0-9]", "", regex=True)
        digits = digits[digits.str.len() > 0]

        if len(digits) == 0:
            scores[entity] = 0.0
            continue

        digits = digits.str[0].astype(int)

        observed = digits.value_counts(normalize=True).sort_index()
        observed = observed.reindex(range(1, 10), fill_value=0)

        mad = np.mean(np.abs(observed.values - expected))
        scores[entity] = float(mad)

    if not scores:
        return {}

    max_val = max(scores.values())
    if max_val == 0:
        return {k: 0.0 for k in scores}

    return {k: float(v / max_val) for k, v in scores.items()}


# =========================
# 3. ANOMALY
# =========================

def compute_anomaly_scores(df):
    features = df[["amount", "hour"]]

    scaler = StandardScaler()
    scaled = scaler.fit_transform(features)

    model = IsolationForest(contamination=0.1, random_state=42)
    df["anomaly"] = model.fit_predict(scaled)

    df["anomaly"] = df["anomaly"].apply(lambda x: 1 if x == -1 else 0)

    vendor_scores = df.groupby("vendor")["anomaly"].mean().to_dict()
    employee_scores = df.groupby("employee")["anomaly"].mean().to_dict()

    return {k: float(v) for k, v in {**vendor_scores, **employee_scores}.items()}


# =========================
# 4. FUZZY
# =========================

def fuzzy_matching(df):
    vendors = df["vendor"].astype(str).unique()

    matches = []
    flags = defaultdict(int)

    for i in range(len(vendors)):
        for j in range(i + 1, len(vendors)):
            v1 = vendors[i]
            v2 = vendors[j]

            score = fuzz.ratio(v1, v2)

            if score > 85:
                matches.append((v1, v2, score))
                flags[v1] = 1
                flags[v2] = 1

    return flags, matches


# =========================
# 5. RISK ENGINE
# =========================

def compute_risk_scores(b, a, f):
    entities = set(b) | set(a) | set(f)
    scores = {}

    for e in entities:
        scores[e] = round(
            0.4 * a.get(e, 0) +
            0.3 * b.get(e, 0) +
            0.3 * f.get(e, 0),
            3
        )

    return scores


# =========================
# 6. GRAPH (FINAL LOGIC)
# =========================

def generate_graph(df, risk, fuzzy_matches):
    nodes = []
    links = []

    top = sorted(risk.items(), key=lambda x: x[1], reverse=True)[:50]
    top = set([x[0] for x in top])

    # Nodes
    for entity, score in risk.items():
        if entity not in top:
            continue

        level = "High" if score > 0.4 else "Moderate" if score > 0.2 else "Low"

        nodes.append({
            "id": str(entity),
            "label": str(entity),
            "type": "employee" if entity in df["employee"].values else "vendor",
            "riskScore": float(score),
            "riskLevel": level
        })

    # Fraud signals
    repeat_counts = df.groupby(["employee", "vendor"]).size()
    amount_threshold = df["amount"].quantile(0.90)

    for _, row in df.iterrows():
        if row["employee"] in top or row["vendor"] in top:

            avg = (risk.get(row["employee"], 0) + risk.get(row["vendor"], 0)) / 2
            repeat = repeat_counts.get((row["employee"], row["vendor"]), 0)
            high_amount = row["amount"] > amount_threshold
            odd_hour = row["hour"] < 6 or row["hour"] > 22

            # scoring system
            score = 0
            if avg > 0.3:
                score += 1
            if repeat >= 5:
                score += 2
            if high_amount:
                score += 1
            if odd_hour:
                score += 1

            # risk levels
            if score >= 3:
                risk_level = "High"
                is_danger = True
            elif score == 2:
                risk_level = "Moderate"
                is_danger = False
            else:
                risk_level = "Low"
                is_danger = False

            links.append({
                "source": str(row["employee"]),
                "target": str(row["vendor"]),
                "amount": float(row["amount"]),
                "riskLevel": risk_level,
                "isDangerous": bool(is_danger)
            })

    # Fuzzy links
    for e, v, _ in fuzzy_matches[:20]:
        links.append({
            "source": str(e),
            "target": str(v),
            "amount": 0.0,
            "riskLevel": "High",
            "isDangerous": True
        })

    return {"nodes": nodes, "links": links}


# =========================
# MAIN
# =========================

def run_pipeline(file):
    df = preprocess_data(file)

    b = compute_benford_scores(df)
    a = compute_anomaly_scores(df)
    f, matches = fuzzy_matching(df)

    risk = compute_risk_scores(b, a, f)

    graph = generate_graph(df, risk, matches)

    with open("graph_data.json", "w") as f:
        json.dump(graph, f, indent=2)

    print("✅ graph_data.json generated")
    return graph


if __name__ == "__main__":
    run_pipeline("fraud_demo_dataset.csv")
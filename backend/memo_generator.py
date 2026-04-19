"""
memo_generator.py — AI Audit Insights & Memo Generation
Uses the shared `llm` object (ChatOllama / Mistral) from llm.py.
All currency in ₹ (INR).
"""

from typing import Optional, Iterator, Any
from langchain_core.messages import HumanMessage
from llm import llm


def _chunk_text(chunk: Any) -> str:
    """Normalize LangChain / Ollama stream chunks to plain text."""
    c = getattr(chunk, "content", None)
    if c is None:
        return ""
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        parts: list[str] = []
        for p in c:
            if isinstance(p, dict):
                parts.append(str(p.get("text", "")))
            else:
                parts.append(str(p))
        return "".join(parts)
    return str(c)


# ─── System preamble (shared across all prompts) ──────────────────────────────

_SYSTEM = (
    "You are a senior forensic auditor specialising in financial fraud detection. "
    "Write in professional, concise auditing language. "
    "Use ₹ (Indian Rupees) for ALL currency amounts. "
    "STRICTLY DO NOT use Markdown formatting (like **, *, #, _). "
    "Always use Title Case or sentence case (Abc format), DO NOT use ALL CAPS (ABC format) anywhere, including section headers. "
    "Use a simple dash (-) for bullet lists."
)


# ─── Context formatters ───────────────────────────────────────────────────────

def _fmt_benford(data: dict) -> str:
    if not data:
        return "No Benford analysis data available."
    score = data.get("benford_score", 0)
    band  = data.get("band", "Unknown")
    chi   = data.get("chi_square", 0)
    n     = data.get("records_analyzed", 0)
    sigs  = data.get("significant_digits", [])
    lines = [
        f"Benford Risk Score : {score}/100  ({band} risk band)",
        f"Chi-square         : {chi}",
        f"Records Analysed   : {n:,}",
        f"Deviating Digits   : {len(sigs)} (deviation > 1.5 %)",
    ]
    for d in sigs[:5]:
        lines.append(
            f"  - Digit {d['digit']}: actual {d['actual']:.1f}%  expected {d['expected']:.1f}%  "
            f"deviation {d['deviation']:+.2f}%"
        )
    return "\n".join(lines)


def _fmt_anomaly(data: dict) -> str:
    if not data:
        return "No anomaly detection data available."
    flagged = data.get("total_flagged", 0)
    total   = data.get("total_records", 0)
    pct     = round(flagged / total * 100, 1) if total else 0
    lines   = [
        f"Flagged Transactions : {flagged} of {total:,}  ({pct}%)",
    ]
    for a in sorted(data.get("anomalies", []), key=lambda x: x.get("risk", 0), reverse=True)[:5]:
        lines.append(
            f"  - {a.get('date','?')} | {a.get('vendor','Unknown')} | "
            f"₹{a.get('amount',0):,.2f} | Risk {a.get('risk',0):.0%}"
        )
    return "\n".join(lines)


def _fmt_fuzzy(data: dict) -> str:
    if not data:
        return "No fuzzy matching data available."
    lines = [
        f"Total Vendors        : {data.get('total_vendors', 0)}",
        f"Flagged Similar Pairs: {data.get('flagged_pairs', 0)} (similarity ≥ 0.70)",
    ]
    for m in sorted(data.get("matches", []), key=lambda x: x.get("score", 0), reverse=True)[:5]:
        lines.append(f"  - '{m.get('vendorA')}' ↔ '{m.get('vendorB')}'  score {m.get('score', 0):.2f}")
    for c in data.get("vendor_clusters", [])[:3]:
        lines.append(f"  Cluster: {', '.join(c.get('members', [])[:5])}")
    return "\n".join(lines)


def _fmt_recon(data: dict) -> str:
    if not data:
        return "No reconciliation data available."
    total     = data.get("total", 0)
    matched   = data.get("matched", 0)
    partial   = data.get("partial", 0)
    unmatched = data.get("unmatched", 0)
    score     = data.get("error_score", 0)
    pct       = round(matched / total * 100, 1) if total else 0
    return "\n".join([
        f"Total Ledger Rows    : {total:,}",
        f"Fully Matched        : {matched}  ({pct}%)",
        f"Partially Matched    : {partial}",
        f"Unmatched            : {unmatched}",
        f"Reconciliation Error : {score:.2f}%",
    ])


def _fmt_mc(data: Optional[dict]) -> str:
    if not data:
        return "No Monte Carlo data available."
    surv = data.get("survival_rate", 0)
    ins  = data.get("insolvency_risk", 0)
    bal  = data.get("current_balance", 0)
    status = "At Risk" if surv < 70 else "Monitor Required" if surv < 85 else "Stable"
    return "\n".join([
        f"12-Month Survival Probability : {surv:.1f}%",
        f"Insolvency Risk               : {ins:.1f}%",
        f"Current Balance               : ₹{bal:,.2f}",
        f"Going Concern Status          : {status}",
    ])


# ─── Per-module insight generators (plain text, no SSE) ──────────────────────

def generate_benford_insight(benford_data: dict) -> str:
    """Return a short plain-text AI insight for the Benford's Law panel."""
    ctx = _fmt_benford(benford_data)
    prompt = (
        f"{_SYSTEM}\n\n"
        "Write exactly 3 bullet-point insights (dash + space) for a finance manager "
        "based on the Benford's Law results below. "
        "Interpret — do NOT just restate numbers. Flag fraud/manipulation risk explicitly.\n\n"
        f"{ctx}\n\nInsights:"
    )
    resp = llm.invoke([HumanMessage(content=prompt)])
    return resp.content.strip()


def generate_anomaly_insight(anomaly_data: dict) -> str:
    """Return a short plain-text AI insight for the Anomaly Detection panel."""
    ctx = _fmt_anomaly(anomaly_data)
    prompt = (
        f"{_SYSTEM}\n\n"
        "Write exactly 3 bullet-point insights (dash + space) for a finance manager "
        "based on the anomaly detection results below. "
        "Explain WHY these transactions are suspicious and the business risk they represent. "
        "Use ₹ for currency amounts.\n\n"
        f"{ctx}\n\nInsights:"
    )
    resp = llm.invoke([HumanMessage(content=prompt)])
    return resp.content.strip()


def generate_fuzzy_insight(fuzzy_data: dict) -> str:
    """Return a short plain-text AI insight for the Fuzzy Matching panel."""
    ctx = _fmt_fuzzy(fuzzy_data)
    prompt = (
        f"{_SYSTEM}\n\n"
        "Write exactly 3 bullet-point insights (dash + space) for a finance manager "
        "based on the fuzzy vendor matching results below. "
        "Focus on duplicate invoice risk, ghost vendors, and recommended actions.\n\n"
        f"{ctx}\n\nInsights:"
    )
    resp = llm.invoke([HumanMessage(content=prompt)])
    return resp.content.strip()


def generate_reconciliation_insight(recon_data: dict) -> str:
    """Return a short plain-text AI insight for the Reconciliation panel."""
    ctx = _fmt_recon(recon_data)
    prompt = (
        f"{_SYSTEM}\n\n"
        "Write exactly 3 bullet-point insights (dash + space) for a finance manager "
        "based on the bank reconciliation results below. "
        "Focus on match quality, unmatched risk, and specific recommended actions. "
        "Use ₹ for currency amounts.\n\n"
        f"{ctx}\n\nInsights:"
    )
    resp = llm.invoke([HumanMessage(content=prompt)])
    return resp.content.strip()


# ─── Structured summary section generators ────────────────────────────────────

_SECTION_INSTRUCTIONS: dict[str, str] = {
    "findings": (
        "List exactly 4 KEY FINDINGS as bullet points (dash + space). "
        "Each finding should reference specific numbers from the data. "
        "No padding or preamble — just the 4 bullet points."
    ),
    "risks": (
        "List exactly 4 RISK HIGHLIGHTS as bullet points (dash + space). "
        "Each risk must name a specific transaction, pattern, or metric that warrants immediate attention. "
        "No padding — just the 4 bullet points."
    ),
    "observations": (
        "List exactly 3 OBSERVATIONS as bullet points (dash + space). "
        "Observations should be contextual qualitative notes, not just repeating numbers. "
        "No padding — just the 3 bullet points."
    ),
    "conclusion": (
        "Write a brief professional conclusion paragraph (3-5 sentences) that: "
        "1) States the overall risk level (Low / Medium / High) with reasoning, "
        "2) Summarises the most material findings, "
        "3) Gives a clear recommendation. "
        "Plain text only. Use ₹ for currency."
    ),
}


def _combined_audit_context(
    benford_data: dict,
    anomaly_data: dict,
    fuzzy_data: dict,
    recon_data: dict,
    mc_data: Optional[dict],
) -> str:
    return "\n\n".join([
        "BENFORD:\n" + _fmt_benford(benford_data),
        "ANOMALIES:\n" + _fmt_anomaly(anomaly_data),
        "FUZZY MATCHING:\n" + _fmt_fuzzy(fuzzy_data),
        "RECONCILIATION:\n" + _fmt_recon(recon_data),
        ("MONTE CARLO:\n" + _fmt_mc(mc_data)) if mc_data else "",
    ]).strip()


def _section_prompt(
    section: str,
    benford_data: dict,
    anomaly_data: dict,
    fuzzy_data: dict,
    recon_data: dict,
    mc_data: Optional[dict] = None,
) -> str:
    combined = _combined_audit_context(benford_data, anomaly_data, fuzzy_data, recon_data, mc_data)
    instr = _SECTION_INSTRUCTIONS.get(section, "Summarise the audit data.")
    return (
        f"{_SYSTEM}\n\n"
        f"{instr}\n\n"
        f"AUDIT DATA:\n{combined}\n\n"
        f"Output:"
    )


def iter_section_stream(
    section: str,
    benford_data: dict,
    anomaly_data: dict,
    fuzzy_data: dict,
    recon_data: dict,
    mc_data: Optional[dict] = None,
) -> Iterator[str]:
    """Stream model tokens for a Summary section (plain UTF-8 chunks)."""
    prompt = _section_prompt(section, benford_data, anomaly_data, fuzzy_data, recon_data, mc_data)
    for chunk in llm.stream([HumanMessage(content=prompt)]):
        t = _chunk_text(chunk)
        if t:
            yield t


def generate_section(
    section: str,
    benford_data: dict,
    anomaly_data: dict,
    fuzzy_data: dict,
    recon_data: dict,
    mc_data: Optional[dict] = None,
) -> str:
    """
    Generate AI text for a specific Summary page section.
    section: 'findings' | 'risks' | 'observations' | 'conclusion'
    Returns plain-text bullet list or paragraph.
    """
    prompt = _section_prompt(section, benford_data, anomaly_data, fuzzy_data, recon_data, mc_data)
    resp = llm.invoke([HumanMessage(content=prompt)])
    return (resp.content or "").strip()


# ─── Full memo generator (used by /analysis/generate-memo) ───────────────────

def _audit_memo_prompt(
    benford_data: dict,
    anomaly_data: dict,
    fuzzy_data: dict,
    reconciliation_data: dict,
    monte_carlo_data: Optional[dict] = None,
) -> str:
    combined = "\n\n".join([
        "BENFORD'S LAW ANALYSIS:\n" + _fmt_benford(benford_data),
        "ANOMALY DETECTION:\n" + _fmt_anomaly(anomaly_data),
        "FUZZY VENDOR MATCHING:\n" + _fmt_fuzzy(fuzzy_data),
        "BANK RECONCILIATION:\n" + _fmt_recon(reconciliation_data),
        ("MONTE CARLO CASH FLOW:\n" + _fmt_mc(monte_carlo_data)) if monte_carlo_data else "",
    ]).strip()
    return (
        f"{_SYSTEM}\n\n"
        "Generate a comprehensive professional audit memo with these plaintext sections:\n"
        "Summary of Procedures\n"
        "Key Findings\n"
        "Risk Highlights\n"
        "Observations\n"
        "Recommendations\n"
        "Conclusion\n\n"
        "Rules:\n"
        "- STRICTLY DO NOT use Markdown.\n"
        "- Use ₹ for all currency.\n"
        "- Always use Abc format (Title or Sentence case). Never use ALL CAPS (ABC format) for headers or text.\n"
        "- Use specific numbers from the data.\n"
        "- Approximately 300-450 words (be concise for faster reading).\n\n"
        f"AUDIT DATA:\n{combined}\n\n"
        "Audit Memo:"
    )


def iter_audit_memo_stream(
    benford_data: dict,
    anomaly_data: dict,
    fuzzy_data: dict,
    reconciliation_data: dict,
    monte_carlo_data: Optional[dict] = None,
) -> Iterator[str]:
    """Stream model tokens for the full audit memo."""
    prompt = _audit_memo_prompt(
        benford_data, anomaly_data, fuzzy_data, reconciliation_data, monte_carlo_data
    )
    for chunk in llm.stream([HumanMessage(content=prompt)]):
        t = _chunk_text(chunk)
        if t:
            yield t


def generate_audit_memo(
    benford_data: dict,
    anomaly_data: dict,
    fuzzy_data: dict,
    reconciliation_data: dict,
    monte_carlo_data: Optional[dict] = None,
    # Legacy params — ignored, kept for backward compat
    model_name: str = "",
    ollama_base_url: str = "",
) -> str:
    """
    Generate a full professional audit memo using the shared llm object.
    Returns plain text (no Markdown symbols).
    """
    prompt = _audit_memo_prompt(
        benford_data, anomaly_data, fuzzy_data, reconciliation_data, monte_carlo_data
    )
    try:
        resp = llm.invoke([HumanMessage(content=prompt)])
        return (resp.content or "").strip()
    except Exception as e:
        raise Exception(f"LLM invocation failed: {e}")

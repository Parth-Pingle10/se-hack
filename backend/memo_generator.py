"""
Audit Memo Generation using LangChain + Ollama
Generates professional audit memos from LedgerSpy analysis data
"""

from langchain_community.llms import Ollama
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from typing import Optional


def generate_audit_memo(
    benford_data: dict,
    anomaly_data: dict,
    fuzzy_data: dict,
    reconciliation_data: dict,
    monte_carlo_data: Optional[dict] = None,
    model_name: str = "qwen2.5:3b",
    ollama_base_url: str = "http://localhost:11434",
) -> str:
    """
    Generate a professional audit memo using Ollama and LangChain.
    
    Args:
        benford_data: Benford analysis results
        anomaly_data: Anomaly detection results
        fuzzy_data: Fuzzy matching results
        reconciliation_data: Bank reconciliation results
        monte_carlo_data: Monte Carlo simulation results (optional)
        model_name: Name of the Ollama model to use
        ollama_base_url: Base URL for Ollama instance
    
    Returns:
        Generated audit memo as string
    """
    
    try:
        # Initialize Ollama LLM with specified model
        llm = Ollama(
            model=model_name,
            base_url=ollama_base_url,
            temperature=0.7,
            top_p=0.9,
            repeat_penalty=1.1,
            top_k=40,
        )
    except Exception as e:
        raise Exception(f"Failed to initialize Ollama: {str(e)}")
    
    # Build context from analysis data
    benford_context = _format_benford_context(benford_data)
    anomaly_context = _format_anomaly_context(anomaly_data)
    fuzzy_context = _format_fuzzy_context(fuzzy_data)
    recon_context = _format_reconciliation_context(reconciliation_data)
    monte_carlo_context = _format_monte_carlo_context(monte_carlo_data) if monte_carlo_data else ""
    
    prompt_template = ChatPromptTemplate.from_template(
        """You are a professional audit memo writer for a financial audit tool called LedgerSpy. 
Generate a comprehensive, professional audit memo based on the following analysis results.

STRICT FORMATTING RULE: 
- DO NOT use Markdown formatting of any kind. 
- DO NOT use asterisks (*), hashtags (#), or underscores (_). 
- DO NOT use bold, italics, or Markdown headers. 
- Use ONLY plain text. 
- Use capitalized plain text for section headers (e.g., SUMMARY OF PROCEDURES).
- Use plain dashes (-) or simple indentation for lists.

The memo should be structured with clear sections: SUMMARY OF PROCEDURES, KEY FINDINGS, RISK HIGHLIGHTS, and RECOMMENDATIONS.
Use specific numbers and percentages from the data. Write in professional accounting language.
Keep the tone professional but accessible. Focus on material findings and risks.

BENFORD'S LAW ANALYSIS:
{benford_context}

ANOMALY DETECTION:
{anomaly_context}

FUZZY MATCHING (VENDOR SIMILARITY):
{fuzzy_context}

BANK RECONCILIATION:
{recon_context}

MONTE CARLO CASH FLOW ANALYSIS:
{monte_carlo_context}

Please write a comprehensive audit memo (approximately 400-600 words) that synthesizes these findings into a professional narrative. 

REMINDER: Output must be 100% plain text. No markdown symbols or formatting. Use standard line breaks and capital letters for organization."""
    )
    
    chain = prompt_template | llm | StrOutputParser()
    
    try:
        result = chain.invoke({
            "benford_context": benford_context,
            "anomaly_context": anomaly_context,
            "fuzzy_context": fuzzy_context,
            "recon_context": recon_context,
            "monte_carlo_context": monte_carlo_context,
        })
        return result
    except Exception as e:
        raise Exception(f"Failed to generate memo: {str(e)}")


def _format_benford_context(data: dict) -> str:
    """Format Benford analysis data for prompt context."""
    if not data:
        return "No Benford analysis data available."
    
    score = data.get("benford_score", 0)
    band = data.get("band", "Unknown")
    chi_square = data.get("chi_square", 0)
    records = data.get("records_analyzed", 0)
    sig_digits = data.get("significant_digits", [])
    
    context = f"""
Benford Risk Score: {score}/100 ({band} risk band)
Chi-square Statistic: {chi_square}
Records Analyzed: {records:,}
Significant Digit Deviations: {len(sig_digits)} digits deviate by >1.5%
"""
    
    if sig_digits:
        context += "\nFlagged Digits:\n"
        for digit in sig_digits[:5]:
            context += f"  - Digit {digit['digit']}: {digit['deviation']:.2f}% deviation (Expected {digit['expected']:.1f}%, Actual {digit['actual']:.1f}%)\n"
    
    return context.strip()


def _format_anomaly_context(data: dict) -> str:
    """Format anomaly detection data for prompt context."""
    if not data:
        return "No anomaly detection data available."
    
    total_flagged = data.get("total_flagged", 0)
    total_records = data.get("total_records", 0)
    anomalies = data.get("anomalies", [])
    
    context = f"""
Total Transactions Flagged: {total_flagged}
Total Records Analyzed: {total_records:,}
Anomaly Percentage: {(total_flagged/total_records*100) if total_records > 0 else 0:.1f}%
"""
    
    if anomalies:
        context += "\nTop Anomalies:\n"
        sorted_anomalies = sorted(anomalies, key=lambda x: x.get("risk", 0), reverse=True)
        for anomaly in sorted_anomalies[:5]:
            context += f"  - {anomaly.get('date', 'N/A')} | {anomaly.get('vendor', 'Unknown')}: ${anomaly.get('amount', 0):,.2f} (Risk: {anomaly.get('risk', 0):.0%})\n"
    
    return context.strip()


def _format_fuzzy_context(data: dict) -> str:
    """Format fuzzy matching data for prompt context."""
    if not data:
        return "No fuzzy matching data available."
    
    total_vendors = data.get("total_vendors", 0)
    flagged_pairs = data.get("flagged_pairs", 0)
    matches = data.get("matches", [])
    clusters = data.get("vendor_clusters", [])
    
    context = f"""
Total Vendors: {total_vendors}
Flagged Vendor Pairs: {flagged_pairs}
Vendor Similarity Threshold: ≥0.70
"""
    
    if matches:
        context += "\nTop Matching Pairs (Potential Duplicates):\n"
        sorted_matches = sorted(matches, key=lambda x: x.get("score", 0), reverse=True)
        for match in sorted_matches[:5]:
            context += f"  - '{match.get('vendorA', 'Unknown')}' ↔ '{match.get('vendorB', 'Unknown')}' (Score: {match.get('score', 0):.2f})\n"
    
    if clusters:
        context += "\nVendor Clusters Identified:\n"
        for cluster in clusters[:3]:
            members = cluster.get("members", [])
            context += f"  - Cluster: {', '.join(members)}\n"
    
    return context.strip()


def _format_reconciliation_context(data: dict) -> str:
    """Format reconciliation data for prompt context."""
    if not data:
        return "No reconciliation data available."
    
    total = data.get("total", 0)
    matched = data.get("matched", 0)
    partial = data.get("partial", 0)
    unmatched = data.get("unmatched", 0)
    error_score = data.get("error_score", 0)
    
    matched_pct = (matched / total * 100) if total > 0 else 0
    context = f"""
Total Transactions: {total:,}
Matched: {matched} ({matched_pct:.1f}%)
Partial Matches: {partial}
Unmatched: {unmatched}
Reconciliation Error Score: {error_score:.2f}
"""
    
    return context.strip()


def _format_monte_carlo_context(data: Optional[dict]) -> str:
    """Format Monte Carlo simulation data for prompt context."""
    if not data:
        return ""
    
    survival = data.get("survival_rate", 0)
    insolvency = data.get("insolvency_risk", 0)
    current_balance = data.get("current_balance", 0)
    drift = data.get("avg_monthly_drift", 0)
    volatility = data.get("monthly_volatility", 0)
    
    context = f"""
12-Month Survival Probability: {survival:.1f}%
Insolvency Risk: {insolvency:.1f}%
Current Balance: ${current_balance:,.2f}
Average Monthly Drift: ${drift:,.2f}
Cash Flow Volatility (Std Dev): ${volatility:,.2f}
Going Concern Status: {'At Risk' if survival < 70 else 'Stable' if survival >= 85 else 'Monitor Required'}
"""
    
    return context.strip()

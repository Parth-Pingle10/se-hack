import pandas as pd
import numpy as np

def run_monte_carlo_stress_test(df, iterations=1000, months=12):
    """
    Run Monte Carlo stress test and return JSON-serializable data.
    
    Args:
        df: Ledger DataFrame with columns: Date/TransactionDate, IncomingAmount, OutgoingAmount (or Amount), Balance
        iterations: Number of simulation paths
        months: Number of months to project forward
    
    Returns:
        Dictionary with simulation results and percentile bands
    """
    # Handle different date column names
    if 'TransactionDate' in df.columns:
        df = df.copy()
        df['Date'] = pd.to_datetime(df['TransactionDate'])
    else:
        df = df.copy()
        df['Date'] = pd.to_datetime(df['Date'])
    
    # Handle amount columns - check for new schema first
    if 'IncomingAmount' in df.columns and 'OutgoingAmount' in df.columns:
        df['NetFlow'] = df['IncomingAmount'] - df['OutgoingAmount']
    elif 'Amount' in df.columns:
        df['NetFlow'] = df['Amount']
    else:
        raise ValueError("DataFrame must have either 'Amount' or both 'IncomingAmount' and 'OutgoingAmount' columns")
    
    # Get current balance from Balance column if available, otherwise use last cumulative sum
    if 'Balance' in df.columns and df['Balance'].notna().sum() > 0:
        current_balance = float(df['Balance'].iloc[-1])
    else:
        # Calculate balance from cumulative net flow
        current_balance = float(df['NetFlow'].sum())
    
    # Group by month to get the historical drift and volatility
    monthly_stats = df.groupby(df['Date'].dt.to_period('M'))['NetFlow'].sum()
    
    avg_monthly_drift = float(monthly_stats.mean())
    monthly_volatility = float(monthly_stats.std())
    
    # Handle case where volatility is 0 or NaN
    if pd.isna(monthly_volatility) or monthly_volatility == 0:
        monthly_volatility = abs(avg_monthly_drift) * 0.1 if avg_monthly_drift != 0 else 1000

    # 2. Simulation Logic (Geometric Brownian Motion-inspired)
    simulations = np.zeros((iterations, months + 1))
    simulations[:, 0] = current_balance

    for i in range(1, months + 1):
        shocks = np.random.normal(avg_monthly_drift, monthly_volatility, iterations)
        simulations[:, i] = simulations[:, i-1] + shocks

    # 3. Calculate percentiles for the bands
    p5 = np.percentile(simulations, 5, axis=0)
    p25 = np.percentile(simulations, 25, axis=0)
    p50 = np.percentile(simulations, 50, axis=0)
    p75 = np.percentile(simulations, 75, axis=0)
    p95 = np.percentile(simulations, 95, axis=0)

    # Calculate survival probability (% of paths ending with positive balance)
    survival_rate = float((simulations[:, -1] > 0).sum() / iterations * 100)
    
    # Calculate insolvency probability (% of paths that go negative at any point)
    touched_zero = float((np.min(simulations, axis=1) <= 0).sum() / iterations * 100)
    
    # Build month labels
    months_labels = [f"Month {i}" for i in range(months + 1)]
    
    # Build chart data
    chart_data = []
    for i in range(months + 1):
        chart_data.append({
            "month": months_labels[i],
            "p5": float(p5[i]),
            "p25": float(p25[i]),
            "p50": float(p50[i]),
            "p75": float(p75[i]),
            "p95": float(p95[i]),
        })
    
    return {
        "survival_rate": round(survival_rate, 1),
        "insolvency_risk": round(touched_zero, 1),
        "current_balance": round(current_balance, 2),
        "avg_monthly_drift": round(avg_monthly_drift, 2),
        "monthly_volatility": round(monthly_volatility, 2),
        "chart_data": chart_data,
    }
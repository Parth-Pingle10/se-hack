import pandas as pd
from datetime import timedelta

def simple_levenshtein(s1, s2):
    s1, s2 = str(s1).lower(), str(s2).lower()
    if len(s1) < len(s2): return simple_levenshtein(s2, s1)
    if not s2: return len(s1)
    prev = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        curr = [i + 1]
        for j, c2 in enumerate(s2):
            curr.append(min(curr[j]+1, prev[j+1]+1, prev[j]+(c1!=c2)))
        prev = curr
    dist = prev[-1]
    max_l = max(len(s1), len(s2))
    return 1 - (dist / max_l) if max_l > 0 else 1

def run_reconciliation(ledger_df, bank_df, date_window=3, similarity_threshold=0.8):
    """
    Reconciles Ledger and Bank Statement.
    Returns: (processed_ledger, unmatched_bank, error_score)
    """
    l_df = ledger_df.copy()
    b_df = bank_df.copy()
    l_df['Date'] = pd.to_datetime(l_df['Date'])
    b_df['Date'] = pd.to_datetime(b_df['Date'])
    
    l_df['MatchStatus'] = 'No Match'
    l_df['MatchedBankDescription'] = None
    l_df['MatchedBankAmount'] = None
    b_df['IsMatched'] = False

    for idx, l_row in l_df.iterrows():
        # Find candidates with exact amount within date window
        candidates = b_df[
            (~b_df['IsMatched']) & 
            (b_df['Amount'] == l_row['Amount']) &
            (b_df['Date'] >= l_row['Date'] - timedelta(days=date_window)) &
            (b_df['Date'] <= l_row['Date'] + timedelta(days=date_window))
        ]
        
        best_sim = 0
        best_idx = None
        
        for b_idx, b_row in candidates.iterrows():
            sim = simple_levenshtein(l_row['VendorName'], b_row['Description'])
            if sim > best_sim:
                best_sim = sim
                best_idx = b_idx
        
        if best_idx is not None:
            l_df.at[idx, 'MatchStatus'] = 'Full Match' if best_sim >= similarity_threshold else 'Partial Match'
            l_df.at[idx, 'MatchedBankDescription'] = b_df.at[best_idx, 'Description']
            l_df.at[idx, 'MatchedBankAmount'] = b_df.at[best_idx, 'Amount']
            b_df.at[best_idx, 'IsMatched'] = True

    # Calculation of Error Score (Percentage of volume unmatched)
    unmatched_ledger = l_df[l_df['MatchStatus'] == 'No Match']['Amount'].sum()
    unmatched_bank = b_df[~b_df['IsMatched']]['Amount'].sum()
    total_vol = l_df['Amount'].sum() + b_df['Amount'].sum()
    
    error_score = ((unmatched_ledger + unmatched_bank) / total_vol) * 100
    
    return l_df, b_df[~b_df['IsMatched']], error_score
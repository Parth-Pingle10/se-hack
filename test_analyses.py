import sys
sys.path.insert(0, 'backend')

from main import (
    app, session, analysis_benford, analysis_anomalies, 
    analysis_fuzzy, analysis_reconciliation, analysis_monte_carlo
)
import pandas as pd
import io

# Load test data
with open('backend/csv-test-files/ledger_new.csv', 'rb') as f:
    ledger_df = pd.read_csv(io.BytesIO(f.read()))

with open('backend/csv-test-files/bank_statement_new.csv', 'rb') as f:
    bank_df = pd.read_csv(io.BytesIO(f.read()))

# Set in session
session['ledger_df'] = ledger_df
session['bank_df'] = bank_df

print(f"Ledger rows: {len(ledger_df)}")
print(f"Bank rows: {len(bank_df)}")

# Test each analysis function
import time

analyses = [
    ('Benford', lambda: analysis_benford(column="Amount")),
    ('Anomalies', lambda: analysis_anomalies(contamination=0.05)),
    ('Fuzzy', lambda: analysis_fuzzy(threshold=0.7, max_vendors=60)),
    ('Reconciliation', lambda: analysis_reconciliation(date_window=3, similarity_threshold=0.6)),
    ('Monte Carlo', lambda: analysis_monte_carlo(iterations=1000, months=12)),
]

for name, func in analyses:
    print(f'\n{name}...')
    try:
        start = time.time()
        result = func()
        elapsed = time.time() - start
        print(f'  ✓ OK ({elapsed:.2f}s)')
    except Exception as e:
        print(f'  ✗ Error: {str(e)[:100]}')

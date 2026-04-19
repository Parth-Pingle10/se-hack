import sys
sys.path.insert(0, 'backend')

import time
from main import _generate_fallback_memo

# Create mock data
benford_data = {'benford_score': 45, 'band': 'Moderate', 'significant_digits': []}
anomaly_data = {'total_flagged': 15, 'total_records': 5000, 'anomalies': []}
fuzzy_data = {'total_vendors': 500, 'flagged_pairs': 8, 'vendor_clusters': []}
recon_data = {'total': 5000, 'matched': 4200, 'error_score': 5.2}
monte_carlo_data = None

print("Generating fallback memo...")
start = time.time()
try:
    memo = _generate_fallback_memo(benford_data, anomaly_data, fuzzy_data, recon_data, monte_carlo_data)
    elapsed = time.time() - start
    print(f"✓ Generated in {elapsed:.3f} seconds")
    print(f"Length: {len(memo)} characters")
    print(f"\nFirst 500 chars:\n{memo[:500]}")
except Exception as e:
    elapsed = time.time() - start
    print(f"✗ Error after {elapsed:.3f}s: {e}")
    import traceback
    traceback.print_exc()

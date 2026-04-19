import requests
import time

BASE = "http://localhost:8000"

# Upload data first
with open('backend/csv-test-files/ledger_new.csv', 'rb') as f:
    resp = requests.post(f'{BASE}/upload/ledger', files={'file': f})
    print(f'Ledger upload: {resp.status_code}')

with open('backend/csv-test-files/bank_statement_new.csv', 'rb') as f:
    resp = requests.post(f'{BASE}/upload/bank', files={'file': f})
    print(f'Bank upload: {resp.status_code}')

# Test each endpoint
endpoints = [
    ('/analysis/benford', 'Benford'),
    ('/analysis/anomalies', 'Anomalies'),
    ('/analysis/fuzzy', 'Fuzzy'),
    ('/analysis/reconciliation', 'Reconciliation'),
    ('/analysis/monte-carlo', 'Monte Carlo'),
]

for endpoint, name in endpoints:
    print(f'\nTesting {name}...')
    try:
        start = time.time()
        resp = requests.get(f'{BASE}{endpoint}', timeout=10)
        elapsed = time.time() - start
        print(f'  Status: {resp.status_code}, Time: {elapsed:.2f}s')
        if resp.status_code == 200:
            print(f'  ✓ {name} OK')
        else:
            print(f'  Error: {resp.text[:200]}')
    except requests.exceptions.Timeout:
        print(f'  ✗ TIMEOUT after 10 seconds')
    except Exception as e:
        print(f'  ✗ Error: {e}')

print('\nNow testing memo generation...')
try:
    start = time.time()
    resp = requests.get(f'{BASE}/analysis/generate-memo', timeout=30)
    elapsed = time.time() - start
    print(f'Status: {resp.status_code}, Time: {elapsed:.2f}s')
    if resp.status_code == 200:
        data = resp.json()
        print(f'Memo length: {len(data.get("memo", ""))} characters')
        print(f'First 300 chars:\n{data.get("memo", "")[:300]}')
    else:
        print(f'Error: {resp.text[:500]}')
except requests.exceptions.Timeout:
    print(f'✗ TIMEOUT after 30 seconds')
except Exception as e:
    print(f'✗ Error: {e}')

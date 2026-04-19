import requests

BASE = "http://localhost:8000"

print("Uploading ledger...")
with open('backend/csv-test-files/ledger_new.csv', 'rb') as f:
    resp = requests.post(f'{BASE}/upload/ledger', files={'file': f}, timeout=10)
    print(f'Status: {resp.status_code}')

print("\nUploading bank...")
with open('backend/csv-test-files/bank_statement_new.csv', 'rb') as f:
    resp = requests.post(f'{BASE}/upload/bank', files={'file': f}, timeout=10)
    print(f'Status: {resp.status_code}')

print("\nGenerating memo (with 60 second timeout)...")
try:
    resp = requests.get(f'{BASE}/analysis/generate-memo', timeout=60)
    print(f'Status: {resp.status_code}')
    if resp.status_code == 200:
        data = resp.json()
        memo = data.get('memo', '')
        print(f'\n✓ SUCCESS!')
        print(f'Memo length: {len(memo)} characters')
        print(f'\nMemo preview (first 800 chars):\n')
        print(memo[:800])
    else:
        print(f'Error: {resp.text}')
except requests.exceptions.Timeout:
    print('✗ Request timed out after 60 seconds')
except Exception as e:
    print(f'✗ Exception: {e}')

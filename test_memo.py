import requests
import sys

# Upload ledger
with open('backend/csv-test-files/ledger_new.csv', 'rb') as f:
    resp = requests.post('http://localhost:8000/upload/ledger', files={'file': f})
    print('Ledger upload:', resp.status_code)

# Upload bank statement
with open('backend/csv-test-files/bank_statement_new.csv', 'rb') as f:
    resp = requests.post('http://localhost:8000/upload/bank', files={'file': f})
    print('Bank upload:', resp.status_code)

# Now try memo generation
print('\nGenerating memo...')
try:
    resp = requests.get('http://localhost:8000/analysis/generate-memo', timeout=60)
    print('Status:', resp.status_code)
    if resp.ok:
        data = resp.json()
        print('Success! Memo generated')
        print('Memo (first 500 chars):\n', data.get('memo', '')[:500])
    else:
        print('Error response:', resp.text[:1000])
except requests.exceptions.Timeout:
    print('Request timed out - LLM might be slow')
except Exception as e:
    print(f'Exception: {e}')

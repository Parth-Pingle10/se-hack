import requests
import pandas as pd
import io

BASE = "http://localhost:8000"

# Upload ledger
with open('backend/csv-test-files/ledger_new.csv', 'rb') as f:
    resp = requests.post(f'{BASE}/upload/ledger', files={'file': f})
    upload_response = resp.json()
    print("Upload Response:")
    print(f"  Rows: {upload_response.get('rows')}")
    print(f"  Columns: {upload_response.get('columns')}")

# Upload bank
with open('backend/csv-test-files/bank_statement_new.csv', 'rb') as f:
    resp = requests.post(f'{BASE}/upload/bank', files={'file': f})
    upload_response = resp.json()
    print("\nBank Upload Response:")
    print(f"  Rows: {upload_response.get('rows')}")
    print(f"  Columns: {upload_response.get('columns')}")

# Now let's check the actual CSV files
print("\n=== Ledger CSV Info ===")
ledger_df = pd.read_csv('backend/csv-test-files/ledger_new.csv', nrows=2)
print(f"Columns: {list(ledger_df.columns)}")
print(f"Shape: {ledger_df.shape}")

print("\n=== Bank CSV Info ===")
bank_df = pd.read_csv('backend/csv-test-files/bank_statement_new.csv', nrows=2)
print(f"Columns: {list(bank_df.columns)}")
print(f"Shape: {bank_df.shape}")

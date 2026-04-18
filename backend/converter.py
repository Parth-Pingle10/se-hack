import os
import pandas as pd
import pdfplumber
from docx2pdf import convert

def process_file(file_path):
    filename, ext = os.path.splitext(file_path)
    ext = ext.lower()

    try:
        # 1. CSV → rename to data.csv
        if ext == ".csv":
            if os.path.exists("data.csv"):
                os.remove("data.csv")
            os.rename(file_path, "data.csv")
            print(f"{file_path} → data.csv")

        # 2. Excel → data.csv
        elif ext in [".xls", ".xlsx"]:
            df = pd.read_excel(file_path)
            df.to_csv("data.csv", index=False)
            print(f"{file_path} → data.csv")

        # 3. PDF → extract tables → data.csv
        elif ext == ".pdf":
            all_tables = []

            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    tables = page.extract_tables()
                    for table in tables:
                        df = pd.DataFrame(table)
                        all_tables.append(df)

            if all_tables:
                combined_df = pd.concat(all_tables, ignore_index=True)
                combined_df.to_csv("data.csv", index=False)
                print(f"{file_path} → data.csv")
            else:
                print(f"{file_path}: Tables not available")

        # 4. DOC / DOCX → data.pdf → data.csv
        elif ext in [".doc", ".docx"]:
            pdf_file = "data.pdf"

            # remove old pdf if exists
            if os.path.exists(pdf_file):
                os.remove(pdf_file)

            convert(file_path, pdf_file)
            print(f"{file_path} → data.pdf")

            # now process the generated PDF
            process_file(pdf_file)

        else:
            print(f"Unsupported file: {file_path}")

    except Exception as e:
        print(f"Error processing {file_path}: {e}")


# 🔁 Run
if __name__ == "__main__":
    # for file in os.listdir("."):
    #     if file not in ["data.csv", "data.pdf"]:
    process_file("log book 2024300179.pdf")
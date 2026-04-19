import os
import pandas as pd
import pdfplumber
from docx2pdf import convert

def process_file(file_path, output_path="data.csv"):
    filename, ext = os.path.splitext(file_path)
    ext = ext.lower()

    try:
        # 1. CSV → rename to output_path
        if ext == ".csv":
            if file_path != output_path:
                if os.path.exists(output_path):
                    os.remove(output_path)
                os.rename(file_path, output_path)
            print(f"{file_path} → {output_path}")

        # 2. Excel → output_path
        elif ext in [".xls", ".xlsx"]:
            df = pd.read_excel(file_path)
            df.to_csv(output_path, index=False)
            print(f"{file_path} → {output_path}")

        # 3. PDF → extract tables → output_path
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
                combined_df.to_csv(output_path, index=False)
                print(f"{file_path} → {output_path}")
            else:
                raise ValueError(f"No tables found in PDF {file_path}")

        # 4. DOC / DOCX → temp.pdf → output_path
        elif ext in [".doc", ".docx"]:
            pdf_file = output_path.replace(".csv", ".pdf")

            # remove old pdf if exists
            if os.path.exists(pdf_file):
                os.remove(pdf_file)

            convert(file_path, pdf_file)
            print(f"{file_path} → {pdf_file}")

            # now process the generated PDF
            process_file(pdf_file, output_path)

        else:
            raise ValueError(f"Unsupported file type: {ext}")

    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        raise


# 🔁 Run
if __name__ == "__main__":
    # for file in os.listdir("."):
    #     if file not in ["data.csv", "data.pdf"]:
    process_file("log book 2024300179.pdf")
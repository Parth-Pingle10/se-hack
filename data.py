import pandas as pd

def check_data_readability(file_path, output_bad_file="bad_data.csv"):
    df = pd.read_csv(file_path)

    # Optional but useful
    df = df.convert_dtypes()

    total_rows = len(df)
    issues = {}
    bad_rows = set()  # ensures NO double counting

    # ---------------------------
    # 1. NULL VALUES
    # ---------------------------
    null_mask = df.isnull()
    if null_mask.any().any():
        issues["null_values"] = df.columns[null_mask.any()].tolist()
        bad_rows.update(df[null_mask.any(axis=1)].index)

    # ---------------------------
    # 2. DUPLICATE ROWS
    # ---------------------------
    dup_mask = df.duplicated()
    if dup_mask.any():
        issues["duplicate_rows"] = int(dup_mask.sum())
        bad_rows.update(df[dup_mask].index)

    # ---------------------------
    # 3. DUPLICATE COLUMN NAMES
    # ---------------------------
    dup_cols = df.columns[df.columns.duplicated()].tolist()
    if dup_cols:
        issues["duplicate_columns"] = dup_cols
        # no row impact

    # ---------------------------
    # 4. MIXED DATA TYPES (fixed logic)
    # ---------------------------
    mixed_cols = []

    for col in df.columns:
        types = df[col].apply(type)

        if types.nunique() > 1:
            mixed_cols.append(col)

            # dominant type
            dominant_type = types.mode()[0]

            # mark only inconsistent rows
            inconsistent = df[types != dominant_type].index
            bad_rows.update(inconsistent)

    if mixed_cols:
        issues["mixed_types"] = mixed_cols

    # ---------------------------
    # 5. EMPTY STRINGS (fixed pandas warning)
    # ---------------------------
    str_df = df.select_dtypes(include=["object", "string"])

    if not str_df.empty:
        empty_mask = str_df.apply(lambda col: col.str.strip() == "")
        
        if empty_mask.any().any():
            issues["empty_strings"] = empty_mask.columns[empty_mask.any()].tolist()

            empty_rows = empty_mask.any(axis=1)
            bad_rows.update(empty_rows[empty_rows].index)

    # ---------------------------
    # READABILITY SCORE (ROW BASED)
    # ---------------------------
    bad_count = len(bad_rows)
    readability = ((total_rows - bad_count) / total_rows) * 100

    print(f"\n📊 Readability Score: {readability:.2f}%")

    # ---------------------------
    # DECISION LOGIC
    # ---------------------------
    if readability < 80:
        print("❌ Data is not readable. Please provide readable data.")

    elif readability >= 85:
        if issues:
            print("\n⚠️ Readability is high but decreasing due to:")
            for k, v in issues.items():
                print(f"- {k}: {v}")
        else:
            print("✅ Data is clean and readable.")

    else:
        print("⚠️ Data is moderately readable but needs improvement.")

    # ---------------------------
    # SAVE BAD DATA
    # ---------------------------
    if bad_rows:
        df.loc[list(bad_rows)].to_csv(output_bad_file, index=False)
        print(f"\n🧾 Bad data saved to: {output_bad_file}")
    else:
        print("\n🎉 No problematic rows found!")


# RUN
check_data_readability("messy_financial_ledger.csv")
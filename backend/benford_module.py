import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

def get_benford_analysis(df, column_name='Amount'):
    """
    Performs Benford's Law analysis on a specified column.
    Returns the digits, expected frequencies, and actual frequencies.
    """
    def get_first_digit(x):
        s = str(abs(x)).replace('.', '').lstrip('0')
        return int(s[0]) if s and s[0].isdigit() else None

    # Extract digits and calculate actual distribution
    digits_series = df[column_name].apply(get_first_digit).dropna()
    actual_counts = digits_series.value_counts(normalize=True).sort_index()
    
    digits = list(range(1, 10))
    expected = [np.log10(1 + 1/d) for d in digits]
    actual = [actual_counts.get(d, 0) for d in digits]
    
    return digits, expected, actual

def plot_benford(digits, expected, actual, save_path='benford_analysis.png'):
    """Generates and saves the Benford Law comparison chart."""
    plt.figure(figsize=(8, 5))
    plt.bar(np.array(digits) - 0.2, actual, width=0.4, label='Actual Distribution', color='#3498db')
    plt.plot(digits, expected, marker='o', color='#e74c3c', label="Benford's Law", linewidth=2)
    plt.title("Benford's Law: Digital Frequency Profiling")
    plt.xlabel('First Leading Digit')
    plt.ylabel('Frequency')
    plt.xticks(digits)
    plt.legend()
    plt.tight_layout()
    plt.savefig(save_path)
    plt.close()
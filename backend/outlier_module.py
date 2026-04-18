import pandas as pd
from sklearn.ensemble import IsolationForest
import matplotlib.pyplot as plt

def detect_outliers(df, contamination=0.01):
    """
    Trains an Isolation Forest and returns the dataframe with an 'Is_Outlier' column.
    -1 indicates an outlier, 1 indicates normal data.
    """
    # Preprocessing
    df_clean = df.copy()
    if 'Time' in df_clean.columns:
        df_clean['Hour'] = pd.to_datetime(df_clean['Time'], format='%H:%M').dt.hour
    
    features = ['Amount', 'Hour']
    X = df_clean[features].fillna(0)
    
    model = IsolationForest(contamination=contamination, random_state=42)
    df_clean['Is_Outlier'] = model.fit_predict(X)
    
    return df_clean

def plot_outliers(df, save_path='anomaly_scatter.png'):
    """Scatter plot highlighting outliers in red."""
    plt.figure(figsize=(8, 5))
    colors = df['Is_Outlier'].map({1: '#34495e', -1: '#e74c3c'})
    plt.scatter(df['Hour'], df['Amount'], c=colors, alpha=0.6, s=50)
    plt.title('Anomaly Detection: High-Risk Outliers (Red)')
    plt.xlabel('Hour of Day')
    plt.ylabel('Amount (₹)')
    plt.tight_layout()
    plt.savefig(save_path)
    plt.close()
import shap
from sklearn.ensemble import IsolationForest

# Assume 'X' is your preprocessed ledger data (amounts, categories, etc.)
model = IsolationForest(contamination=0.05).fit(X)

# Create an explainer
# SHAP KernelExplainer is model-agnostic and works for Isolation Forest
explainer = shap.KernelExplainer(model.decision_function, X.sample(100))
shap_values = explainer.shap_values(X.iloc[0:10])

# Summary Plot (Global Explainability)
shap.summary_plot(shap_values, X)
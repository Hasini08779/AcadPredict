import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
from xgboost import XGBClassifier
import joblib

# Load dataset
data = pd.read_csv("dataset.csv")

# Input features
X = data[["grade_score", "attendance", "assignment_submission"]]

# Target
y = data["risk_level"]

# Convert risk labels to numbers
risk_mapping = {
    "Low": 0,
    "Medium": 1,
    "High": 2
}

y = y.map(risk_mapping)

# Split dataset
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

# Create XGBoost model
model = XGBClassifier(
    n_estimators=100,
    max_depth=4,
    learning_rate=0.1,
    random_state=42,
    eval_metric="mlogloss"
)

# Train
model.fit(X_train, y_train)

# Predict
y_pred = model.predict(X_test)

# Accuracy
accuracy = accuracy_score(y_test, y_pred)

print("XGBoost model trained successfully!")
print(f"Accuracy: {accuracy * 100:.2f}%")

print("\nClassification Report:")
print(
    classification_report(
        y_test,
        y_pred,
        target_names=["Low", "Medium", "High"]
    )
)

# Save model
joblib.dump(model, "risk_prediction_xgboost.pkl")

# Save mapping for later use
joblib.dump(risk_mapping, "risk_mapping.pkl")

print("\nModel saved as risk_prediction_xgboost.pkl")
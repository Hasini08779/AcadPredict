import joblib
import pandas as pd

# Load the trained XGBoost model
model = joblib.load("risk_prediction_xgboost.pkl")

# Grade conversion
grade_scores = {
    "A+": 98,
    "A": 95,
    "A-": 90,
    "B+": 85,
    "B": 80,
    "B-": 75,
    "C+": 70,
    "C": 65,
    "D": 55,
    "F": 40
}

# Test student details
grade = "A"
attendance = 90
assignment_submission = 85

# Convert grade to score
grade_score = grade_scores[grade]

# Create input data
student_data = pd.DataFrame([{
    "grade_score": grade_score,
    "attendance": attendance,
    "assignment_submission": assignment_submission
}])

# Make prediction
prediction = model.predict(student_data)[0]

# Convert prediction number back to risk level
risk_levels = {
    0: "Low",
    1: "Medium",
    2: "High"
}

risk = risk_levels[int(prediction)]

print("Student Details")
print("----------------")
print(f"Grade: {grade}")
print(f"Attendance: {attendance}%")
print(f"Assignment Submission: {assignment_submission}%")

print("\nPredicted Risk:", risk)
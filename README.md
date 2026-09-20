# AcadPredict

## Student Performance Analysis and Risk Prediction using Machine Learning

AcadPredict is a machine learning-based web application that analyzes student performance using attendance, assignment submission, and subject grades. It predicts the student's academic risk level and provides useful insights to identify students who may need additional support.

## Features

* Student registration and login
* Student performance analysis
* Subject-wise performance prediction
* Overall risk percentage
* Risk levels: Low, Medium, and High
* Confidence score
* Identification of strong and weak subjects
* Risk factors and recommendations
* Faculty dashboard
* Admin dashboard
* MongoDB database

## Machine Learning

AcadPredict uses an **XGBoost machine learning model** for student risk prediction.

The model uses:

* Subject grades
* Attendance percentage
* Assignment submission percentage

The system provides an overall risk percentage, risk level, confidence score, and subject-wise predictions.

## Technologies Used

### Frontend

* React
* JavaScript
* HTML
* CSS
* Vite

### Backend

* Python
* Flask
* XGBoost
* Pandas
* Scikit-learn
* Joblib

### Database

* MongoDB

## Project Structure

```text
AcadPredict/
├── frontend/
├── backend/
│   └── ml/
├── .gitignore
├── README.md
└── REFACTORING_SUMMARY.md
```

## Purpose

The main purpose of AcadPredict is to use machine learning to identify academic risk at an early stage and provide meaningful insights for student performance monitoring.

## Future Enhancements

* Improved prediction models
* Detailed analytics and visualizations
* Additional student performance factors
* Personalized recommendations
* Online deployment

## Author

**Hasini Darsi**

B.Tech Computer Science and Engineering

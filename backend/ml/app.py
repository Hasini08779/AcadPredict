from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import joblib
from pymongo import MongoClient
from datetime import datetime
import os
import random
from dotenv import load_dotenv

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

# Load trained XGBoost model
model_path = os.path.join(os.path.dirname(__file__), "risk_prediction_xgboost.pkl")
model = joblib.load(model_path)

# MongoDB connection
mongo_uri = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017/")
client = MongoClient(mongo_uri)
db = client["acadpredict"]

students_collection = db["students"]
predictions_collection = db["predictions"]

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

# Risk mapping
risk_levels = {
    0: "Low",
    1: "Medium",
    2: "High"
}

MOCK_TEST_SUBJECTS = {
    "Python Programming",
    "Computer Networks",
    "Database Management",
    "Mathematics",
    "Operating System",
    "Data Structures",
}


def require_percentage(data, field):
    value = data.get(field)
    if value in (None, ""):
        raise ValueError(f"{field} is required")
    try:
        value = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field} must be a number")
    if value < 0 or value > 100:
        raise ValueError(f"{field} must be between 0 and 100")
    return value


def validate_academic_context(data):
    student_id = data.get("studentId")
    if not isinstance(student_id, str) or not student_id.strip():
        raise ValueError("studentId is required")
    student = students_collection.find_one({"student_id": student_id.strip()})
    if not student:
        raise ValueError("Student record was not found")
    validate_student_academic_data(student)
    subjects = data.get("subjects")
    names = {item.get("name") for item in subjects if isinstance(item, dict)} if isinstance(subjects, list) else set()
    if names != MOCK_TEST_SUBJECTS or len(subjects) != len(MOCK_TEST_SUBJECTS):
        raise ValueError("Complete academic subject data is required")
    for subject in subjects:
        if not isinstance(subject, dict) or not subject.get("name"):
            raise ValueError("Complete academic subject data is required")
        require_percentage(subject, "score")
        require_percentage(subject, "attendance")
        require_percentage(subject, "submission")
    require_percentage(data, "attendance")
    require_percentage(data, "assignmentSubmission")


def validate_student_academic_data(student):
    subjects = student.get("subjects") if isinstance(student, dict) else None
    if not isinstance(subjects, dict) or set(subjects) != MOCK_TEST_SUBJECTS:
        raise ValueError("Complete academic data is required")
    for name in MOCK_TEST_SUBJECTS:
        subject = subjects.get(name) or {}
        if subject.get("grade") not in grade_scores:
            raise ValueError("Complete academic data is required")
        require_percentage(subject, "submission")
        total = subject.get("totalClasses", subject.get("total_classes"))
        attended = subject.get("classesAttended", subject.get("classes_attended"))
        if total not in (None, "") or attended not in (None, ""):
            try:
                total = float(total)
                attended = float(attended)
            except (TypeError, ValueError):
                raise ValueError("Complete academic data is required")
            if total <= 0 or attended < 0 or attended > total:
                raise ValueError("Complete academic data is required")
        else:
            require_percentage(subject, "attendance")


def normalize_subjects(subjects):
    normalized = {}
    for name, source in (subjects or {}).items():
        subject = dict(source or {})
        total = subject.get("totalClasses", subject.get("total_classes"))
        attended = subject.get("classesAttended", subject.get("classes_attended"))

        if total not in (None, "") or attended not in (None, ""):
            try:
                total = float(total)
                attended = float(attended)
            except (TypeError, ValueError):
                raise ValueError(f"Invalid attendance totals for {name}")
            if total <= 0 or attended < 0 or attended > total:
                raise ValueError(f"Invalid attendance totals for {name}")
            attended = int(attended) if attended.is_integer() else attended
            total = int(total) if total.is_integer() else total
            subject["totalClasses"] = total
            subject["classesAttended"] = attended
            subject["classesMissed"] = total - attended
            subject["attendance"] = round(attended / total * 100)
        normalized[name] = subject
    return normalized


class AIServiceError(Exception):
    def __init__(self, message, public_message=None):
        super().__init__(message)
        self.public_message = public_message or message


LOCAL_QUESTIONS = {
    "Python Programming": [
        ("Which keyword defines a function in Python?", ["func", "def", "function", "lambda"], "def", "The def keyword starts a named function definition.", "Easy"),
        ("Which Python collection stores key-value pairs?", ["List", "Tuple", "Dictionary", "Set"], "Dictionary", "Dictionaries map keys to values.", "Easy"),
        ("What does len([1, 2, 3]) return?", ["2", "3", "4", "None"], "3", "There are three items in the list.", "Easy"),
        ("Which value represents an immutable sequence?", ["List", "Dictionary", "Tuple", "Set"], "Tuple", "Tuples cannot be changed after creation.", "Medium"),
        ("What is the result of 2 ** 3?", ["5", "6", "8", "9"], "8", "The exponent operator raises 2 to the third power.", "Easy"),
        ("Which block handles an exception?", ["try-except", "if-else", "for-in", "with-as"], "try-except", "A try-except block catches and handles exceptions.", "Easy"),
        ("What does range(3) produce?", ["1, 2, 3", "0, 1, 2", "0, 1, 2, 3", "3 only"], "0, 1, 2", "range(3) starts at zero and stops before three.", "Easy"),
        ("Which symbol starts a Python comment?", ["//", "#", "--", "/*"], "#", "Python uses # for single-line comments.", "Easy"),
        ("What is a reusable class instance called?", ["Object", "Module", "Package", "Iterator"], "Object", "An object is an instance created from a class.", "Medium"),
        ("Which function converts text to an integer?", ["str", "float", "int", "bool"], "int", "int converts a suitable value to an integer.", "Easy"),
    ],
    "Computer Networks": [
        ("Which protocol translates domain names to IP addresses?", ["DNS", "HTTP", "FTP", "SSH"], "DNS", "DNS resolves human-readable domain names.", "Easy"),
        ("Which device forwards packets between networks?", ["Switch", "Router", "Repeater", "Hub"], "Router", "A router connects and forwards traffic between networks.", "Easy"),
        ("What does TCP provide?", ["Unreliable delivery", "Reliable ordered delivery", "Only encryption", "Address translation"], "Reliable ordered delivery", "TCP uses acknowledgements and ordering for reliable delivery.", "Medium"),
        ("Which layer handles IP addressing in the OSI model?", ["Physical", "Transport", "Network", "Application"], "Network", "The Network layer handles logical addressing and routing.", "Medium"),
        ("What is the default port for HTTPS?", ["21", "53", "80", "443"], "443", "HTTPS commonly uses port 443.", "Easy"),
        ("Which protocol automatically assigns IP addresses?", ["DHCP", "DNS", "SMTP", "ARP"], "DHCP", "DHCP leases network configuration to clients.", "Easy"),
        ("What does bandwidth measure?", ["Delay only", "Data capacity per unit time", "Number of routers", "Signal direction"], "Data capacity per unit time", "Bandwidth is the maximum data rate of a connection.", "Easy"),
        ("Which address identifies a network interface locally?", ["MAC address", "URL", "Port", "Domain"], "MAC address", "A MAC address identifies a network interface at the link layer.", "Medium"),
        ("What does HTTP primarily transfer?", ["Web resources", "Power", "CPU instructions", "Database indexes"], "Web resources", "HTTP is used to request and transfer web resources.", "Easy"),
        ("Which topology connects every node to a central device?", ["Ring", "Bus", "Star", "Mesh"], "Star", "A star topology uses a central hub or switch.", "Easy"),
    ],
    "Database Management": [
        ("Which command retrieves rows from a SQL table?", ["INSERT", "SELECT", "UPDATE", "DELETE"], "SELECT", "SELECT reads data from one or more tables.", "Easy"),
        ("What is a primary key used for?", ["Allowing duplicate rows", "Uniquely identifying rows", "Encrypting data", "Sorting every query"], "Uniquely identifying rows", "A primary key uniquely identifies each record.", "Easy"),
        ("Which normal form removes repeating groups?", ["1NF", "2NF", "3NF", "BCNF"], "1NF", "First normal form requires atomic, non-repeating values.", "Medium"),
        ("What does a SQL JOIN combine?", ["Databases", "Rows from related tables", "Indexes only", "User accounts"], "Rows from related tables", "JOIN combines related rows using a matching condition.", "Easy"),
        ("Which constraint prevents NULL values?", ["UNIQUE", "CHECK", "NOT NULL", "DEFAULT"], "NOT NULL", "NOT NULL requires a value for the column.", "Easy"),
        ("Which SQL clause filters rows?", ["WHERE", "ORDER BY", "GROUP BY", "VALUES"], "WHERE", "WHERE keeps rows that satisfy a condition.", "Easy"),
        ("What is an index mainly used to improve?", ["Query lookup speed", "Table color", "Password length", "Column names"], "Query lookup speed", "Indexes can make searches faster at storage cost.", "Medium"),
        ("Which command changes existing rows?", ["ALTER", "UPDATE", "CREATE", "DROP"], "UPDATE", "UPDATE modifies values in existing records.", "Easy"),
        ("What does atomicity mean in a transaction?", ["All or nothing", "Always concurrent", "Only reading", "No constraints"], "All or nothing", "Atomic transactions fully succeed or fully roll back.", "Medium"),
        ("Which SQL clause sorts results?", ["SORT", "ORDER BY", "ARRANGE", "GROUP"], "ORDER BY", "ORDER BY sorts the returned rows.", "Easy"),
    ],
    "Mathematics": [
        ("What is the derivative of x^2?", ["x", "2x", "x^3", "2"], "2x", "The power rule gives 2x for x squared.", "Easy"),
        ("What is the value of 3/4 as a percentage?", ["25%", "50%", "75%", "80%"], "75%", "Three divided by four equals 0.75, or 75 percent.", "Easy"),
        ("What is the sum of the angles in a triangle?", ["90 degrees", "180 degrees", "270 degrees", "360 degrees"], "180 degrees", "Every Euclidean triangle has an angle sum of 180 degrees.", "Easy"),
        ("If f(x)=2x+1, what is f(3)?", ["5", "6", "7", "8"], "7", "Substitute 3: 2 times 3 plus 1 equals 7.", "Easy"),
        ("What is the probability of heads on a fair coin?", ["0", "1/4", "1/2", "1"], "1/2", "A fair coin has two equally likely outcomes.", "Easy"),
        ("What is the area of a rectangle 4 by 5?", ["9", "16", "20", "25"], "20", "Area equals length times width: 4 times 5.", "Easy"),
        ("What is the next prime after 7?", ["8", "9", "10", "11"], "11", "Eleven is the next number greater than 7 with only two factors.", "Easy"),
        ("What is the square root of 81?", ["7", "8", "9", "10"], "9", "Nine multiplied by nine equals 81.", "Easy"),
        ("Solve 2x = 10.", ["2", "4", "5", "8"], "5", "Divide both sides by 2 to get x equals 5.", "Easy"),
        ("What is the mean of 2, 4, and 6?", ["3", "4", "5", "6"], "4", "The sum is 12 and there are 3 values, so the mean is 4.", "Easy"),
    ],
    "Operating System": [
        ("Which component manages processes and hardware resources?", ["Compiler", "Kernel", "Browser", "Database"], "Kernel", "The kernel is the core resource manager of an operating system.", "Easy"),
        ("What does virtual memory use to extend RAM?", ["CPU cache", "Disk storage", "ROM", "GPU memory"], "Disk storage", "Virtual memory uses disk space when RAM is insufficient.", "Medium"),
        ("Which scheduling algorithm uses time slices?", ["FCFS", "Round Robin", "SJF", "Priority only"], "Round Robin", "Round Robin gives each ready process a time quantum.", "Easy"),
        ("A deadlock requires which condition?", ["Mutual exclusion", "Compilation", "Paging only", "Caching"], "Mutual exclusion", "Mutual exclusion is one of the necessary deadlock conditions.", "Medium"),
        ("What is a process?", ["A program in execution", "A file extension", "A hardware cable", "A database row"], "A program in execution", "A process is a running instance of a program.", "Easy"),
        ("Which memory is closest to the CPU?", ["Cache", "Hard disk", "USB drive", "Optical disk"], "Cache", "Cache memory is small and very close to the processor.", "Easy"),
        ("What does a context switch change?", ["Running process", "File format", "IP address", "Screen size"], "Running process", "The OS saves one process state and loads another.", "Medium"),
        ("Which technique divides memory into fixed-size blocks?", ["Paging", "Compiling", "Routing", "Spooling"], "Paging", "Paging divides virtual memory into fixed-size pages and frames.", "Medium"),
        ("What is an interrupt?", ["A signal needing CPU attention", "A database table", "A disk partition", "A source-code comment"], "A signal needing CPU attention", "Interrupts notify the processor that an event needs service.", "Easy"),
        ("Which state means a process is waiting for CPU time?", ["Ready", "Running", "Terminated", "Booted"], "Ready", "A ready process can run when the scheduler assigns the CPU.", "Easy"),
    ],
    "Data Structures": [
        ("Which structure follows LIFO order?", ["Queue", "Stack", "Graph", "Heap"], "Stack", "A stack removes the most recently added item first.", "Easy"),
        ("Which structure follows FIFO order?", ["Stack", "Tree", "Queue", "Set"], "Queue", "A queue removes the earliest added item first.", "Easy"),
        ("What is the average lookup time in a hash table?", ["O(1)", "O(log n)", "O(n)", "O(n^2)"], "O(1)", "With a good hash function, lookup is constant time on average.", "Medium"),
        ("Which traversal visits a tree root before its children?", ["In-order", "Post-order", "Pre-order", "Level-only"], "Pre-order", "Pre-order traversal visits root, then left and right subtrees.", "Easy"),
        ("What does a linked-list node usually contain?", ["Only an index", "Data and a link", "Only a key", "A SQL query"], "Data and a link", "Each node stores its data and a reference to another node.", "Easy"),
        ("What is the worst-case search time in an unsorted array?", ["O(1)", "O(log n)", "O(n)", "O(n log n)"], "O(n)", "A linear scan may inspect every element.", "Easy"),
        ("Which tree has at most two children per node?", ["Binary tree", "B-tree", "Trie", "Graph"], "Binary tree", "A binary tree allows zero, one, or two children.", "Easy"),
        ("Which algorithm finds shortest paths with nonnegative weights?", ["Dijkstra's", "Kruskal's", "Binary search", "Linear search"], "Dijkstra's", "Dijkstra's algorithm handles nonnegative edge weights.", "Medium"),
        ("What is the purpose of a stack in recursion?", ["Store active calls", "Sort keys", "Connect networks", "Compress images"], "Store active calls", "The call stack tracks active function invocations.", "Medium"),
        ("Which structure is best for priority-based removal?", ["Heap", "Queue", "Array", "Linked list"], "Heap", "A heap efficiently exposes the highest or lowest priority item.", "Medium"),
    ],
}


def local_recommendations(data):
    recommendations = []
    seen = set()
    attendance = data.get("attendance")
    assignments = data.get("assignmentSubmission")
    risk = str(data.get("riskLevel") or "").lower()
    risk_percentage = data.get("riskPercentage")
    performance = data.get("performance")
    performance_status = str(data.get("performanceStatus") or "").lower()
    subjects = data.get("subjects") or []
    weak_subjects = data.get("weakSubjects") or []

    def add_recommendation(category, title, explanation, action, key):
        normalized_key = key.lower().strip()
        if normalized_key in seen:
            return
        seen.add(normalized_key)
        recommendations.append({
            "category": category,
            "title": title,
            "explanation": explanation,
            "action": action,
        })

    if risk == "high":
        add_recommendation("Risk", "High Risk - Take Action", "Use a structured daily study plan and review progress each week.", "Monitor", "risk-high")
    elif risk == "medium":
        add_recommendation("Risk", "Monitor Academic Risk", "Use short daily revision sessions to prevent small gaps from growing.", "Monitor", "risk-medium")
    if isinstance(risk_percentage, (int, float)) and risk_percentage >= 60 and risk != "high":
        add_recommendation("Risk", "Monitor Risk Indicator", f"Your risk indicator is {round(risk_percentage)}%; check your highest-priority work regularly.", "Monitor", "risk-indicator")
    for subject in weak_subjects[:3]:
        name = subject.get("name") if isinstance(subject, dict) else str(subject)
        score = subject.get("score") if isinstance(subject, dict) else None
        score_text = f"Current score: {round(score)}%. " if isinstance(score, (int, float)) else ""
        add_recommendation("Weak Subject", f"Focus on {name}", f"{score_text}Give this subject additional practice and revision.", "Focus", f"weak-subject:{name}")
    if isinstance(attendance, (int, float)) and attendance < 75:
        add_recommendation("Attendance", "Improve Attendance", f"Your attendance is {round(attendance)}%. Plan regular class attendance and review missed lessons.", "Improve", "attendance")
    if isinstance(assignments, (int, float)) and assignments < 60:
        add_recommendation("Assignments", "Complete Assignments", f"Your submission progress is {round(assignments)}%. Finish pending work before the next review.", "Improve", "assignments")
    if performance_status in ("strong", "excellent") or (isinstance(performance, (int, float)) and performance >= 80):
        add_recommendation("Strong Performance", "Maintain Strong Performance", "Maintain your overall performance with weekly revision and timed practice.", "Maintain", "overall-strong")
    strong_subjects = [subject for subject in data.get("strongSubjects") or [] if isinstance(subject, dict) and subject.get("name")]
    if strong_subjects:
        name = strong_subjects[0]["name"]
        add_recommendation("Strong Subject", f"Maintain {name}", "Your performance is strong. Continue with light weekly revision.", "Maintain", f"strong-subject:{name}")
    if not recommendations:
        add_recommendation("Study Planning", "Build a Consistent Routine", "Review each subject weekly and keep a steady study schedule.", "Maintain", "general-maintenance")
    return {"recommendations": recommendations}


def local_timetable(data):
    subjects = [item for item in data.get("subjects", []) if isinstance(item, dict) and item.get("name")]
    risk = str(data.get("riskLevel") or "").lower()
    risk_percentage = data.get("riskPercentage")
    overall_attendance = data.get("attendance")
    assignment_submission = data.get("assignmentSubmission")
    risk_percentage = float(risk_percentage) if risk_percentage not in (None, "") else 0
    overall_attendance = float(overall_attendance) if overall_attendance not in (None, "") else None
    assignment_submission = float(assignment_submission) if assignment_submission not in (None, "") else None
    risk_weight = {"high": 3, "medium": 2, "low": 1}.get(risk, 1)
    risk_factors = [str(factor).lower() for factor in data.get("riskFactors", []) if factor]

    def numeric(value, fallback=None):
        if value in (None, ""):
            return fallback
        try:
            return float(value)
        except (TypeError, ValueError):
            return fallback

    def priority(item):
        score = numeric(item.get("score"), 100)
        subject_attendance = numeric(item.get("attendance"), overall_attendance if overall_attendance is not None else 100)
        subject_submission = numeric(item.get("submission"), assignment_submission if assignment_submission is not None else 100)
        subject_name = str(item["name"]).lower()
        factor_bonus = 20 if any(subject_name in factor for factor in risk_factors) else 0
        return ((100 - score) * 1.2
                + (100 - subject_attendance) * 0.8
                + (100 - subject_submission) * 0.6
                + factor_bonus
                + risk_weight * 5
                + risk_percentage * 0.1)

    subjects.sort(key=priority, reverse=True)
    if not subjects:
        raise ValueError("Complete academic subject data is required")
    focus_subjects = subjects
    focus = [item["name"] for item in focus_subjects for _ in range(max(1, min(4, int(priority(item) // 25))))]
    intensive = risk == "high" or risk_percentage >= 60
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    slots = ["06:30 - 07:00", "17:00 - 18:00", "18:15 - 19:15", "19:30 - 20:00", "20:15 - 21:00"]
    timetable = []
    for slot_index, slot in enumerate(slots):
        row = {"time": slot}
        for day_index, day in enumerate(days):
            if slot_index == 0:
                subject = focus[(day_index + slot_index) % len(focus)]
                activity = ("Priority Revision: " if intensive or day_index < 3 else "Quick Review: ") + subject
            elif slot_index == 3:
                activity = "Break and reflect"
            elif slot_index == 4 and day_index in (5, 6):
                activity = "Mock Test: " + focus[(day_index + slot_index) % len(focus)]
            elif slot_index == 4:
                item = focus_subjects[(day_index + slot_index) % len(focus_subjects)]
                score = numeric(item.get("score"), 100)
                submission = numeric(item.get("submission"), assignment_submission if assignment_submission is not None else 100)
                activity = ("Assignment Completion: " if submission < 60 else "Revision: ") + item["name"]
            elif slot_index == 2:
                item = focus_subjects[(day_index + slot_index) % len(focus_subjects)]
                attendance_value = numeric(item.get("attendance"), overall_attendance if overall_attendance is not None else 100)
                activity = ("Concept Review: " if attendance_value < 75 else "Practice Questions: ") + item["name"]
            else:
                item = focus_subjects[(day_index + slot_index * 2) % len(focus_subjects)]
                activity = ("Priority Revision: " if priority(item) >= 45 else "Concept Review: ") + item["name"]
            row[day] = activity
        timetable.append(row)
    return {"timetable": timetable}


def local_mock_test(subject):
    bank = LOCAL_QUESTIONS[subject].copy()
    random.shuffle(bank)
    questions = []
    for index, item in enumerate(bank):
        question, options, answer, explanation, difficulty = item
        shuffled_options = options.copy()
        random.shuffle(shuffled_options)
        questions.append({
            "question": question,
            "options": shuffled_options,
            "answer": answer,
            "explanation": explanation,
            "difficulty": difficulty,
        })
    return {"questions": questions}


def get_json_body():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ValueError("Request body must be valid JSON")
    return data


def require_text(data, field):
    value = data.get(field)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} is required")
    return value.strip()


def require_mock_subject(data):
    subject = require_text(data, "subject")
    if subject not in MOCK_TEST_SUBJECTS:
        raise ValueError("subject must be one of the supported academic subjects")
    return subject


def validate_timetable(result):
    timetable = result.get("timetable")
    if not isinstance(timetable, list) or not timetable:
        raise AIServiceError("AI service returned an invalid timetable")
    for row in timetable:
        if not isinstance(row, dict) or not isinstance(row.get("time"), str):
            raise AIServiceError("AI service returned an invalid timetable")
        if any(not isinstance(row.get(day), str) for day in [
            "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
        ]):
            raise AIServiceError("AI service returned an invalid timetable")
    return {"timetable": timetable}


def validate_mock_test(result):
    questions = result.get("questions")
    if not isinstance(questions, list) or len(questions) != 10:
        raise AIServiceError("AI service returned an invalid mock test")
    for item in questions:
        if not isinstance(item, dict):
            raise AIServiceError("AI service returned an invalid mock test")
        if not all(isinstance(item.get(field), str) and item[field].strip() for field in [
            "question", "answer", "explanation", "difficulty"
        ]):
            raise AIServiceError("AI service returned an invalid mock test")
        if not isinstance(item.get("options"), list) or len(item["options"]) != 4:
            raise AIServiceError("AI service returned an invalid mock test")
        if any(not isinstance(option, str) or not option.strip() for option in item["options"]):
            raise AIServiceError("AI service returned an invalid mock test")
        if item["answer"] not in item["options"]:
            raise AIServiceError("AI service returned an invalid mock test")
    return {"questions": questions}


def ai_error_response(error):
    app.logger.error("AI request failed: %s", error)
    if isinstance(error, ValueError):
        return jsonify({"error": str(error)}), 400
    if isinstance(error, AIServiceError):
        return jsonify({"error": error.public_message}), 503
    return jsonify({"error": "Unable to process the AI request."}), 500


@app.route("/ai/timetable", methods=["POST"])
def generate_timetable():
    try:
        data = get_json_body()
        validate_academic_context(data)
        return jsonify(validate_timetable(local_timetable(data)))
    except Exception as error:
        return ai_error_response(error)


@app.route("/ai/recommendations", methods=["POST"])
def generate_recommendations():
    try:
        data = get_json_body()
        validate_academic_context(data)
        return jsonify(local_recommendations(data))
    except Exception as error:
        return ai_error_response(error)


@app.route("/ai/mock-test", methods=["POST"])
def generate_mock_test():
    try:
        data = get_json_body()
        validate_academic_context(data)
        subject = require_mock_subject(data)
        return jsonify(validate_mock_test(local_mock_test(subject)))
    except Exception as error:
        return ai_error_response(error)


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "ACAD PREDICT ML API is running",
        "database": "MongoDB"
    })


@app.route("/db-test", methods=["GET"])
def db_test():
    try:
        client.admin.command("ping")

        return jsonify({
            "success": True,
            "message": "MongoDB connected successfully",
            "database": "acadpredict"
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()

        if not isinstance(data, dict):
            raise ValueError("Request body must be valid JSON")
        grade = data.get("grade")
        if not isinstance(grade, str) or not grade.strip():
            raise ValueError("grade is required")
        grade = grade.strip()
        attendance = require_percentage(data, "attendance")
        assignment_submission = require_percentage(data, "assignment_submission")

        if grade not in grade_scores:
            return jsonify({
                "error": "Invalid grade"
            }), 400

        grade_score = grade_scores[grade]

        student_data = pd.DataFrame([{
            "grade_score": grade_score,
            "attendance": attendance,
            "assignment_submission": assignment_submission
        }])

        prediction = model.predict(student_data)[0]

        risk = risk_levels[int(prediction)]

        return jsonify({
            "grade": grade,
            "score": round(grade_score * 0.5 + attendance * 0.25 + assignment_submission * 0.25),
            "attendance": attendance,
            "assignment_submission": assignment_submission,
            "risk_level": risk
        })

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500


@app.route("/students", methods=["POST"])
def add_student():
    try:
        data = request.get_json()

        student = {
            "student_id": data["student_id"],
            "name": data["name"],
            "status": data.get("status", "Active"),
            "department": data.get("department"),
            "semester": data.get("semester"),
            "subjects": normalize_subjects(data.get("subjects", {})),
        }

        students_collection.update_one(
            {"student_id": student["student_id"]},
            {
                "$set": student,
                "$setOnInsert": {"created_at": datetime.utcnow()},
                "$unset": {"year": ""},
            },
            upsert=True
        )
        predictions_collection.delete_many({"student_id": student["student_id"]})

        saved_student = students_collection.find_one(
            {"student_id": student["student_id"]},
            {"_id": 0},
        )

        return jsonify({
            "success": True,
            "message": "Student saved successfully",
            "student": saved_student,
        }), 201

    except ValueError as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route("/students", methods=["GET"])
def get_students():
    try:
        students = list(
            students_collection.find({}, {"_id": 0})
            .sort("created_at", -1)
        )

        return jsonify(students)

    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500


@app.route("/students/<student_id>", methods=["DELETE"])
def delete_student(student_id):
    try:
        if not student_id.strip():
            return jsonify({"success": False, "error": "student_id is required"}), 400

        result = students_collection.delete_one({"student_id": student_id})
        if result.deleted_count != 1:
            return jsonify({"success": False, "error": "Student record was not found"}), 404

        predictions_collection.delete_many({"student_id": student_id})
        return jsonify({"success": True, "student_id": student_id}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/predictions", methods=["POST"])
def save_prediction():
    try:
        data = request.get_json()
        if not isinstance(data, dict) or not data.get("student_id"):
            raise ValueError("student_id is required")
        student = students_collection.find_one({"student_id": data["student_id"]})
        if not student:
            raise ValueError("Student record was not found")
        validate_student_academic_data(student)

        prediction = {
            "student_id": data["student_id"],
            "student_name": data.get("student_name", ""),
            "semester": data.get("semester"),
            "risk_level": data["risk_level"],
            "performance": data.get("performance", ""),
            "confidence": data.get("confidence", 0),
            "subject_results": data.get("subject_results", []),
            "weak_subjects": data.get("weak_subjects", []),
            "factors": data.get("factors", []),
            "overall_score": data.get("overall_score", 0),
            "performance_status": data.get("performance_status", ""),
            "risk_percentage": data.get("risk_percentage", 0),
            "recommendations": data.get("recommendations", []),
            "strong_subjects": data.get("strong_subjects", []),
            "created_at": datetime.utcnow()
        }

        predictions_collection.insert_one(prediction)

        return jsonify({
            "success": True,
            "message": "Prediction saved successfully"
        }), 201

    except ValueError as e:
        return jsonify({"success": False, "error": str(e)}), 400
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route("/predictions", methods=["GET"])
def get_predictions():
    try:
        predictions = list(
            predictions_collection.find({}, {"_id": 0})
            .sort("created_at", -1)
        )

        return jsonify(predictions)

    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500


if __name__ == "__main__":
    flask_debug = os.getenv("FLASK_DEBUG", "false").lower() in {"1", "true", "yes"}
    app.run(
        host="0.0.0.0",
        port=5001,
        debug=flask_debug
    )
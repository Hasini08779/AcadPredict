import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getAuthenticatedUser, logout as authLogout } from "../auth";
import { getAttendanceSummary, getSubjectAttendance } from "../attendance";
import { fetchStudents, getAcademicDataStatus, getAssignmentSummary, getPerformanceStatus, getPerformanceStatusClass, getRiskFactors, getStudentPerformance, getWeakSubjects, notifyStudentsUpdated, STUDENTS_UPDATED_EVENT } from "../studentData";
import AdminPredictionInsights from "./adminPredictionInsights";

const SUBJECTS = [
  "Python Programming",
  "Computer Networks",
  "Database Management",
  "Mathematics",
  "Operating System",
  "Data Structures",
];

const GRADE_SCORES = {
  "A+": 98,
  A: 95,
  "A-": 90,
  "B+": 85,
  B: 80,
  "B-": 75,
  "C+": 70,
  C: 65,
  D: 55,
  F: 40,
};

function calculateGrade(attendance, submission) {
  if (attendance === "" || submission === "" || attendance == null || submission == null) return "";
  if (!Number.isFinite(Number(attendance)) || !Number.isFinite(Number(submission))) return "";
  const average = (Number(attendance) + Number(submission)) / 2;
  return Object.entries(GRADE_SCORES).find(([, score]) => average >= score)?.[0] || "F";
}

function mapSavedPrediction(prediction) {
  return {
    studentName: prediction.student_name,
    studentId: prediction.student_id,
    riskLevel: prediction.risk_level,
    performance: prediction.performance,
    performanceStatus: getPerformanceStatus(prediction.overall_score),
    confidence: prediction.confidence,
    overallScore: prediction.overall_score,
    riskPercent: prediction.risk_percentage,
    subjectResults: prediction.subject_results || [],
    factors: prediction.factors || [],
    weakSubjects: prediction.weak_subjects || [],
    strongSubjects: prediction.strong_subjects || [],
    recommendations: prediction.recommendations || [],
    timestamp: prediction.created_at || prediction.timestamp || null,
  };
}

function getPredictionTime(prediction) {
  const time = new Date(prediction.timestamp || prediction.created_at || 0).getTime();
  return Number.isNaN(time) ? 0 : time;
}

const ADMIN_SECTIONS = [
  { key: "dashboard", label: "Dashboard", icon: "⌂" },
  { key: "students", label: "Students", icon: "👥" },
  { key: "prediction", label: "Prediction Center", icon: "▶" },
  { key: "history", label: "Prediction History", icon: "🕘" },
  { key: "insights", label: "AI Prediction Insights", icon: "◒" },
  { key: "settings", label: "Settings", icon: "⚙" },
];

function createSubjects(data = {}) {
  return SUBJECTS.reduce((result, subject) => {
    const source = data[subject] || {};
    const attendanceRecord = getSubjectAttendance(source);
    const attendance = attendanceRecord.percentage ?? (source.attendance == null || source.attendance === "" ? "" : Number(source.attendance));
    const submission = source.submission == null || source.submission === "" ? "" : Number(source.submission);
    result[subject] = {
      grade: source.grade || calculateGrade(attendance, submission),
      attendance,
      submission,
      totalClasses: attendanceRecord.totalClasses,
      classesAttended: attendanceRecord.classesAttended,
      classesMissed: attendanceRecord.classesMissed,
    };
    return result;
  }, {});
}

function buildNewStudent() {
  return {
    id: `STU${Math.floor(1000 + Math.random() * 9000)}`,
    name: "",
    status: "Active",
    department: "",
    semester: "",
    subjects: createSubjects(),
  };
}

function AdminDashboard() {
useEffect(() => {
  const loadStudents = async () => {
    try {
      const data = await fetchStudents();

      const formattedStudents = data
        .map((student) => ({
          id: student.student_id,
          name: student.name,
          status: student.status || "Active",
          department: student.department ?? null,
          semester: student.semester ?? null,
          subjects: createSubjects(student.subjects),
          createdAt: student.createdAt || student.created_at || null,
        }));

      setStudents(formattedStudents);

    } catch (error) {
      console.error("Error loading students:", error);
    }
  };

  loadStudents();
  window.addEventListener(STUDENTS_UPDATED_EVENT, loadStudents);
  const refreshTimer = window.setInterval(loadStudents, 5000);

  return () => {
    window.removeEventListener(STUDENTS_UPDATED_EVENT, loadStudents);
    window.clearInterval(refreshTimer);
  };
}, []);
  const navigate = useNavigate();
  const user = getAuthenticatedUser();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState(location.pathname === "/admin/insights" ? "insights" : "dashboard");
  const [students, setStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedHistoryStudentId, setSelectedHistoryStudentId] = useState("");
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [attendanceErrors, setAttendanceErrors] = useState({});
  const [studentForm, setStudentForm] = useState(buildNewStudent());
  const [predictionResult, setPredictionResult] = useState(null);
  const [predictionHistory, setPredictionHistory] = useState({});

  useEffect(() => {
    const loadPredictions = async () => {
      try {
        const response = await fetch("http://127.0.0.1:5001/predictions");

        if (!response.ok) {
          throw new Error("Failed to load predictions");
        }

        const predictions = await response.json();
        const historyByStudent = {};

        predictions.forEach((prediction) => {
          const mappedPrediction = mapSavedPrediction(prediction);
          const studentHistory = historyByStudent[mappedPrediction.studentId] || [];
          historyByStudent[mappedPrediction.studentId] = [
            ...studentHistory,
            mappedPrediction,
          ].sort((a, b) => getPredictionTime(b) - getPredictionTime(a));
        });

        setPredictionHistory(historyByStudent);
      } catch (error) {
        console.error("Admin predictions error:", error);
      }
    };

    loadPredictions();
    const refreshTimer = window.setInterval(loadPredictions, 5000);

    return () => window.clearInterval(refreshTimer);
  }, []);

  const handleLogout = () => {
    authLogout();
    navigate("/login");
  };

  const attendanceRows = useMemo(
    () =>
      students.map((student) => {
        const attendanceSummary = getAttendanceSummary(student, SUBJECTS);

        return {
          ...student,
          ...attendanceSummary,
        };
      }),
    [students]
  );

  const summary = useMemo(() => {
    const riskCounts = { Low: 0, Medium: 0, High: 0 };
    const latestPredictions = [];
    const performanceValues = [];
    const assignmentValues = [];
    const riskPercentageValues = [];

    students.forEach((student) => {
      if (!getAcademicDataStatus(student).complete) return;

      const performance = getStudentPerformance(student);
      if (Number.isFinite(performance)) performanceValues.push(performance);

      const assignmentPercentage = getAssignmentSummary(student).percentage;
      if (Number.isFinite(assignmentPercentage)) assignmentValues.push(assignmentPercentage);

      const history = predictionHistory[student.id] || [];
      const latestPrediction = history[0];

      if (latestPrediction && ["Low", "Medium", "High"].includes(latestPrediction.riskLevel)) {
        latestPredictions.push(latestPrediction);
        riskCounts[latestPrediction.riskLevel] =
          (riskCounts[latestPrediction.riskLevel] || 0) + 1;
        if (Number.isFinite(latestPrediction.riskPercent)) riskPercentageValues.push(latestPrediction.riskPercent);
      }
    });

    const totalPredictions = Object.values(predictionHistory).reduce(
      (total, history) => total + history.length,
      0
    );

    const average = (values) => values.length
      ? Math.round(values.reduce((total, value) => total + value, 0) / values.length)
      : null;

    return {
      total: students.length,
      low: riskCounts.Low,
      medium: riskCounts.Medium,
      high: riskCounts.High,
      totalPredictions,
      validPredictionCount: latestPredictions.length,
      averagePerformance: average(performanceValues),
      averageRiskPercent: average(riskPercentageValues),
      averageAssignmentSubmission: average(assignmentValues),
    };
  }, [students, predictionHistory]);

  const riskDistribution = useMemo(() => {
    const total = summary.low + summary.medium + summary.high;

    return [
      {
        label: "Low Risk",
        value: summary.low,
        percent: total ? Math.round((summary.low / total) * 100) : null,
        tone: "low",
      },
      {
        label: "Medium Risk",
        value: summary.medium,
        percent: total ? Math.round((summary.medium / total) * 100) : null,
        tone: "medium",
      },
      {
        label: "High Risk",
        value: summary.high,
        percent: total ? Math.round((summary.high / total) * 100) : null,
        tone: "high",
      },
    ];
  }, [summary]);

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch =
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === "all" || student.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [students, searchTerm, statusFilter]);

  const selectedStudent =
    students.find((student) => student.id === selectedStudentId) || null;

  const selectedStudentAttendance =
    attendanceRows.find((student) => student.id === selectedStudentId) || null;

  const selectedHistoryStudent =
    students.find((student) => student.id === selectedHistoryStudentId) || null;

  const selectedHistory = predictionHistory[selectedHistoryStudentId] || [];

  const latestHistory = selectedHistory[0] || null;

  const riskTrend = useMemo(() => {
    const history = predictionHistory[selectedHistoryStudentId] || [];
    if (history.length < 2) return "Stable";
    const first = history.at(-1).riskLevel;
    const last = history[0].riskLevel;
    const riskValues = { Low: 1, Medium: 2, High: 3 };
    if (riskValues[last] < riskValues[first]) return "Improving";
    if (riskValues[last] > riskValues[first]) return "Worsening";
    return "Stable";
  }, [predictionHistory, selectedHistoryStudentId]);

  const setSection = (key) => {
    setActiveSection(key);
    setPredictionResult(null);
  };

  const openAddStudent = () => {
    setEditingStudent(null);
    setStudentForm(buildNewStudent());
    setAttendanceErrors({});
    setShowStudentForm(true);
  };

  const openEditStudent = (student) => {
    setEditingStudent(student);
    setStudentForm({
      ...student,
      subjects: createSubjects(student.subjects),
    });
    setAttendanceErrors({});
    setShowStudentForm(true);
  };

  const closeStudentForm = () => {
    setShowStudentForm(false);
    setEditingStudent(null);
  };

  const handleStudentFormChange = (field, value) => {
    setStudentForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubjectChange = (subject, field, value) => {
    setStudentForm((prev) => {
      const previousSubject = prev.subjects[subject];
      const nextSubject = {
        ...previousSubject,
        [field]: field === "attendance" || field === "submission" || field === "totalClasses" || field === "classesAttended"
          ? value === "" ? "" : Number(value)
          : value,
      };
      const attendanceRecord = getSubjectAttendance(nextSubject);
      const hasAnyClassValue = nextSubject.totalClasses !== "" || nextSubject.classesAttended !== "";
      const nextAttendance = hasAnyClassValue
        ? attendanceRecord.percentage ?? ""
        : previousSubject.attendance;
      return {
        ...prev,
        subjects: {
          ...prev.subjects,
          [subject]: {
            ...nextSubject,
            attendance: value === "" && field === "attendance"
              ? ""
              : Number.isFinite(nextAttendance) ? nextAttendance : "",
            classesMissed: attendanceRecord.classesMissed,
            grade: calculateGrade(
              value === "" && field === "attendance" ? "" : nextAttendance,
              field === "submission" ? value : previousSubject.submission,
            ),
          },
        },
      };
    });

    const nextSubject = {
      ...studentForm.subjects[subject],
      [field]: value === "" ? "" : Number(value),
    };
    const total = Number(nextSubject.totalClasses);
    const attended = Number(nextSubject.classesAttended);
    const hasAnyClassValue = nextSubject.totalClasses !== "" || nextSubject.classesAttended !== "";
    const error = hasAnyClassValue && (!Number.isFinite(total) || total < 0 || !Number.isFinite(attended) || attended < 0 || attended > total)
      ? attended > total ? "Classes attended cannot exceed total classes." : "Enter valid class totals."
      : "";
    setAttendanceErrors((previous) => ({ ...previous, [subject]: error }));
  };

  const handleSaveStudent = async (event) => {
    event.preventDefault();

    if (!studentForm.name.trim()) {
      alert("Please enter student name");
      return;
    }

    const updatedStudent = {
      ...studentForm,
      name: studentForm.name.trim(),
      subjects: createSubjects(studentForm.subjects),
    };
    const invalidAttendance = Object.values(updatedStudent.subjects).some((subject) => {
      const hasAnyValue = subject.totalClasses != null || subject.classesAttended != null;
      return hasAnyValue && (subject.totalClasses == null || subject.classesAttended == null);
    });
    if (Object.values(attendanceErrors).some(Boolean) || invalidAttendance) {
      alert("Please correct the attendance values before saving.");
      return;
    }
try {
  const response = await fetch("http://127.0.0.1:5001/students", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      student_id: updatedStudent.id,
      name: updatedStudent.name,
      status: updatedStudent.status,
      department: updatedStudent.department,
      semester: updatedStudent.semester,
      subjects: updatedStudent.subjects,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to save student");
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || "Failed to save student");
  }

  const savedStudent = {
    ...updatedStudent,
    createdAt: result.student?.created_at || result.student?.createdAt || updatedStudent.createdAt || null,
  };

  alert("Student data saved successfully!");

} catch (error) {
  console.error("Student save error:", error);
  alert("Unable to save student to MongoDB.");
  return;
}

    if (editingStudent) {
      setStudents((prev) =>
        prev.map((student) =>
          student.id === editingStudent.id ? savedStudent : student
        )
      );
    } else {
      setStudents((prev) => [savedStudent, ...prev]);
      setSelectedStudentId(savedStudent.id);
      setSelectedHistoryStudentId(savedStudent.id);
    }

    notifyStudentsUpdated();

    closeStudentForm();
  };

  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm("Remove this student from the list?")) return;

    try {
      const response = await fetch(`http://127.0.0.1:5001/students/${encodeURIComponent(studentId)}`, {
        method: "DELETE",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to delete student");
      }

      setStudents((prev) => prev.filter((student) => student.id !== studentId));

      setPredictionHistory((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });

      if (studentId === selectedStudentId) setSelectedStudentId("");
      if (studentId === selectedHistoryStudentId) setSelectedHistoryStudentId("");
      setPredictionResult(null);
      notifyStudentsUpdated();
    } catch (error) {
      console.error("Student delete error:", error);
      alert(error.message || "Unable to delete student. The student was not removed.");
    }
  };

  const handleRunPrediction = async () => {
    if (!selectedStudent) return;
    const academicData = getAcademicDataStatus(selectedStudent);
    if (!academicData.complete) {
      alert("Complete all academic data before running a prediction.");
      return;
    }

    try {
      const subjectResults = [];

      for (const subject of SUBJECTS) {
        const data = selectedStudent.subjects[subject];

        const response = await fetch("http://127.0.0.1:5001/predict", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            grade: data.grade,
            attendance: Number(data.attendance),
            assignment_submission: Number(data.submission),
          }),
        });

        if (!response.ok) {
          throw new Error("Prediction API failed");
        }

        const result = await response.json();

        subjectResults.push({
          subject,
          riskLevel: result.risk_level,
          grade: data.grade,
          attendance: Number(data.attendance),
          submission: Number(data.submission),
          score: Number(result.score),
        });
      }

      const highCount = subjectResults.filter(
        (item) => item.riskLevel === "High"
      ).length;

      const mediumCount = subjectResults.filter(
        (item) => item.riskLevel === "Medium"
      ).length;

      let overallRisk = "Low";

      if (highCount >= 2) {
        overallRisk = "High";
      } else if (highCount >= 1 || mediumCount >= 2) {
        overallRisk = "Medium";
      }

      const prediction = {
        studentName: selectedStudent.name,
        studentId: selectedStudent.id,
        riskLevel: overallRisk,
        overallScore: Math.round(
          subjectResults.reduce((sum, item) => sum + item.score, 0) /
            subjectResults.length
        ),
        performance:
          overallRisk === "High"
            ? "Needs Improvement"
            : overallRisk === "Medium"
            ? "Moderate"
            : "Strong",
        performanceStatus:
          subjectResults.reduce((sum, item) => sum + item.score, 0) /
            subjectResults.length >= 80
            ? "Strong"
            : subjectResults.reduce((sum, item) => sum + item.score, 0) /
                subjectResults.length >= 60
            ? "Moderate"
            : "Needs Improvement",
        confidence: 90,
        riskPercent:
          overallRisk === "High"
            ? 100
            : overallRisk === "Medium"
            ? 50
            : 0,
        subjectResults: subjectResults.map((item) => ({
          subject: item.subject,
          grade: item.grade,
          score: item.score,
          attendance: item.attendance,
          submission: item.submission,
          status: item.riskLevel,
        })),
        factors: getRiskFactors(selectedStudent),
        weakSubjects: getWeakSubjects(selectedStudent),
        strongSubjects: subjectResults
          .filter((item) => item.riskLevel === "Low")
          .map((item) => ({
            subject: item.subject,
            score: item.score,
          })),
        recommendations:
          overallRisk === "High"
            ? [
                "Prioritize intervention for weak subjects and schedule a support review.",
                "Increase attendance and assignment completion for at-risk courses.",
              ]
            : overallRisk === "Medium"
            ? [
                "Monitor performance in low scoring subjects closely.",
                "Encourage consistent attendance and faster assignment completion.",
              ]
            : [
                "Maintain current academic discipline and keep progressing.",
                "Continue reinforcing attendance and assignment consistency.",
              ],
      };

      const response = await fetch("http://127.0.0.1:5001/predictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          student_id: prediction.studentId,
          student_name: prediction.studentName,
          semester: selectedStudent.semester,
          risk_level: prediction.riskLevel,
          performance: prediction.performance,
          confidence: prediction.confidence,
          subject_results: prediction.subjectResults,
          weak_subjects: prediction.weakSubjects,
          factors: prediction.factors,
          overall_score: prediction.overallScore,
          performance_status: prediction.performanceStatus,
          risk_percentage: prediction.riskPercent,
          recommendations: prediction.recommendations,
          strong_subjects: prediction.strongSubjects,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save prediction");
      }

      const savedResponse = await fetch("http://127.0.0.1:5001/predictions");
      if (!savedResponse.ok) {
        throw new Error("Failed to load saved prediction");
      }

      const savedPredictions = await savedResponse.json();
      const savedPrediction = savedPredictions.find(
        (item) => item.student_id === selectedStudent.id
      );
      if (!savedPrediction) {
        throw new Error("Saved prediction not found");
      }

      const savedPredictionResult = mapSavedPrediction(savedPrediction);
      setPredictionResult(savedPredictionResult);
      setPredictionHistory((prev) => ({
        ...prev,
        [selectedStudent.id]: [
          savedPredictionResult,
          ...(prev[selectedStudent.id] || []),
        ],
      }));
      setSelectedHistoryStudentId(selectedStudent.id);

      console.log("Prediction saved to MongoDB");
    } catch (error) {
      console.error("Prediction error:", error);
      alert("Unable to connect to the ML prediction server.");
    }
  };

  const getPredictionStatusClass = (status) => {
    if (status === "High") return "high";
    if (status === "Medium") return "medium";
    if (status === "Low") return "low";
    if (status === "Strong") return "strong";
    if (status === "Moderate") return "moderate";
    if (status === "Needs Improvement") return "needs-improvement";
    return "";
  };
  return (
    <div className="admin-dashboard">
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <div className="logo-box">A</div>
          <div className="logo-text">
            Acad<span>Predict</span>
          </div>
        </div>

        <nav className="admin-nav">
          {ADMIN_SECTIONS.map((section) => (
            <button
              key={section.key}
              className={`nav-item ${(location.pathname === "/admin/insights" ? "insights" : activeSection) === section.key ? "active" : ""}`}
              onClick={() => {
                if (section.key === "insights") {
                  navigate("/admin/insights");
                } else {
                  if (location.pathname === "/admin/insights") navigate("/admin");
                  setSection(section.key);
                }
              }}
              type="button"
            >
              <span>{section.icon}</span>
              {section.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-button" onClick={handleLogout} type="button">
            <span>↪</span>
            Logout
          </button>
        </div>
      </aside>

      <main className="admin-main">
        {location.pathname === "/admin/insights" ? <AdminPredictionInsights embedded /> : null}
        {location.pathname !== "/admin/insights" ? <>
        {activeSection === "dashboard" ? (
          <header className="admin-header admin-home-header">
            <p className="welcome-text">Welcome, Admin 👋</p>
          </header>
        ) : null}

        {/* DASHBOARD */}
        {activeSection === "dashboard" && (
          <div className="dashboard-shell">
            <section className="admin-panel-grid summary-grid admin-risk-summary-grid">
              <div className="panel summary-card">
                <div className="kpi-card">
                  <div className="kpi-icon neutral">T</div>
                  <div className="kpi-copy">
                    <span className="kpi-label">Total Students</span>
                    <strong className="kpi-value">{summary.total}</strong>
                    <small className="kpi-meta">Students monitored</small>
                  </div>
                </div>
              </div>

              <div className="panel summary-card">
                <div className="kpi-card">
                  <div className="kpi-icon danger">H</div>
                  <div className="kpi-copy">
                    <span className="kpi-label">High Risk</span>
                    <strong className="kpi-value">{summary.high}</strong>
                  </div>
                </div>
              </div>

              <div className="panel summary-card">
                <div className="kpi-card">
                  <div className="kpi-icon warning">M</div>
                  <div className="kpi-copy">
                    <span className="kpi-label">Medium Risk</span>
                    <strong className="kpi-value">{summary.medium}</strong>
                  </div>
                </div>
              </div>

              <div className="panel summary-card">
                <div className="kpi-card">
                  <div className="kpi-icon success">L</div>
                  <div className="kpi-copy">
                    <span className="kpi-label">Low Risk</span>
                    <strong className="kpi-value">{summary.low}</strong>
                  </div>
                </div>
              </div>

            </section>

            <section className="admin-academic-overview">
              <div className="admin-academic-overview-heading">
                <div>
                  <h2>📊 Academic Overview</h2>
                  <span>All Students</span>
                </div>
              </div>
              <div className="admin-panel-grid summary-grid admin-academic-metrics-grid">
                <div className="panel summary-card">
                  <div className="kpi-card">
                    <div className="kpi-icon neutral">P</div>
                    <div className="kpi-copy">
                      <span className="kpi-label">Overall Performance</span>
                      <strong className="kpi-value">{summary.averagePerformance == null ? "Data Required" : `${summary.averagePerformance}%`}</strong>
                    </div>
                  </div>
                </div>
                <div className="panel summary-card">
                  <div className="kpi-card">
                    <div className="kpi-icon danger">R</div>
                    <div className="kpi-copy">
                      <span className="kpi-label">Risk Percentage</span>
                      <strong className="kpi-value">{summary.averageRiskPercent == null ? "Pending" : `${summary.averageRiskPercent}%`}</strong>
                    </div>
                  </div>
                </div>
                <div className="panel summary-card">
                  <div className="kpi-card">
                    <div className="kpi-icon success">A</div>
                    <div className="kpi-copy">
                      <span className="kpi-label">Assignment Submission</span>
                      <strong className="kpi-value">{summary.averageAssignmentSubmission == null ? "Data Required" : `${summary.averageAssignmentSubmission}%`}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="panel analytics-panel">
              <div className="panel-header">
                <div>
                  <h2>Risk Analytics</h2>
                  <small>Current student risk distribution</small>
                </div>
              </div>

              <div className="distribution-panel">
                <h3>Student Risk Distribution</h3>
                <div className="distribution-list">
                  {riskDistribution.map((item) => (
                    <div key={item.label} className="distribution-row">
                      <div className="distribution-line">
                        <span className={`status-pill ${item.tone}`}>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                      <div className="distribution-bar">
                        <span className={`distribution-fill ${item.tone}`} style={{ width: `${item.percent || 0}%` }} />
                      </div>
                      <div className="distribution-percent">{item.percent == null ? "Data Required" : `${item.percent}%`}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

          </div>
        )}

        {/* STUDENTS */}
        {activeSection === "students" && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Student Management</h2>
                <small>Enter academic information subject by subject</small>
              </div>
              <button
                className="button-primary"
                type="button"
                onClick={openAddStudent}
              >
                + Add Student
              </button>
            </div>

            <div className="section-actions">
              <input
                placeholder="Search student by name or ID"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            {/* ADD / EDIT STUDENT FORM */}
            {showStudentForm && (
              <div className="panel student-form-panel">
                <div className="panel-heading">
                  <div>
                    <h3>{editingStudent ? "Edit Student" : "Add Student"}</h3>
                    <small>Enter attendance and assignment submission for each subject</small>
                  </div>
                  <button
                    className="button-ghost"
                    type="button"
                    onClick={closeStudentForm}
                  >
                    Cancel
                  </button>
                </div>

                <form onSubmit={handleSaveStudent}>
                  {/* Student Info */}
                  <div className="form-section">
                    <h4>Student Information</h4>
                    <div className="form-grid">
                      <label>
                        Student Name
                        <input
                          value={studentForm.name}
                          onChange={(event) =>
                            handleStudentFormChange("name", event.target.value)
                          }
                          placeholder="Enter student name"
                        />
                      </label>

                      <label>
                        Student ID
                        <input value={studentForm.id} disabled />
                      </label>

                      <label>
                        Status
                        <select
                          value={studentForm.status}
                          onChange={(event) =>
                            handleStudentFormChange("status", event.target.value)
                          }
                        >
                          <option>Active</option>
                          <option>Inactive</option>
                        </select>
                      </label>

                      <label>
                        Department
                        <input
                          value={studentForm.department}
                          onChange={(event) =>
                            handleStudentFormChange("department", event.target.value)
                          }
                          placeholder="Enter department"
                        />
                      </label>

                      <label>
                        Semester
                        <input
                          value={studentForm.semester}
                          onChange={(event) =>
                            handleStudentFormChange("semester", event.target.value)
                          }
                          placeholder="Enter semester"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Subject-wise Details */}
                  <div className="form-section">
                    <h4>Subject-wise Academic Details</h4>
                    <div className="subjects-grid">
                      {SUBJECTS.map((subject) => {
                        const data = studentForm.subjects[subject];
                        return (
                          <div key={subject} className="subject-card">
                            <h5>{subject}</h5>
                            <div className="subject-fields">
                              <label>
                                Grade
                                <input
                                  readOnly
                                  aria-readonly="true"
                                  value={data.grade}
                                />
                              </label>

                              <label>
                                Attendance %
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={data.attendance}
                                  readOnly
                                  aria-readonly="true"
                                />
                              </label>

                                <label>
                                  Total Classes
                                  <input
                                    type="number"
                                    min="0"
                                    value={data.totalClasses ?? ""}
                                    onChange={(event) => handleSubjectChange(subject, "totalClasses", event.target.value)}
                                  />
                                </label>

                                <label>
                                  Classes Attended
                                  <input
                                    type="number"
                                    min="0"
                                    max={data.totalClasses || undefined}
                                    value={data.classesAttended ?? ""}
                                    onChange={(event) => handleSubjectChange(subject, "classesAttended", event.target.value)}
                                  />
                                </label>

                                <label>
                                  Classes Missed
                                  <input value={data.classesMissed ?? ""} readOnly aria-readonly="true" />
                                </label>

                                {attendanceErrors[subject] ? <small className="form-error">{attendanceErrors[subject]}</small> : null}

                              <label>
                                Assignment Submission %
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={data.submission}
                                  onChange={(event) =>
                                    handleSubjectChange(
                                      subject,
                                      "submission",
                                      event.target.value
                                    )
                                  }
                                />
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="section-actions" style={{ marginTop: 20 }}>
                    <button className="button-primary" type="submit">
                      Save Student Data
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* STUDENT LIST */}
            <div className="table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Student ID</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: "center", padding: "20px" }}>
                        No students found
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => (
                      <tr key={student.id}>
                        <td>{student.name}</td>
                        <td>{student.id}</td>
                        <td>{student.status}</td>
                        <td>
                          <div className="action-buttons">
                            <button
                              className="button-secondary"
                              type="button"
                              onClick={() => setSelectedStudentId(student.id)}
                            >
                              View
                            </button>
                            <button
                              className="button-secondary"
                              type="button"
                              onClick={() => openEditStudent(student)}
                            >
                              Edit
                            </button>
                            <button
                              className="button-ghost"
                              type="button"
                              onClick={() => handleDeleteStudent(student.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* SELECTED STUDENT DETAILS */}
            {selectedStudent && (
              <div className="panel student-detail-card" style={{ marginTop: 20 }}>
                <div className="panel-heading">
                  <div>
                    <h3>{selectedStudent.name}</h3>
                    <small>{selectedStudent.id}</small>
                    <div className="student-details-summary">
                      <div>
                        <span>Department</span>
                        <strong>{selectedStudent.department ?? "Not available"}</strong>
                      </div>
                      <div>
                        <span>Semester</span>
                        <strong>{selectedStudent.semester ?? "Not available"}</strong>
                      </div>
                    </div>
                  </div>
                  <button
                    className="button-ghost"
                    type="button"
                    onClick={() => setSelectedStudentId("")}
                  >
                    Close
                  </button>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table className="admin-table" style={{ minWidth: "850px" }}>
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th>Grade</th>
                        <th>Attendance</th>
                        <th>Assignment</th>
                      </tr>
                    </thead>

                    <tbody>
                      {SUBJECTS.map((subject) => {
                        const data = selectedStudent.subjects[subject];
                        return (
                          <tr key={subject}>
                            <td>
                              <strong>{subject}</strong>
                            </td>
                            <td>{data.grade}</td>
                            <td>{data.attendance}%</td>
                            <td>{data.submission}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {/* PREDICTION CENTER */}
        {activeSection === "prediction" && (
          <section className="panel prediction-center-panel">
            <div className="panel-heading">
              <div>
                <h2>Prediction Center</h2>
                <small>Select a student and generate a subject-wise academic risk prediction</small>
              </div>
            </div>

            <div className="section-actions">
              <select
                value={selectedStudentId}
                onChange={(event) => {
                  setSelectedStudentId(event.target.value);
                  setPredictionResult(null);
                }}
              >
                <option value="">Select a student...</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.id} — {student.name}
                  </option>
                ))}
              </select>

              <button
                className="button-primary"
                type="button"
                onClick={handleRunPrediction}
                disabled={!selectedStudent}
              >
                Run Prediction
              </button>
            </div>

            {selectedStudent && (
              <>
                {/* INPUT DATA */}
                <div className="panel student-detail-card" style={{ marginTop: 20 }}>
                  <div className="panel-heading">
                    <h3>Student Academic Input</h3>
                    <small>Data entered by Admin</small>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table className="admin-table" style={{ minWidth: "850px" }}>
                      <thead>
                        <tr>
                          <th>Subject</th>
                          <th>Grade</th>
                          <th>Attendance</th>
                          <th>Assignment Submission</th>
                        </tr>
                      </thead>

                      <tbody>
                        {SUBJECTS.map((subject) => {
                          const data = selectedStudent.subjects[subject];
                          return (
                            <tr key={subject}>
                              <td>
                                <strong>{subject}</strong>
                              </td>
                              <td>{data.grade}</td>
                              <td>{data.attendance}%</td>
                              <td>{data.submission}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* PREDICTION RESULT */}
                {predictionResult && (
                  <>
                    {/* Student Info & Overview */}
                    <div className="faculty-section-card prediction-analysis-card" style={{ marginTop: 20 }}>
                      <div className="panel-heading">
                        <div>
                         <h4>UPDATED TEST DASHBOARD</h4>
                          <p>Academic risk and subject-level prediction based on the live grade, attendance, and assignment submission data entered by the admin.</p>
                        </div>
                      </div>

                      <div className="prediction-analysis-grid">
                        <div className="prediction-analysis-item">
                          <span>Student Name</span>
                          <strong>{predictionResult.studentName}</strong>
                        </div>
                        <div className="prediction-analysis-item">
                          <span>Student ID</span>
                          <strong>{predictionResult.studentId}</strong>
                        </div>
                        <div className="prediction-analysis-item">
                          <span>Overall Risk / Risk Level</span>
                          <span className={`status-pill ${getPredictionStatusClass(predictionResult.riskLevel)}`}>
                            {predictionResult.riskLevel}
                          </span>
                        </div>
                        <div className="prediction-analysis-item">
                          <span>Confidence</span>
                          <strong>{predictionResult.confidence}%</strong>
                        </div>
                        <div className="prediction-analysis-item">
                          <span>Overall Performance %</span>
                          <strong>{predictionResult.overallScore}%</strong>
                        </div>
                        <div className="prediction-analysis-item">
                          <span>Performance Status</span>
                          <span className={`status-pill ${getPerformanceStatusClass(predictionResult.performanceStatus)}`}>
                            {predictionResult.performanceStatus}
                          </span>
                        </div>
                        <div className="prediction-analysis-item">
                          <span>Risk Percentage</span>
                          <strong>{predictionResult.riskPercent}%</strong>
                        </div>
                        <div className="prediction-analysis-item">
                          <span>Overall Attendance</span>
                          <strong>{selectedStudentAttendance?.overallAttendance ?? 0}%</strong>
                        </div>
                        <div className="prediction-analysis-item">
                          <span>Attendance Status</span>
                          <span className={selectedStudentAttendance?.attendanceStatus ? `attendance-status-badge attendance-${selectedStudentAttendance.attendanceStatus.toLowerCase()}` : "attendance-status-badge"}>
                            {selectedStudentAttendance?.attendanceStatus || "No attendance data"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* SUBJECT-WISE PREDICTION */}
                    <div className="panel" style={{ marginTop: 20 }}>
                      <div className="panel-heading">
                        <h3>Subject-wise Prediction</h3>
                        <small>Performance and risk signals for each subject</small>
                      </div>

                      <div className="subjects-prediction-grid">
                        {predictionResult.subjectResults.map((item) => (
                          <div
                            key={item.subject}
                            className={`subject-prediction-card performance-status-${getPerformanceStatus(item.score).toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            <h4>{item.subject}</h4>
                            <div className="score-display">
                              <span className="score">{item.score}%</span>
                                <span className={`status-badge performance-status-${getPerformanceStatus(item.score).toLowerCase().replace(/\s+/g, "-")}`}>
                                {getPerformanceStatus(item.score)}
                              </span>
                            </div>

                          </div>
                        ))}
                      </div>
                    </div>

                    {/* RISK FACTORS */}
                    <div className="detail-panel-grid" style={{ marginTop: 20 }}>
                      <div className="student-detail-card">
                        <div className="panel-heading">
                          <h3>Risk Factors</h3>
                        </div>
                        <ul className="risk-factors-list">
                          {predictionResult.factors.map((factor, index) => (
                            <li key={index}>{factor}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="student-detail-card">
                        <div className="panel-heading">
                          <h3>Weak Subjects</h3>
                        </div>
                        {predictionResult.weakSubjects.length > 0 ? (
                          <ol className="weak-subjects-list">
                            {predictionResult.weakSubjects.map((subject) => (
                              <li key={subject.subject}>
                                <strong>{subject.subject}</strong>
                                <span className="score-badge">{subject.score}%</span>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p style={{ color: "#6f748f" }}>No weak subjects identified</p>
                        )}
                      </div>
                    </div>


                  </>
                )}

                {!predictionResult && (
                  <div className="panel student-detail-card" style={{ marginTop: 20 }}>
                    <p style={{ color: "#6f748f", textAlign: "center", padding: "40px 20px" }}>
                      Click "Run Prediction" to analyze this student's subject-wise academic data.
                    </p>
                  </div>
                )}
              </>
            )}

            {!selectedStudent && (
              <div className="panel student-detail-card">
                <p style={{ color: "#6f748f", textAlign: "center", padding: "40px 20px" }}>
                  Select a student to generate prediction.
                </p>
              </div>
            )}
          </section>
        )}

        {/* PREDICTION HISTORY */}
        {activeSection === "history" && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Prediction History</h2>
                <small>Review previous predictions and monitor risk trends</small>
              </div>
            </div>

            <div className="section-actions">
              <select
                value={selectedHistoryStudentId}
                onChange={(event) => setSelectedHistoryStudentId(event.target.value)}
              >
                <option value="">Select a student...</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.id} — {student.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedHistoryStudent ? (
              <>
                {latestHistory ? (
                  <>
                    {/* Latest Prediction Summary */}
                    <div className="admin-panel-grid prediction-history-summary-grid" style={{ marginTop: 20 }}>
                      <div className="panel summary-card">
                        <div className="kpi-copy">
                          <span className="kpi-label">Current Risk Level</span>
                          <strong className={`kpi-value status-pill status-${latestHistory.riskLevel.toLowerCase()}`}>
                            {latestHistory.riskLevel}
                          </strong>
                        </div>
                      </div>

                      <div className="panel summary-card">
                        <div className="kpi-copy">
                          <span className="kpi-label">Overall Performance</span>
                          <strong className={`kpi-value status-pill ${getPerformanceStatusClass(latestHistory.performanceStatus)}`}>
                            {latestHistory.performanceStatus}
                          </strong>
                        </div>
                      </div>

                      <div className="panel summary-card">
                        <div className="kpi-copy">
                          <span className="kpi-label">Confidence</span>
                          <strong className="kpi-value">{latestHistory.confidence}%</strong>
                        </div>
                      </div>

                      <div className="panel summary-card">
                        <div className="kpi-copy">
                          <span className="kpi-label">Trend</span>
                          <strong className={`kpi-value status-pill ${riskTrend === "Worsening" ? "danger" : "positive"}`}>
                            {riskTrend}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Prediction History Table */}
                    <div className="panel" style={{ marginTop: 20 }}>
                      <div className="panel-heading">
                        <h3>Prediction History</h3>
                      </div>

                      <div className="table-scroll">
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Performance</th>
                              <th>Risk Level</th>
                              <th>Confidence</th>
                              <th>Weak Subjects</th>
                            </tr>
                          </thead>

                          <tbody>
                            {selectedHistory.map((entry, index) => (
                              <tr key={`${entry.timestamp}-${index}`}>
                                <td>
                                  {new Date(entry.timestamp).toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </td>
                                <td>{entry.performanceStatus}</td>
                                <td>
                                  <span className={`risk-level-badge ${entry.riskLevel.toLowerCase()}`}>
                                    {entry.riskLevel}
                                  </span>
                                </td>
                                <td>{entry.confidence}%</td>
                                <td>
                                  {entry.weakSubjects.length > 0
                                    ? entry.weakSubjects.map((s) => s.subject).join(", ")
                                    : "None"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="panel student-detail-card" style={{ marginTop: 20 }}>
                    <p style={{ color: "#6f748f", textAlign: "center", padding: "40px 20px" }}>
                      No prediction history available for this student yet.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="panel student-detail-card">
                <p style={{ color: "#6f748f", textAlign: "center", padding: "40px 20px" }}>
                  Select a student to view prediction history.
                </p>
              </div>
            )}
          </section>
        )}

        {/* SETTINGS */}
        {activeSection === "settings" && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Settings</h2>
                <small>Admin profile settings and account preferences</small>
              </div>
            </div>

            <div className="detail-panel-grid">
              <div className="student-detail-card">
                <div className="panel-heading">
                  <h3>Admin Profile</h3>
                </div>

                <div className="student-detail-item">
                  <strong>Name</strong>
                  <span>{user?.name || "Admin"}</span>
                </div>

                <div className="student-detail-item">
                  <strong>Email</strong>
                  <span>{user?.email || "admin@acadpredict.edu"}</span>
                </div>

                <div className="student-detail-item">
                  <strong>Role</strong>
                  <span>Administrator</span>
                </div>
              </div>

              <div className="student-detail-card">
                <div className="panel-heading">
                  <h3>Account Settings</h3>
                </div>

                <div className="student-detail-item">
                  <strong>Security</strong>
                  <span>Two-step verification available later</span>
                </div>

                <div className="student-detail-item">
                  <strong>Notification</strong>
                  <span>Email alerts for prediction updates</span>
                </div>

                <div className="section-actions" style={{ marginTop: 18 }}>
                  <button className="button-secondary" type="button" onClick={handleLogout}>
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
        </> : null}
      </main>
    </div>
  );
}

export default AdminDashboard;

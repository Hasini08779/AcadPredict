import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAttendanceStatus, getAttendanceSummary, getSubjectAttendance } from "../attendance";
import { fetchStudents, getAcademicDataStatus, getAssignmentStatus, getAssignmentStatusClass, getAssignmentSubjects, getAssignmentSummary, getPerformanceStatus, getPerformanceStatusClass, getRiskFactors, getStudentPerformance, getSubjectScore, getWeakSubjects, STUDENTS_UPDATED_EVENT } from "../studentData";

const SUBJECTS = [
  "Python Programming",
  "Computer Networks",
  "Database Management",
  "Mathematics",
  "Operating System",
  "Data Structures",
];

function getPredictionStatusClass(status) {
  const normalizedStatus = String(status || "").toLowerCase();
  if (normalizedStatus === "low" || normalizedStatus === "strong") return "status-low";
  if (normalizedStatus === "medium" || normalizedStatus === "moderate") return "status-medium";
  if (normalizedStatus === "high") return "status-high";
  return "status-unavailable";
}

function getPredictionTime(prediction) {
  const time = new Date(prediction.created_at || prediction.timestamp || 0).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getAttendanceDetails(student) {
  return SUBJECTS.map((subject) => {
    const record = getSubjectAttendance(student?.subjects?.[subject]);
    return { subject, ...record };
  }).filter((record) => record.percentage != null);
}

function getAssignmentInsight(subjects) {
  if (!subjects.length) return null;
  return {
    strongest: subjects.reduce((best, subject) => subject.percentage > best.percentage ? subject : best),
    needsAttention: subjects.reduce((weakest, subject) => subject.percentage < weakest.percentage ? subject : weakest),
  };
}

function csvValue(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadReport(filename, headers, rows) {
  const csv = [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
  const link = document.createElement("a");
  const reportUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.href = reportUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(reportUrl), 60000);
}

function viewReport(title, headers, rows) {
  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  const tableRows = rows
    .map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`)
    .join("");
  const reportHtml = `<!doctype html><html><head><title>${title}</title><style>
    body{font-family:Arial,sans-serif;color:#172033;padding:32px}h1{font-size:24px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #dfe4ee;padding:9px;text-align:left;vertical-align:top}th{background:#f5f7fb}
  </style></head><body><h1>${escapeHtml(title)}</h1><p>Generated from the latest available AcadPredict data.</p><table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${tableRows}</tbody></table></body></html>`;
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) return false;

  reportWindow.document.open();
  reportWindow.document.write(reportHtml);
  reportWindow.document.close();
  return true;
}

function FacultyDashboard() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("Dashboard");
  const [studentSearch, setStudentSearch] = useState("");
  const [studentRiskFilter] = useState("All Students");
  const [selectedPerformanceStudent, setSelectedPerformanceStudent] = useState(null);
  const [selectedRiskStudent, setSelectedRiskStudent] = useState(null);
  const [selectedAttendanceStudent, setSelectedAttendanceStudent] = useState(null);
  const [selectedAssignmentStudent, setSelectedAssignmentStudent] = useState(null);

  const [facultyStudentBaseData, setFacultyStudentBaseData] = useState([]);
  const [savedPredictions, setSavedPredictions] = useState({});
  const [generatedReports, setGeneratedReports] = useState({});
  const [viewingReport, setViewingReport] = useState(null);

  useEffect(() => {
  const loadFacultyStudents = async () => {
    try {
      const data = await fetchStudents();

      const formattedStudents = data.map((student) => ({
        id: student.student_id,
        name: student.name,
        status: student.status || "Active",
        department: student.department ?? null,
        semester: student.semester ?? null,
        subjects: student.subjects || {},
        createdAt: student.createdAt || student.created_at || null,
      }));

      setFacultyStudentBaseData(formattedStudents);
    } catch (error) {
      console.error("Faculty MongoDB error:", error);

      setFacultyStudentBaseData([]);
    }
  };

  loadFacultyStudents();
  window.addEventListener(STUDENTS_UPDATED_EVENT, loadFacultyStudents);
  const refreshTimer = window.setInterval(loadFacultyStudents, 5000);

  return () => {
    window.removeEventListener(STUDENTS_UPDATED_EVENT, loadFacultyStudents);
    window.clearInterval(refreshTimer);
  };
}, []);
  useEffect(() => {
    const loadPredictions = async () => {
      try {
        const response = await fetch("http://127.0.0.1:5001/predictions");

        if (!response.ok) {
          throw new Error("Failed to fetch predictions");
        }

        const predictions = await response.json();
        const latestByStudent = {};

        predictions.forEach((prediction) => {
          const currentPrediction = latestByStudent[prediction.student_id];
          if (
            !currentPrediction ||
            getPredictionTime(prediction) > getPredictionTime(currentPrediction)
          ) {
            latestByStudent[prediction.student_id] = prediction;
          }
        });

        setSavedPredictions(latestByStudent);
      } catch (error) {
        console.error("Faculty predictions error:", error);
        setSavedPredictions({});
      }
    };

    loadPredictions();
    const refreshTimer = window.setInterval(loadPredictions, 5000);

    return () => window.clearInterval(refreshTimer);
  }, []);

  const studentData = useMemo(() => {
    return facultyStudentBaseData.map((student) => {
      const academicDataComplete = getAcademicDataStatus(student).complete;
      const savedPrediction = academicDataComplete ? savedPredictions[student.id] : null;
      const savedSubjectResults = savedPrediction?.subject_results || [];
      const currentSubjectResults = academicDataComplete ? SUBJECTS.map((subject) => {
        const score = getSubjectScore(student.subjects?.[subject]);
        const savedSubject = savedSubjectResults.find((item) => item.subject === subject);
        return score == null ? null : {
          subject,
          score,
            status: getPerformanceStatus(score),
        };
      }).filter(Boolean) : [];
      const prediction = savedPrediction
        ? {
            studentName: savedPrediction.student_name,
            studentId: savedPrediction.student_id,
            overallScore: getStudentPerformance(student),
            riskLevel: savedPrediction.risk_level,
            performance_status: savedPrediction.performance_status,
            riskPercent: savedPrediction.risk_percentage,
            confidence: savedPrediction.confidence,
            riskFactors: getRiskFactors(student),
            subjectResults: currentSubjectResults,
            weakSubjects: getWeakSubjects(student),
            strongSubjects: savedPrediction.strong_subjects || [],
            recommendations: savedPrediction.recommendations || [],
          }
        : {
            studentName: student.name,
            studentId: student.id,
            overallScore: null,
            riskLevel: null,
            performance_status: null,
            riskPercent: null,
            confidence: null,
            riskFactors: [],
            subjectResults: [],
            weakSubjects: [],
            strongSubjects: [],
            recommendations: [],
          };
      const assignmentSummary = academicDataComplete ? getAssignmentSummary(student) : { percentage: null };
      const attendanceSummary = academicDataComplete
        ? getAttendanceSummary(student, SUBJECTS)
        : { overallAttendance: null, totalClasses: null, classesAttended: null, classesMissed: null, attendanceStatus: null };
      const averageAttendance = attendanceSummary.overallAttendance;
      const averageSubmission = assignmentSummary.percentage;
      const totalClasses = attendanceSummary.totalClasses;
      const present = attendanceSummary.classesAttended;
      const assignmentCompletion = averageSubmission;
      const status = student.status || "Active";
      const risk = academicDataComplete && prediction.riskLevel
        ? prediction.riskLevel === "Low"
          ? "Low Risk"
          : prediction.riskLevel === "Medium"
          ? "Medium Risk"
          : "High Risk"
        : "Pending Analysis";
      const recommendedAction = academicDataComplete && prediction?.recommendations[0] ? prediction.recommendations[0] : "Will appear after academic data is entered";

      return {
        id: student.id,
        name: student.name,
        status,
        department: student.department ?? null,
        semester: student.semester ?? null,
        present,
        performance: prediction?.overallScore,
        assignmentStatus: academicDataComplete ? getAssignmentStatus(assignmentCompletion) : null,
        risk,
        riskLevel: risk,
        riskScore: prediction?.riskPercent,
        riskFactor: academicDataComplete ? prediction?.weakSubjects?.[0]?.subject || "Will be identified after academic data is entered" : "Will be identified after academic data is entered",
        performanceStatus: academicDataComplete ? getPerformanceStatus(prediction?.overallScore) || "Data Required" : "Data Required",
        attendanceStatus: attendanceSummary.attendanceStatus,
        recommendedAction,
        totalClasses,
        absent: attendanceSummary.classesMissed,
        attendance: averageAttendance,
        assignmentCompletion,
        predictionAvailable: Boolean(savedPrediction && academicDataComplete),
        academicDataComplete,
        prediction,
      };
    });
  }, [facultyStudentBaseData, savedPredictions]);

  const normalizedStudents = studentData.map((student) => ({
    ...student,
    totalClasses: student.totalClasses,
    present: student.present,
    absent: student.absent,
    attendance: student.attendance,
  }));
  const completeAcademicStudents = studentData.filter((student) => student.academicDataComplete);

  const filteredStudents = normalizedStudents.filter((student) => {
    const query = studentSearch.trim().toLowerCase();
    const matchesSearch =
      !query ||
      student.name.toLowerCase().includes(query) ||
      student.id.toLowerCase().includes(query);
    const matchesRisk =
      studentRiskFilter === "All Students" || student.riskLevel === studentRiskFilter;
    return matchesSearch && matchesRisk;
  });

  const attendanceRows = facultyStudentBaseData.map((student) => {
    const academicDataComplete = getAcademicDataStatus(student).complete;
    const attendanceSummary = academicDataComplete
      ? getAttendanceSummary(student, SUBJECTS)
      : { totalClasses: null, classesAttended: null, classesMissed: null, overallAttendance: null, attendanceStatus: null };

    return {
      id: student.id,
      name: student.name,
      totalClasses: attendanceSummary.totalClasses,
      present: attendanceSummary.classesAttended,
      absent: attendanceSummary.classesMissed,
      attendance: attendanceSummary.overallAttendance,
      ...attendanceSummary,
      riskPercentage: academicDataComplete ? savedPredictions[student.id]?.risk_percentage : null,
      status: academicDataComplete ? attendanceSummary.attendanceStatus : null,
      academicDataComplete,
      subjects: student.subjects,
    };
  });

  const assignmentRows = facultyStudentBaseData.map((student) => {
    const academicDataComplete = getAcademicDataStatus(student).complete;
    const subjects = academicDataComplete ? getAssignmentSubjects(student) : [];
    const assignmentSubmission = academicDataComplete ? getAssignmentSummary(student).percentage : null;

    return {
      id: student.id,
      name: student.name,
      subjects,
      assignmentSubmission,
      status: academicDataComplete ? getAssignmentStatus(assignmentSubmission) : null,
      academicDataComplete,
    };
  });

  const riskRows = facultyStudentBaseData.map((student) => {
    const academicDataComplete = getAcademicDataStatus(student).complete;
    const savedPrediction = academicDataComplete ? savedPredictions[student.id] : null;
    const riskLevel = savedPrediction?.risk_level;

    return {
      id: student.id,
      name: student.name,
      riskPercentage: savedPrediction?.risk_percentage,
      predictionAvailable: Boolean(savedPrediction),
      riskLevel: riskLevel
        ? riskLevel === "Low"
          ? "Low Risk"
          : riskLevel === "Medium"
          ? "Medium Risk"
          : "High Risk"
        : "Pending Analysis",
      riskFactors: academicDataComplete ? getRiskFactors(student) : [],
      weakSubjects: academicDataComplete ? getWeakSubjects(student) : [],
      strongSubjects: savedPrediction?.strong_subjects || [],
      subjectResults: savedPrediction?.subject_results || [],
      academicDataComplete,
    };
  });

  const facultyReports = useMemo(() => {
    const performance = {
      headers: ["Student Name", "Student ID", "Overall Performance", "Performance Status"],
      rows: studentData.map((student) => [
        student.name,
        student.id,
        student.performance == null ? "Pending" : `${student.performance}%`,
        student.performanceStatus,
      ]),
    };
    const attendance = {
      headers: ["Student Name", "Student ID", "Overall Attendance", "Attendance Status"],
      rows: attendanceRows.map((student) => [
        student.name,
        student.id,
        student.attendance == null ? "Data Required" : `${student.attendance}%`,
        student.status || "Data Required",
      ]),
    };
    const assignments = {
      headers: ["Student Name", "Student ID", "Assignment Submission", "Status"],
      rows: assignmentRows.map((student) => [
        student.name,
        student.id,
        student.assignmentSubmission == null ? "Data Required" : `${student.assignmentSubmission}%`,
        student.status || "Data Required",
      ]),
    };
    const risk = {
      headers: ["Student Name", "Student ID", "Risk Percentage", "Risk Level", "Risk Factors"],
      rows: riskRows.map((student) => [
        student.name,
        student.id,
        student.riskPercentage == null ? "Pending Analysis" : `${student.riskPercentage}%`,
        student.riskLevel,
        student.predictionAvailable ? student.riskFactors.join(", ") : "Will appear after academic data is entered",
      ]),
    };
    const complete = {
      headers: ["Student Name", "Student ID", "Department", "Semester", "Status", "Attendance", "Assignments", "Performance", "Risk Level", "Risk Percentage"],
      rows: studentData.map((student) => [
        student.name,
        student.id,
        student.department || "Not Entered Yet",
        student.semester || "Not Entered Yet",
        student.status,
        student.attendance == null ? "Not Entered Yet" : `${student.attendance}%`,
        student.assignmentCompletion == null ? "Not Entered Yet" : `${student.assignmentCompletion}%`,
        student.performance == null ? "Pending" : `${student.performance}%`,
        student.risk,
        student.riskScore == null ? "Pending Analysis" : `${student.riskScore}%`,
      ]),
    };

    return { performance, attendance, assignments, risk, complete };
  }, [assignmentRows, attendanceRows, riskRows, studentData]);

  const generateFacultyReport = (reportKey) => {
    const report = facultyReports[reportKey];
    if (!report) return null;

    const generatedReport = {
      ...report,
      generatedAt: new Date().toISOString(),
    };

    setGeneratedReports((previous) => ({ ...previous, [reportKey]: generatedReport }));
    return generatedReport;
  };

  const handleFacultyReportAction = (reportKey, action) => {
    const reportToUse = action === "Generate" || !generatedReports[reportKey]
      ? generateFacultyReport(reportKey)
      : generatedReports[reportKey];
    if (!reportToUse) return;

    if (action === "Generate") return;

    if (action === "View") {
      const title = {
        performance: "Performance Report",
        attendance: "Attendance Report",
        assignments: "Assignment Report",
        risk: "Risk Analysis Report",
        complete: "Complete Student Report",
      }[reportKey];
      const openedInNewTab = viewReport(title, reportToUse.headers, reportToUse.rows);
      if (!openedInNewTab) {
        setViewingReport({ title, ...reportToUse });
      }
    } else if (action === "Download") {
      downloadReport(`${reportKey}-report.csv`, reportToUse.headers, reportToUse.rows);
    }
  };

  const attendanceSummary = attendanceRows.reduce(
    (summary, student) => {
      if (!student.academicDataComplete) return summary;
      if (getAttendanceStatus(student.attendance) === "Good") {
        summary.high += 1;
      } else if (getAttendanceStatus(student.attendance) === "Warning") {
        summary.mid += 1;
      } else {
        summary.low += 1;
      }
      summary.total += 1;
      summary.sumAttendance += student.attendance;
      return summary;
    },
    { high: 0, mid: 0, low: 0, total: 0, sumAttendance: 0 }
  );

  const averageAttendance = attendanceSummary.total
    ? Math.round(attendanceSummary.sumAttendance / attendanceSummary.total)
    : null;

  const performanceSummary = useMemo(() => {
    const counts = { strong: 0, moderate: 0, needsImprovement: 0 };

    studentData.forEach((student) => {
      const score = Number(student.performance);
      if (!student.predictionAvailable || Number.isNaN(score)) return;

      const performanceStatus = getPerformanceStatus(score);
      if (performanceStatus === "Strong") counts.strong += 1;
      else if (performanceStatus === "Moderate") counts.moderate += 1;
      else counts.needsImprovement += 1;
    });

    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const percent = (count) => (total ? Math.round((count / total) * 100) : 0);

    return {
      strong: percent(counts.strong),
      moderate: percent(counts.moderate),
      needsImprovement: percent(counts.needsImprovement),
    };
  }, [studentData]);

  const totalStudents = studentData.length;
  const goodStandingCount = studentData.filter(
    (student) => student.prediction?.riskLevel === "Low"
  ).length;
  const moderateRiskCount = studentData.filter(
    (student) => student.prediction?.riskLevel === "Medium"
  ).length;
  const highRiskCount = studentData.filter(
    (student) => student.prediction?.riskLevel === "High"
  ).length;
  const riskTotal = goodStandingCount + moderateRiskCount + highRiskCount;
  const riskPercent = (count) => (riskTotal ? `${Math.round((count / riskTotal) * 100)}%` : "0%");

  const handleLogout = () => {
    localStorage.removeItem("acadPredictLoggedIn");
    navigate("/login");
  };

  return (
    <div className="faculty-dashboard">
      <aside className="faculty-sidebar">
        <div className="sidebar-brand">
          <div className="logo-box">A</div>
          <div className="logo-text">
            Acad<span>Predict</span>
          </div>
        </div>

        <nav className="faculty-nav">
          <button
            className={`nav-item ${activeSection === "Dashboard" ? "active" : ""}`}
            onClick={() => setActiveSection("Dashboard")}
          >
            <span>⌂</span>
            Dashboard
          </button>
          <button
            className={`nav-item ${activeSection === "Students" ? "active" : ""}`}
            onClick={() => setActiveSection("Students")}
          >
            <span>👥</span>
            Students
          </button>
          <button
            className={`nav-item ${activeSection === "Performance" ? "active" : ""}`}
            onClick={() => setActiveSection("Performance")}
          >
            <span>▣</span>
            Performance
          </button>
          <button
            className={`nav-item ${activeSection === "Attendance" ? "active" : ""}`}
            onClick={() => setActiveSection("Attendance")}
          >
            <span>◷</span>
            Attendance
          </button>
          <button
            className={`nav-item ${activeSection === "Assignments" ? "active" : ""}`}
            onClick={() => setActiveSection("Assignments")}
          >
            <span>✓</span>
            Assignments
          </button>
          <button
            className={`nav-item ${activeSection === "Reports" ? "active" : ""}`}
            onClick={() => setActiveSection("Reports")}
          >
            <span>▤</span>
            Reports
          </button>
        </nav>

        <button className="logout-button" onClick={handleLogout}>
          <span>↪</span>
          Logout
        </button>
      </aside>

      <main className="faculty-main">
        {activeSection === "Dashboard" ? (
          <header className="faculty-header faculty-home-header">
            <p className="welcome-text">Welcome, Faculty 👋</p>
          </header>
        ) : null}

        {activeSection === "Dashboard" ? (
          <>
            <section className="faculty-summary-cards student-stats">
              <div className="student-stat-card">
                <div className="stat-top">
                  <div className="student-stat-icon blue">👥</div>
                  <span className="stat-badge">Total</span>
                </div>
                <p>Total Students</p>
                <h2>{totalStudents}</h2>
              </div>
              <div className="student-stat-card">
                <div className="stat-top">
                  <div className="student-stat-icon green">✓</div>
                  <span className="safe-badge">Stable</span>
                </div>
                <p>Good Standing Students</p>
                <h2>{riskTotal ? goodStandingCount : "—"}</h2>
              </div>
              <div className="student-stat-card">
                <div className="stat-top">
                  <div className="student-stat-icon orange">⚠</div>
                  <span className="stat-badge">Monitor</span>
                </div>
                <p>Moderate Risk Students</p>
                <h2>{riskTotal ? moderateRiskCount : "—"}</h2>
              </div>
              <div className="student-stat-card">
                <div className="stat-top">
                  <div className="student-stat-icon purple">‼</div>
                  <span className="stat-badge">Alert</span>
                </div>
                <p>High Risk Students</p>
                <h2>{riskTotal ? highRiskCount : "—"}</h2>
              </div>
            </section>

            <section className="faculty-analytics-grid">
              <div className="analytics-card performance-card">
                <div className="panel-heading">
                  <div>
                    <h3>Student Performance</h3>
                    <p>Overview of performance categories across the cohort.</p>
                  </div>
                  <span>Summary</span>
                </div>
                {completeAcademicStudents.length ? <div className="performance-bar-chart">
                  <div className="performance-bar-row">
                    <span>Strong</span>
                    <div className="performance-bar-outer">
                      <div className="performance-bar-fill strong" style={{ width: `${performanceSummary.strong}%` }} />
                    </div>
                    <strong>{performanceSummary.strong}%</strong>
                  </div>
                  <div className="performance-bar-row">
                    <span>Moderate</span>
                    <div className="performance-bar-outer">
                      <div className="performance-bar-fill moderate" style={{ width: `${performanceSummary.moderate}%` }} />
                    </div>
                    <strong>{performanceSummary.moderate}%</strong>
                  </div>
                  <div className="performance-bar-row">
                    <span>Needs Improvement</span>
                    <div className="performance-bar-outer">
                      <div className="performance-bar-fill needs-improvement" style={{ width: `${performanceSummary.needsImprovement}%` }} />
                    </div>
                    <strong>{performanceSummary.needsImprovement}%</strong>
                  </div>
                </div> : <p className="faculty-pending-state">Data Required</p>}
              </div>

              <div className="analytics-card attendance-card">
                <div className="faculty-attendance-overall">
                  <span>Overall Attendance</span>
                  <strong>{averageAttendance == null ? "Data Required" : `${averageAttendance}%`}</strong>
                </div>
              </div>

              <div className="analytics-card risk-card">
                <div className="panel-heading">
                  <div>
                    <h3>Risk Distribution</h3>
                    <p>Students classified by risk category.</p>
                  </div>
                </div>
                {riskTotal ? <div className="risk-share">
                  <div className="risk-row">
                    <span>Good Standing</span>
                    <strong>{goodStandingCount}</strong>
                  </div>
                  <div className="progress-bar-sm">
                    <div style={{ width: riskPercent(goodStandingCount) }} />
                  </div>
                  <div className="risk-row">
                    <span>Moderate Risk</span>
                    <strong>{moderateRiskCount}</strong>
                  </div>
                  <div className="progress-bar-sm warning">
                    <div style={{ width: riskPercent(moderateRiskCount) }} />
                  </div>
                  <div className="risk-row">
                    <span>High Risk</span>
                    <strong>{highRiskCount}</strong>
                  </div>
                  <div className="progress-bar-sm danger">
                    <div style={{ width: riskPercent(highRiskCount) }} />
                  </div>
                </div> : <p className="faculty-pending-state">Pending Analysis</p>}
              </div>
            </section>
          </>
        ) : activeSection === "Students" ? (
          <section className="faculty-section-panel">
            <div className="faculty-section-card">
              <div className="panel-heading">
                <div>
                  <h3>Students</h3>
                  <p>Search and filter student records by status.</p>
                </div>
              </div>
              <div className="faculty-filter-section">
                <div className="faculty-filter-row">
                  <div className="filter-block" style={{ flex: 1 }}>
                    <label htmlFor="student-search">Search students</label>
                    <input
                      id="student-search"
                      type="search"
                      value={studentSearch}
                      onChange={(event) => setStudentSearch(event.target.value)}
                      placeholder="Search by name or ID"
                    />
                  </div>
                </div>
              </div>
              <div className="table-scroll">
                <table className="faculty-data-table">
                  <thead>
                    <tr>
                      <th>Student Name</th>
                      <th>Student ID</th>
                      <th>Department</th>
                      <th>Semester</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student) => (
                      <tr key={student.id}>
                        <td>{student.name}</td>
                        <td>{student.id}</td>
                        <td>{student.department || "Not Entered Yet"}</td>
                        <td>{student.semester || "Not Entered Yet"}</td>
                        <td>
                          <span
                            className={`status-pill ${
                              student.status === "Active" ? "positive" : "danger"
                            }`}
                          >
                            {student.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : activeSection === "Performance" ? (
          <section className="faculty-section-panel">
            <div className="faculty-section-card">
              <div className="panel-heading">
                <div>
                  <h3>Performance</h3>
                  <p>Detailed academic performance information.</p>
                </div>
              </div>
              <div className="table-scroll">
                <table className="faculty-data-table">
                  <thead>
                    <tr>
                      <th>Student Name</th>
                      <th>Student ID</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentData.map((student) => (
                      <tr key={student.id}>
                        <td>{student.name}</td>
                        <td>{student.id}</td>
                        <td>
                          <button
                            className="detail-button"
                            onClick={() => setSelectedPerformanceStudent(student)}
                          >
                            Analyze
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {selectedPerformanceStudent && (
              <div className="faculty-section-card" style={{ marginTop: "20px" }}>
                <div className="panel-heading">
                  <div>
                    <h4>Prediction Centre Analysis for {selectedPerformanceStudent.name}</h4>
                    <p>Academic risk and subject-level prediction based on the student&apos;s grade, attendance, and assignment submission data.</p>
                  </div>
                </div>

                <div style={{ display: "grid", gap: "20px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                    <div style={{ background: "#f7f8ff", borderRadius: "14px", padding: "14px 16px" }}>
                      <div style={{ color: "#667085", fontSize: "12px", marginBottom: "6px" }}>Student Name</div>
                      <strong>{selectedPerformanceStudent.name}</strong>
                    </div>
                    <div style={{ background: "#f7f8ff", borderRadius: "14px", padding: "14px 16px" }}>
                      <div style={{ color: "#667085", fontSize: "12px", marginBottom: "6px" }}>Student ID</div>
                      <strong>{selectedPerformanceStudent.id}</strong>
                    </div>
                    <div style={{ background: "#f7f8ff", borderRadius: "14px", padding: "14px 16px" }}>
                      <div style={{ color: "#667085", fontSize: "12px", marginBottom: "6px" }}>Overall Risk / Risk Level</div>
                      <span className={`status-pill ${getPredictionStatusClass(selectedPerformanceStudent.prediction.riskLevel)}`}>
                        {selectedPerformanceStudent.academicDataComplete ? selectedPerformanceStudent.prediction.riskLevel || "Pending Analysis" : "Pending Analysis"}
                      </span>
                    </div>
                    <div style={{ background: "#f7f8ff", borderRadius: "14px", padding: "14px 16px" }}>
                      <div style={{ color: "#667085", fontSize: "12px", marginBottom: "6px" }}>Confidence</div>
                      <strong>
                        {!selectedPerformanceStudent.academicDataComplete || selectedPerformanceStudent.prediction.confidence == null
                          ? "Pending Analysis"
                          : `${Math.round(selectedPerformanceStudent.prediction.confidence)}%`}
                      </strong>
                    </div>
                    <div style={{ background: "#f7f8ff", borderRadius: "14px", padding: "14px 16px" }}>
                      <div style={{ color: "#667085", fontSize: "12px", marginBottom: "6px" }}>Overall Performance %</div>
                      <strong style={{ fontSize: "24px" }}>
                        {!selectedPerformanceStudent.academicDataComplete || selectedPerformanceStudent.prediction.overallScore == null
                          ? "Pending"
                          : `${selectedPerformanceStudent.prediction.overallScore}%`}
                      </strong>
                    </div>
                    <div style={{ background: "#f7f8ff", borderRadius: "14px", padding: "14px 16px" }}>
                      <div style={{ color: "#667085", fontSize: "12px", marginBottom: "6px" }}>Performance Status</div>
                          <span className={`status-pill ${getPerformanceStatusClass(getPerformanceStatus(selectedPerformanceStudent.prediction.overallScore))}`}>
                            {!selectedPerformanceStudent.academicDataComplete ? "Data Required" : getPerformanceStatus(selectedPerformanceStudent.prediction.overallScore) || "Data Required"}
                      </span>
                    </div>
                    <div style={{ background: "#f7f8ff", borderRadius: "14px", padding: "14px 16px" }}>
                      <div style={{ color: "#667085", fontSize: "12px", marginBottom: "6px" }}>Risk Percentage</div>
                      <strong>
                        {!selectedPerformanceStudent.academicDataComplete || selectedPerformanceStudent.prediction.riskPercent == null
                          ? "Pending Analysis"
                          : `${selectedPerformanceStudent.prediction.riskPercent}%`}
                      </strong>
                    </div>
                    <div style={{ background: "#f7f8ff", borderRadius: "14px", padding: "14px 16px" }}>
                      <div style={{ color: "#667085", fontSize: "12px", marginBottom: "6px" }}>Overall Attendance</div>
                      <strong>{selectedPerformanceStudent.academicDataComplete && selectedPerformanceStudent.attendance != null ? `${selectedPerformanceStudent.attendance}%` : "Data Required"}</strong>
                    </div>
                    <div style={{ background: "#f7f8ff", borderRadius: "14px", padding: "14px 16px" }}>
                      <div style={{ color: "#667085", fontSize: "12px", marginBottom: "6px" }}>Attendance Status</div>
                      <span className={selectedPerformanceStudent.attendanceStatus ? `attendance-status-badge attendance-${selectedPerformanceStudent.attendanceStatus.toLowerCase()}` : "attendance-status-badge"}>
                        {selectedPerformanceStudent.academicDataComplete ? selectedPerformanceStudent.attendanceStatus || "Data Required" : "Data Required"}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                    <div style={{ background: "#f7f8ff", borderRadius: "14px", padding: "18px" }}>
                      <h5 style={{ margin: "0 0 12px", fontSize: "16px" }}>Risk Factors</h5>
                      <ul style={{ margin: 0, paddingLeft: "18px", color: "#3d4464", lineHeight: 1.7 }}>
                          {selectedPerformanceStudent.prediction.riskFactors.length > 0 ? (
                            selectedPerformanceStudent.prediction.riskFactors.map((factor, index) => (
                              <li key={`${factor}-${index}`}>{factor}</li>
                            ))
                          ) : (
                            <li>{selectedPerformanceStudent.academicDataComplete ? "No risk factors identified." : "Will appear after academic data is entered"}</li>
                          )}
                      </ul>
                    </div>

                    <div style={{ background: "#f7f8ff", borderRadius: "14px", padding: "18px" }}>
                      <h5 style={{ margin: "0 0 12px", fontSize: "16px" }}>Recommendations</h5>
                      <ul style={{ margin: 0, paddingLeft: "18px", color: "#3d4464", lineHeight: 1.7 }}>
                          {selectedPerformanceStudent.prediction.recommendations.length > 0 ? (
                            selectedPerformanceStudent.prediction.recommendations.map((item, index) => (
                              <li key={`${item}-${index}`}>{item}</li>
                            ))
                          ) : (
                            <li>{selectedPerformanceStudent.academicDataComplete ? "No recommendations available." : "Will appear after academic data is entered"}</li>
                          )}
                      </ul>
                    </div>
                  </div>

                  <div style={{ background: "#f7f8ff", borderRadius: "14px", padding: "18px" }}>
                    <h5 style={{ margin: "0 0 14px", fontSize: "16px" }}>Subject-wise Prediction</h5>
                    <p style={{ margin: "0 0 14px", color: "#667085" }}>Performance and risk signals for each subject</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                      {selectedPerformanceStudent.prediction.subjectResults.length > 0 ? selectedPerformanceStudent.prediction.subjectResults.map((item) => (
                        <div key={item.subject} className={`subject-prediction-card performance-status-${getPerformanceStatus(item.score).toLowerCase().replace(/\s+/g, "-")}`}>
                          <div style={{ fontSize: "12px", color: "#667085", marginBottom: "8px" }}>{item.subject}</div>
                          <div className="score-display">
                            <span className="score">{item.score}%</span>
                            <span className={`status-pill ${getPerformanceStatusClass(getPerformanceStatus(item.score))}`}>
                              {getPerformanceStatus(item.score)}
                            </span>
                          </div>
                        </div>
                      )) : <p>Available after academic data is entered</p>}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                    <div style={{ background: "#f7f8ff", borderRadius: "14px", padding: "18px" }}>
                      <h5 style={{ margin: "0 0 12px", fontSize: "16px" }}>Weak Subjects</h5>
                      <ul style={{ margin: 0, paddingLeft: "18px", color: "#3d4464", lineHeight: 1.7 }}>
                        {selectedPerformanceStudent.prediction.weakSubjects.length > 0 ? (
                          selectedPerformanceStudent.prediction.weakSubjects.map((subject) => (
                            <li key={subject.subject}><strong>{subject.subject}</strong> ({subject.score}%)</li>
                          ))
                        ) : (
                          <li>{selectedPerformanceStudent.academicDataComplete ? "No weak subjects identified." : "Will be identified after academic data is entered"}</li>
                        )}
                      </ul>
                    </div>

                  </div>
                </div>
              </div>
            )}
          </section>
        ) : activeSection === "Attendance" ? (
          <section className="faculty-section-panel">
            <div className="faculty-section-card">
              <div className="panel-heading">
                <div>
                  <h3>Attendance</h3>
                  <p>Attendance summaries and status for each student.</p>
                </div>
              </div>
              <div className="table-scroll">
                <table className="faculty-data-table">
                  <thead>
                    <tr>
                      <th>Student Name</th>
                      <th>Student ID</th>
                      <th>Overall Attendance</th>
                      <th>Attendance Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRows.map((student) => (
                      <tr key={student.id}>
                        <td>{student.name}</td>
                        <td>{student.id}</td>
                        <td>{student.attendance == null ? "Data Required" : `${student.attendance}%`}</td>
                        <td>
                          <span className={student.status ? `attendance-status-badge attendance-${student.status.toLowerCase()}` : "attendance-status-badge"}>
                            {student.status || "Data Required"}
                          </span>
                        </td>
                        <td>
                          <button className="button-ghost" type="button" onClick={() => setSelectedAttendanceStudent(student)}>
                            View Details →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selectedAttendanceStudent && (
                <div className="faculty-section-card" style={{ marginTop: 20 }}>
                  <div className="panel-heading">
                    <div>
                      <h3>{selectedAttendanceStudent.name} — {selectedAttendanceStudent.id}</h3>
                      <small>Subject-wise attendance details</small>
                    </div>
                  </div>
                  <div className="table-scroll">
                    <table className="faculty-data-table">
                      <thead><tr><th>Subject</th><th>Total Classes</th><th>Attended</th><th>Missed</th><th>Attendance</th><th>Status</th></tr></thead>
                      <tbody>
                        {selectedAttendanceStudent.academicDataComplete && getAttendanceDetails(selectedAttendanceStudent).length ? getAttendanceDetails(selectedAttendanceStudent).map((record) => {
                          return <tr key={record.subject}><td>{record.subject}</td><td>{record.totalClasses ?? "Data Required"}</td><td>{record.classesAttended ?? "Data Required"}</td><td>{record.classesMissed ?? "Data Required"}</td><td>{record.percentage == null ? "Data Required" : `${record.percentage}%`}</td><td>{record.percentage == null ? "Data Required" : <span className={`attendance-status-badge attendance-${getAttendanceStatus(record.percentage).toLowerCase()}`}>{getAttendanceStatus(record.percentage)}</span>}</td></tr>;
                        }) : <tr><td colSpan="6">Data Required</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <div className="attendance-details-summary faculty-attendance-summary">
                    <h4>Attendance</h4>
                    <strong className="faculty-summary-percentage">{selectedAttendanceStudent.attendance == null ? "—" : `${selectedAttendanceStudent.attendance}%`}</strong>
                    <span className="faculty-summary-status">{selectedAttendanceStudent.status || "Data Required"}</span>
                    <button className="button-ghost" type="button" onClick={() => setSelectedAttendanceStudent(null)}>Close</button>
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : activeSection === "Assignments" ? (
          <section className="faculty-section-panel">
            <div className="faculty-section-card">
              <div className="panel-heading">
                <div>
                  <h3>Assignments</h3>
                  <p>Assignment completion data for your students.</p>
                </div>
              </div>
              <div className="table-scroll">
                <table className="faculty-data-table">
                  <thead>
                    <tr>
                      <th>Student Name</th>
                      <th>Student ID</th>
                      <th>Assignment Submission %</th>
                      <th>Assignment Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignmentRows.map((student) => (
                      <tr key={student.id}>
                        <td>{student.name}</td>
                        <td>{student.id}</td>
                        <td>{student.assignmentSubmission == null ? "Data Required" : `${student.assignmentSubmission}%`}</td>
                        <td>
                          <span className={`assignment-status ${getAssignmentStatusClass(student.status)}`}>
                            {student.status || "Data Required"}
                          </span>
                        </td>
                        <td>
                          <button className="button-ghost" type="button" onClick={() => setSelectedAssignmentStudent(student)}>
                            View Details →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selectedAssignmentStudent && (
                <div className="faculty-section-card" style={{ marginTop: 20 }}>
                  <div className="panel-heading">
                    <div>
                      <h3>{selectedAssignmentStudent.name} — {selectedAssignmentStudent.id}</h3>
                      <small>Subject-wise Assignment Performance</small>
                    </div>
                  </div>
                  <div className="table-scroll">
                    <table className="faculty-data-table">
                      <thead><tr><th>Subject</th><th>Assignment Submission</th><th>Status</th></tr></thead>
                      <tbody>
                        {selectedAssignmentStudent.subjects.length ? selectedAssignmentStudent.subjects.map((subject) => (
                          <tr key={subject.subject}>
                            <td>{subject.subject}</td>
                            <td>{subject.percentage}%</td>
                            <td><span className={`assignment-status ${getAssignmentStatusClass(getAssignmentStatus(subject.percentage))}`}>{getAssignmentStatus(subject.percentage)}</span></td>
                          </tr>
                        )) : <tr><td colSpan="3">Data Required</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <div className="attendance-details-summary faculty-assignment-insight">
                    <h4>Assignment</h4>
                    {(() => {
                      const insight = getAssignmentInsight(selectedAssignmentStudent.subjects);
                      return insight ? <><p><strong>Strongest:</strong> {insight.strongest.subject}</p><p><strong>Needs Attention:</strong> {insight.needsAttention.subject}</p></> : <p>Data Required</p>;
                    })()}
                    <button className="button-ghost" type="button" onClick={() => setSelectedAssignmentStudent(null)}>Close</button>
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : activeSection === "Risk Analysis" ? (
          <section className="faculty-section-panel">
            <div className="faculty-section-card">
              <div className="panel-heading">
                <div>
                  <h3>Risk Analysis</h3>
                  <p>Academic risk monitoring based on the ACAD PREDICT model output.</p>
                </div>
              </div>
              <div className="table-scroll">
                <table className="faculty-data-table">
                  <thead>
                    <tr>
                      <th>Student Name</th>
                      <th>Student ID</th>
                      <th>Risk Percentage</th>
                      <th>Risk Level</th>
                      <th>Risk Factors</th>
                      <th>Action / View Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riskRows.map((student) => (
                      <tr key={student.id}>
                        <td>{student.name}</td>
                        <td>{student.id}</td>
                        <td>
                          {student.riskPercentage == null
                            ? "Pending Analysis"
                            : `${student.riskPercentage}%`}
                        </td>
                        <td>
                          <span
                            className={`status-pill ${
                              student.riskLevel === "Low Risk"
                                ? "status-low"
                                : student.riskLevel === "Medium Risk"
                                ? "status-medium"
                                : student.riskLevel === "High Risk"
                                ? "status-high"
                                : "status-unavailable"
                            }`}
                          >
                            {student.riskLevel}
                          </span>
                        </td>
                        <td>
                          {student.predictionAvailable
                            ? student.riskFactors.join(", ")
                            : "Will appear after academic data is entered"}
                        </td>
                        <td>
                          <button
                            className="detail-button"
                            onClick={() => setSelectedRiskStudent(student)}
                            type="button"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedRiskStudent && (
              <div className="faculty-section-card" style={{ marginTop: "20px" }}>
                <div className="panel-heading">
                  <div>
                    <h4>Detailed Risk Analysis for {selectedRiskStudent.name}</h4>
                    <p>Risk profile generated from the student’s academic data and ACAD PREDICT prediction analysis.</p>
                  </div>
                </div>

                <div style={{ display: "grid", gap: "18px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                    <div style={{ flex: "1 1 180px", background: "#f7f8ff", borderRadius: "14px", padding: "14px 16px" }}>
                      <div style={{ color: "#667085", fontSize: "12px", marginBottom: "6px" }}>Risk Percentage</div>
                      <strong style={{ fontSize: "24px" }}>
                        {!selectedRiskStudent.academicDataComplete || selectedRiskStudent.riskPercentage == null
                          ? "Pending Analysis"
                          : `${selectedRiskStudent.riskPercentage}%`}
                      </strong>
                    </div>
                    <div style={{ flex: "1 1 180px", background: "#f7f8ff", borderRadius: "14px", padding: "14px 16px" }}>
                      <div style={{ color: "#667085", fontSize: "12px", marginBottom: "6px" }}>Risk Level</div>
                          <span
                            className={`status-pill ${
                              selectedRiskStudent.riskLevel === "Low Risk"
                                ? "status-low"
                                : selectedRiskStudent.riskLevel === "Medium Risk"
                                ? "status-medium"
                                : selectedRiskStudent.riskLevel === "High Risk"
                                ? "status-high"
                                : "status-unavailable"
                            }`}
                      >
                        {selectedRiskStudent.riskLevel}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                    <div style={{ background: "#f7f8ff", borderRadius: "14px", padding: "18px" }}>
                      <h5 style={{ margin: "0 0 12px", fontSize: "16px" }}>Weak Subjects</h5>
                      <ul style={{ margin: 0, paddingLeft: "18px", color: "#3d4464", lineHeight: 1.7 }}>
                        {selectedRiskStudent.predictionAvailable && selectedRiskStudent.weakSubjects.length > 0 ? (
                          selectedRiskStudent.weakSubjects.map((subject) => (
                            <li key={subject.subject}>{subject.subject} ({subject.score}%)</li>
                          ))
                        ) : (
                          <li>
                            {selectedRiskStudent.predictionAvailable
                              ? "No weak subjects identified."
                              : "Will be identified after academic data is entered"}
                          </li>
                        )}
                      </ul>
                    </div>

                    <div style={{ background: "#f7f8ff", borderRadius: "14px", padding: "18px" }}>
                      <h5 style={{ margin: "0 0 12px", fontSize: "16px" }}>Risk Factors</h5>
                      <ul style={{ margin: 0, paddingLeft: "18px", color: "#3d4464", lineHeight: 1.7 }}>
                        {selectedRiskStudent.predictionAvailable && selectedRiskStudent.riskFactors.length > 0 ? (
                          selectedRiskStudent.riskFactors.map((factor, index) => (
                            <li key={`${factor}-${index}`}>{factor}</li>
                          ))
                        ) : (
                          <li>
                            {selectedRiskStudent.predictionAvailable
                              ? "No risk factors identified."
                              : "Will appear after academic data is entered"}
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>

                  <div style={{ background: "#f7f8ff", borderRadius: "14px", padding: "18px" }}>
                    <h5 style={{ margin: "0 0 14px", fontSize: "16px" }}>Subject-wise Prediction</h5>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                      {selectedRiskStudent.subjectResults.length > 0 ? selectedRiskStudent.subjectResults.map((item) => (
                        <div key={item.subject} className={`subject-prediction-card performance-status-${getPerformanceStatus(item.score).toLowerCase().replace(/\s+/g, "-")}`}>
                          <div style={{ fontSize: "12px", color: "#667085", marginBottom: "8px" }}>{item.subject}</div>
                          <div className="score-display">
                            <span className="score">{item.score}%</span>
                            <span className={`status-pill ${getPerformanceStatusClass(getPerformanceStatus(item.score))}`}>
                              {getPerformanceStatus(item.score)}
                            </span>
                          </div>
                        </div>
                      )) : <p>Available after academic data is entered</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="faculty-section-panel">
            <div className="faculty-section-card">
              <div className="panel-heading">
                <div>
                  <h3>Reports</h3>
                  <p>Reports for performance, attendance, assignments, and risk.</p>
                </div>
              </div>
              <div className="reports-grid">
                <div className="report-card">
                  <h4>Performance Report</h4>
                  <p>Snapshot of student performance across assessments.</p>
                  {generatedReports.performance && (
                    <small>Generated {new Date(generatedReports.performance.generatedAt).toLocaleString()}</small>
                  )}
                  <div className="section-actions">
                    <button className="button-secondary" type="button" onClick={() => handleFacultyReportAction("performance", "View")}>View</button>
                    <button className="button-ghost" type="button" onClick={() => handleFacultyReportAction("performance", "Generate")}>Generate</button>
                    <button className="button-ghost" type="button" onClick={() => handleFacultyReportAction("performance", "Download")}>Download</button>
                  </div>
                </div>
                <div className="report-card">
                  <h4>Attendance Report</h4>
                  <p>Detailed attendance insights and trends.</p>
                  {generatedReports.attendance && (
                    <small>Generated {new Date(generatedReports.attendance.generatedAt).toLocaleString()}</small>
                  )}
                  <div className="section-actions">
                    <button className="button-secondary" type="button" onClick={() => handleFacultyReportAction("attendance", "View")}>View</button>
                    <button className="button-ghost" type="button" onClick={() => handleFacultyReportAction("attendance", "Generate")}>Generate</button>
                    <button className="button-ghost" type="button" onClick={() => handleFacultyReportAction("attendance", "Download")}>Download</button>
                  </div>
                </div>
                <div className="report-card">
                  <h4>Assignment Report</h4>
                  <p>Completion and submission status snapshots.</p>
                  {generatedReports.assignments && (
                    <small>Generated {new Date(generatedReports.assignments.generatedAt).toLocaleString()}</small>
                  )}
                  <div className="section-actions">
                    <button className="button-secondary" type="button" onClick={() => handleFacultyReportAction("assignments", "View")}>View</button>
                    <button className="button-ghost" type="button" onClick={() => handleFacultyReportAction("assignments", "Generate")}>Generate</button>
                    <button className="button-ghost" type="button" onClick={() => handleFacultyReportAction("assignments", "Download")}>Download</button>
                  </div>
                </div>
                <div className="report-card">
                  <h4>Risk Analysis Report</h4>
                  <p>Overview of student risk categories and actions.</p>
                  {generatedReports.risk && (
                    <small>Generated {new Date(generatedReports.risk.generatedAt).toLocaleString()}</small>
                  )}
                  <div className="section-actions">
                    <button className="button-secondary" type="button" onClick={() => handleFacultyReportAction("risk", "View")}>View</button>
                    <button className="button-ghost" type="button" onClick={() => handleFacultyReportAction("risk", "Generate")}>Generate</button>
                    <button className="button-ghost" type="button" onClick={() => handleFacultyReportAction("risk", "Download")}>Download</button>
                  </div>
                </div>
                <div className="report-card">
                  <h4>Complete Student Report</h4>
                  <p>Combined academic, attendance, and risk insights.</p>
                  {generatedReports.complete && (
                    <small>Generated {new Date(generatedReports.complete.generatedAt).toLocaleString()}</small>
                  )}
                  <div className="section-actions">
                    <button className="button-secondary" type="button" onClick={() => handleFacultyReportAction("complete", "View")}>View</button>
                    <button className="button-ghost" type="button" onClick={() => handleFacultyReportAction("complete", "Generate")}>Generate</button>
                    <button className="button-ghost" type="button" onClick={() => handleFacultyReportAction("complete", "Download")}>Download</button>
                  </div>
                </div>
              </div>
              {viewingReport && (
                <div className="faculty-section-card" style={{ marginTop: "20px" }}>
                  <div className="panel-heading">
                    <div>
                      <h4>{viewingReport.title}</h4>
                      <p>Generated from the latest available AcadPredict data.</p>
                    </div>
                    <button
                      className="button-ghost"
                      type="button"
                      onClick={() => setViewingReport(null)}
                    >
                      Close
                    </button>
                  </div>
                  <div className="table-scroll">
                    <table className="faculty-data-table">
                      <thead>
                        <tr>
                          {viewingReport.headers.map((header) => <th key={header}>{header}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {viewingReport.rows.map((row, rowIndex) => (
                          <tr key={`${viewingReport.title}-${rowIndex}`}>
                            {row.map((value, valueIndex) => <td key={`${rowIndex}-${valueIndex}`}>{value}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default FacultyDashboard;

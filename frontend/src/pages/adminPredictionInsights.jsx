import { useEffect, useMemo, useState } from "react";
import { getAttendanceStatus, getAttendanceSummary } from "../attendance";
import { fetchStudents, getAcademicDataStatus, getPerformanceStatus, getStudentPerformance, STUDENTS_UPDATED_EVENT } from "../studentData";

const SUBJECTS = [
  "Python Programming",
  "Computer Networks",
  "Database Management",
  "Mathematics",
  "Operating System",
  "Data Structures",
];

const RISK_LEVELS = ["High", "Medium", "Low"];
const RISK_COLORS = { High: "#ef7070", Medium: "#e5af4f", Low: "#55b987" };

function predictionTime(prediction) {
  const value = new Date(prediction.created_at || prediction.timestamp || 0).getTime();
  return Number.isNaN(value) ? 0 : value;
}

function formatDate(value, options = { day: "2-digit", month: "short" }) {
  return new Date(value).toLocaleDateString("en-IN", options);
}

function formatDateTime(value) {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function AdminPredictionInsights({ embedded = false }) {
  const [students, setStudents] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadInsightsData = async () => {
      try {
        const [studentData, predictionsResponse] = await Promise.all([
          fetchStudents(),
          fetch("http://127.0.0.1:5001/predictions"),
        ]);
        if (!predictionsResponse.ok) throw new Error("Unable to load insights data");
        const predictionData = await predictionsResponse.json();
        if (active) {
          setStudents(studentData);
          setPredictions(Array.isArray(predictionData) ? predictionData : []);
          setLoading(false);
        }
      } catch (error) {
        console.error("Admin insights error:", error);
        if (active) setLoading(false);
      }
    };

    loadInsightsData();
    window.addEventListener(STUDENTS_UPDATED_EVENT, loadInsightsData);
    const refreshTimer = window.setInterval(loadInsightsData, 5000);
    return () => {
      active = false;
      window.removeEventListener(STUDENTS_UPDATED_EVENT, loadInsightsData);
      window.clearInterval(refreshTimer);
    };
  }, []);

  const insightData = useMemo(() => {
    const history = predictions
      .filter((prediction) => predictionTime(prediction) > 0)
      .sort((first, second) => predictionTime(first) - predictionTime(second));
    const latestByStudent = {};
    const studentsById = new Map(students.map((student) => [String(student.student_id), student]));
    const completeStudentIds = new Set(
      students
        .filter((student) => getAcademicDataStatus(student).complete)
        .map((student) => String(student.student_id))
    );
    history.forEach((prediction) => {
      if (!studentsById.has(String(prediction.student_id)) || !completeStudentIds.has(String(prediction.student_id))) return;
      const current = latestByStudent[prediction.student_id];
      if (!current || predictionTime(prediction) >= predictionTime(current)) {
        latestByStudent[prediction.student_id] = prediction;
      }
    });

    const currentCounts = RISK_LEVELS.reduce((counts, level) => ({ ...counts, [level]: 0 }), {});
    Object.values(latestByStudent).forEach((prediction) => {
      if (currentCounts[prediction.risk_level] !== undefined) currentCounts[prediction.risk_level] += 1;
    });

    const latestTimestamp = history.at(-1) ? predictionTime(history.at(-1)) : 0;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const studentMetrics = students.map((student) => {
      if (!getAcademicDataStatus(student).complete) return null;
      return {
        performance: getStudentPerformance(student),
        attendance: getAttendanceSummary(student, SUBJECTS).overallAttendance,
      };
    });
    const performanceBuckets = [
      { label: "Strong", value: 0 },
      { label: "Moderate", value: 0 },
      { label: "Needs Improvement", value: 0 },
    ];
    const attendanceBuckets = [
      { label: "Good", status: "Good", value: 0 },
      { label: "Warning", status: "Warning", value: 0 },
      { label: "Critical", status: "Critical", value: 0 },
    ];
    studentMetrics.filter(Boolean).forEach(({ performance, attendance }) => {
      const performanceBucket = performanceBuckets.find(({ label }) => getPerformanceStatus(performance) === label);
      const attendanceBucket = attendanceBuckets.find(({ status }) => status === getAttendanceStatus(attendance));
      if (performanceBucket) performanceBucket.value += 1;
      if (attendanceBucket) attendanceBucket.value += 1;
    });

    const academicDataStatus = students.reduce((status, student) => {
      const academicStatus = getAcademicDataStatus(student);
      if (academicStatus.complete) status.complete += 1;
      else if (academicStatus.missing.length === SUBJECTS.length * 3) status.notEntered += 1;
      else status.partial += 1;
      return status;
    }, { complete: 0, partial: 0, notEntered: 0 });

    const latestPredictions = Object.values(latestByStudent);
    const newPredictions = history.filter((prediction) => predictionTime(prediction) >= todayStart.getTime()).length;

    return {
      history,
      latestByStudent,
      currentCounts,
      performanceBuckets,
      attendanceBuckets,
      academicDataStatus,
      latestUpdate: latestTimestamp || null,
      newPredictions,
      coverage: `${latestPredictions.length} of ${students.length}`,
    };
  }, [predictions, students]);

  const totalCurrent = RISK_LEVELS.reduce((sum, level) => sum + insightData.currentCounts[level], 0);
  const dataCompletionPercent = students.length
    ? Math.round(insightData.academicDataStatus.complete / students.length * 100)
    : 0;
  const performanceMaximum = Math.max(...insightData.performanceBuckets.map((bucket) => bucket.value), 1);
  const attendanceTotal = insightData.attendanceBuckets.reduce((sum, bucket) => sum + bucket.value, 0);

  return (
    <div className={`admin-insights-page${embedded ? " admin-insights-embedded" : ""}`}>
      <header className="admin-insights-header">
        <div>
          <span className="header-overline">Administration</span>
          <h1>AI Prediction Insights</h1>
          <p>Live risk intelligence from current student predictions.</p>
        </div>
      </header>

      {loading && !insightData.history.length ? <p className="insight-loading">Loading current prediction data...</p> : (
        <main className="admin-insights-content">
          <section className="insights-chart-grid">
            <article className="insight-chart-card donut-card">
              <div className="insight-chart-heading"><div><h2>Risk Distribution</h2><p>Latest prediction for each student</p></div><span>{totalCurrent} students</span></div>
              {totalCurrent ? <div className="donut-layout"><div className="risk-donut" style={{ background: `conic-gradient(${RISK_COLORS.High} 0 ${insightData.currentCounts.High / totalCurrent * 100}%, ${RISK_COLORS.Medium} ${insightData.currentCounts.High / totalCurrent * 100}% ${(insightData.currentCounts.High + insightData.currentCounts.Medium) / totalCurrent * 100}%, ${RISK_COLORS.Low} ${(insightData.currentCounts.High + insightData.currentCounts.Medium) / totalCurrent * 100}% 100%)` }}><div><strong>{totalCurrent}</strong><span>students</span></div></div><div className="chart-legend">{RISK_LEVELS.map((level) => <div key={level} title={`${level} Risk: ${insightData.currentCounts[level]} students`}><i style={{ background: RISK_COLORS[level] }} /><span>{level} Risk</span><strong>{insightData.currentCounts[level]} ({Math.round(insightData.currentCounts[level] / totalCurrent * 100)}%)</strong></div>)}</div></div> : <p className="insight-empty-state">No current prediction data available.</p>}
            </article>

            <article className="insight-chart-card prediction-activity-card">
              <div className="insight-chart-heading"><div><h2>Prediction Activity</h2><p>Current prediction records and coverage</p></div></div>
              <div className="activity-metric-list">
                <div><span>Total Predictions</span><strong>{insightData.history.length}</strong></div>
                <div><span>New Predictions</span><strong>{insightData.newPredictions}</strong></div>
                <div><span>Prediction Coverage</span><strong>{insightData.coverage}</strong></div>
                <div><span>Latest Prediction</span><strong>{insightData.latestUpdate ? formatDateTime(insightData.latestUpdate) : "Data not available"}</strong></div>
              </div>
            </article>
          </section>

          <section className="insights-chart-grid">
            <article className="insight-chart-card academic-data-status-card">
              <div className="insight-chart-heading"><div><h2>Academic Data Status</h2><p>Current student data completion</p></div></div>
              <div className="data-completion-progress">
                <div className="data-completion-progress-heading"><span>Data Completion</span><strong>{insightData.academicDataStatus.complete} of {students.length} students</strong></div>
                <div className="data-completion-track"><span style={{ width: `${dataCompletionPercent}%` }} /></div>
                <small>{dataCompletionPercent}% of students have complete academic data</small>
              </div>
              <div className="data-status-counts">
                <div><i className="complete" /><span>Complete Data</span><strong>{insightData.academicDataStatus.complete}</strong></div>
                <div><i className="partial" /><span>Partial Data</span><strong>{insightData.academicDataStatus.partial}</strong></div>
                <div><i className="not-entered" /><span>Data Not Entered</span><strong>{insightData.academicDataStatus.notEntered}</strong></div>
              </div>
            </article>
            <article className="insight-chart-card">
              <div className="insight-chart-heading"><div><h2>Performance Overview</h2><p>Current student performance distribution</p></div></div>
              <div className="performance-vertical-chart">{insightData.performanceBuckets.map((bucket) => { const statusClass = bucket.label.toLowerCase().replace(/\s+/g, "-"); return <div className="performance-vertical-column" key={bucket.label} title={`${bucket.label}: ${bucket.value} students`}><strong>{bucket.value}</strong><div className="performance-vertical-track"><i className={statusClass} style={{ height: `${bucket.value / performanceMaximum * 100}%` }} /></div><span className={`performance-label ${statusClass}`}>{bucket.label}</span></div>; })}</div>
            </article>
          </section>

          <section className="insight-chart-card attendance-overview-card">
            <div className="insight-chart-heading"><div><h2>Attendance Overview</h2><p>Current attendance distribution from student records</p></div></div>
            <div className="attendance-progress-list">{insightData.attendanceBuckets.map((bucket) => { const percentage = attendanceTotal ? Math.round(bucket.value / attendanceTotal * 100) : 0; return <div className="attendance-progress-row" key={bucket.label} title={`${bucket.label}: ${bucket.value} students`}><div className="attendance-progress-heading"><span>{bucket.label}</span><strong>{bucket.value}</strong><small>{percentage}%</small></div><div className="attendance-progress-track"><i className={`attendance-${bucket.status.toLowerCase()}`} style={{ width: `${percentage}%` }} /></div></div>; })}</div>
          </section>

          <p className="insight-updated">Latest prediction update: {insightData.latestUpdate ? new Date(insightData.latestUpdate).toLocaleString() : "Unavailable"}</p>
        </main>
      )}
    </div>
  );
}

export default AdminPredictionInsights;

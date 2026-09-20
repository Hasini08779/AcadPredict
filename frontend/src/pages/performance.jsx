import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPerformanceStatus, getSubjectScore, useStudentData } from "../studentData";
import AcademicDataEmptyState from "../components/academicDataEmptyState";

function getValidScore(value) {
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 && score <= 100 ? score : null;
}

function average(values) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function Performance() {
  const navigate = useNavigate();
  const [selectedSemester, setSelectedSemester] = useState("");
  const { status, student, predictions, attendance, assignments, academicDataComplete, missingAcademicData } = useStudentData();
  const currentSemester = student?.semester == null ? null : String(student.semester);
  const activeSemester = selectedSemester || currentSemester;
  const semesterOptions = [...new Set([currentSemester, ...predictions.map((prediction) => prediction.semester)].filter(Boolean))]
    .map(String).sort((first, second) => Number(first) - Number(second));
  const selectedPredictions = predictions.filter((prediction) => {
    const semester = prediction.semester == null ? currentSemester : String(prediction.semester);
    return semester === activeSemester;
  });
  const predictionSubjects = selectedPredictions.flatMap((prediction) => prediction.subject_results || prediction.subjectResults || []);
  const currentSubjectEntries = activeSemester === currentSemester
    ? Object.entries(student?.subjects || {}).map(([name, data]) => [name, getValidScore(getSubjectScore(data))])
    : [];
  const subjectMap = new Map();
  const predictionScores = new Map();
  predictionSubjects.forEach((item) => {
    const score = getValidScore(item.score);
    if (item.subject && score != null) {
      const scores = predictionScores.get(item.subject) || [];
      predictionScores.set(item.subject, [...scores, score]);
    }
  });
  const subjectEntries = currentSubjectEntries.some(([, score]) => score != null)
    ? currentSubjectEntries
    : [...predictionScores.entries()].map(([name, values]) => [name, average(values)]);
  subjectEntries.forEach(([name, score]) => { if (name && score != null) subjectMap.set(name, score); });
  const subjects = [...subjectMap.entries()]
    .map(([name, score]) => ({ name, score, status: getPerformanceStatus(score) }))
    .sort((first, second) => first.score - second.score);
  const performanceDistribution = ["Strong", "Moderate", "Needs Improvement"].map((category) => {
    const count = subjects.filter((subject) => subject.status === category).length;
    return {
      category,
      count,
      percentage: subjects.length ? Math.round(count / subjects.length * 1000) / 10 : 0,
    };
  });
  const averageScore = average(subjects.map((subject) => subject.score));
  const previousSemester = semesterOptions.filter((semester) => Number(semester) < Number(activeSemester)).at(-1);
  const previousSemesterScore = average(predictions
    .filter((prediction) => String(prediction.semester) === previousSemester)
    .map((prediction) => getValidScore(prediction.overall_score)).filter((score) => score != null));
  const change = averageScore != null && previousSemesterScore != null ? averageScore - previousSemesterScore : null;
  const performanceStatus = getPerformanceStatus(averageScore);
  const strongest = subjects.at(-1);
  const weakest = subjects[0];
  const insightText = change > 0
    ? "Your recent performance is improving. Keep maintaining your current study routine."
    : change < 0
    ? "Your recent performance has declined. Review your focus areas and prioritize the subjects needing attention."
    : "Your performance is stable. Continue focusing on your weaker subjects to maintain progress.";
  const performanceTitle = performanceStatus ? `${performanceStatus} Performance` : null;
  const assignmentData = assignments && typeof assignments === "object" ? assignments : {};
  const assignmentPercentage = Number(assignmentData.percentage);
  const assignmentHasData = Number.isFinite(assignmentPercentage)
    && assignmentPercentage >= 0
    && assignmentPercentage <= 100;
  const improvementTarget = weakest
    ? { subject: weakest.name, score: Math.min(weakest.score + 5, 100) }
    : null;
  if (status === "loading") return <div className="analytics-page"><p>Loading performance distribution...</p></div>;
  if (status === "error") return <div className="analytics-page"><p>Unable to load performance distribution</p></div>;
  if (!academicDataComplete) return <div className="analytics-page academic-performance-empty-page"><AcademicDataEmptyState variant="performance" missing={missingAcademicData} /><AcademicDataEmptyState variant="insights" missing={missingAcademicData} /></div>;

  return (
    <div className="analytics-page">
      <div className="analytics-top">
        <div><div className="analytics-label">PERFORMANCE ANALYTICS</div><h1>My Performance</h1><p>A detailed view of your academic progress, strengths and areas for improvement.</p></div>
        <button className="analytics-back" onClick={() => navigate("/dashboard")}>← Back to Dashboard</button>
      </div>

      <section className="score-section">
          <div className="score-main">
          <div className="score-circle"><div><strong>{averageScore == null ? "—" : averageScore}</strong><span>%</span></div></div>
          <div><p className="score-small">OVERALL PERFORMANCE</p><h2>{performanceTitle || "No performance data available"}</h2><p className="score-description">{performanceStatus == null ? "No performance data available" : performanceStatus === "Strong" ? "Your academic performance is strong. Keep maintaining your current study routine." : performanceStatus === "Moderate" ? "Your academic performance is progressing normally. Continue focusing on consistent improvement." : "Review your focus areas and prioritize the subjects needing attention."}</p></div>
        </div>
        <div className="score-stats"><div><span>Average Score</span><strong>{averageScore == null ? "—" : `${averageScore}%`}</strong></div><div><span>Attendance</span><strong>{attendance ? `${attendance.overallAttendance}%` : "—"}</strong></div><div><span>Assignments</span><strong>{assignmentData.percentage == null ? "—" : `${assignmentData.percentage}%`}</strong></div></div>
      </section>

      <section className="analytics-grid">
        <div className="analytics-card trend-card">
          <div className="analytics-card-heading"><div><h2>Performance Distribution</h2><p>Your subjects grouped by current performance level.</p></div><select className="period" value={activeSemester || ""} onChange={(event) => setSelectedSemester(event.target.value)} aria-label="Select semester">{semesterOptions.map((semester) => <option key={semester} value={semester}>Semester {semester}</option>)}</select></div>
          <div className="performance-distribution-list">{subjects.length ? performanceDistribution.map((item) => <div className="performance-distribution-row" key={item.category}><div className="performance-distribution-line"><strong className={`performance-distribution-label ${item.category.toLowerCase()}`}>{item.category}</strong><span>{item.count} {item.count === 1 ? "subject" : "subjects"}</span><b>{item.percentage}%</b></div><div className="performance-distribution-bar"><span className={`performance-distribution-fill ${item.category.toLowerCase()}`} style={{ width: `${item.percentage}%` }} /></div></div>) : <p>{activeSemester ? "No subject performance data available for this semester" : "No subject performance data available"}</p>}</div>
        </div>
        <div className="analytics-card insight-card"><div className="insight-title"><div className="insight-symbol">✦</div><span>PERSONALIZED STUDY PLAN</span></div><h2>{performanceTitle || "Data required"}</h2><p>{performanceStatus == null ? "Complete your academic data to receive a personalized study plan." : insightText}</p><div className="insight-item"><span>Strongest Area</span><strong>{strongest ? `${strongest.name} · ${strongest.score}%` : "Data required"}</strong></div><div className="insight-item warning"><span>Needs Attention</span><strong>{weakest ? `${weakest.name} · ${weakest.score}%` : "Data required"}</strong></div><button onClick={() => navigate("/ai-recommendations")}>Open Personalized Study Plan →</button></div>
      </section>

      <section className="subject-analysis academic-progress-breakdown">
        <div className="subject-heading"><div><div className="analytics-label">ACADEMIC INSIGHTS</div><h2>A quick view of your academic strengths and areas to improve.</h2></div></div>
        <div className="academic-progress-list">
          <div className="academic-progress-item"><div className="subject-number">01</div><div className="academic-progress-copy"><strong>Top Subject</strong><small>{strongest ? `${strongest.name} · ${strongest.score}%` : "No subject data available"}</small></div><span className="analysis-status status-excellent">{strongest ? "Your strongest subject" : "No subject data available"}</span></div>
          <div className="academic-progress-item"><div className="subject-number">02</div><div className="academic-progress-copy"><strong>Focus Subject</strong><small>{weakest ? `${weakest.name} · ${weakest.score}%` : "No focus subject available"}</small></div><span className="analysis-status status-focus">{weakest ? "Immediate area to improve" : "No focus subject available"}</span></div>
          <div className="academic-progress-item"><div className="subject-number">03</div><div className="academic-progress-copy"><strong>Assignment Submission</strong><small>{assignmentHasData ? `${assignmentPercentage}% complete` : "Assignment data unavailable"}</small></div><span className="analysis-status status-good">{assignmentHasData ? "Available" : "Not available"}</span></div>
          <div className="academic-progress-item"><div className="subject-number">04</div><div className="academic-progress-copy"><strong>Improvement Target</strong><small>{improvementTarget ? `${improvementTarget.subject} → Target ${improvementTarget.score}%` : "No target available"}</small></div><span className="analysis-status status-good">{improvementTarget ? "Next performance goal" : "No target available"}</span></div>
        </div>
      </section>

      <section className="bottom-insights"><div className="mini-insight"><span>✓</span><div><strong>Your strength</strong><p>{strongest ? `${strongest.name} · ${strongest.score}%. Your strongest current subject based on available performance data.` : "No subject performance data available"}</p></div></div><div className="mini-insight"><span>!</span><div><strong>Focus area</strong><p>{weakest ? `${weakest.name} · ${weakest.score}%. This is your lowest-scoring available subject.` : "No focus area is available."}</p></div></div></section>
      <div className="analytics-footer">AcadPredict • Academic Performance Analytics</div>
    </div>
  );
}

export default Performance;

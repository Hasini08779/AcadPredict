import { useNavigate } from "react-router-dom";
import { getPerformanceStatus, getRiskFactors, getStudentPerformance, getSubjectScore, getWeakSubjects, SUBJECTS, useStudentData } from "../studentData";
import AcademicDataEmptyState from "../components/academicDataEmptyState";

function getScore(value) {
  if (value === null || value === undefined || value === "") return null;
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 && score <= 100 ? score : null;
}

function uniqueValues(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()))];
}

function RiskAnalysis() {
  const navigate = useNavigate();
  const { status, student, latestPrediction, attendance, assignments, academicDataComplete, missingAcademicData } = useStudentData();
  const riskLevel = ["High", "Medium", "Low"].includes(latestPrediction?.risk_level) ? latestPrediction.risk_level : null;
  const confidence = getScore(latestPrediction?.confidence);
  const riskPercent = getScore(latestPrediction?.risk_percentage);
  const performance = academicDataComplete ? getStudentPerformance(student) : null;
  const subjectMap = new Map(
    SUBJECTS
      .map((subject) => [subject, getScore(getSubjectScore(student?.subjects?.[subject]))])
      .filter(([, score]) => score != null)
  );

  const subjects = [...subjectMap.entries()]
    .map(([subject, score]) => ({ subject, score, status: getPerformanceStatus(score) }))
    .sort((first, second) => first.score - second.score);
  const weakSubjects = academicDataComplete ? getWeakSubjects(student) : [];
  const strongSubjects = subjects.filter((subject) => subject.score >= 80);
  const factors = uniqueValues(student ? getRiskFactors(student) : []);
  const factorSubjects = (phrase) => factors
    .filter((factor) => factor.toLowerCase().includes(phrase))
    .map((factor) => factor.split(":")[0].trim());
  const attendanceRiskSubjects = [...new Set(factorSubjects("low attendance"))];
  const assignmentRiskSubjects = [...new Set(factorSubjects("low assignment submission"))];
  const actionGroups = [
    attendanceRiskSubjects.length ? `Improve attendance in ${attendanceRiskSubjects.join(" and ")}.` : null,
    assignmentRiskSubjects.length ? `Complete pending assignments, especially in ${assignmentRiskSubjects.join(", ")}.` : null,
    weakSubjects.length ? `Give additional study focus to ${weakSubjects.map((subject) => subject.subject).join(", ")}.` : null,
  ].filter(Boolean);
  const actions = actionGroups.length
    ? actionGroups
    : riskLevel === "Low"
    ? ["Maintain your current academic routine and continue monitoring your progress."]
    : ["Complete academic data to receive personalized recommendations."];
  const riskTone = String(riskLevel || "unavailable").toLowerCase();
  const ringProgress = riskPercent == null ? 0 : riskPercent;
  const riskMessage = riskLevel === "High"
    ? "Immediate academic attention is recommended."
    : riskLevel === "Medium"
    ? "Review your focus areas and keep your academic routine consistent."
    : riskLevel === "Low"
    ? "Your current academic indicators are in a healthy range."
    : "A risk prediction is not available yet.";

  if (status === "loading") return <div className="risk-page"><p className="risk-page-state">Loading risk analysis...</p></div>;
  if (status === "error") return <div className="risk-page"><p className="risk-page-state">Unable to load risk analysis.</p></div>;
  if (!academicDataComplete) return <div className="risk-page"><AcademicDataEmptyState variant="risk" missing={missingAcademicData} /></div>;

  return (
    <div className="risk-page">
      <header className="risk-topbar">
        <div>
          <div className="analytics-label">ACADPREDICT / ANALYTICS</div>
          <h1>Risk Analysis</h1>
          <p>{student?.name ? `${student.name}'s academic risk overview` : "No student data available"}</p>
        </div>
        <button className="analytics-back" onClick={() => navigate("/dashboard")}>← Back</button>
      </header>

      <main className="risk-dashboard-content">
        <section className={`risk-hero-card ${riskTone}`}>
          <div className="risk-hero-copy">
            <span className="risk-eyebrow">CURRENT ACADEMIC RISK</span>
            <h2>{riskLevel ? `${riskLevel} Risk` : "No risk prediction available"}</h2>
            <p>{riskMessage}</p>
            <div className="risk-hero-metrics">
              <div><span>Overall Performance</span><strong>{performance == null ? "Data Required" : `${performance}%`}</strong></div>
              <div><span>Performance Status</span><strong>{getPerformanceStatus(performance) || "Data Required"}</strong></div>
              <div><span>Confidence</span><strong>{confidence == null ? "Pending Analysis" : `${confidence}%`}</strong></div>
              <div><span>Overall Attendance</span><strong>{attendance?.overallAttendance == null ? "Data Required" : `${attendance.overallAttendance}%`}</strong></div>
              <div><span>Attendance Status</span><strong>{attendance?.attendanceStatus || "Data Required"}</strong></div>
            </div>
          </div>
          <div className="risk-progress-ring" style={{ "--risk-progress": `${ringProgress * 3.6}deg` }}>
            <div><strong>{riskPercent == null ? "—" : `${riskPercent}%`}</strong><span>Risk score</span></div>
          </div>
        </section>

        <section className="risk-dashboard-card risk-subject-prediction-card">
          <div className="risk-card-heading"><div><span className="risk-eyebrow">SUBJECT-WISE PREDICTION</span><h2>Subject-wise Prediction</h2><p className="risk-card-subtitle">Performance and risk signals for each subject</p></div></div>
          {subjects.length ? <div className="risk-prediction-rows">{subjects.map((subject) => <div className="risk-prediction-row" key={subject.subject}><div><strong>{subject.subject}</strong><span className={`risk-prediction-status ${String(subject.status || "").toLowerCase().replace(/\s+/g, "-")}`}>{subject.status || "Data Required"}</span></div><b>{subject.score}%</b></div>)}</div> : <p className="risk-empty">Subject data required.</p>}
        </section>

        <section className="risk-dashboard-card">
          <div className="risk-card-heading"><div><span className="risk-eyebrow">RISK FACTORS</span><h2>Why this risk level applies</h2></div><span className="risk-card-icon">!</span></div>
          {factors.length ? <div className="risk-factor-rows">{factors.map((factor) => <div className="risk-factor-row" key={factor}><span className="risk-row-icon">!</span><div><strong>{factor.split(":")[0]}</strong><p>{factor.includes(":") ? factor.slice(factor.indexOf(":") + 1).trim() : factor}</p></div><span className="risk-row-marker" /></div>)}</div> : <p className="risk-empty">No risk factors identified.</p>}
        </section>

        <section className="risk-subject-columns">
          <div className="risk-dashboard-card">
            <div className="risk-card-heading"><div><span className="risk-eyebrow">WEAK SUBJECTS</span><h2>Needs Improvement</h2></div><span className="risk-card-icon warning">!</span></div>
            {weakSubjects.length ? <ol className="weak-subjects-list">{weakSubjects.map((subject) => <li key={subject.subject}><strong>{subject.subject}</strong><span className="score-badge">{subject.score}%</span></li>)}</ol> : <p className="risk-empty">No weak subjects identified.</p>}
          </div>
          <div className="risk-dashboard-card">
            <div className="risk-card-heading"><div><span className="risk-eyebrow">STRONG SUBJECTS</span><h2>Performing Well</h2></div><span className="risk-card-icon success">✓</span></div>
            {strongSubjects.length ? <div className="risk-subject-rows">{strongSubjects.map((subject) => <div className="risk-subject-row" key={subject.subject}><div><strong>{subject.subject}</strong><div className="risk-subject-bar success"><span style={{ width: `${subject.score}%` }} /></div></div><b>{subject.score}%</b></div>)}</div> : <p className="risk-empty">No strong subjects identified.</p>}
          </div>
        </section>

        <section className="risk-dashboard-card risk-recommendations-card">
          <div className="risk-card-heading"><div><span className="risk-eyebrow">WHAT YOU SHOULD DO</span><h2>Personalized Next Steps</h2></div><span className="risk-card-icon">✦</span></div>
          {actions.length ? <div className="risk-recommendation-rows">{actions.map((action) => <div className="risk-recommendation-row" key={action}><span>✓</span><p>{action}</p></div>)}</div> : <p className="risk-empty">No recommendations available.</p>}
        </section>
      </main>
    </div>
  );
}

export default RiskAnalysis;

import { useNavigate } from "react-router-dom";
import { getPerformanceStatus, useStudentData } from "../studentData";

function Dashboard() {
  const navigate = useNavigate();
  const { status, student, latestPrediction, attendance, assignments, performance } = useStudentData();
  const studentName = student?.name || "Student";
  const studentId = student?.student_id ?? "Not Entered";
  const semester = student?.semester ?? "Not Entered";
  const department = student?.department ?? "Not Entered";
  const riskLevel = ["High", "Medium", "Low"].includes(latestPrediction?.risk_level)
    ? latestPrediction.risk_level
    : null;
  const nextStepMessage = performance == null
    ? "Add your academic data to get personalized guidance."
    : getPerformanceStatus(performance) === "Strong"
    ? "Keep building consistent academic progress."
    : getPerformanceStatus(performance) === "Moderate"
    ? "Stay consistent with your academic work."
    : "Continue focusing on steady improvement.";
  const overviewItems = [
    ["♙", "Overall Performance", performance == null ? "Data Required" : `${performance}%`, "performance"],
    ["✓", "Attendance", attendance?.overallAttendance == null ? "Data Required" : `${attendance.overallAttendance}%`, "attendance"],
    ["↗", "Assignment Submission", assignments?.percentage == null ? "Data Required" : `${assignments.percentage}%`, "assignment"],
    ["◇", "Risk Level", riskLevel || "Pending Analysis", "risk"],
  ];
  const supportItems = [
    ["▥", "Performance", "Track your academic progress", "View Performance →", "/performance"],
    ["!", "Risk Analysis", "Understand your current academic risk", "View Risk →", "/risk-analysis"],
    ["✦", "Study Plan", "Get personalized guidance for your studies", "Open Study Plan →", "/ai-recommendations"],
  ];

  return (
    <div className="dashboard-home-content">
      <header className="dashboard-home-header">
        <div>
          <p className="dashboard-home-eyebrow">STUDENT PORTAL</p>
          <h1>Welcome back, {studentName} 👋</h1>
          <p>Your academic overview and personalized support in one place.</p>
        </div>
        <div className="dashboard-home-avatar" aria-label={`${studentName} profile`}>{studentName.charAt(0).toUpperCase()}</div>
      </header>

      <section className="dashboard-profile-card" aria-label="Student profile">
        <div className="dashboard-profile-avatar">{studentName.charAt(0).toUpperCase()}</div>
        <div className="dashboard-profile-main">
          <p className="dashboard-home-eyebrow">STUDENT PROFILE</p>
          <h2>{status === "loading" ? "Loading profile..." : studentName}</h2>
          <div className="dashboard-profile-meta">
            <span><small>Department:</small><strong>{department}</strong></span>
            <span><small>Student ID:</small><strong>{studentId}</strong></span>
            <span><small>Semester:</small><strong>{semester}</strong></span>
          </div>
        </div>
      </section>

      <section className="dashboard-overview-section" aria-labelledby="quick-overview">
        <div className="dashboard-section-heading">
          <p className="dashboard-home-eyebrow">QUICK OVERVIEW</p>
          <h2 id="quick-overview">Your academic snapshot</h2>
        </div>
        <div className="dashboard-overview-grid">
          {overviewItems.map(([icon, title, value, tone]) => (
            <div className={`dashboard-overview-card ${tone}`} key={title}>
              <span className="dashboard-overview-icon">{icon}</span>
              <div><small>{title}</small><strong>{value}</strong></div>
            </div>
          ))}
        </div>
      </section>

      <section className="dashboard-support-section" aria-labelledby="academic-support">
        <div className="dashboard-section-heading">
          <p className="dashboard-home-eyebrow">EXPLORE YOUR ACADEMIC TOOLS</p>
          <h2 id="academic-support">Explore Your Academic Tools</h2>
        </div>
        <div className="dashboard-support-list">
          {supportItems.map(([icon, title, description, action, path]) => (
            <div className="dashboard-support-item" key={title}>
              <span className="dashboard-support-icon">{icon}</span>
              <div className="dashboard-support-copy"><strong>{title}</strong><p>{description}</p><button onClick={() => navigate(path)}>{action}</button></div>
            </div>
          ))}
        </div>
      </section>

      <section className="dashboard-next-step" aria-labelledby="next-step-heading">
        <div className="dashboard-next-step-icon">→</div>
        <div>
          <p className="dashboard-home-eyebrow">YOUR NEXT STEP</p>
          <h2 id="next-step-heading">{nextStepMessage}</h2>
        </div>
      </section>

    </div>
  );
}

export default Dashboard;
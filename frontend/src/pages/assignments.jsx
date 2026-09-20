import { useNavigate } from "react-router-dom";
import { getAssignmentStatus, getAssignmentStatusClass, getAssignmentSubjects, useStudentData } from "../studentData";
import AcademicDataEmptyState from "../components/academicDataEmptyState";

function Assignments() {
  const navigate = useNavigate();
  const { status: dataState, student, assignments: assignmentSummary, academicDataComplete, missingAcademicData } = useStudentData();
  const assignmentData = assignmentSummary && typeof assignmentSummary === "object" ? assignmentSummary : {};
  const percentage = assignmentData.percentage;
  const hasAssignmentData = percentage !== null && percentage !== undefined && percentage !== ""
    && Number.isFinite(Number(percentage)) && Number(percentage) >= 0 && Number(percentage) <= 100;
  const numericPercentage = hasAssignmentData ? Number(percentage) : null;
  const assignmentStatus = getAssignmentStatus(numericPercentage);
  const subjectAssignments = getAssignmentSubjects(student);
  const statusOnTrack = assignmentStatus === "Completed" || assignmentStatus === "Partially Completed";
  const semester = student?.semester ? `Semester ${student.semester}` : "Academic details unavailable";
  const statusLabel = assignmentStatus === "Completed" ? "On Track" : assignmentStatus === "Partially Completed" ? "On Track" : "Needs attention";
  const statusClass = statusOnTrack ? "completed" : "pending";
  const lowSubmissionSubjects = subjectAssignments.filter((subject) => subject.percentage < 60);
  const subjectNames = (subjects) => subjects.map((subject) => subject.subject).join(", ");
  const statusSentence = !hasAssignmentData
    ? "Enter assignment submission data to receive assignment insights."
    : `Your average assignment submission is ${numericPercentage}%.`;
  const nextStep = !hasAssignmentData
    ? "Enter assignment submission data to receive assignment insights."
    : lowSubmissionSubjects.length > 1
    ? `Complete pending assignments in ${subjectNames(lowSubmissionSubjects)}.`
    : lowSubmissionSubjects.length === 1
    ? `Prioritize pending assignments in ${lowSubmissionSubjects[0].subject} (${lowSubmissionSubjects[0].percentage}%).`
    : assignmentStatus === "Completed"
    ? `Maintain timely submissions across your subjects; your current average is ${numericPercentage}%.`
    : `Continue submitting assignments consistently to improve your current average of ${numericPercentage}%.`;

  if (dataState === "loading") {
    return <div className="assignments-page"><p className="assignment-page-state">Loading assignments...</p></div>;
  }

  if (dataState === "error") {
    return <div className="assignments-page"><p className="assignment-page-state">Unable to load assignment data.</p></div>;
  }
  if (!academicDataComplete) return <div className="assignments-page"><AcademicDataEmptyState variant="assignments" missing={missingAcademicData} /></div>;

  return (
    <div className="assignments-page">
      <header className="assignments-nav">
        <div className="assignments-brand">
          <div className="assignments-brand-logo">A</div>
          <div><strong>AcadPredict</strong><span>Academic Portal</span></div>
        </div>
        <button className="assignments-back" onClick={() => navigate("/dashboard")}>← Dashboard</button>
      </header>

      <main className="assignments-content">
        <section className="assignments-hero">
          <div>
            <span className="assignments-eyebrow">MY ASSIGNMENTS</span>
            <h1>My Assignments</h1>
            <p>Track your assignment submission consistency and academic progress.</p>
            <span className="assignment-semester">{semester}</span>
          </div>

          <div className="assignment-completion assignment-primary-card">
            <div className="completion-ring">
              <strong>{hasAssignmentData ? `${numericPercentage}%` : "—"}</strong>
            </div>
            <div>
              <span>ASSIGNMENT SUBMISSION</span>
              <strong>{hasAssignmentData ? assignmentStatus : "Enter assignment submission data to receive assignment insights."}</strong>
              <p>{statusSentence}</p>
            </div>
          </div>
        </section>

        <section className="assignment-subject-section">
          <div className="assignment-list-heading">
            <div><span>ASSIGNMENT PERFORMANCE</span><h2>Subject Submission</h2></div>
          </div>
          <div className="assignment-subject-list">
            {subjectAssignments.length ? subjectAssignments.map((subject) => {
              const subjectStatus = getAssignmentStatus(subject.percentage);
              return <div className="assignment-subject-row" key={subject.subject}><strong>{subject.subject}</strong><span>{subject.percentage}%</span><span className={`assignment-status ${getAssignmentStatusClass(subjectStatus)}`}>{subjectStatus}</span></div>;
            }) : <p>Enter assignment submission data to receive assignment insights.</p>}
          </div>
        </section>

        <section className="assignments-insight-grid assignment-status-grid">
          <div className="assignment-info-card">
            <span className="assignment-section-label">CURRENT STATUS</span>
            <div className="assignment-status-heading">
              <span className={`assignment-status ${statusClass}`}>{hasAssignmentData ? `● ${statusLabel}` : "Enter assignment submission data to receive assignment insights."}</span>
            </div>
            <p>{statusSentence}</p>
          </div>

        </section>

        <section className="assignment-support-grid">
          <div className="assignment-info-card">
            <span className="assignment-section-label">YOUR NEXT STEP</span>
            <h2>{nextStep}</h2>
          </div>
        </section>
      </main>

    </div>
  );
}

export default Assignments;

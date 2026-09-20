import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./airecommendations.css";
import "./mockCards.css";
import { getPerformanceStatus, getRiskFactors, getSubjectScore, getWeakSubjects, useStudentData } from "../studentData";
import { getSubjectAttendance } from "../attendance";
import AcademicDataEmptyState from "../components/academicDataEmptyState";

const API_URL = "http://127.0.0.1:5001";
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function recommendationDetails(recommendation) {
  if (recommendation && typeof recommendation === "object") {
    return {
      title: recommendation.title || "Study Recommendation",
      category: recommendation.category || "Study Planning",
      explanation: recommendation.explanation || "Review your academic plan regularly.",
      action: recommendation.action || "Monitor",
      tone: recommendation.category === "Risk" ? "#b45309" : recommendation.category === "Weak Subject" ? "#dc2626" : recommendation.category === "Attendance" ? "#2563eb" : recommendation.category === "Assignments" ? "#7c3aed" : "#15803d",
    };
  }
  const text = String(recommendation || "");
  const value = text.toLowerCase();
  if (value.includes("risk")) return { title: "High Risk - Take Action", category: "Risk", explanation: text, action: "Monitor", tone: "#b45309" };
  if (value.includes("attendance")) return { title: "Improve Attendance", category: "Attendance", explanation: text, action: "Improve", tone: "#2563eb" };
  if (value.includes("assignment")) return { title: "Complete Assignments", category: "Assignments", explanation: text, action: "Improve", tone: "#7c3aed" };
  if (value.includes("extra practice") || value.includes("focus on")) return { title: text.split(".")[0], category: "Weak Subject", explanation: text, action: "Focus", tone: "#dc2626" };
  if (value.includes("maintain") || value.includes("keep ")) return { title: text.split(".")[0], category: "Strong Subject", explanation: text, action: "Maintain", tone: "#15803d" };
  return { title: "Build Your Study Routine", category: "Study Planning", explanation: text, action: "Maintain", tone: "#475569" };
}

async function getApiError(response, fallback) {
  try {
    const data = await response.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

function AIRecommendations() {
  const navigate = useNavigate();
  const { status, student, latestPrediction, attendance, assignments, performance, academicDataComplete, missingAcademicData } = useStudentData();
  const [timetable, setTimetable] = useState([]);
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [timetableError, setTimetableError] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [mockLoading, setMockLoading] = useState(false);
  const [mockError, setMockError] = useState("");
  const [mockSubmitted, setMockSubmitted] = useState(false);

  const subjects = Object.entries(student?.subjects || {}).map(([name, data]) => ({
    name,
    score: getSubjectScore(data),
    attendance: getSubjectAttendance(data).percentage,
    submission: Number(data?.submission),
  })).filter((subject) => Number.isFinite(subject.score));
  const weakSubjects = getWeakSubjects(student).map(({ subject, score }) => ({ name: subject, score }));
  const riskFactors = getRiskFactors(student);
  const hasAttendanceData = Number.isFinite(Number(attendance?.overallAttendance));
  const hasAssignmentData = Number.isFinite(Number(assignments?.percentage));
  const hasPredictionData = Boolean(latestPrediction);
  const hasSufficientAcademicData = academicDataComplete
    && hasAttendanceData
    && hasAssignmentData
    && hasPredictionData;
  const context = {
    studentId: student?.student_id,
    semester: student?.semester,
    performance,
    attendance: attendance?.overallAttendance,
    assignmentSubmission: assignments?.percentage,
    riskLevel: latestPrediction?.risk_level,
    riskPercentage: Number(latestPrediction?.risk_percentage),
    performanceStatus: latestPrediction?.performance_status,
    subjects,
    weakSubjects,
    riskFactors,
    strongSubjects: subjects.filter((subject) => subject.score >= 80),
  };

  const loadRecommendations = async () => {
    if (!hasSufficientAcademicData) return;

    setRecommendationsLoading(true);
    setRecommendationsError("");
    try {
      const response = await fetch(`${API_URL}/ai/recommendations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(context) });
      if (!response.ok) throw new Error(await getApiError(response, "Unable to load your recommendations."));
      const data = await response.json();
      setRecommendations(Array.isArray(data.recommendations) ? data.recommendations : []);
    } catch (error) {
      setRecommendationsError(error.message);
    } finally {
      setRecommendationsLoading(false);
    }
  };

  useEffect(() => {
    if (status === "ready" && student && hasSufficientAcademicData) {
      loadRecommendations();
    } else if (!hasSufficientAcademicData) {
      setRecommendations([]);
      setRecommendationsError("");
      setTimetable([]);
      setTimetableError("");
    }
  }, [status, student, hasSufficientAcademicData]);

  const generateTimetable = async () => {
    if (!hasSufficientAcademicData) return;

    setTimetableLoading(true);
    setTimetableError("");
    try {
      const response = await fetch(`${API_URL}/ai/timetable`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(context) });
      if (!response.ok) throw new Error(await getApiError(response, "Unable to create your study plan."));
      const data = await response.json();
      setTimetable(Array.isArray(data.timetable) ? data.timetable : []);
    } catch (error) {
      setTimetableError(error.message);
    } finally {
      setTimetableLoading(false);
    }
  };

  const startMockTest = async (subject) => {
    setSelectedSubject(subject.name);
    setMockLoading(true);
    setMockError("");
    setQuestions([]);
    setAnswers({});
    setMockSubmitted(false);
    try {
      const response = await fetch(`${API_URL}/ai/mock-test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...context, subject: subject.name }) });
      if (!response.ok) throw new Error(await getApiError(response, "Unable to generate this mock test."));
      const data = await response.json();
      setQuestions(Array.isArray(data.questions) ? data.questions : []);
    } catch (error) {
      setMockError(error.message);
    } finally {
      setMockLoading(false);
    }
  };

  const score = questions.length ? questions.reduce((total, item, index) => total + (answers[index] === item.answer ? 1 : 0), 0) : 0;
  const correctCount = score;
  const wrongCount = questions.length - score;
  const recommendationPriority = { Risk: 1, "Weak Subject": 2, Attendance: 3, Assignments: 4, "Strong Subject": 5, "Strong Performance": 5, "Study Planning": 6 };
  const uniqueRecommendations = [...new Map(recommendations.map((item) => {
    const details = recommendationDetails(item);
    return [`${details.category}|${details.title}|${details.explanation}`.toLowerCase(), item];
  })).values()];
  const sortedRecommendations = uniqueRecommendations.sort((first, second) => recommendationPriority[recommendationDetails(first).category] - recommendationPriority[recommendationDetails(second).category]);

  if (status === "loading") return <div className="ai-dashboard"><main className="ai-main"><p className="ai-page-state">Loading your AI assistant...</p></main></div>;
  if (status === "error") return <div className="ai-dashboard"><main className="ai-main"><p className="ai-page-state">Unable to load your academic context.</p></main></div>;
  if (!academicDataComplete) return <div className="ai-dashboard"><main className="ai-main academic-ai-empty-page"><AcademicDataEmptyState variant="study-plan" missing={missingAcademicData} /><AcademicDataEmptyState variant="mock-test" missing={missingAcademicData} /></main></div>;

  return (
    <div className="ai-dashboard">
      <main className="ai-main">
        <header className="ai-page-header">
          <div className="ai-page-header-left">
            <button className="ai-back-button" onClick={() => navigate("/dashboard")}>← Dashboard</button>
            <div><p className="ai-welcome">PERSONALIZED ACADEMIC GUIDANCE</p><h1>Personalized Study Plan</h1><p className="ai-header-description">Your local academic planning assistant</p><span className="ai-assistant-badge">✦ Personalized Study Plan</span></div>
          </div>
          <div className="ai-profile"><div className="ai-profile-avatar">{(student?.name || "Student").charAt(0).toUpperCase()}</div><div><strong>{student?.name || "Student"}</strong><small>Student</small></div></div>
        </header>

        <section className="ai-feature-card">
          <div className="ai-section-heading"><div><span className="ai-label">LOCAL ACADEMIC GUIDANCE</span><h2>Personalized Recommendations</h2><p>Practical next steps based on your current academic data</p></div><button className="ai-secondary-button" onClick={loadRecommendations} disabled={recommendationsLoading}>{recommendationsLoading ? "Refreshing..." : "Refresh Recommendations"}</button></div>
          {!hasSufficientAcademicData ? <div className="ai-empty-panel"><strong>📚 No study plan available yet</strong><p>Add your marks, attendance, and assignment details to generate a personalized study plan.</p><p>Weak Subjects: No data available</p><p>Attendance: No data available</p><p>Assignments: No data available</p><p>Personalized Timetable: Available after sufficient data is provided</p></div> : recommendationsError ? <p className="ai-error">{recommendationsError}</p> : sortedRecommendations.length ? <div className="ai-recommendation-list" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px", marginTop: "22px" }}>{sortedRecommendations.map((item, index) => { const details = recommendationDetails(item); return <article className="ai-recommendation" key={`${details.category}-${details.title}-${index}`} style={{ position: "relative", padding: "18px 18px 16px 52px", background: "#fbfbff", border: "1px solid #e5e5ef", borderRadius: "14px", boxShadow: "0 6px 16px rgba(35,32,70,.05)" }}><span style={{ position: "absolute", left: "16px", top: "18px", width: "24px", height: "24px", display: "grid", placeItems: "center", borderRadius: "50%", background: details.tone, color: "#fff", fontSize: "11px", fontWeight: 800 }}>{index + 1}</span><div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "start" }}><div><small style={{ color: details.tone, fontWeight: 800, fontSize: "10px", textTransform: "uppercase", letterSpacing: ".08em" }}>{details.category}</small><h3 style={{ margin: "6px 0 7px", fontSize: "15px", color: "#20202f" }}>{details.title}</h3></div><span style={{ color: details.tone, fontSize: "10px", fontWeight: 800, whiteSpace: "nowrap" }}>{details.action}</span></div><p style={{ margin: 0, color: "#747488", fontSize: "12px", lineHeight: 1.55 }}>{details.explanation}</p></article>; })}</div> : <div className="ai-empty-panel">Recommendations will appear when your academic data is available.</div>}
        </section>

        <section className="ai-feature-card ai-timetable-card">
          <div className="ai-feature-heading"><div><span className="ai-label">📅 AI STUDY TIMETABLE</span><h2>AI Study Timetable</h2><p>A personalized weekly schedule based on your academic performance</p></div><button className="ai-primary-button" onClick={generateTimetable} disabled={timetableLoading}>{timetableLoading ? "Creating your personalized study plan..." : "✨ Generate AI Timetable"}</button></div>
          {timetableError ? <p className="ai-error">{timetableError}</p> : null}
          {hasSufficientAcademicData && timetable.length ? <div className="ai-timetable"><div className="ai-timetable-header"><span>Time</span>{DAYS.map((day) => <span key={day}>{day}</span>)}</div>{timetable.map((row, index) => <div className="ai-timetable-row" key={`${row.time || "period"}-${index}`}><strong>{row.time || "Study period"}</strong>{DAYS.map((day) => <span key={day}>{row[day] || "-"}</span>)}</div>)}</div> : <div className="ai-empty-panel">{hasSufficientAcademicData ? "Generate a plan from your live academic context to see your week." : "Personalized Timetable: Available after sufficient data is provided"}</div>}
          <button className="ai-secondary-button" onClick={generateTimetable} disabled={timetableLoading}>🔄 Regenerate Timetable</button>
        </section>

        <section className="ai-section ai-mock-section">
          <div className="ai-section-heading"><div><span className="ai-label">📝 PRACTICE WITH PURPOSE</span><h2>AI Mock Tests</h2><p>Practice the subjects that matter most for your improvement</p></div></div>
          <div className="ai-mock-grid">{subjects.map((subject) => { const subjectStatus = getPerformanceStatus(subject.score); const recommended = subject.score < 60; return <article className={`ai-mock-card ${recommended ? "recommended" : ""}`} key={subject.name}><div className="ai-mock-icon">{subject.name.charAt(0)}</div><div><h3>{subject.name}</h3><strong>{subject.score}%</strong><p className={`ai-mock-status ${subjectStatus.toLowerCase().replace(/\s+/g, "-")}`}>{subjectStatus}{recommended ? " · Recommended" : ""}</p></div><button className="ai-outline-button" onClick={() => startMockTest(subject)} disabled={mockLoading}>Start Mock Test</button></article>; })}</div>
          {mockError ? <p className="ai-error">{mockError}</p> : null}
          {selectedSubject ? <div className="ai-test-panel"><div className="ai-test-heading"><div><span className="ai-label">LOCAL MOCK TEST</span><h2>{selectedSubject} — Mock Test</h2><p>10 questions · Multiple choice</p></div><button className="ai-text-button" onClick={() => setSelectedSubject("")}>Close</button></div>{mockLoading ? <p className="ai-panel-state">Preparing your local mock test...</p> : questions.length ? <>{mockSubmitted ? <div className="ai-result" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px", margin: "20px 0", padding: "18px", background: "#f7f7ff", border: "1px solid #e5e5ef", borderRadius: "14px" }}><strong style={{ gridColumn: "1 / -1", fontSize: "18px" }}>Mock Test Result</strong><span>Score: <strong>{score} / {questions.length}</strong></span><span>Percentage: <strong>{Math.round(score / questions.length * 100)}%</strong></span><span>Correct: <strong>{correctCount}</strong></span><span>Wrong: <strong>{wrongCount}</strong></span></div> : null}{questions.map((item, index) => { const selectedAnswer = answers[index]; const isCorrect = selectedAnswer === item.answer; return <div className="ai-question" key={`${item.question}-${index}`}><div className="ai-question-meta">Question {index + 1} of {questions.length} · {item.difficulty || "Mixed"}</div><h3>{item.question}</h3><div className="ai-options">{(item.options || []).map((option) => <label key={option} style={mockSubmitted && option === item.answer ? { color: "#15803d", fontWeight: 700 } : mockSubmitted && option === selectedAnswer ? { color: "#dc2626", fontWeight: 700 } : undefined}><input type="radio" name={`question-${index}`} checked={selectedAnswer === option} onChange={() => setAnswers({ ...answers, [index]: option })} disabled={mockSubmitted} />{option}</label>)}</div>{mockSubmitted ? <div style={{ marginTop: "12px", padding: "11px 13px", borderRadius: "9px", background: isCorrect ? "#ecfdf3" : "#fff1f2", color: isCorrect ? "#166534" : "#be123c", fontSize: "12px", lineHeight: 1.6 }}><strong>{isCorrect ? "✓ Correct Answer" : "✕ Wrong Answer"}</strong>{isCorrect ? <div>Your answer is correct.</div> : <><div>Your answer: {selectedAnswer || "Not answered"}</div><div>Correct answer: {item.answer}</div></>}</div> : null}</div>; })}{mockSubmitted ? null : <button className="ai-primary-button" onClick={() => setMockSubmitted(true)}>Submit Test</button>}</> : <p className="ai-panel-state">No questions were returned by the local question bank.</p>}</div> : null}
        </section>

        <footer className="ai-footer"><span>AcadPredict • Personalized Academic Guidance</span></footer>
      </main>
    </div>
  );
}

export default AIRecommendations;

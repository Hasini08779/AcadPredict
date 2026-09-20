import { useEffect, useState } from "react";
import { getAuthenticatedUser } from "./auth";
import { getAttendanceSummary, getSubjectAttendance } from "./attendance";

export const SUBJECTS = [
  "Python Programming",
  "Computer Networks",
  "Database Management",
  "Mathematics",
  "Operating System",
  "Data Structures",
];

export const GRADE_SCORES = {
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

export const STUDENTS_UPDATED_EVENT = "acadpredict:students-updated";

function studentCreationTime(student) {
  const value = new Date(student?.createdAt || student?.created_at || 0).getTime();
  return Number.isNaN(value) ? null : value;
}

export async function fetchStudents() {
  const response = await fetch("http://127.0.0.1:5001/students");
  if (!response.ok) throw new Error("Unable to load students");

  const students = await response.json();
  if (!Array.isArray(students)) return [];

  return students.sort((first, second) => {
    const firstTime = studentCreationTime(first);
    const secondTime = studentCreationTime(second);
    if (firstTime == null || secondTime == null) return 0;
    return secondTime - firstTime;
  });
}

export function notifyStudentsUpdated() {
  window.dispatchEvent(new Event(STUDENTS_UPDATED_EVENT));
}

export function getPerformanceStatus(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return null;
  if (value >= 80) return "Strong";
  if (value >= 60) return "Moderate";
  return "Needs Improvement";
}

export function getPerformanceStatusClass(status) {
  return `performance-status-${String(status || "").toLowerCase().replace(/\s+/g, "-")}`;
}

export function getCurrentStudentId() {
  const user = getAuthenticatedUser();
  return user?.studentId || user?.student_id || user?.userId || user?.id || user?.accountId || "";
}

export function getPredictionTime(prediction) {
  const value = new Date(prediction?.created_at || prediction?.timestamp || 0).getTime();
  return Number.isNaN(value) ? 0 : value;
}

function getStableId(record) {
  return record?.assessmentId || record?.assessment_id || record?.predictionId || record?.prediction_id || record?.recordId || record?.record_id || record?._id || null;
}

function normalizeSubjectResults(results) {
  if (!Array.isArray(results)) return [];
  return results
    .map((result) => ({
      subject: String(result?.subject || "").trim(),
      score: Number(result?.score),
      grade: result?.grade,
      attendance: Number(result?.attendance),
      submission: Number(result?.submission),
    }))
    .filter((result) => result.subject && Number.isFinite(result.score));
}

function getPredictionFingerprint(prediction) {
  const stableId = getStableId(prediction);
  if (stableId != null) return `id:${stableId}`;

  const subjects = normalizeSubjectResults(prediction?.subject_results || prediction?.subjectResults)
    .sort((first, second) => first.subject.localeCompare(second.subject));
  const timestamp = getPredictionTime(prediction);
  const date = timestamp ? new Date(timestamp) : null;
  return JSON.stringify({
    studentId: prediction?.student_id || prediction?.studentId,
    semester: prediction?.semester == null ? null : String(prediction.semester),
    month: date ? `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}` : null,
    assessment: prediction?.assessment_name || prediction?.assessment || null,
    score: Number(prediction?.overall_score ?? prediction?.overallScore),
    subjects,
  });
}

export function normalizePredictions(predictions, studentId) {
  const unique = new Map();
  (Array.isArray(predictions) ? predictions : [])
    .filter((prediction) => String(prediction?.student_id || prediction?.studentId) === String(studentId))
    .forEach((prediction) => {
      const normalized = {
        ...prediction,
        student_id: prediction.student_id || prediction.studentId,
        overall_score: prediction.overall_score ?? prediction.overallScore,
        subject_results: normalizeSubjectResults(prediction.subject_results || prediction.subjectResults),
      };
      const key = getPredictionFingerprint(normalized);
      const existing = unique.get(key);
      if (!existing || getPredictionTime(normalized) > getPredictionTime(existing)) unique.set(key, normalized);
    });

  return [...unique.values()].sort((first, second) => getPredictionTime(first) - getPredictionTime(second));
}

export function getSubjectScore(data = {}) {
  const gradeScore = GRADE_SCORES[data.grade];
  const attendance = getSubjectAttendance(data).percentage;
  const hasSubmission = data.submission !== null && data.submission !== undefined && data.submission !== "";
  const submission = Number(data.submission);
  if (gradeScore == null || attendance == null || !hasSubmission || !Number.isFinite(submission) || submission < 0 || submission > 100) return null;
  return Math.round(gradeScore * 0.5 + attendance * 0.25 + submission * 0.25);
}

export function getAcademicDataStatus(student) {
  const subjects = student?.subjects || {};
  const missing = [];

  SUBJECTS.forEach((subject) => {
    const data = subjects[subject] || {};
    const attendance = getSubjectAttendance(data).percentage;
    const hasSubmission = data.submission !== null && data.submission !== undefined && data.submission !== "";
    const submission = Number(data.submission);
    if (!GRADE_SCORES[data.grade]) missing.push(`${subject} grade`);
    if (attendance == null) missing.push(`${subject} attendance`);
    if (!hasSubmission || !Number.isFinite(submission) || submission < 0 || submission > 100) missing.push(`${subject} assignment submission`);
  });

  return { complete: missing.length === 0, missing };
}

export function getStudentPerformance(student) {
  const scores = Object.values(student?.subjects || {}).map(getSubjectScore).filter(Number.isFinite);
  return scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
}

export function getWeakSubjects(student) {
  return SUBJECTS
    .map((subject) => ({ subject, score: getSubjectScore(student?.subjects?.[subject]) }))
    .filter((item) => Number.isFinite(item.score) && item.score < 60)
    .sort((first, second) => first.score - second.score);
}

export function getAssignmentSummary(student) {
  const submissions = Object.values(student?.subjects || {})
    .map((subject) => subject.submission)
    .filter((submission) => submission !== null && submission !== undefined && submission !== "")
    .map(Number)
    .filter((submission) => Number.isFinite(submission) && submission >= 0 && submission <= 100);
  const percentage = submissions.length ? Math.round(submissions.reduce((sum, submission) => sum + submission, 0) / submissions.length) : null;
  return { total: null, completed: null, pending: null, percentage };
}

export function getRiskFactors(student) {
  return Object.entries(student?.subjects || {})
    .map(([subject, data]) => {
      const attendance = getSubjectAttendance(data).percentage;
      const submission = data?.submission === "" || data?.submission == null ? null : Number(data.submission);
      const reasons = [];
      if (attendance != null && attendance < 75) reasons.push("Low attendance");
      if (Number.isFinite(submission) && submission >= 0 && submission < 70) reasons.push("Low assignment submission");
      return reasons.length ? `${subject}: ${reasons.join(" and ")}` : null;
    })
    .filter(Boolean);
}

export function getAssignmentSubjects(student) {
  return Object.entries(student?.subjects || {})
    .map(([subject, data]) => ({
      subject,
      percentage: data?.submission === "" || data?.submission == null ? null : Number(data.submission),
    }))
    .filter((item) => Number.isFinite(item.percentage) && item.percentage >= 0 && item.percentage <= 100);
}

export function getAssignmentStatus(percentage) {
  const value = Number(percentage);
  if (!Number.isFinite(value)) return null;
  if (value >= 90) return "Completed";
  if (value >= 60) return "Partially Completed";
  return "In Progress";
}

export function getAssignmentStatusClass(status) {
  if (status === "Completed") return "completed";
  if (status === "Partially Completed") return "in-progress";
  if (status === "In Progress") return "pending";
  return "unavailable";
}

export function useStudentData() {
  const studentId = getCurrentStudentId();
  const [state, setState] = useState({ status: studentId ? "loading" : "unavailable", student: null, predictions: [], latestPrediction: null });

  useEffect(() => {
    let active = true;
    setState({ status: studentId ? "loading" : "unavailable", student: null, predictions: [], latestPrediction: null });

    if (!studentId) {
      return undefined;
    }

    const load = async () => {
      try {
        const [students, predictionsResponse] = await Promise.all([
          fetchStudents(),
          fetch("http://127.0.0.1:5001/predictions"),
        ]);
        if (!predictionsResponse.ok) throw new Error("Unable to load student data");
        const predictions = await predictionsResponse.json();
        const student = (Array.isArray(students) ? students : []).find((item) => String(item.student_id) === String(studentId)) || null;
        const history = normalizePredictions(predictions, studentId);
        if (active) setState({ status: "ready", student, predictions: history, latestPrediction: history.at(-1) || null });
      } catch (error) {
        console.error("Student data error:", error);
        if (active) setState({ status: "error", student: null, predictions: [], latestPrediction: null });
      }
    };

    load();
    window.addEventListener(STUDENTS_UPDATED_EVENT, load);
    const timer = window.setInterval(load, 5000);
    return () => {
      active = false;
      window.removeEventListener(STUDENTS_UPDATED_EVENT, load);
      window.clearInterval(timer);
    };
  }, [studentId]);

  const academicData = getAcademicDataStatus(state.student);
  const attendance = state.student && academicData.complete ? getAttendanceSummary(state.student, SUBJECTS) : null;
  return {
    ...state,
    studentId,
    attendance,
    assignments: academicData.complete ? getAssignmentSummary(state.student) : { total: null, completed: null, pending: null, percentage: null },
    performance: academicData.complete ? getStudentPerformance(state.student) : null,
    academicDataComplete: academicData.complete,
    missingAcademicData: academicData.missing,
  };
}

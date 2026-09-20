import { useNavigate } from "react-router-dom";
import { getAttendanceStatus, getSubjectAttendance } from "../attendance";
import { useStudentData } from "../studentData";
import AcademicDataEmptyState from "../components/academicDataEmptyState";

function Attendance() {
  const navigate = useNavigate();

  const { status: dataState, student, attendance, academicDataComplete, missingAcademicData } = useStudentData();
  const subjects = Object.entries(student?.subjects || {})
    .map(([name, data]) => ({
      name,
      code: "",
      ...getSubjectAttendance(data),
      attended: getSubjectAttendance(data).classesAttended,
      total: getSubjectAttendance(data).totalClasses,
      percentage: getSubjectAttendance(data).percentage,
      status: getAttendanceStatus(getSubjectAttendance(data).percentage),
    }))
    .filter((subject) => subject.percentage != null);
  const attentionSubjects = subjects.filter((subject) => subject.status !== "Good");
  const subjectAttendanceRecords = subjects.filter((subject) => subject.percentage != null);
  const totalClasses = attendance?.totalClasses;
  const attendedClasses = attendance?.classesAttended;
  const missedClasses = attendance?.classesMissed;

  if (dataState === "loading") return <div className="attendance-page"><p>Loading attendance...</p></div>;
  if (dataState === "error") return <div className="attendance-page"><p>Unable to load attendance data.</p></div>;
  if (!academicDataComplete) return <div className="attendance-page"><AcademicDataEmptyState variant="attendance" missing={missingAcademicData} /></div>;

  return (
    <div className="attendance-page">

      {/* TOP NAVIGATION */}
      <div className="attendance-topbar">

        <div className="attendance-brand">
          <div className="attendance-logo">
            A
          </div>

          <div>
            <strong>AcadPredict</strong>
            <span>Student Portal</span>
          </div>
        </div>

        <button
          className="attendance-dashboard-btn"
          onClick={() => navigate("/dashboard")}
        >
          ← Dashboard
        </button>

      </div>


      {/* PAGE INTRO */}
      <section className="attendance-intro">

        <div>

          <span className="attendance-overline">
            ATTENDANCE ANALYTICS
          </span>

          <h1>
            My Attendance
          </h1>

          <p>
            Track your class attendance, identify subjects
            that need attention, and stay academically on track.
          </p>

        </div>

        <div className="semester-selector">
          <span>Academic Details</span>
              <strong>{student?.semester ? `Semester ${student.semester}` : "Academic details unavailable"}</strong>
        </div>

      </section>


      {/* HERO ATTENDANCE */}
      <section className="attendance-hero">

        <div className="attendance-score-area">

          <div className="attendance-circle">

            <div>
              <strong>{attendance?.overallAttendance ?? "—"}</strong>
              <span>%</span>
            </div>

          </div>


          <div className="attendance-score-text">

            <span>
              OVERALL ATTENDANCE
            </span>

            <h2>
              {attendance?.attendanceStatus || (dataState === "loading" ? "Loading attendance..." : "No data available")}
            </h2>

            <p>
              {attendance?.attendanceStatus ? `Your attendance is ${attendance.attendanceStatus.toLowerCase()}.` : "No attendance data available."}
            </p>

          </div>

        </div>


        <div className="attendance-mini-stats">

          <div className="attendance-mini-stat">

            <span className="mini-stat-icon">
              ◉
            </span>

            <div>
              <small>
                TOTAL CLASSES
              </small>

              <strong>
                {totalClasses ?? "No class-total data"}
              </strong>
            </div>

          </div>


          <div className="attendance-mini-stat">

            <span className="mini-stat-icon">
              ✓
            </span>

            <div>
              <small>
                ATTENDED
              </small>

              <strong>
                {attendedClasses ?? "No class-total data"}
              </strong>
            </div>

          </div>


          <div className="attendance-mini-stat">

            <span className="mini-stat-icon">
              ×
            </span>

            <div>
              <small>
                MISSED
              </small>

              <strong>
                {missedClasses ?? "No class-total data"}
              </strong>
            </div>

          </div>

        </div>

      </section>


      {/* QUICK INSIGHTS */}
      <section className="attendance-insights">

        <div className="attendance-insight-card">

          <div className="attendance-insight-icon green">
            ✓
          </div>

          <div>

            <span>
              STATUS
            </span>

            <h3>
              {attendance?.attendanceStatus || "No attendance data available"}
            </h3>

            <p>
              {attendance ? `Current attendance is ${attendance.overallAttendance}%.` : "No attendance data available."}
            </p>

          </div>

        </div>


        <div className="attendance-insight-card">

          <div className="attendance-insight-icon orange">
            !
          </div>

          <div>

            <span>
              WARNING
            </span>

            <h3>
              {attentionSubjects.length ? attentionSubjects.map((subject) => subject.name).join(", ") : "No subjects need immediate attention"}
            </h3>

            <p>
              {attentionSubjects.length ? "Review attendance in these subjects." : "No subjects need immediate attention"}
            </p>

          </div>

        </div>

      </section>


      {/* SUBJECT SECTION */}
      <section className="attendance-subject-section">

        <div className="attendance-section-header">

          <div>

            <span>
              SUBJECT ATTENDANCE
            </span>

            <h2>
              Attendance Breakdown
            </h2>

            <p>
              Your attendance performance across all subjects.
            </p>

          </div>

          <div className="attendance-legend">

            <span>
              <i className="legend-dot good-dot"></i>
              Good: 75–100%
            </span>

            <span>
              <i className="legend-dot warning-dot"></i>
              Warning: 60–74%
            </span>

            <span>
              <i className="legend-dot critical-dot"></i>
              Critical: Below 60%
            </span>

          </div>

        </div>


        <div className="attendance-subject-list">

          {subjectAttendanceRecords.length ? subjectAttendanceRecords.map((subject, index) => (

            <div
              className="attendance-subject-card"
              key={index}
            >

              <div className="attendance-subject-left">

                <div className="attendance-number">
                  {String(index + 1).padStart(2, "0")}
                </div>

                <div>

                  <h3>
                    {subject.name}
                  </h3>

                  <span>
                    {subject.code}
                  </span>

                </div>

              </div>


              <div className="attendance-class-info">

                  <strong>
                    {subject.attended == null ? "No class-total data" : `${subject.attended}/${subject.total}`}
                  </strong>

                <span>
                  {`${subject.classesMissed ?? 0} missed`}
                </span>

              </div>


              <div className="attendance-meter-area">

                <div className="attendance-meter-top">

                  <span>
                    Attendance
                  </span>

                  <strong>
                    {subject.percentage == null ? "No attendance data" : `${subject.percentage}%`}
                  </strong>

                </div>

                <div className="attendance-meter">

                  <div
                    className={`meter-${getAttendanceStatus(subject.percentage).toLowerCase()}`}
                    style={{
                      width: `${subject.percentage ?? 0}%`,
                    }}
                  ></div>

                </div>

              </div>


              <div
                className={`attendance-status-badge attendance-${getAttendanceStatus(subject.percentage).toLowerCase()}`}
              >
                {subject.status}
              </div>

            </div>

          )) : <p>No subject attendance data available</p>}

        </div>

      </section>

    </div>
  );
}

export default Attendance;
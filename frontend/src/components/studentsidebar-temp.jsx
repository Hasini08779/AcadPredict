import { useNavigate, useLocation } from "react-router-dom";
import { logout } from "../auth";

function StudentSidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const goToDashboard = () => {
    navigate("/dashboard");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside className="student-sidebar">

      {/* BRAND */}
      <div className="sidebar-brand">
        <div className="logo-box">A</div>

        <div className="logo-text">
          Acad<span>Predict</span>
        </div>
      </div>

      {/* NAVIGATION */}
      <nav className="student-nav">

        {/* DASHBOARD */}
        <button
          className={`nav-item ${
            location.pathname === "/dashboard" ? "active" : ""
          }`}
          onClick={goToDashboard}
        >
          <span>⌂</span>
          Dashboard
        </button>

        {/* PERFORMANCE */}
        <button
          className={`nav-item ${
            location.pathname === "/performance" ? "active" : ""
          }`}
          onClick={() => navigate("/performance")}
        >
          <span>▣</span>
          My Performance
        </button>

        {/* ATTENDANCE */}
        <button
          className={`nav-item ${
            location.pathname === "/attendance" ? "active" : ""
          }`}
          onClick={() => navigate("/attendance")}
        >
          <span>◷</span>
          Attendance
        </button>

        {/* ASSIGNMENTS */}
        <button
          className={`nav-item ${
            location.pathname === "/assignments" ? "active" : ""
          }`}
          onClick={() => navigate("/assignments")}
        >
          <span>✓</span>
          Assignments
        </button>

        {/* RISK ANALYSIS */}
        <button
          className={`nav-item ${
            location.pathname === "/risk-analysis" ? "active" : ""
          }`}
          onClick={() => navigate("/risk-analysis")}
        >
          <span>⚠</span>
          Risk Analysis
        </button>

        {/* PERSONALIZED STUDY PLAN */}
        <button
          className={`nav-item ${
            location.pathname === "/ai-recommendations" ? "active" : ""
          }`}
          onClick={() => navigate("/ai-recommendations")}
        >
          <span>✦</span>
          Personalized Study Plan
        </button>

      </nav>

      {/* LOGOUT */}
      <button
        className="logout-button"
        onClick={handleLogout}
      >
        <span>↪</span>
        Logout
      </button>

    </aside>
  );
}

export default StudentSidebar;
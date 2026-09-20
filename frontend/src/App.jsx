import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Home from "./pages/home";
import Login from "./pages/login";
import Register from "./pages/register";

import Dashboard from "./pages/dashboard";
import Performance from "./pages/performance";
import Attendance from "./pages/attendance";
import Assignments from "./pages/assignments";
import RiskAnalysis from "./pages/riskanalysis";
import AIRecommendations from "./pages/airecommendations";
import FacultyDashboard from "./pages/facultyDashboard";
import AdminDashboard from "./pages/adminDashboard";
import StudentLayout from "./components/studentlayout-temp";

import {
  getAuthenticatedUser,
  isLoggedIn,
  getRoleRedirectPath,
} from "./auth";

function ProtectedRoute({ children, allowedRoles }) {
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />;
  }

  const user = getAuthenticatedUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role = user.role || "student";

  if (!allowedRoles.includes(role)) {
    return <Navigate to={getRoleRedirectPath(role)} replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page */}
        <Route path="/" element={<Home />} />

        {/* Authentication */}
        <Route
          path="/login"
          element={
            isLoggedIn() ? (
              <Navigate
                to={getRoleRedirectPath(getAuthenticatedUser()?.role)}
                replace
              />
            ) : (
              <Login />
            )
          }
        />
        <Route path="/register" element={<Register />} />

        {/* Student Routes */}
        <Route
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <StudentLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/performance" element={<Performance />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/assignments" element={<Assignments />} />
          <Route path="/risk-analysis" element={<RiskAnalysis />} />
          <Route path="/ai-recommendations" element={<AIRecommendations />} />
        </Route>

        <Route
          path="/reports"
          element={
            <Navigate
              to={
                getAuthenticatedUser()?.role === "student"
                  ? "/dashboard"
                  : getRoleRedirectPath(getAuthenticatedUser()?.role)
              }
              replace
            />
          }
        />

        {/* Faculty Routes */}
        <Route
          path="/faculty"
          element={
            <ProtectedRoute allowedRoles={["faculty"]}>
              <FacultyDashboard />
            </ProtectedRoute>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/insights"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

import StudentSidebar from "./studentsidebar-temp";
import { Outlet } from "react-router-dom";

function StudentLayout({ children }) {
  return (
    <div className="student-dashboard student-layout">

      {/* SIDEBAR */}
      <StudentSidebar />

      {/* DASHBOARD CONTENT */}
      <main className="student-layout-content">
        {children || <Outlet />}
      </main>

    </div>
  );
}

export default StudentLayout;


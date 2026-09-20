import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { findUserByEmail, saveUser, setLoggedIn } from "../auth";
import { fetchStudents } from "../studentData";

function Register() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();

    const cleanName = name.trim();
    const cleanStudentId = studentId.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanStudentId || !cleanEmail || !password) {
      alert("Please fill all fields.");
      return;
    }

    try {
      const students = await fetchStudents();
      const student = students.find(
        (item) => String(item.student_id).toLowerCase() === cleanStudentId.toLowerCase()
      );
      if (!student) {
        alert("No Admin-created student record was found for this Student ID.");
        return;
      }
    } catch {
      alert("Unable to connect to the student record service.");
      return;
    }

    if (findUserByEmail(cleanEmail)) {
      alert(
        "An account with this email already exists. Please sign in."
      );
      return;
    }

    const user = {
      name: cleanName,
      studentId: cleanStudentId,
      email: cleanEmail,
      password: password,
      role: "student",
      createdAt: new Date().toISOString(),
    };

    saveUser(user);
    setLoggedIn(false);

    alert("Account created successfully!");

    navigate("/login");
  };

  return (
    <div className="login-page">

      <div
        className="login-right"
        style={{ width: "100%" }}
      >

        <div className="login-card">

          <div className="login-heading">

            <h2>Create your account</h2>

            <p>
              Create an account to continue to AcadPredict.
            </p>

          </div>


          <form onSubmit={handleRegister}>

            <div className="input-group">

              <label>Student ID</label>

              <input
                type="text"
                placeholder="Enter your Admin-created Student ID"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              />

            </div>


            <div className="input-group">

              <label>Full Name</label>

              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
              />

            </div>


            <div className="input-group">

              <label>Email Address</label>

              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
              />

            </div>


            <div className="input-group">

              <label>Password</label>

              <input
                type="password"
                placeholder="Create a password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
              />

            </div>


            <button
              type="submit"
              className="login-submit"
            >
              Create Account →
            </button>

          </form>


          <p className="register-text">

            Already have an account?

            <button
              type="button"
              onClick={() => navigate("/login")}
            >
              Sign In
            </button>

          </p>

        </div>

      </div>

    </div>
  );
}

export default Register;
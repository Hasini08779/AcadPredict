import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  findUserByEmail,
  saveUser,
  setLoggedIn,
  getRoleRedirectPath,
  normalizeUser,
} from "../auth";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleForgotPassword = (e) => {
    e.preventDefault();

    const enteredEmail = window.prompt(
      "Enter your registered email:"
    );

    if (enteredEmail === null) {
      return;
    }

    const cleanEmail = enteredEmail.trim().toLowerCase();

    if (!cleanEmail) {
      alert("Please enter your registered email.");
      return;
    }

    const user = findUserByEmail(cleanEmail);

    if (!user) {
      alert("No account found with this email.");
      return;
    }

    const newPassword = window.prompt(
      "Enter a new password:"
    );

    if (newPassword === null) {
      return;
    }

    if (!newPassword.trim()) {
      alert("Password cannot be empty.");
      return;
    }

    const updatedUser = {
      ...user,
      password: newPassword,
      role: user.role || "student",
    };

    saveUser(updatedUser);

    alert(
      "Password reset successfully! You can now sign in."
    );
  };

  const handleLogin = (e) => {
    e.preventDefault();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      alert("Please enter your email and password.");
      return;
    }

    const user = findUserByEmail(cleanEmail);

    if (!user) {
      alert(
        "No account found. Please create an account first."
      );
      return;
    }

    if (password !== user.password) {
      alert("Incorrect email or password.");
      return;
    }

    const normalized = normalizeUser(user);
    saveUser(normalized);
    setLoggedIn(true);

    alert("Login successful!");

    navigate(getRoleRedirectPath(normalized.role));
  };

  return (
    <div className="login-page">

      {/* LEFT SIDE */}

      <div className="login-left">

        <button
          className="back-home"
          onClick={() => navigate("/")}
        >
          ← Back to Home
        </button>


        <div className="login-brand">

          <div className="logo-box">
            A
          </div>

          <div className="logo-text">
            Acad<span>Predict</span>
          </div>

        </div>


        <div className="login-content">

          <div className="eyebrow">
            AI-POWERED ACADEMIC ANALYTICS
          </div>

          <h1>
            Understand your
            <span> academic journey.</span>
          </h1>

          <p>
            Track your performance, understand your academic
            risk, and receive personalized insights powered by
            machine learning.
          </p>


          <div className="login-benefits">

            <div>
              <span>✓</span>
              Performance tracking
            </div>

            <div>
              <span>✓</span>
              AI-based risk prediction
            </div>

            <div>
              <span>✓</span>
              Personalized recommendations
            </div>

          </div>

        </div>

      </div>


      {/* RIGHT SIDE */}

      <div className="login-right">

        <div className="login-card">

          <div className="login-heading">

            <h2>
              Welcome back
            </h2>

            <p>
              Sign in to continue to your AcadPredict dashboard.
            </p>

          </div>


          <form onSubmit={handleLogin}>

            {/* EMAIL */}

            <div className="input-group">

              <label>
                Email Address
              </label>

              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
              />

            </div>


            {/* PASSWORD */}

            <div className="input-group">

              <div className="password-label">

                <label>
                  Password
                </label>

                <a href="#forgot" onClick={handleForgotPassword}>
                  Forgot password?
                </a>

              </div>

              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((visible) => !visible)
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  style={{
                    position: "absolute",
                    right: "14px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    padding: 0,
                    background: "transparent",
                    cursor: "pointer",
                    color: "#495057",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "28px",
                    height: "28px",
                  }}
                >
                  {showPassword ? (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17.94 17.94A10 10 0 0 1 12 20c-7 0-11-8-11-8a20.39 20.39 0 0 1 5.23-6.53" />
                      <path d="M1 1l22 22" />
                      <path d="M9.53 9.53A3 3 0 0 0 14.47 14.47" />
                      <path d="M14.12 14.12A3 3 0 0 1 9.88 9.88" />
                    </svg>
                  ) : (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>

            </div>


            {/* LOGIN BUTTON */}

            <button
              type="submit"
              className="login-submit"
            >
              Sign In
              <span>→</span>
            </button>

          </form>


          {/* DIVIDER */}

          <div className="divider">
            <span>or</span>
          </div>


          {/* REGISTER */}

          <p className="register-text">

            Don't have an account?

            <button
              type="button"
              onClick={() => navigate("/register")}
            >
              Create an account
            </button>

          </p>

        </div>

      </div>

    </div>
  );
}

export default Login;
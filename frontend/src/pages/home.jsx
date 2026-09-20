import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();

  return (
    <div className="app">

      {/* NAVBAR */}
      <nav className="navbar">
        <div className="logo-section">
          <div className="logo-box">A</div>
          <div className="logo-text">
            Acad<span>Predict</span>
          </div>
        </div>

        <div className="nav-links">
          <a href="#home">Home</a>
          <a href="#features">Features</a>
          <a href="#about">About</a>

          <button
            className="login-btn"
            onClick={() => navigate("/login")}
          >
            Login
          </button>
        </div>
      </nav>


      {/* HERO SECTION */}
      <section className="hero" id="home">

        {/* LEFT SIDE */}
        <div className="hero-left">

          <div className="eyebrow">
            ✦ AI-POWERED ACADEMIC ANALYTICS
          </div>

          <h1>
            Predict. Analyze.
            <br />
            <span>Improve.</span>
          </h1>

          <p className="hero-description">
            AcadPredict uses machine learning to analyze student
            performance, identify academic risk early, and provide
            meaningful insights for better learning outcomes.
          </p>

          <div className="hero-buttons">

            <button
              className="primary-btn"
              onClick={() => navigate("/login")}
            >
              Get Started
              <span>→</span>
            </button>

            <button
              className="secondary-btn"
              onClick={() =>
                document
                  .getElementById("features")
                  .scrollIntoView({ behavior: "smooth" })
              }
            >
              Learn More
              <span>▷</span>
            </button>

          </div>


          {/* TRUST CARDS */}
          <div className="trust-cards">

            <div className="trust-card">
              <div className="trust-icon">♢</div>
              <div>
                <strong>Secure & Private</strong>
                <small>Your data is protected</small>
              </div>
            </div>

            <div className="trust-card">
              <div className="trust-icon">✦</div>
              <div>
                <strong>AI-Powered</strong>
                <small>Advanced ML models</small>
              </div>
            </div>

            <div className="trust-card">
              <div className="trust-icon">⌁</div>
              <div>
                <strong>Smart Insights</strong>
                <small>Actionable reports</small>
              </div>
            </div>

          </div>
        </div>


        {/* RIGHT SIDE - DASHBOARD PREVIEW */}
        <div className="dashboard-card">

          <div className="dashboard-header">
            <h3>Academic Overview</h3>

            <div className="live">
              <span></span>
              Live
            </div>
          </div>

          <div className="performance-header">
            <div>Overall Performance Score</div>
            <strong>82%</strong>
          </div>

          <div className="progress-bar">
            <div></div>
          </div>


          {/* STAT CARDS */}
          <div className="stats">

            <div className="stat-card">
              <div className="stat-icon purple">♙</div>
              <p>Attendance</p>
              <strong>91%</strong>
              <small className="excellent">Excellent</small>
            </div>

            <div className="stat-card">
              <div className="stat-icon blue">★</div>
              <p>Avg. Score</p>
              <strong>78%</strong>
              <small className="good">Good</small>
            </div>

            <div className="stat-card">
              <div className="stat-icon orange">↗️</div>
              <p>Assignments</p>
              <strong>88%</strong>
              <small className="excellent">Excellent</small>
            </div>

            <div className="stat-card">
              <div className="stat-icon red">♢</div>
              <p>Risk Level</p>
              <strong className="low">Low</strong>
              <small className="safe">Safe</small>
            </div>

          </div>


          {/* PERFORMANCE CHART */}
          <div className="chart-card">

            <div className="chart-header">
              <strong>Performance Trend</strong>

              <span>
                This Month⌄
              </span>
            </div>

            <div className="chart">

              <div className="y-axis">
                <span>100</span>
                <span>75</span>
                <span>50</span>
                <span>25</span>
                <span>0</span>
              </div>

              <div className="chart-area">

                <div className="chart-line">
                  <div className="point point1"></div>
                  <div className="point point2"></div>
                  <div className="point point3"></div>
                  <div className="point point4"></div>
                </div>

                <div className="chart-labels">
                  <span>Week 1</span>
                  <span>Week 2</span>
                  <span>Week 3</span>
                  <span>Week 4</span>
                </div>

              </div>

            </div>

          </div>

        </div>
      </section>


      {/* FEATURES */}
      <section className="features-section" id="features">

        <div className="section-label">
          WHAT ACADPREDICT OFFERS
        </div>

        <h2>Smart Academic Insights</h2>

        <div className="section-line"></div>


        <div className="feature-grid">

          <div className="feature-card">
            <div className="feature-icon">▥</div>

            <div>
              <h3>Performance Analysis</h3>

              <p>
                Analyze marks, attendance, study patterns and
                academic performance in one place.
              </p>
            </div>
          </div>


          <div className="feature-card">
            <div className="feature-icon">◎</div>

            <div>
              <h3>Risk Prediction</h3>

              <p>
                Identify students who may be academically at risk
                using advanced machine learning models.
              </p>
            </div>
          </div>


          <div className="feature-card">
            <div className="feature-icon">♧</div>

            <div>
              <h3>Smart Recommendations</h3>

              <p>
                Provide personalized suggestions and learning
                resources to help students improve.
              </p>
            </div>
          </div>

        </div>

      </section>


      {/* ABOUT */}
      <section className="about-section" id="about">

        <div className="section-label">
          ABOUT ACADPREDICT
        </div>

        <h2>Turning Student Data Into Insights</h2>

        <p>
          AcadPredict is an AI-powered academic analytics platform
          designed to help students and educators understand
          academic performance, predict potential risks, and take
          timely action.
        </p>

      </section>


      {/* FOOTER */}
      <footer>
        <div className="footer-logo">
          Acad<span>Predict</span>
        </div>

        <p>
          AI-powered academic performance prediction and analysis.
        </p>

        <small>
          ©️ 2026 AcadPredict. All rights reserved.
        </small>
      </footer>

    </div>
  );
}

export default Home;
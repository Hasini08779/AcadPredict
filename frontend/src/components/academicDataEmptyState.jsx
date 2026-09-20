function EmptyStateHeader({ icon, label, title, description }) {
  return (
    <div className="academic-data-empty-header">
      <div className="academic-data-empty-icon" aria-hidden="true">{icon}</div>
      <div>
        <span className="academic-data-empty-label">{label}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}

function AcademicDataEmptyState({ missing = [], variant = "overview" }) {
  const missingCount = missing.length;

  if (variant === "risk") {
    return (
      <div className="academic-data-empty-state academic-data-empty-state-risk">
        <EmptyStateHeader icon="!" label="RISK ANALYSIS" title="Risk analysis needs academic data" description="Your risk score and contributing factors will be calculated from your actual grades, attendance, and assignment submissions." />
        <div className="academic-risk-empty-layout">
          <div className="academic-risk-score-placeholder"><span>RISK SCORE</span><strong>Not available</strong><small>Complete your academic data first</small></div>
          <div className="academic-risk-factor-placeholder"><span className="academic-data-empty-label">RISK FACTORS</span><h3>No factors to review yet</h3><p>AcadPredict will identify meaningful risk indicators after your academic record is complete.</p></div>
        </div>
      </div>
    );
  }

  if (variant === "performance") {
    return (
      <div className="academic-data-empty-state academic-data-empty-state-performance">
        <EmptyStateHeader icon="↗" label="PERFORMANCE ANALYTICS" title="Your performance story starts with your data" description="Average score, subject performance, and distribution will appear here after your academic information is entered." />
        <div className="academic-performance-empty-layout">
          <div className="academic-performance-score-placeholder"><span>AVERAGE SCORE</span><strong>Not available</strong><small>Awaiting subject scores</small></div>
          <div className="academic-performance-bars" aria-label="Performance distribution unavailable"><span /><span /><span /></div>
          <div className="academic-performance-empty-note"><strong>Performance distribution</strong><p>Strong, moderate, and improvement areas will be calculated from your actual subjects.</p></div>
        </div>
      </div>
    );
  }

  if (variant === "insights") {
    return (
      <div className="academic-data-empty-state academic-data-empty-state-insights">
        <EmptyStateHeader icon="✦" label="ACADEMIC INSIGHTS" title="Meaningful insights will follow your input" description="AcadPredict needs real student data before it can identify strengths, focus areas, or improvement targets." />
        <div className="academic-insights-empty-list">
          <div><span>01</span><strong>Strongest subject</strong><em>Not available yet</em></div>
          <div><span>02</span><strong>Focus subject</strong><em>Not available yet</em></div>
          <div><span>03</span><strong>Improvement target</strong><em>Not available yet</em></div>
        </div>
      </div>
    );
  }

  if (variant === "assignments") {
    return (
      <div className="academic-data-empty-state academic-data-empty-state-assignments">
        <EmptyStateHeader icon="✓" label="ASSIGNMENT ANALYTICS" title="Assignment insights are waiting for your submissions" description="Enter assignment submission data to see your current status, subject patterns, and personalized assignment guidance." />
        <div className="academic-assignment-empty-layout">
          <div className="academic-assignment-ring"><strong>—</strong><span>SUBMISSION</span></div>
          <div className="academic-assignment-empty-copy"><div><span>Current status</span><strong>Not available</strong></div><div><span>Subject insights</span><strong>Awaiting submission data</strong></div></div>
        </div>
      </div>
    );
  }

  if (variant === "study-plan") {
    return (
      <div className="academic-data-empty-state academic-data-empty-state-plan">
        <EmptyStateHeader icon="◷" label="PERSONALIZED STUDY PLAN" title="Your study plan will be built around your data" description="Once your academic record is complete, AcadPredict will turn your real focus areas into a personalized plan and timetable." />
        <div className="academic-plan-empty-layout">
          <div><span>WEEKLY PLAN</span><strong>Waiting for academic context</strong></div>
          <div><span>FOCUS AREAS</span><strong>Not available yet</strong></div>
          <div><span>TIMETABLE</span><strong>Generated after data entry</strong></div>
        </div>
      </div>
    );
  }

  if (variant === "mock-test") {
    return (
      <div className="academic-data-empty-state academic-data-empty-state-mock">
        <EmptyStateHeader icon="□" label="AI MOCK TESTS" title="Practice recommendations come next" description="Your personalized mock tests will be matched to the subjects and performance areas in your completed academic record." />
        <div className="academic-mock-empty-layout">
          <div className="academic-mock-empty-preview"><span>PERSONALIZED PRACTICE</span><strong>No subjects recommended</strong><small>Recommendations appear after data entry</small></div>
          <div className="academic-mock-empty-tags"><span>Subject matched</span><span>Difficulty matched</span><span>Progress aware</span></div>
        </div>
      </div>
    );
  }

  if (variant === "attendance") {
    return (
      <div className="academic-data-empty-state academic-data-empty-state-attendance">
        <EmptyStateHeader icon="◉" label="ATTENDANCE ANALYTICS" title="Attendance tracking starts with class records" description="Enter attendance details for your subjects to see your overall presence and areas that need attention." />
        <div className="academic-attendance-empty-layout"><div><strong>—</strong><span>OVERALL ATTENDANCE</span></div><p>Subject attendance and class totals will appear after your records are complete.</p></div>
      </div>
    );
  }

  return (
    <div className="academic-data-empty-state academic-data-empty-state-overview">
      <EmptyStateHeader icon="✦" label="STUDENT OVERVIEW" title="Complete your academic data" description="Enter your academic information to unlock your personalized analysis." />
      <div className="academic-overview-empty-grid">
        <div><span>RISK ANALYSIS</span><strong>Ready when your data is complete</strong></div>
        <div><span>PERFORMANCE</span><strong>Scores and subject trends will appear here</strong></div>
        <div><span>AI GUIDANCE</span><strong>Plans and practice matched to you</strong></div>
      </div>
      <div className="academic-data-empty-footer"><span className="academic-data-footer-icon" aria-hidden="true">◎</span><p><strong>{missingCount ? `${missingCount} required fields remain.` : "Your academic record is not available yet."}</strong> Complete your subjects to open your personalized dashboard.</p></div>
    </div>
  );
}

export default AcademicDataEmptyState;
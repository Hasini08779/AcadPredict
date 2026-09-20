export function getAttendanceStatus(attendance) {
  const percentage = Number(attendance);
  if (percentage >= 75) return "Good";
  if (percentage >= 60) return "Warning";
  return "Critical";
}

export function getAttendanceStatusClass(attendance) {
  return `attendance-${getAttendanceStatus(attendance).toLowerCase()}`;
}

export function getSubjectAttendance(subject = {}) {
  const totalClasses = Number(subject.totalClasses ?? subject.total_classes);
  const classesAttended = Number(subject.classesAttended ?? subject.classes_attended);
  const hasClassTotals = Number.isFinite(totalClasses) && totalClasses > 0
    && Number.isFinite(classesAttended) && classesAttended >= 0 && classesAttended <= totalClasses;
  const hasDirectPercentage = subject.attendance !== null && subject.attendance !== undefined && subject.attendance !== "";
  const percentage = hasClassTotals
    ? Math.min(100, Math.round(classesAttended / totalClasses * 100))
    : hasDirectPercentage ? Number(subject.attendance) : null;

  return {
    totalClasses: hasClassTotals ? totalClasses : null,
    classesAttended: hasClassTotals ? classesAttended : null,
    classesMissed: hasClassTotals ? totalClasses - classesAttended : null,
    percentage: Number.isFinite(percentage) && percentage >= 0 && percentage <= 100 ? percentage : null,
  };
}

export function getAttendanceSummary(student, subjects) {
  const subjectAttendance = subjects.reduce((result, subject) => {
    result[subject] = getSubjectAttendance(student?.subjects?.[subject]);
    return result;
  }, {});
  const records = Object.values(subjectAttendance).filter((item) => item.percentage != null);
  const hasTotals = records.length > 0 && records.every((item) => item.totalClasses != null);
  const totalClasses = hasTotals ? records.reduce((sum, item) => sum + (item.totalClasses || 0), 0) : null;
  const classesAttended = hasTotals ? records.reduce((sum, item) => sum + (item.classesAttended || 0), 0) : null;
  const overallAttendance = totalClasses
    ? Math.round(classesAttended / totalClasses * 100)
    : records.length ? Math.round(records.reduce((sum, item) => sum + item.percentage, 0) / records.length) : null;

  return {
    subjectAttendance,
    overallAttendance,
    totalClasses,
    classesAttended,
    classesMissed: totalClasses == null ? null : totalClasses - classesAttended,
    attendanceStatus: overallAttendance == null ? null : getAttendanceStatus(overallAttendance),
  };
}

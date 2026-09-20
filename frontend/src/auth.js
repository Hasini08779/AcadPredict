const STORAGE_KEY_USER = "acadPredictUser";
const STORAGE_KEY_LOGGED_IN = "acadPredictLoggedIn";
const STORAGE_KEY_USERS = "acadPredictUsers";
const DEMO_PASSWORDS = {
  studentA: import.meta.env.VITE_DEMO_STUDENT_A_PASSWORD || "",
  studentB: import.meta.env.VITE_DEMO_STUDENT_B_PASSWORD || "",
  studentC: import.meta.env.VITE_DEMO_STUDENT_C_PASSWORD || "",
  faculty: import.meta.env.VITE_DEMO_FACULTY_PASSWORD || "",
  admin: import.meta.env.VITE_DEMO_ADMIN_PASSWORD || "",
};

const DEMO_USERS = [
  {
    name: "Amina Hasan",
    studentId: "STU1025",
    email: "student.a@test.com",
    password: DEMO_PASSWORDS.studentA,
    role: "student",
  },
  {
    name: "Rafiq Ahmed",
    studentId: "STU1048",
    email: "student.b@test.com",
    password: DEMO_PASSWORDS.studentB,
    role: "student",
  },
  {
    name: "Sara Nabil",
    studentId: "STU1092",
    email: "student.c@test.com",
    password: DEMO_PASSWORDS.studentC,
    role: "student",
  },
  {
    name: "Faculty Tester",
    email: "faculty@test.com",
    password: DEMO_PASSWORDS.faculty,
    role: "faculty",
  },
  {
    name: "Admin Tester",
    email: "admin@test.com",
    password: DEMO_PASSWORDS.admin,
    role: "admin",
  },
];

function parseStoredUser() {
  const raw = localStorage.getItem(STORAGE_KEY_USER);

  if (!raw) {
    return null;
  }

  try {
    const user = JSON.parse(raw);
    return user;
  } catch {
    localStorage.removeItem(STORAGE_KEY_USER);
    return null;
  }
}

function parseStoredUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USERS);
    const users = raw ? JSON.parse(raw) : [];
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

export function normalizeUser(user) {
  if (!user) {
    return null;
  }

  if (!user.role) {
    return { ...user, role: "student" };
  }

  return user;
}

export function getAuthenticatedUser() {
  const user = parseStoredUser();
  return normalizeUser(user);
}

export function findUserByEmail(email) {
  if (!email) {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const storedUsers = parseStoredUsers();
  const storedUser = parseStoredUser();
  const savedMatch = storedUsers.find((user) => user.email?.trim().toLowerCase() === normalizedEmail);

  if (savedMatch) return normalizeUser(savedMatch);

  if (storedUser && storedUser.email?.trim().toLowerCase() === normalizedEmail) {
    return normalizeUser(storedUser);
  }

  const demoUser = DEMO_USERS.find(
    (user) => user.email === normalizedEmail
  );

  return demoUser ? { ...demoUser } : null;
}

export function saveUser(user) {
  if (!user || !user.email) {
    return;
  }

  const normalized = normalizeUser(user);
  const users = parseStoredUsers().filter(
    (savedUser) => savedUser.email?.trim().toLowerCase() !== normalized.email.trim().toLowerCase()
  );
  users.push(normalized);
  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(normalized));
}

export function updateStoredUser(user) {
  if (!user || !user.email) {
    return;
  }

  saveUser(user);
}

export function setLoggedIn(value) {
  localStorage.setItem(
    STORAGE_KEY_LOGGED_IN,
    value ? "true" : "false"
  );
}

export function logout() {
  setLoggedIn(false);
  localStorage.removeItem(STORAGE_KEY_USER);
}

export function isLoggedIn() {
  return localStorage.getItem(STORAGE_KEY_LOGGED_IN) === "true";
}

export function getRoleRedirectPath(role) {
  if (role === "faculty") {
    return "/faculty";
  }

  if (role === "admin") {
    return "/admin";
  }

  return "/dashboard";
}

export function updatePasswordForEmail(email, newPassword) {
  const foundUser = findUserByEmail(email);

  if (!foundUser) {
    return null;
  }

  const updated = {
    ...foundUser,
    password: newPassword,
    role: foundUser.role || "student",
  };

  saveUser(updated);
  return updated;
}

export function getDefaultStoredRole() {
  return "student";
}

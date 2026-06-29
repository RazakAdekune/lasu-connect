const AUTH_KEY = window.LASU_SHARED.AUTH_KEY;
const levels = window.LASU_DATA.levels;
const semesters = window.LASU_DATA.semesters || [window.LASU_SHARED.getDefaultSemester()];
const faculties = window.LASU_DATA.faculties || [];
const admins = window.LASU_DATA.adminUsers || [];

// Student login fields
const loginMatric = document.getElementById("login-matric");
const loginPassword = document.getElementById("login-password");

// Student signup fields
const signupName = document.getElementById("signup-name");
const signupMatric = document.getElementById("signup-matric");
const signupFaculty = document.getElementById("signup-faculty");
const signupDepartment = document.getElementById("signup-department");
const signupLevel = document.getElementById("signup-level");
const signupSemester = document.getElementById("signup-semester");
const signupPassword = document.getElementById("signup-password");
const signupPasswordConfirm = document.getElementById("signup-password-confirm");

// Admin fields
const adminFaculty = document.getElementById("admin-faculty");
const adminDepartment = document.getElementById("admin-department");
const adminUsernameInput = document.getElementById("admin-username");
const adminPasswordInput = document.getElementById("admin-password");
const adminHelperUsername = document.getElementById("admin-helper-username");
const adminHelperPassword = document.getElementById("admin-helper-password");
const adminHelperFillButton = document.getElementById("admin-helper-fill");

const feedback = document.getElementById("login-feedback");
const studentLoginForm = document.getElementById("student-login");
const studentSignupForm = document.getElementById("student-signup");
const adminLoginForm = document.getElementById("admin-login");

// Student sub-toggle (Log in / Sign up)
const studentTabLogin = document.getElementById("student-tab-login");
const studentTabSignup = document.getElementById("student-tab-signup");
const studentGoSignup = document.getElementById("student-go-signup");
const studentGoLogin = document.getElementById("student-go-login");
const studentLaneTitle = document.getElementById("student-lane-title");

function renderDepartments(selectElement, faculty) {
  const departments = window.LASU_SHARED.getDepartmentsForFaculty(faculty);
  selectElement.innerHTML = departments.map((department) => `<option value="${department}">${department}</option>`).join("");
}

function initializeLoginForm() {
  signupFaculty.innerHTML = faculties.map((faculty) => `<option value="${faculty}">${faculty}</option>`).join("");
  adminFaculty.innerHTML = faculties.map((faculty) => `<option value="${faculty}">${faculty}</option>`).join("");
  signupLevel.innerHTML = levels.map((level) => `<option value="${level}">${level} Level</option>`).join("");
  signupSemester.innerHTML = semesters.map((semester) => `<option value="${semester}">${semester}</option>`).join("");
  signupSemester.value = window.LASU_SHARED.getDefaultSemester();
  renderDepartments(signupDepartment, signupFaculty.value);
  renderDepartments(adminDepartment, adminFaculty.value);
  renderAdminHelper();
}

function buildStudentInitials(name) {
  return (name || "Student")
    .split(" ")
    .map((part) => part[0] || "")
    .slice(0, 2)
    .join("")
    .toUpperCase() || "ST";
}

function showStudentLogin() {
  studentTabLogin.classList.add("is-active");
  studentTabSignup.classList.remove("is-active");
  studentLoginForm.classList.add("is-active");
  studentSignupForm.classList.remove("is-active");
  if (studentLaneTitle) studentLaneTitle.textContent = "Student Login";
  feedback.textContent = "";
}

function showStudentSignup() {
  studentTabSignup.classList.add("is-active");
  studentTabLogin.classList.remove("is-active");
  studentSignupForm.classList.add("is-active");
  studentLoginForm.classList.remove("is-active");
  if (studentLaneTitle) studentLaneTitle.textContent = "Student Sign Up";
  feedback.textContent = "";
}

function startStudentSession(student) {
  const cleanName = (student.name || "").trim() || "Student";
  const payload = {
    role: "student",
    studentId: student.id || `student-${window.LASU_SHARED.normalizeMatric(student.matric)}`,
    studentName: cleanName,
    studentMatric: student.matric || "N/A",
    studentFaculty: student.faculty || "",
    studentDepartment: student.department || "",
    studentLevel: student.level || "",
    studentSemester: student.semester || window.LASU_SHARED.getDefaultSemester(),
    studentInitials: buildStudentInitials(cleanName)
  };
  window.localStorage.setItem(AUTH_KEY, JSON.stringify(payload));
}

async function handleStudentSignup(event) {
  event.preventDefault();
  feedback.textContent = "";
  window.LASU_SHARED.clearFormErrors(studentSignupForm);
  let valid = true;
  if (!signupName.value.trim()) {
    window.LASU_SHARED.setFieldError(studentSignupForm, "signup-name", "Full name is required.");
    valid = false;
  }
  if (!signupMatric.value.trim()) {
    window.LASU_SHARED.setFieldError(studentSignupForm, "signup-matric", "Matric number is required.");
    valid = false;
  }
  if (!signupFaculty.value) {
    window.LASU_SHARED.setFieldError(studentSignupForm, "signup-faculty", "Select a faculty.");
    valid = false;
  }
  if (!signupDepartment.value) {
    window.LASU_SHARED.setFieldError(studentSignupForm, "signup-department", "Select a department.");
    valid = false;
  }
  if (!signupLevel.value) {
    window.LASU_SHARED.setFieldError(studentSignupForm, "signup-level", "Select a level.");
    valid = false;
  }
  if (!signupSemester.value) {
    window.LASU_SHARED.setFieldError(studentSignupForm, "signup-semester", "Select a semester.");
    valid = false;
  }
  if (!signupPassword.value) {
    window.LASU_SHARED.setFieldError(studentSignupForm, "signup-password", "Password is required.");
    valid = false;
  } else if (signupPassword.value.length < 6) {
    window.LASU_SHARED.setFieldError(studentSignupForm, "signup-password", "Use at least 6 characters.");
    valid = false;
  }
  if (signupPasswordConfirm.value !== signupPassword.value) {
    window.LASU_SHARED.setFieldError(studentSignupForm, "signup-password-confirm", "Passwords do not match.");
    valid = false;
  }
  if (!valid) {
    window.LASU_SHARED.showToast("Please complete the sign up form.", "error");
    return;
  }

  window.LASU_SHARED.setFormLoading(studentSignupForm, true, "Creating account...");
  const result = await window.LASU_SHARED.registerStudent({
    name: signupName.value.trim(),
    matric: signupMatric.value.trim(),
    faculty: signupFaculty.value,
    department: signupDepartment.value,
    level: signupLevel.value,
    semester: signupSemester.value,
    password: signupPassword.value
  });
  window.LASU_SHARED.setFormLoading(studentSignupForm, false);

  if (!result.ok) {
    if (result.error === "matric_taken") {
      feedback.textContent = "An account with this matric number already exists. Please log in.";
      window.LASU_SHARED.setFieldError(studentSignupForm, "signup-matric", "Matric number already registered.");
      window.LASU_SHARED.showToast("Matric number already registered.", "error");
    } else if (result.error === "weak_password") {
      feedback.textContent = "Please choose a password with at least 6 characters.";
      window.LASU_SHARED.setFieldError(studentSignupForm, "signup-password", "Use at least 6 characters.");
      window.LASU_SHARED.showToast("Password too weak.", "error");
    } else if (result.error === "network") {
      feedback.textContent = "Could not reach the server. Check your connection and try again.";
      window.LASU_SHARED.showToast("Network error.", "error");
    } else {
      feedback.textContent = "Could not create the account. Please try again.";
      window.LASU_SHARED.showToast("Sign up failed.", "error");
    }
    return;
  }

  startStudentSession(result.student);
  window.LASU_SHARED.showToast("Account created. Welcome!", "success");
  window.location.href = "student.html";
}

async function handleStudentLogin(event) {
  event.preventDefault();
  feedback.textContent = "";
  window.LASU_SHARED.clearFormErrors(studentLoginForm);
  let valid = true;
  if (!loginMatric.value.trim()) {
    window.LASU_SHARED.setFieldError(studentLoginForm, "login-matric", "Matric number is required.");
    valid = false;
  }
  if (!loginPassword.value) {
    window.LASU_SHARED.setFieldError(studentLoginForm, "login-password", "Password is required.");
    valid = false;
  }
  if (!valid) {
    window.LASU_SHARED.showToast("Please enter your matric number and password.", "error");
    return;
  }

  window.LASU_SHARED.setFormLoading(studentLoginForm, true, "Signing in...");
  const result = await window.LASU_SHARED.verifyStudent(loginMatric.value.trim(), loginPassword.value);
  window.LASU_SHARED.setFormLoading(studentLoginForm, false);

  if (!result.ok) {
    if (result.error === "not_found") {
      feedback.textContent = "No account found for that matric number. Please sign up first.";
    } else if (result.error === "network") {
      feedback.textContent = "Could not reach the server. Check your connection and try again.";
    } else {
      feedback.textContent = "Incorrect matric number or password.";
    }
    window.LASU_SHARED.showToast("Login failed.", "error");
    return;
  }

  startStudentSession(result.student);
  window.LASU_SHARED.showToast("Student login successful.", "success");
  window.location.href = "student.html";
}

async function handleAdminLogin(event) {
  event.preventDefault();
  feedback.textContent = "";
  window.LASU_SHARED.clearFormErrors(adminLoginForm);
  let valid = true;
  if (!adminUsernameInput.value.trim()) {
    window.LASU_SHARED.setFieldError(adminLoginForm, "admin-username", "Username is required.");
    valid = false;
  }
  if (!adminPasswordInput.value.trim()) {
    window.LASU_SHARED.setFieldError(adminLoginForm, "admin-password", "Password is required.");
    valid = false;
  }
  if (!adminFaculty.value) {
    window.LASU_SHARED.setFieldError(adminLoginForm, "admin-faculty", "Select a faculty.");
    valid = false;
  }
  if (!adminDepartment.value) {
    window.LASU_SHARED.setFieldError(adminLoginForm, "admin-department", "Select a department.");
    valid = false;
  }
  if (!valid) {
    window.LASU_SHARED.showToast("Please complete the admin login form.", "error");
    return;
  }
  window.LASU_SHARED.setFormLoading(adminLoginForm, true, "Signing in...");
  const result = await window.LASU_SHARED.verifyAdmin(
    adminUsernameInput.value.trim(),
    adminPasswordInput.value.trim(),
    adminFaculty.value,
    adminDepartment.value
  );
  window.LASU_SHARED.setFormLoading(adminLoginForm, false);

  if (!result.ok) {
    if (result.error === "network") {
      feedback.textContent = "Could not reach the server. Check your connection and try again.";
    } else {
      feedback.textContent = "Invalid admin login for selected faculty/department.";
    }
    window.LASU_SHARED.showToast("Invalid admin login details.", "error");
    return;
  }

  window.localStorage.setItem(AUTH_KEY, JSON.stringify({
    role: "admin",
    adminFaculty: adminFaculty.value,
    adminDepartment: adminDepartment.value,
    adminName: result.admin.name
  }));
  window.LASU_SHARED.showToast("Admin login successful.", "success");
  window.location.href = "admin.html";
}

function currentAdminMatch() {
  return admins.find((admin) =>
    admin.faculty === adminFaculty.value &&
    admin.department === adminDepartment.value
  ) || null;
}

function renderAdminHelper() {
  const match = currentAdminMatch();
  if (!match) {
    adminHelperUsername.textContent = "-";
    adminHelperPassword.textContent = "-";
    adminHelperFillButton.disabled = true;
    adminHelperFillButton.classList.add("opacity-60");
    return;
  }
  adminHelperUsername.textContent = match.username;
  adminHelperPassword.textContent = match.password;
  adminHelperFillButton.disabled = false;
  adminHelperFillButton.classList.remove("opacity-60");
}

function applyAdminHelperCredentials() {
  const match = currentAdminMatch();
  if (!match) return;
  adminUsernameInput.value = match.username;
  adminPasswordInput.value = match.password;
}

initializeLoginForm();

signupFaculty.addEventListener("change", () => renderDepartments(signupDepartment, signupFaculty.value));
adminFaculty.addEventListener("change", () => {
  renderDepartments(adminDepartment, adminFaculty.value);
  renderAdminHelper();
});
adminDepartment.addEventListener("change", renderAdminHelper);
adminHelperFillButton.addEventListener("click", applyAdminHelperCredentials);

studentTabLogin.addEventListener("click", showStudentLogin);
studentTabSignup.addEventListener("click", showStudentSignup);
studentGoSignup.addEventListener("click", showStudentSignup);
studentGoLogin.addEventListener("click", showStudentLogin);

studentLoginForm.addEventListener("submit", handleStudentLogin);
studentSignupForm.addEventListener("submit", handleStudentSignup);
adminLoginForm.addEventListener("submit", handleAdminLogin);

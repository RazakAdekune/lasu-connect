const AUTH_KEY = window.LASU_SHARED.AUTH_KEY;
const levels = window.LASU_DATA.levels;
const semesters = window.LASU_DATA.semesters || [window.LASU_SHARED.getDefaultSemester()];
const faculties = window.LASU_DATA.faculties || [];
const admins = window.LASU_DATA.adminUsers || [];

const studentName = document.getElementById("student-name");
const studentMatric = document.getElementById("student-matric");
const studentFaculty = document.getElementById("student-faculty");
const studentDepartment = document.getElementById("student-department");
const studentLevel = document.getElementById("student-level");
const studentSemester = document.getElementById("student-semester");
const adminFaculty = document.getElementById("admin-faculty");
const adminDepartment = document.getElementById("admin-department");
const adminUsernameInput = document.getElementById("admin-username");
const adminPasswordInput = document.getElementById("admin-password");
const adminHelperUsername = document.getElementById("admin-helper-username");
const adminHelperPassword = document.getElementById("admin-helper-password");
const adminHelperFillButton = document.getElementById("admin-helper-fill");
const feedback = document.getElementById("login-feedback");
const studentLoginForm = document.getElementById("student-login");
const adminLoginForm = document.getElementById("admin-login");

function renderDepartments(selectElement, faculty) {
  const departments = window.LASU_SHARED.getDepartmentsForFaculty(faculty);
  selectElement.innerHTML = departments.map((department) => `<option value="${department}">${department}</option>`).join("");
}

function initializeLoginForm() {
  studentFaculty.innerHTML = faculties.map((faculty) => `<option value="${faculty}">${faculty}</option>`).join("");
  adminFaculty.innerHTML = faculties.map((faculty) => `<option value="${faculty}">${faculty}</option>`).join("");
  studentLevel.innerHTML = levels.map((level) => `<option value="${level}">${level} Level</option>`).join("");
  studentSemester.innerHTML = semesters.map((semester) => `<option value="${semester}">${semester}</option>`).join("");
  studentSemester.value = window.LASU_SHARED.getDefaultSemester();
  studentName.value = "";
  studentMatric.value = "";
  renderDepartments(studentDepartment, studentFaculty.value);
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

function handleStudentLogin(event) {
  event.preventDefault();
  feedback.textContent = "";
  window.LASU_SHARED.clearFormErrors(studentLoginForm);
  let valid = true;
  if (!studentName.value.trim()) {
    window.LASU_SHARED.setFieldError(studentLoginForm, "student-name", "Full name is required.");
    valid = false;
  }
  if (!studentMatric.value.trim()) {
    window.LASU_SHARED.setFieldError(studentLoginForm, "student-matric", "Matric number is required.");
    valid = false;
  }
  if (!studentFaculty.value) {
    window.LASU_SHARED.setFieldError(studentLoginForm, "student-faculty", "Select a faculty.");
    valid = false;
  }
  if (!studentDepartment.value) {
    window.LASU_SHARED.setFieldError(studentLoginForm, "student-department", "Select a department.");
    valid = false;
  }
  if (!studentLevel.value) {
    window.LASU_SHARED.setFieldError(studentLoginForm, "student-level", "Select a level.");
    valid = false;
  }
  if (!studentSemester.value) {
    window.LASU_SHARED.setFieldError(studentLoginForm, "student-semester", "Select a semester.");
    valid = false;
  }
  if (!valid) {
    window.LASU_SHARED.showToast("Please complete the student login form.", "error");
    return;
  }
  window.LASU_SHARED.setFormLoading(studentLoginForm, true, "Signing in...");
  const cleanName = studentName.value.trim() || "Student";
  const payload = {
    role: "student",
    studentId: "custom-student",
    studentName: cleanName,
    studentMatric: studentMatric.value.trim() || "N/A",
    studentFaculty: studentFaculty.value,
    studentDepartment: studentDepartment.value,
    studentLevel: studentLevel.value,
    studentSemester: studentSemester.value,
    studentInitials: buildStudentInitials(cleanName)
  };
  window.localStorage.setItem(AUTH_KEY, JSON.stringify(payload));
  window.LASU_SHARED.showToast("Student login successful.", "success");
  window.LASU_SHARED.setFormLoading(studentLoginForm, false);
  window.location.href = "student.html";
}

function handleAdminLogin(event) {
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
  const username = adminUsernameInput.value.trim();
  const password = adminPasswordInput.value.trim();
  const match = admins.find((admin) =>
    admin.username === username &&
    admin.password === password &&
    admin.faculty === adminFaculty.value &&
    admin.department === adminDepartment.value
  );
  if (!match) {
    feedback.textContent = "Invalid admin login for selected faculty/department.";
    window.LASU_SHARED.showToast("Invalid admin login details.", "error");
    window.LASU_SHARED.setFormLoading(adminLoginForm, false);
    return;
  }
  window.localStorage.setItem(AUTH_KEY, JSON.stringify({
    role: "admin",
    adminFaculty: adminFaculty.value,
    adminDepartment: adminDepartment.value,
    adminName: match.name
  }));
  window.LASU_SHARED.showToast("Admin login successful.", "success");
  window.LASU_SHARED.setFormLoading(adminLoginForm, false);
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

studentFaculty.addEventListener("change", () => renderDepartments(studentDepartment, studentFaculty.value));
adminFaculty.addEventListener("change", () => {
  renderDepartments(adminDepartment, adminFaculty.value);
  renderAdminHelper();
});
adminDepartment.addEventListener("change", renderAdminHelper);
adminHelperFillButton.addEventListener("click", applyAdminHelperCredentials);
studentLoginForm.addEventListener("submit", handleStudentLogin);
adminLoginForm.addEventListener("submit", handleAdminLogin);

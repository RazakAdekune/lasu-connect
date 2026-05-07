window.LASU_SHARED = (function createSharedHelpers() {
  const STORAGE_KEY = window.LASU_DATA.storageKey;
  const AUTH_KEY = "lasu-connect-auth-v1";
  const LOCATION_OVERRIDES_KEY = `${STORAGE_KEY}-location-overrides-v1`;
  const CUSTOM_LOCATIONS_KEY = `${STORAGE_KEY}-custom-locations-v1`;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function loadAuth() {
    try {
      return JSON.parse(window.localStorage.getItem(AUTH_KEY) || "null");
    } catch (_error) {
      return null;
    }
  }

  function requireRole(expectedRole) {
    const auth = loadAuth();
    if (!auth || auth.role !== expectedRole) {
      window.location.href = "login.html";
      return null;
    }
    return auth;
  }

  function getDepartmentsForFaculty(faculty) {
    return Array.isArray(window.LASU_DATA.facultyDepartments?.[faculty])
      ? window.LASU_DATA.facultyDepartments[faculty].slice()
      : [];
  }

  function getFacultyForDepartment(department) {
    if (!department) {
      return "";
    }
    const faculty = (window.LASU_DATA.faculties || []).find((item) =>
      getDepartmentsForFaculty(item).includes(department)
    );
    return faculty || "";
  }

  function getDefaultSemester() {
    return window.LASU_DATA.defaultSemester || window.LASU_DATA.semesters?.[0] || "First Semester";
  }

  function normalizeTimetableEntry(entry) {
    return {
      ...entry,
      faculty: entry.faculty || getFacultyForDepartment(entry.department),
      semester: entry.semester || getDefaultSemester()
    };
  }

  function normalizeReport(report) {
    const seededStudent = (window.LASU_DATA.students || []).find((student) => student.id === report.studentId);
    const studentDepartment = report.studentDepartment || seededStudent?.department || "";
    const studentFaculty = report.studentFaculty || seededStudent?.faculty || getFacultyForDepartment(studentDepartment);
    return {
      ...report,
      studentDepartment,
      studentFaculty,
      studentLevel: report.studentLevel || seededStudent?.level || "",
      studentMatric: report.studentMatric || seededStudent?.matricNo || "",
      studentSemester: report.studentSemester || getDefaultSemester()
    };
  }

  function normalizeAnnouncement(announcement) {
    const audienceDepartment = announcement.audienceDepartment || "all";
    return {
      ...announcement,
      audienceDepartment,
      audienceLevel: announcement.audienceLevel || "all",
      audienceFaculty: announcement.audienceFaculty || (audienceDepartment === "all" ? "all" : getFacultyForDepartment(audienceDepartment)),
      audienceSemester: announcement.audienceSemester || "all"
    };
  }

  function normalizeState(rawState) {
    return {
      issues: (rawState.issues || []).map(normalizeReport),
      timetable: (rawState.timetable || []).map(normalizeTimetableEntry),
      announcements: (rawState.announcements || []).map(normalizeAnnouncement)
    };
  }

  function loadState(defaults) {
    const fallback = normalizeState({
      issues: clone(defaults.issues),
      timetable: clone(defaults.timetable),
      announcements: clone(defaults.announcements)
    });
    try {
      const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
      return normalizeState({
        issues: Array.isArray(raw.issues) ? raw.issues : fallback.issues,
        timetable: Array.isArray(raw.timetable) ? raw.timetable : fallback.timetable,
        announcements: Array.isArray(raw.announcements) ? raw.announcements : fallback.announcements
      });
    } catch (_error) {
      return fallback;
    }
  }

  function saveState(state) {
    const base = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    base.issues = state.issues;
    base.timetable = state.timetable;
    base.announcements = state.announcements;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(base));
  }

  function loadLocationOverrides() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(LOCATION_OVERRIDES_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  function loadCustomLocations() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(CUSTOM_LOCATIONS_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  }

  function saveCustomLocations(locations) {
    window.localStorage.setItem(CUSTOM_LOCATIONS_KEY, JSON.stringify(locations));
  }

  function normalizeLocation(location) {
    return {
      ...location,
      verified: Boolean(location.verified),
      verifiedSource: location.verifiedSource || (location.verified ? "manual" : "unverified")
    };
  }

  function getLocations() {
    const baseLocations = Array.isArray(window.LASU_DATA.locations) ? window.LASU_DATA.locations : [];
    const customLocations = loadCustomLocations();
    const overrides = loadLocationOverrides();
    const mergedLocations = [];
    const seen = new Set();

    const locationsWithSource = [
      ...baseLocations.map((location) => ({ ...location, __source: "base" })),
      ...customLocations.map((location) => ({ ...location, __source: "custom" }))
    ];

    locationsWithSource.forEach((location) => {
      if (!location || typeof location.name !== "string") return;
      const trimmedName = location.name.trim();
      if (!trimmedName) return;
      const key = trimmedName.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      mergedLocations.push({ ...location, name: trimmedName, isCustom: location.__source === "custom" });
    });

    return mergedLocations.map((location) => {
      const override = overrides[location.name];
      if (!override || typeof override !== "object") {
        return normalizeLocation({ ...location });
      }
      return normalizeLocation({ ...location, ...override });
    });
  }

  function addCustomLocation(locationInput) {
    const name = String(locationInput?.name || "").trim();
    const zone = String(locationInput?.zone || "").trim();
    const nextStop = String(locationInput?.nextStop || "Destination").trim() || "Destination";
    const summary = String(locationInput?.summary || "Custom campus location.").trim() || "Custom campus location.";
    const lat = Number(locationInput?.lat);
    const lng = Number(locationInput?.lng);
    const popular = Boolean(locationInput?.popular);
    const verified = Boolean(locationInput?.verified);
    const verifiedSource = String(locationInput?.verifiedSource || (verified ? "admin_custom_pin" : "admin_custom_unverified")).trim();

    if (!name) {
      return { ok: false, message: "Location name is required." };
    }
    if (!zone) {
      return { ok: false, message: "Location zone is required." };
    }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return { ok: false, message: "Latitude must be a valid number between -90 and 90." };
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      return { ok: false, message: "Longitude must be a valid number between -180 and 180." };
    }

    const existing = getLocations().some((location) => String(location.name || "").toLowerCase() === name.toLowerCase());
    if (existing) {
      return { ok: false, message: "A location with this name already exists." };
    }

    const customLocations = loadCustomLocations();
    const customLocation = normalizeLocation({
      name,
      zone,
      lat,
      lng,
      nextStop,
      summary,
      popular,
      verified,
      verifiedSource
    });
    customLocations.push(customLocation);
    saveCustomLocations(customLocations);
    return { ok: true, location: { ...customLocation, isCustom: true } };
  }

  function removeCustomLocation(nameInput) {
    const name = String(nameInput || "").trim();
    if (!name) {
      return { ok: false, message: "Location name is required." };
    }

    const baseLocations = Array.isArray(window.LASU_DATA.locations) ? window.LASU_DATA.locations : [];
    const isSeedLocation = baseLocations.some((location) =>
      String(location?.name || "").trim().toLowerCase() === name.toLowerCase()
    );
    if (isSeedLocation) {
      return { ok: false, message: "Default LASU locations cannot be deleted." };
    }

    const customLocations = loadCustomLocations();
    const index = customLocations.findIndex((location) =>
      String(location?.name || "").trim().toLowerCase() === name.toLowerCase()
    );
    if (index === -1) {
      return { ok: false, message: "Custom location not found." };
    }

    const [removed] = customLocations.splice(index, 1);
    saveCustomLocations(customLocations);
    clearLocationOverride(removed.name);
    return { ok: true, removedName: removed.name };
  }

  function saveLocationOverride(name, overridePatch) {
    if (!name || typeof name !== "string") {
      return;
    }
    const overrides = loadLocationOverrides();
    const current = overrides[name] && typeof overrides[name] === "object" ? overrides[name] : {};
    overrides[name] = { ...current, ...overridePatch };
    window.localStorage.setItem(LOCATION_OVERRIDES_KEY, JSON.stringify(overrides));
  }

  function clearLocationOverride(name) {
    if (!name || typeof name !== "string") {
      return;
    }
    const overrides = loadLocationOverrides();
    delete overrides[name];
    window.localStorage.setItem(LOCATION_OVERRIDES_KEY, JSON.stringify(overrides));
  }

  function logout() {
    window.localStorage.removeItem(AUTH_KEY);
    window.location.href = "login.html";
  }

  function formatTime(value) {
    const [h, m] = value.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    const hh = h % 12 || 12;
    return `${hh}:${String(m).padStart(2, "0")} ${suffix}`;
  }

  function ensureToastContainer() {
    let container = document.getElementById("app-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "app-toast-container";
      container.className = "fixed right-4 top-4 z-50 flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2";
      document.body.appendChild(container);
    }
    return container;
  }

  function showToast(message, type = "info", durationMs = 2600) {
    const paletteByType = {
      success: "border-green-300 bg-green-50 text-green-800",
      error: "border-red-300 bg-red-50 text-red-800",
      info: "border-slate-300 bg-white text-slate-800"
    };
    const toast = document.createElement("div");
    toast.className = `rounded-lg border px-3 py-2 text-sm shadow ${paletteByType[type] || paletteByType.info}`;
    toast.textContent = message;
    ensureToastContainer().appendChild(toast);
    window.setTimeout(() => {
      toast.remove();
    }, durationMs);
  }

  function getSubmitButton(form) {
    return form.querySelector('button[type="submit"], button:not([type]), input[type="submit"]');
  }

  function setFormLoading(form, isLoading, loadingLabel = "Please wait...") {
    const submitButton = getSubmitButton(form);
    if (!submitButton) {
      return;
    }
    if (!submitButton.dataset.idleLabel) {
      submitButton.dataset.idleLabel = submitButton.textContent || "Submit";
    }
    submitButton.disabled = isLoading;
    submitButton.classList.toggle("opacity-70", isLoading);
    submitButton.classList.toggle("cursor-not-allowed", isLoading);
    submitButton.textContent = isLoading ? loadingLabel : submitButton.dataset.idleLabel;
  }

  function clearFormErrors(form) {
    form.querySelectorAll("[data-inline-error]").forEach((node) => node.remove());
    form.querySelectorAll("[data-input-error='true']").forEach((input) => {
      input.dataset.inputError = "false";
      input.classList.remove("border-red-500");
      input.classList.remove("ring-1");
      input.classList.remove("ring-red-200");
    });
  }

  function setFieldError(form, fieldId, message) {
    const input = form.querySelector(`#${fieldId}`);
    if (!input) {
      return;
    }
    input.dataset.inputError = "true";
    input.classList.add("border-red-500");
    input.classList.add("ring-1");
    input.classList.add("ring-red-200");
    const error = document.createElement("p");
    error.dataset.inlineError = "true";
    error.className = "mt-1 text-xs text-red-600";
    error.textContent = message;
    input.insertAdjacentElement("afterend", error);
  }

  function isValidTimeRange(startValue, endValue) {
    if (!startValue || !endValue) {
      return false;
    }
    return startValue < endValue;
  }

  function matchesFacultyDepartment(recordFaculty, recordDepartment, scopeFaculty, scopeDepartment) {
    const facultyMatch = !scopeFaculty || recordFaculty === scopeFaculty;
    const departmentMatch = !scopeDepartment || recordDepartment === scopeDepartment;
    return facultyMatch && departmentMatch;
  }

  function matchesStudentScope(entry, currentStudent) {
    return entry.faculty === currentStudent.faculty &&
      entry.department === currentStudent.department &&
      entry.level === currentStudent.level &&
      entry.semester === currentStudent.semester;
  }

  function matchesAnnouncementAudience(announcement, audience) {
    const facultyMatch = announcement.audienceFaculty === "all" || announcement.audienceFaculty === audience.faculty;
    const departmentMatch = announcement.audienceDepartment === "all" || announcement.audienceDepartment === audience.department;
    const levelMatch = announcement.audienceLevel === "all" || announcement.audienceLevel === audience.level;
    const semesterMatch = announcement.audienceSemester === "all" || announcement.audienceSemester === audience.semester;
    return facultyMatch && departmentMatch && levelMatch && semesterMatch;
  }

  return {
    AUTH_KEY,
    clone,
    escapeHtml,
    loadAuth,
    requireRole,
    getDepartmentsForFaculty,
    getFacultyForDepartment,
    getDefaultSemester,
    loadState,
    saveState,
    getLocations,
    addCustomLocation,
    removeCustomLocation,
    saveLocationOverride,
    clearLocationOverride,
    logout,
    formatTime,
    showToast,
    setFormLoading,
    clearFormErrors,
    setFieldError,
    isValidTimeRange,
    matchesFacultyDepartment,
    matchesStudentScope,
    matchesAnnouncementAudience
  };
})();

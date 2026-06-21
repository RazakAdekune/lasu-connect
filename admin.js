const auth = window.LASU_SHARED.requireRole("admin");
if (!auth) {
  throw new Error("Admin role required");
}

const defaults = {
  issues: window.LASU_DATA.reports,
  timetable: window.LASU_DATA.timetable,
  announcements: window.LASU_DATA.announcements
};

let state = window.LASU_SHARED.loadState(defaults);
const timetableForm = document.getElementById("timetable-form");
const announcementForm = document.getElementById("announcement-form");
const timetableFeedback = document.getElementById("tt-feedback");
const announcementFeedback = document.getElementById("announcement-feedback");
const locationVerifySelect = document.getElementById("location-verify-select");
const locationVerifyLat = document.getElementById("location-verify-lat");
const locationVerifyLng = document.getElementById("location-verify-lng");
const locationVerifySource = document.getElementById("location-verify-source");
const locationVerifyVerified = document.getElementById("location-verify-verified");
const locationVerifyFeedback = document.getElementById("location-verify-feedback");
const locationUnverifiedList = document.getElementById("location-unverified-list");
const locationUseMapPinButton = document.getElementById("location-use-map-pin");
const adminPinMapElement = document.getElementById("admin-pin-map");
const esc = window.LASU_SHARED.escapeHtml || ((value) => String(value ?? ""));

let adminMap = null;
let adminEditMarker = null;
const adminLocationMarkers = new Map();

const CAMPUS_BOUNDS = {
  minLat: 6.4620,
  maxLat: 6.4795,
  minLng: 3.1950,
  maxLng: 3.2065
};

function scope() {
  return {
    faculty: window.LASU_SHARED.getFacultyForDepartment(auth.adminDepartment) || auth.adminFaculty || "",
    department: auth.adminDepartment || ""
  };
}

function inScopeFacultyDepartment(recordFaculty, recordDepartment) {
  const currentScope = scope();
  return window.LASU_SHARED.matchesFacultyDepartment(
    recordFaculty,
    recordDepartment,
    currentScope.faculty,
    currentScope.department
  );
}

function visibleTimetable() {
  return state.timetable
    .filter((t) => inScopeFacultyDepartment(t.faculty, t.department))
    .sort((a, b) => `${a.level}-${a.day}-${a.start}`.localeCompare(`${b.level}-${b.day}-${b.start}`));
}

function visibleReports() {
  return state.issues.filter((issue) => {
    return inScopeFacultyDepartment(issue.studentFaculty, issue.studentDepartment);
  });
}

function visibleAnnouncementsForFlow() {
  const currentScope = scope();
  return state.announcements.filter((announcement) => {
    const facultyMatch = announcement.audienceFaculty === "all" || announcement.audienceFaculty === currentScope.faculty;
    const departmentMatch = announcement.audienceDepartment === "all" || announcement.audienceDepartment === currentScope.department;
    return facultyMatch && departmentMatch;
  });
}

function hasDuplicateTimetableEntry(candidate) {
  return state.timetable.some((entry) =>
    entry.day === candidate.day &&
    entry.start === candidate.start &&
    entry.end === candidate.end &&
    entry.level === candidate.level &&
    entry.semester === candidate.semester &&
    entry.department === candidate.department
  );
}

function renderHeader() {
  const s = scope();
  document.getElementById("admin-scope").textContent = `${auth.adminName || "Admin"} | ${s.faculty} / ${s.department}`;
}

function allLocations() {
  return window.LASU_SHARED.getLocations();
}

function hasCoordinates(location) {
  return typeof location.lat === "number" && Number.isFinite(location.lat) &&
    typeof location.lng === "number" && Number.isFinite(location.lng);
}

function isWithinCampus(location) {
  if (!hasCoordinates(location)) return false;
  return location.lat >= CAMPUS_BOUNDS.minLat &&
    location.lat <= CAMPUS_BOUNDS.maxLat &&
    location.lng >= CAMPUS_BOUNDS.minLng &&
    location.lng <= CAMPUS_BOUNDS.maxLng;
}

function findLocation(name) {
  return allLocations().find((location) => location.name === name);
}

function optionLabel(location) {
  const verifiedLabel = location.verified ? "Verified" : "Needs pin";
  const campusLabel = isWithinCampus(location) ? "On-campus" : "Check campus";
  return `${location.name} (${verifiedLabel}, ${campusLabel})`;
}

function mapCenter() {
  const points = allLocations().filter(hasCoordinates).filter(isWithinCampus);
  if (!points.length) return { lat: 6.473789, lng: 3.199954 };
  return {
    lat: points.reduce((sum, location) => sum + location.lat, 0) / points.length,
    lng: points.reduce((sum, location) => sum + location.lng, 0) / points.length
  };
}

function adminMarkerStyle(location, selected = false) {
  if (selected) return { radius: 7, color: "#000000", weight: 2, fillColor: "#000000", fillOpacity: 1 };
  if (location.verified) return { radius: 6, color: "#111827", weight: 2, fillColor: "#111827", fillOpacity: 0.8 };
  return { radius: 6, color: "#92400e", weight: 2, fillColor: "#b45309", fillOpacity: 0.9 };
}

function updateLatLngInputsFromMap(lat, lng) {
  locationVerifyLat.value = lat.toFixed(7);
  locationVerifyLng.value = lng.toFixed(7);
}

function setAdminEditMarker(lat, lng, centerMap = false) {
  if (!adminMap || typeof window.L === "undefined") return;
  if (!adminEditMarker) {
    adminEditMarker = window.L.marker([lat, lng], { draggable: true })
      .addTo(adminMap)
      .bindPopup("Drag this pin to set exact coordinates.");
    adminEditMarker.on("dragend", () => {
      const pos = adminEditMarker.getLatLng();
      updateLatLngInputsFromMap(pos.lat, pos.lng);
    });
  } else {
    adminEditMarker.setLatLng([lat, lng]);
  }
  if (centerMap) adminMap.setView([lat, lng], Math.max(adminMap.getZoom(), 17));
}

function refreshAdminLocationMarkers() {
  if (!adminMap || typeof window.L === "undefined") return;

  adminLocationMarkers.forEach((marker) => adminMap.removeLayer(marker));
  adminLocationMarkers.clear();

  const selectedName = locationVerifySelect?.value || "";
  allLocations().forEach((location) => {
    if (!hasCoordinates(location)) return;
    const marker = window.L.circleMarker([location.lat, location.lng], adminMarkerStyle(location, location.name === selectedName))
      .bindPopup(`<strong>${esc(location.name)}</strong><br>${location.verified ? "Verified pin" : "Needs verification"}`)
      .addTo(adminMap);
    marker.on("click", () => {
      locationVerifySelect.value = location.name;
      locationVerifyFeedback.textContent = "";
      fillLocationVerifierForm(location);
      refreshAdminLocationMarkers();
      setAdminEditMarker(location.lat, location.lng, true);
    });
    adminLocationMarkers.set(location.name, marker);
  });
}

function syncMapWithSelectedLocation(centerMap = true) {
  const selected = findLocation(locationVerifySelect.value);
  if (!selected || !adminMap) return;
  if (hasCoordinates(selected)) {
    setAdminEditMarker(selected.lat, selected.lng, centerMap);
  } else {
    const center = mapCenter();
    setAdminEditMarker(center.lat, center.lng, centerMap);
  }
  refreshAdminLocationMarkers();
}

function initializeAdminPinMap() {
  if (adminMap || !adminPinMapElement || typeof window.L === "undefined") return;
  const center = mapCenter();
  adminMap = window.L.map("admin-pin-map").setView([center.lat, center.lng], 17);
  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 20,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(adminMap);

  adminMap.on("click", (event) => {
    setAdminEditMarker(event.latlng.lat, event.latlng.lng, false);
    updateLatLngInputsFromMap(event.latlng.lat, event.latlng.lng);
  });

  refreshAdminLocationMarkers();
  syncMapWithSelectedLocation(false);
}

function populateInputs() {
  document.getElementById("tt-venue").innerHTML = allLocations()
    .filter((l) => l.name !== "Student Affairs")
    .map((l) => `<option value="${esc(l.name)}">${esc(l.name)}</option>`)
    .join("");
  document.getElementById("tt-level").innerHTML = window.LASU_DATA.levels.map((l) => `<option value="${l}">${l} Level</option>`).join("");
  document.getElementById("tt-semester").innerHTML = window.LASU_DATA.semesters.map((semester) => `<option value="${semester}">${semester}</option>`).join("");
  document.getElementById("tt-department").innerHTML = `<option value="${esc(scope().department)}">${esc(scope().department)}</option>`;
  document.getElementById("announcement-level").innerHTML = [`<option value="all">All levels</option>`, ...window.LASU_DATA.levels.map((l) => `<option value="${l}">${l} Level</option>`)].join("");
  document.getElementById("announcement-semester").innerHTML = [`<option value="all">All semesters</option>`, ...window.LASU_DATA.semesters.map((semester) => `<option value="${semester}">${semester}</option>`)].join("");
  document.getElementById("announcement-department").innerHTML = `<option value="${esc(scope().department)}">${esc(scope().department)}</option>`;
}

function fillLocationVerifierForm(location) {
  if (!location) return;
  locationVerifyLat.value = hasCoordinates(location) ? String(location.lat) : "";
  locationVerifyLng.value = hasCoordinates(location) ? String(location.lng) : "";
  locationVerifySource.value = location.verifiedSource || (location.verified ? "manual" : "unverified");
  locationVerifyVerified.checked = Boolean(location.verified);
}

function renderUnverifiedLocations() {
  if (!locationUnverifiedList) return;
  const pending = allLocations().filter((location) => !location.verified || !isWithinCampus(location));
  locationUnverifiedList.innerHTML = pending.length
    ? pending.map((location) => `<div class="rounded border px-2 py-1">${esc(optionLabel(location))}</div>`).join("")
    : `<p class="text-sm text-green-700">All locations are verified and inside campus bounds.</p>`;
}

function renderLocationVerifier() {
  if (!locationVerifySelect) return;
  const previousSelection = locationVerifySelect.value;
  const options = allLocations()
    .map((location) => `<option value="${esc(location.name)}">${esc(optionLabel(location))}</option>`)
    .join("");
  locationVerifySelect.innerHTML = options;
  locationVerifySelect.value = previousSelection && findLocation(previousSelection)
    ? previousSelection
    : (allLocations()[0]?.name || "");
  fillLocationVerifierForm(findLocation(locationVerifySelect.value));
  renderUnverifiedLocations();
  syncMapWithSelectedLocation(false);
}

function saveLocationVerification() {
  const selected = findLocation(locationVerifySelect.value);
  if (!selected) return;

  const lat = Number(locationVerifyLat.value.trim());
  const lng = Number(locationVerifyLng.value.trim());
  const source = locationVerifySource.value.trim() || "manual_verification";
  const verified = locationVerifyVerified.checked;

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    locationVerifyFeedback.textContent = "Latitude must be a valid number between -90 and 90.";
    return;
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    locationVerifyFeedback.textContent = "Longitude must be a valid number between -180 and 180.";
    return;
  }

  window.LASU_SHARED.saveLocationOverride(selected.name, {
    lat,
    lng,
    verified,
    verifiedSource: source
  });

  const updated = { ...selected, lat, lng, verified };
  locationVerifyFeedback.textContent = isWithinCampus(updated)
    ? `Saved ${selected.name} as verified pin.`
    : `Saved ${selected.name}, but the pin is outside LASU campus bounds. Recheck on map.`;
  renderLocationVerifier();
  populateInputs();
}

function resetLocationVerification() {
  const selectedName = locationVerifySelect.value;
  if (!selectedName) return;
  window.LASU_SHARED.clearLocationOverride(selectedName);
  locationVerifyFeedback.textContent = `Reset ${selectedName} to seed data.`;
  renderLocationVerifier();
  populateInputs();
}

function useMapPinCoordinates() {
  if (!adminEditMarker) {
    locationVerifyFeedback.textContent = "Map pin is not ready yet.";
    return;
  }
  const pin = adminEditMarker.getLatLng();
  updateLatLngInputsFromMap(pin.lat, pin.lng);
  locationVerifyFeedback.textContent = "Loaded coordinates from map pin.";
}

function syncMapPinFromInputs() {
  const lat = Number(locationVerifyLat.value.trim());
  const lng = Number(locationVerifyLng.value.trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  setAdminEditMarker(lat, lng, false);
}

function openLocationInGoogleMaps() {
  const selectedName = locationVerifySelect.value;
  if (!selectedName) return;
  const query = encodeURIComponent(`${selectedName}, Lagos State University Ojo`);
  window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank", "noopener");
}

function renderTimetable() {
  const rows = visibleTimetable();
  document.getElementById("timetable-list").innerHTML = rows.length
    ? rows.map((r) => `<div class="rounded border p-2 text-sm">${esc(r.courseCode)} - ${esc(r.courseTitle)} | ${esc(r.day)} ${window.LASU_SHARED.formatTime(r.start)}-${window.LASU_SHARED.formatTime(r.end)} | ${esc(r.level)} | ${esc(r.semester)} | ${esc(r.location)}</div>`).join("")
    : `<p class="text-sm text-gray-600">No timetable entries yet for this department.</p>`;
}

function renderReports() {
  const reports = visibleReports().sort((a, b) => b.id - a.id);
  document.getElementById("report-list").innerHTML = reports.length ? reports.map((r) => `
    <article class="rounded border p-3">
      <p class="font-medium">Report #${r.id} - ${esc(r.type)}</p>
      <p class="mt-1 text-xs text-gray-600">${esc(r.studentFaculty)} | ${esc(r.studentDepartment)} | ${esc(r.studentLevel || "Level not set")} | ${esc(r.studentSemester || "Semester not set")}</p>
      <p class="text-sm text-gray-700">${esc(r.description)}</p>
      <p class="mt-1 text-xs text-gray-600">${esc(r.location)} | ${esc(r.status)}</p>
      <div class="mt-2 grid gap-2 md:grid-cols-3">
        <select class="report-status rounded border px-2 py-1" data-id="${r.id}">
          <option value="Pending" ${r.status === "Pending" ? "selected" : ""}>Pending</option>
          <option value="Under review" ${r.status === "Under review" ? "selected" : ""}>Under review</option>
          <option value="Resolved" ${r.status === "Resolved" ? "selected" : ""}>Resolved</option>
        </select>
        <input class="report-response rounded border px-2 py-1 md:col-span-2" data-id="${r.id}" value="${esc(r.adminResponse || "")}" placeholder="Admin response">
      </div>
      <label class="mt-2 flex items-center gap-2 text-sm">
        <input type="checkbox" class="report-broadcast" data-id="${r.id}" ${r.broadcast ? "checked" : ""}>
        Broadcast to notifications
      </label>
      <button class="save-report mt-2 rounded bg-black px-3 py-1 text-sm text-white" data-id="${r.id}">Save</button>
    </article>
  `).join("") : `<p class="text-sm text-gray-600">No reports for this department.</p>`;

  document.querySelectorAll(".save-report").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);
      const status = document.querySelector(`.report-status[data-id="${id}"]`).value;
      const response = document.querySelector(`.report-response[data-id="${id}"]`).value.trim();
      const broadcast = document.querySelector(`.report-broadcast[data-id="${id}"]`).checked;
      state.issues = state.issues.map((issue) => issue.id === id ? { ...issue, status, adminResponse: response, broadcast, respondedAt: new Date().toISOString().slice(0, 16).replace("T", " ") } : issue);
      window.LASU_SHARED.saveState(state);
      window.LASU_SHARED.showToast(`Report #${id} updated.`, "success");
      renderNotifications();
      renderReports();
    });
  });
}

function renderNotifications() {
  const items = [];
  visibleAnnouncementsForFlow().forEach((a) => {
    items.push({ source: "Announcement", message: `${a.title}: ${a.message} (${a.audienceSemester})`, time: a.createdAt });
  });
  visibleTimetable().forEach((t) => {
    items.push({ source: "Timetable", message: `${t.courseCode} updated for ${t.level} level, ${t.semester}, on ${t.day}`, time: t.updatedAt });
  });
  visibleReports().forEach((r) => {
    if (r.adminResponse) items.push({ source: "Report response", message: `Report #${r.id}: ${r.adminResponse}`, time: r.respondedAt || r.createdAt });
    if (r.broadcast) items.push({ source: "Broadcast", message: `${r.location}: ${r.description}`, time: r.respondedAt || r.createdAt });
  });
  items.sort((a, b) => String(b.time).localeCompare(String(a.time)));
  document.getElementById("notifications-list").innerHTML = items.length
    ? items.map((n) => `<div class="rounded border p-2 text-sm"><span class="font-medium">${esc(n.source)}:</span> ${esc(n.message)} <span class="text-xs text-gray-500">(${esc(n.time)})</span></div>`).join("")
    : `<p class="text-sm text-gray-600">No notifications yet.</p>`;
}

function bindActions() {
  document.getElementById("logout-btn").addEventListener("click", () => window.LASU_SHARED.logout());

  timetableForm.addEventListener("submit", (e) => {
    e.preventDefault();
    timetableFeedback.textContent = "";
    window.LASU_SHARED.clearFormErrors(timetableForm);
    const courseCode = document.getElementById("tt-course-code").value.trim();
    const courseTitle = document.getElementById("tt-course-title").value.trim();
    const day = document.getElementById("tt-day").value;
    const location = document.getElementById("tt-venue").value;
    const level = document.getElementById("tt-level").value;
    const semester = document.getElementById("tt-semester").value;
    const department = document.getElementById("tt-department").value;
    const start = document.getElementById("tt-start").value;
    const end = document.getElementById("tt-end").value;
    let valid = true;
    if (!courseCode) {
      window.LASU_SHARED.setFieldError(timetableForm, "tt-course-code", "Course code is required.");
      valid = false;
    }
    if (!courseTitle) {
      window.LASU_SHARED.setFieldError(timetableForm, "tt-course-title", "Course title is required.");
      valid = false;
    }
    if (!location) {
      window.LASU_SHARED.setFieldError(timetableForm, "tt-venue", "Venue is required.");
      valid = false;
    }
    if (!start) {
      window.LASU_SHARED.setFieldError(timetableForm, "tt-start", "Start time is required.");
      valid = false;
    }
    if (!end) {
      window.LASU_SHARED.setFieldError(timetableForm, "tt-end", "End time is required.");
      valid = false;
    }
    if (start && end && !window.LASU_SHARED.isValidTimeRange(start, end)) {
      window.LASU_SHARED.setFieldError(timetableForm, "tt-end", "End time must be later than start time.");
      valid = false;
    }
    const candidateEntry = { day, start, end, level, semester, department };
    if (valid && hasDuplicateTimetableEntry(candidateEntry)) {
      window.LASU_SHARED.setFieldError(timetableForm, "tt-day", "Duplicate timetable slot exists for this day/time/level/semester.");
      valid = false;
    }
    if (!valid) {
      window.LASU_SHARED.showToast("Please fix timetable form errors.", "error");
      return;
    }
    window.LASU_SHARED.setFormLoading(timetableForm, true, "Adding...");
    const nextId = state.timetable.length ? Math.max(...state.timetable.map((t) => t.id)) + 1 : 1;
    state.timetable.unshift({
      id: nextId,
      courseCode,
      courseTitle,
      day,
      location,
      level,
      semester,
      faculty: scope().faculty,
      department,
      start,
      end,
      updatedAt: new Date().toISOString().slice(0, 10)
    });
    window.LASU_SHARED.saveState(state);
    timetableFeedback.textContent = "Timetable entry added.";
    window.LASU_SHARED.showToast("Timetable entry added.", "success");
    window.LASU_SHARED.setFormLoading(timetableForm, false);
    e.target.reset();
    populateInputs();
    renderTimetable();
    renderNotifications();
  });

  announcementForm.addEventListener("submit", (e) => {
    e.preventDefault();
    announcementFeedback.textContent = "";
    window.LASU_SHARED.clearFormErrors(announcementForm);
    const title = document.getElementById("announcement-title").value.trim();
    const message = document.getElementById("announcement-message").value.trim();
    const audienceLevel = document.getElementById("announcement-level").value;
    const audienceSemester = document.getElementById("announcement-semester").value;
    const audienceDepartment = document.getElementById("announcement-department").value;
    let valid = true;
    if (!title) {
      window.LASU_SHARED.setFieldError(announcementForm, "announcement-title", "Title is required.");
      valid = false;
    }
    if (!message) {
      window.LASU_SHARED.setFieldError(announcementForm, "announcement-message", "Message is required.");
      valid = false;
    } else if (message.length < 10) {
      window.LASU_SHARED.setFieldError(announcementForm, "announcement-message", "Message should be at least 10 characters.");
      valid = false;
    }
    if (!audienceLevel) {
      window.LASU_SHARED.setFieldError(announcementForm, "announcement-level", "Select audience level.");
      valid = false;
    }
    if (!audienceSemester) {
      window.LASU_SHARED.setFieldError(announcementForm, "announcement-semester", "Select audience semester.");
      valid = false;
    }
    if (!audienceDepartment) {
      window.LASU_SHARED.setFieldError(announcementForm, "announcement-department", "Select audience department.");
      valid = false;
    }
    if (!valid) {
      window.LASU_SHARED.showToast("Please fix announcement form errors.", "error");
      return;
    }
    window.LASU_SHARED.setFormLoading(announcementForm, true, "Publishing...");
    const nextId = state.announcements.length ? Math.max(...state.announcements.map((a) => a.id)) + 1 : 1;
    state.announcements.unshift({
      id: nextId,
      title,
      message,
      audienceLevel,
      audienceSemester,
      audienceFaculty: scope().faculty,
      audienceDepartment,
      createdAt: new Date().toISOString().slice(0, 16).replace("T", " ")
    });
    window.LASU_SHARED.saveState(state);
    announcementFeedback.textContent = "Announcement published.";
    window.LASU_SHARED.showToast("Announcement published.", "success");
    window.LASU_SHARED.setFormLoading(announcementForm, false);
    e.target.reset();
    populateInputs();
    renderNotifications();
  });

  if (locationVerifySelect) {
    locationVerifySelect.addEventListener("change", () => {
      locationVerifyFeedback.textContent = "";
      const selected = findLocation(locationVerifySelect.value);
      fillLocationVerifierForm(selected);
      syncMapWithSelectedLocation(true);
    });
  }
  if (locationVerifyLat) {
    locationVerifyLat.addEventListener("change", syncMapPinFromInputs);
  }
  if (locationVerifyLng) {
    locationVerifyLng.addEventListener("change", syncMapPinFromInputs);
  }
  const saveButton = document.getElementById("location-verify-save");
  if (saveButton) {
    saveButton.addEventListener("click", saveLocationVerification);
  }
  const resetButton = document.getElementById("location-verify-reset");
  if (resetButton) {
    resetButton.addEventListener("click", resetLocationVerification);
  }
  const openGoogleButton = document.getElementById("location-open-google");
  if (openGoogleButton) {
    openGoogleButton.addEventListener("click", openLocationInGoogleMaps);
  }
  if (locationUseMapPinButton) {
    locationUseMapPinButton.addEventListener("click", useMapPinCoordinates);
  }
}

renderHeader();
populateInputs();
bindActions();
renderTimetable();
renderReports();
renderNotifications();
renderLocationVerifier();
initializeAdminPinMap();

window.LASU_SHARED.syncStateWithCloud(defaults, (syncedState) => {
  state = syncedState;
  populateInputs();
  renderTimetable();
  renderReports();
  renderNotifications();
  renderLocationVerifier();
  initializeAdminPinMap();
}).then((result) => {
  if (result?.enabled && result?.error) {
    window.LASU_SHARED.showToast("Supabase sync unavailable. Using local data.", "info");
  } else if (result?.enabled && result?.changed) {
    window.LASU_SHARED.showToast("Synced admin data from Supabase.", "success");
  }
});

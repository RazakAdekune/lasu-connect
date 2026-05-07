const auth = window.LASU_SHARED.requireRole("student");
if (!auth) throw new Error("Student role required");

const defaults = {
  issues: window.LASU_DATA.reports,
  timetable: window.LASU_DATA.timetable,
  announcements: window.LASU_DATA.announcements
};
const state = window.LASU_SHARED.loadState(defaults);
const reportForm = document.getElementById("report-form");
const reportFeedback = document.getElementById("report-feedback");
const routeStartSelect = document.getElementById("route-start");
const routeDestinationSelect = document.getElementById("route-destination");
const MAP_LIVE_OPTION_VALUE = "__live_location__";
const routeVerificationHint = document.getElementById("route-verification-hint");
const liveLocationStatus = document.getElementById("live-location-status");
const notificationsBadge = document.getElementById("notifications-badge");
const notificationsMeta = document.getElementById("notifications-meta");
const markNotificationsReadButton = document.getElementById("mark-notifications-read");
const timetableSummary = document.getElementById("timetable-summary");
const notificationsTabButton = document.querySelector('.student-tab[data-view-target="notifications"]');
const esc = window.LASU_SHARED.escapeHtml || ((value) => String(value ?? ""));

const CAMPUS_BOUNDS = {
  minLat: 6.4620,
  maxLat: 6.4795,
  minLng: 3.1950,
  maxLng: 3.2065
};

let mapInstance = null;
let routeLayer = null;
let startMarker = null;
let destinationMarker = null;
let liveMarker = null;
let livePosition = null;
let liveAccuracyMeters = null;
let liveTimestampMs = 0;
let locationWatchId = null;
const locationMarkers = new Map();
let lastLiveErrorToastAt = 0;
let lastLiveErrorMessage = "";
let currentView = "timetable";
let lastStateSignature = "";
let lastNotificationAlertSignature = "";

const LIVE_LOCATION_FRESH_MS = 15000;
const LIVE_LOCATION_GOOD_ACCURACY_METERS = 250;
const LIVE_LOCATION_ACCEPTABLE_ACCURACY_METERS = 300;
const LIVE_ERROR_TOAST_COOLDOWN_MS = 12000;

function allLocations() {
  return window.LASU_SHARED.getLocations();
}

function hasCoordinates(location) {
  return typeof location?.lat === "number" && Number.isFinite(location.lat) &&
    typeof location?.lng === "number" && Number.isFinite(location.lng);
}

function isWithinCampus(location) {
  if (!hasCoordinates(location)) return false;
  return location.lat >= CAMPUS_BOUNDS.minLat &&
    location.lat <= CAMPUS_BOUNDS.maxLat &&
    location.lng >= CAMPUS_BOUNDS.minLng &&
    location.lng <= CAMPUS_BOUNDS.maxLng;
}

function mappableLocations() {
  return allLocations().filter((location) => hasCoordinates(location) && isWithinCampus(location));
}

function routableLocations() {
  return mappableLocations().filter((location) => location.verified);
}

function verifiedMappableLocations() {
  return mappableLocations().filter((location) => location.verified);
}

function markerStyle(location, active = false) {
  if (active) {
    return { radius: 7, color: "#000000", weight: 2, fillColor: "#000000", fillOpacity: 1 };
  }
  if (location.verified) {
    return { radius: 6, color: "#111827", weight: 2, fillColor: "#111827", fillOpacity: 0.75 };
  }
  return { radius: 6, color: "#92400e", weight: 2, fillColor: "#b45309", fillOpacity: 0.9 };
}

function setLiveStatus(text) {
  if (liveLocationStatus) {
    liveLocationStatus.textContent = text;
  }
}

function accuracyText(accuracy) {
  if (!Number.isFinite(accuracy)) return "unknown";
  if (accuracy < 1000) return `~${Math.round(accuracy)} m`;
  return `~${(accuracy / 1000).toFixed(1)} km`;
}

function isLiveFresh() {
  return Boolean(livePosition) && (Date.now() - liveTimestampMs) <= LIVE_LOCATION_FRESH_MS;
}

function isAccuracyAcceptable(accuracy) {
  if (!Number.isFinite(accuracy)) return false;
  return accuracy <= LIVE_LOCATION_ACCEPTABLE_ACCURACY_METERS;
}

function shouldAutoRouteFromLive() {
  return Boolean(livePosition) &&
    isLiveFresh() &&
    isAccuracyAcceptable(liveAccuracyMeters) &&
    isWithinCampus(livePosition);
}

function maybeShowLiveError(message) {
  const now = Date.now();
  const sameMessage = message === lastLiveErrorMessage;
  if (sameMessage && (now - lastLiveErrorToastAt) < LIVE_ERROR_TOAST_COOLDOWN_MS) {
    return;
  }
  lastLiveErrorMessage = message;
  lastLiveErrorToastAt = now;
  window.LASU_SHARED.showToast(message, "error");
}

function setLivePositionFromCoords(coords) {
  livePosition = { lat: coords.latitude, lng: coords.longitude };
  liveAccuracyMeters = Number.isFinite(coords.accuracy) ? coords.accuracy : null;
  liveTimestampMs = Date.now();
  const quality = !Number.isFinite(liveAccuracyMeters)
    ? "unknown accuracy"
    : liveAccuracyMeters <= LIVE_LOCATION_GOOD_ACCURACY_METERS
      ? "good accuracy"
      : "low accuracy";
  setLiveStatus(`Live location: ${quality} (${accuracyText(liveAccuracyMeters)})`);
}

function updateLiveMarker() {
  if (!mapInstance || !livePosition) return;
  if (!liveMarker) {
    liveMarker = window.L.marker([livePosition.lat, livePosition.lng]).addTo(mapInstance).bindPopup("My Live Location");
  } else {
    liveMarker.setLatLng([livePosition.lat, livePosition.lng]);
  }
}

function fetchCurrentPosition(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

async function resolveReliableLivePosition(forceFresh = false) {
  if (!navigator.geolocation) {
    return { ok: false, message: "Geolocation is not available on this device." };
  }

  if (!forceFresh && shouldAutoRouteFromLive()) {
    return { ok: true, position: { ...livePosition }, accuracy: liveAccuracyMeters };
  }

  try {
    const current = await fetchCurrentPosition({
      enableHighAccuracy: true,
      timeout: 25000,
      maximumAge: 0
    });
    setLivePositionFromCoords(current.coords);
    updateLiveMarker();
    if (!isAccuracyAcceptable(liveAccuracyMeters)) {
      if (!Number.isFinite(liveAccuracyMeters)) {
        return {
          ok: false,
          message: "Live location accuracy is unavailable. Enable precise location and try again."
        };
      }
      return {
        ok: false,
        message: `Live location is too inaccurate (${accuracyText(liveAccuracyMeters)}). Enable precise location and try again.`
      };
    }
    if (!isWithinCampus(livePosition)) {
      return {
        ok: false,
        message: "Live location appears outside LASU campus bounds. Check device location settings and try again."
      };
    }
    return { ok: true, position: { ...livePosition }, accuracy: liveAccuracyMeters };
  } catch (_error) {
    if (shouldAutoRouteFromLive()) {
      return { ok: true, position: { ...livePosition }, accuracy: liveAccuracyMeters };
    }
    return { ok: false, message: "Could not get live location. Select a start location manually." };
  }
}

function student() {
  const faculty = window.LASU_SHARED.getFacultyForDepartment(auth.studentDepartment) || auth.studentFaculty || "";
  return {
    id: auth.studentId || "custom-student",
    name: auth.studentName || "Student",
    matricNo: auth.studentMatric || "N/A",
    faculty,
    department: auth.studentDepartment || "",
    level: auth.studentLevel || "",
    semester: auth.studentSemester || window.LASU_SHARED.getDefaultSemester()
  };
}

function myTimetable() {
  const s = student();
  return state.timetable.filter((t) => window.LASU_SHARED.matchesStudentScope(t, s));
}

function isOwnReport(report) {
  const s = student();
  if (report.studentId !== s.id) return false;
  if (s.id !== "custom-student") return true;
  return report.studentMatric === s.matricNo && report.studentFaculty === s.faculty && report.studentDepartment === s.department;
}

function myReports() {
  return state.issues.filter(isOwnReport);
}

function dayOrder(day) {
  const order = {
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
    Sunday: 7
  };
  return order[day] || 99;
}

function timeToMinutes(value) {
  if (!value || !value.includes(":")) return 0;
  const [h, m] = value.split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function sortedTimetableRows(rows) {
  return rows.slice().sort((a, b) => {
    const dayDiff = dayOrder(a.day) - dayOrder(b.day);
    if (dayDiff !== 0) return dayDiff;
    return timeToMinutes(a.start) - timeToMinutes(b.start);
  });
}

function nextClassRow(rows) {
  if (!rows.length) return null;
  const now = new Date();
  const jsToName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayName = jsToName[now.getDay()];
  const todayOrder = dayOrder(todayName);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  let best = null;
  let bestScore = Number.POSITIVE_INFINITY;
  rows.forEach((row) => {
    const rowDay = dayOrder(row.day);
    const rowStartMinutes = timeToMinutes(row.start);
    let dayDelta = rowDay - todayOrder;
    if (dayDelta < 0 || (dayDelta === 0 && rowStartMinutes < nowMinutes)) {
      dayDelta += 7;
    }
    const score = dayDelta * 1440 + (rowStartMinutes - nowMinutes);
    if (score < bestScore) {
      bestScore = score;
      best = row;
    }
  });
  return best;
}

function notificationStorageKey() {
  const s = student();
  return `${window.LASU_DATA.storageKey}-student-notification-cursor-v1:${String(s.id)}:${String(s.matricNo)}:${String(s.department)}:${String(s.level)}:${String(s.semester)}`;
}

function notificationKey(notification) {
  return `${notification.source}|${notification.time}|${notification.text}`;
}

function getNotificationCursor() {
  return window.localStorage.getItem(notificationStorageKey()) || "";
}

function setNotificationCursor(value) {
  window.localStorage.setItem(notificationStorageKey(), value || "");
}

function ensureNotificationCursorInitialized() {
  const key = notificationStorageKey();
  if (window.localStorage.getItem(key) !== null) return;
  const rows = myNotifications();
  setNotificationCursor(rows[0] ? notificationKey(rows[0]) : "");
}

function unreadNotificationsCount(rows) {
  const cursor = getNotificationCursor();
  if (!rows.length) return 0;
  if (!cursor) return rows.length;
  const cursorIndex = rows.findIndex((row) => notificationKey(row) === cursor);
  if (cursorIndex === -1) return rows.length;
  return cursorIndex;
}

function markNotificationsRead() {
  const rows = myNotifications();
  setNotificationCursor(rows[0] ? notificationKey(rows[0]) : "");
}

function updateNotificationsBadge(unreadCount) {
  if (!notificationsBadge) return;
  if (unreadCount > 0) {
    notificationsBadge.classList.remove("hidden");
    notificationsBadge.textContent = String(unreadCount);
  } else {
    notificationsBadge.classList.add("hidden");
    notificationsBadge.textContent = "0";
  }
}

function maybeAlertNewNotifications(rows, unreadCount) {
  if (currentView === "notifications" || unreadCount <= 0) return;
  const signature = `${notificationKey(rows[0])}|${unreadCount}`;
  if (signature === lastNotificationAlertSignature) return;
  lastNotificationAlertSignature = signature;
  window.LASU_SHARED.showToast(`You have ${unreadCount} new notification${unreadCount === 1 ? "" : "s"}.`, "info", 3600);
}

function stateSignature(payload) {
  const issueSig = (payload.issues || [])
    .map((item) => `${item.id}-${item.status}-${item.respondedAt || item.createdAt}`)
    .join("|");
  const timetableSig = (payload.timetable || [])
    .map((item) => `${item.id}-${item.updatedAt}`)
    .join("|");
  const announcementSig = (payload.announcements || [])
    .map((item) => `${item.id}-${item.createdAt}`)
    .join("|");
  return `${payload.issues?.length || 0};${payload.timetable?.length || 0};${payload.announcements?.length || 0};${issueSig};${timetableSig};${announcementSig}`;
}

function myNotifications() {
  const s = student();
  const notes = [];
  state.announcements.forEach((a) => {
    if (window.LASU_SHARED.matchesAnnouncementAudience(a, s)) notes.push({ source: "Announcement", text: `${a.title}: ${a.message}`, time: a.createdAt });
  });
  myTimetable().forEach((t) => notes.push({ source: "Timetable", text: `${t.courseCode} ${t.day} ${window.LASU_SHARED.formatTime(t.start)} at ${t.location}`, time: t.updatedAt }));
  myReports().forEach((r) => {
    if (r.adminResponse) notes.push({ source: "Report response", text: `Report #${r.id}: ${r.adminResponse}`, time: r.respondedAt || r.createdAt });
    if (r.broadcast) notes.push({ source: "Broadcast", text: `${r.location}: ${r.description}`, time: r.respondedAt || r.createdAt });
  });
  return notes.sort((a, b) => String(b.time).localeCompare(String(a.time)));
}

function renderHeader() {
  const s = student();
  document.getElementById("student-scope").textContent = `${s.name} | ${s.faculty} / ${s.department} | ${s.level} Level | ${s.semester}`;
}

function renderTimetable() {
  const rows = sortedTimetableRows(myTimetable());
  const todayName = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date());
  const todayCount = rows.filter((row) => row.day === todayName).length;
  const nextRow = nextClassRow(rows);

  if (timetableSummary) {
    timetableSummary.innerHTML = rows.length
      ? `
        <div class="rounded-xl border border-line bg-wash p-4">
          <p class="text-xs uppercase tracking-[0.18em] text-mist">Total Classes</p>
          <p class="mt-2 text-2xl font-semibold">${rows.length}</p>
        </div>
        <div class="rounded-xl border border-line bg-wash p-4">
          <p class="text-xs uppercase tracking-[0.18em] text-mist">Today</p>
          <p class="mt-2 text-2xl font-semibold">${todayCount}</p>
        </div>
        <div class="rounded-xl border border-line bg-wash p-4">
          <p class="text-xs uppercase tracking-[0.18em] text-mist">Next Class</p>
          <p class="mt-2 text-sm font-semibold">${nextRow ? `${esc(nextRow.courseCode)} (${esc(nextRow.day)})` : "None"}</p>
          <p class="mt-1 text-xs text-slate">${nextRow ? `${window.LASU_SHARED.formatTime(nextRow.start)} at ${esc(nextRow.location)}` : "No upcoming class yet."}</p>
        </div>
      `
      : "";
  }

  document.getElementById("timetable-list").innerHTML = rows.length
    ? rows.map((row) => `
      <article class="rounded-xl border border-line bg-white p-4 shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p class="text-xs uppercase tracking-[0.18em] text-mist">${esc(row.day)}</p>
            <h3 class="mt-1 text-base font-semibold">${esc(row.courseCode)}</h3>
            <p class="text-sm text-slate">${esc(row.courseTitle)}</p>
          </div>
          <span class="rounded-full bg-ink px-3 py-1 text-xs font-medium text-white">${window.LASU_SHARED.formatTime(row.start)} - ${window.LASU_SHARED.formatTime(row.end)}</span>
        </div>
        <div class="mt-3 flex flex-wrap gap-2 text-xs">
          <span class="rounded-full border border-line px-2 py-1">${esc(row.level)} Level</span>
          <span class="rounded-full border border-line px-2 py-1">${esc(row.semester)}</span>
          <span class="rounded-full border border-line px-2 py-1">${esc(row.location)}</span>
        </div>
      </article>
    `).join("")
    : `<p class="text-sm text-gray-600">No timetable entries for your department, level, and semester yet.</p>`;
}

function renderReports() {
  const rows = myReports().sort((a, b) => b.id - a.id);
  document.getElementById("report-list").innerHTML = rows.length
    ? rows.map((r) => `<div class="rounded border p-2 text-sm"><p class="font-medium">#${r.id} - ${esc(r.type)} (${esc(r.status)})</p><p>${esc(r.description)}</p>${r.adminResponse ? `<p class="mt-1 text-gray-700">Admin: ${esc(r.adminResponse)}</p>` : ""}</div>`).join("")
    : `<p class="text-sm text-gray-600">You have not submitted any report yet.</p>`;
}

function renderNotifications(options = {}) {
  const { alertOnNew = false } = options;
  const rows = myNotifications();
  const unreadCount = unreadNotificationsCount(rows);
  updateNotificationsBadge(unreadCount);
  if (notificationsMeta) {
    notificationsMeta.textContent = `${rows.length} update${rows.length === 1 ? "" : "s"} • ${unreadCount} unread`;
  }
  if (alertOnNew) {
    maybeAlertNewNotifications(rows, unreadCount);
  }
  document.getElementById("notifications-list").innerHTML = rows.length
    ? rows.map((n, index) => `
      <div class="rounded border p-3 text-sm ${index < unreadCount ? "border-ink bg-wash" : ""}">
        <div class="flex items-center justify-between gap-2">
          <span class="font-medium">${n.source}</span>
          ${index < unreadCount ? `<span class="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">new</span>` : ""}
        </div>
        <p class="mt-1">${n.text}</p>
        <p class="mt-1 text-xs text-gray-500">${n.time}</p>
      </div>
    `).join("")
    : `<p class="text-sm text-gray-600">No notifications yet.</p>`;
}

function syncStateFromStorageAndRefresh(alertOnNew = true) {
  const refreshed = window.LASU_SHARED.loadState(defaults);
  const refreshedSignature = stateSignature(refreshed);
  if (refreshedSignature === lastStateSignature) return;

  state.issues = refreshed.issues;
  state.timetable = refreshed.timetable;
  state.announcements = refreshed.announcements;
  lastStateSignature = refreshedSignature;

  renderTimetable();
  renderReports();
  renderNotifications({ alertOnNew });
  if (currentView === "map") {
    renderMap();
  }
}

function renderNotifications(options = {}) {
  const { alertOnNew = false } = options;
  const rows = myNotifications();
  const unreadCount = unreadNotificationsCount(rows);
  updateNotificationsBadge(unreadCount);
  if (notificationsMeta) {
    notificationsMeta.textContent = `${rows.length} update${rows.length === 1 ? "" : "s"} | ${unreadCount} unread`;
  }
  if (alertOnNew) {
    maybeAlertNewNotifications(rows, unreadCount);
  }
  document.getElementById("notifications-list").innerHTML = rows.length
    ? rows.map((n, index) => `
      <div class="rounded border p-3 text-sm ${index < unreadCount ? "border-ink bg-wash" : ""}">
        <div class="flex items-center justify-between gap-2">
          <span class="font-medium">${esc(n.source)}</span>
          ${index < unreadCount ? `<span class="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">new</span>` : ""}
        </div>
        <p class="mt-1">${esc(n.text)}</p>
        <p class="mt-1 text-xs text-gray-500">${esc(n.time)}</p>
      </div>
    `).join("")
    : `<p class="text-sm text-gray-600">No notifications yet.</p>`;
}

function populateForm() {
  document.getElementById("issue-type").innerHTML = window.LASU_DATA.issueTypes.map((t) => `<option value="${t}">${t}</option>`).join("");
  document.getElementById("issue-location").innerHTML = allLocations().map((l) => `<option value="${esc(l.name)}">${esc(l.name)}</option>`).join("");
}

function populateRouteSelectors() {
  const starts = routableLocations();
  const destinations = verifiedMappableLocations();
  routeStartSelect.innerHTML = [`<option value="${MAP_LIVE_OPTION_VALUE}">My Live Location</option>`]
    .concat(starts.map((l) => `<option value="${esc(l.name)}">${esc(l.name)}</option>`)).join("");
  routeDestinationSelect.innerHTML = destinations.map((l) => `<option value="${esc(l.name)}">${esc(l.name)}</option>`).join("");
  if (routeVerificationHint) {
    const unresolved = allLocations().filter((l) => !l.verified).length;
    routeVerificationHint.textContent = unresolved
      ? `Routing is limited to verified LASU pins. ${unresolved} locations are hidden until verified in Admin.`
      : "All destinations are verified for routing.";
  }
}

function getLocationByName(name) {
  return allLocations().find((l) => l.name === name);
}

function handleMapSearch() {
  const query = document.getElementById("map-search").value.trim().toLowerCase();
  const match = verifiedMappableLocations().find((l) => l.name.toLowerCase().includes(query));
  if (!match) {
    if (query) window.LASU_SHARED.showToast("No verified matching landmark found. Verify it in Admin panel first.", "info");
    return;
  }
  routeDestinationSelect.value = match.name;
  drawSelectedRoute();
}

function getCampusCenter() {
  const points = mappableLocations();
  if (!points.length) return { lat: 6.473789, lng: 3.199954 };
  return {
    lat: points.reduce((sum, p) => sum + p.lat, 0) / points.length,
    lng: points.reduce((sum, p) => sum + p.lng, 0) / points.length
  };
}

function initializeLeafletMap() {
  if (mapInstance || typeof window.L === "undefined") return;
  const center = getCampusCenter();
  mapInstance = window.L.map("map-grid").setView([center.lat, center.lng], 17);
  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 20,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(mapInstance);

  verifiedMappableLocations().forEach((l) => {
    const marker = window.L.circleMarker([l.lat, l.lng], markerStyle(l))
      .bindPopup(`<strong>${esc(l.name)}</strong><br>${esc(l.summary)}<br><span style="font-size:11px;color:#6b7280">${l.verified ? `Verified (${esc(l.verifiedSource || "manual")})` : "Pin needs verification before reliable routing"}</span>`)
      .addTo(mapInstance);
    marker.on("click", () => {
      routeDestinationSelect.value = l.name;
      drawSelectedRoute();
    });
    locationMarkers.set(l.name, marker);
  });
}

function startLiveLocationWatch() {
  if (!navigator.geolocation) {
    setLiveStatus("Live location: not supported by this browser/device.");
    return;
  }
  if (locationWatchId !== null) return;
  setLiveStatus("Live location: acquiring GPS fix...");
  locationWatchId = navigator.geolocation.watchPosition(
    (position) => {
      setLivePositionFromCoords(position.coords);
      if (!isWithinCampus(livePosition)) {
        setLiveStatus(`Live location: outside LASU bounds (${accuracyText(liveAccuracyMeters)}).`);
      } else if (!isAccuracyAcceptable(liveAccuracyMeters)) {
        setLiveStatus(`Live location: low accuracy (${accuracyText(liveAccuracyMeters)}).`);
      }
      updateLiveMarker();
      if (routeStartSelect.value === MAP_LIVE_OPTION_VALUE && shouldAutoRouteFromLive()) {
        drawSelectedRoute();
      }
    },
    () => {
      setLiveStatus("Live location: permission denied or unavailable.");
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 25000 }
  );
}

function toRad(v) {
  return v * (Math.PI / 180);
}

function distanceMeters(start, end) {
  const R = 6371000;
  const dLat = toRad(end.lat - start.lat);
  const dLng = toRad(end.lng - start.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(start.lat)) * Math.cos(toRad(end.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDuration(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr ${minutes % 60} min`;
}

function updateRouteMeta(startName, destination, summary, duration) {
  document.getElementById("route-target").textContent = destination.name;
  document.getElementById("route-summary").textContent = summary;
  document.getElementById("route-time").textContent = duration;
  document.getElementById("route-next-stop").textContent = destination.nextStop || "Destination";
}

function highlightDestination(name) {
  locationMarkers.forEach((marker, key) => {
    const location = getLocationByName(key);
    if (!location) return;
    marker.setStyle(markerStyle(location, key === name));
  });
}

function renderMap() {
  if (typeof window.L === "undefined") {
    document.getElementById("map-grid").innerHTML = `<div class="rounded-xl border border-line bg-white p-4 text-sm text-slate">Map library could not load. Check internet and refresh.</div>`;
    return;
  }
  initializeLeafletMap();
  const prevStart = routeStartSelect.value;
  const prevDest = routeDestinationSelect.value;
  populateRouteSelectors();
  const availableStarts = routableLocations().map((location) => location.name);
  const availableDestinations = verifiedMappableLocations().map((location) => location.name);
  const fallback = availableDestinations[0] || "";
  const startCandidate = prevStart || MAP_LIVE_OPTION_VALUE;
  routeStartSelect.value = startCandidate === MAP_LIVE_OPTION_VALUE || availableStarts.includes(startCandidate)
    ? startCandidate
    : MAP_LIVE_OPTION_VALUE;
  routeDestinationSelect.value = availableDestinations.includes(prevDest) ? prevDest : fallback;
  document.getElementById("quick-locations").innerHTML = routableLocations()
    .filter((l) => l.popular)
    .map((l) => `<button class="quick-location rounded-full border border-line px-3 py-1 text-xs" data-location="${esc(l.name)}">${esc(l.name)}</button>`)
    .join("");
  document.querySelectorAll(".quick-location").forEach((button) => {
    button.addEventListener("click", () => {
      routeDestinationSelect.value = button.dataset.location;
      drawSelectedRoute();
    });
  });
  startLiveLocationWatch();
  drawSelectedRoute();
}

async function drawSelectedRoute() {
  initializeLeafletMap();
  if (!mapInstance) return;

  const destination = getLocationByName(routeDestinationSelect.value);
  if (!destination || !hasCoordinates(destination) || !isWithinCampus(destination)) return;

  let startPoint = null;
  let startName = routeStartSelect.value;
  if (routeStartSelect.value === MAP_LIVE_OPTION_VALUE) {
    const resolved = await resolveReliableLivePosition(false);
    if (!resolved.ok) {
      maybeShowLiveError(resolved.message);
      setLiveStatus(`Live location: ${resolved.message}`);
      return;
    }
    startPoint = { ...resolved.position };
    startName = "My Live Location";
    updateLiveMarker();
    if (Number.isFinite(resolved.accuracy) && resolved.accuracy > LIVE_LOCATION_GOOD_ACCURACY_METERS) {
      window.LASU_SHARED.showToast(`Live location accuracy is low (${accuracyText(resolved.accuracy)}).`, "info");
    }
  } else {
    const selectedStart = getLocationByName(routeStartSelect.value);
    if (!selectedStart || typeof selectedStart.lat !== "number" || typeof selectedStart.lng !== "number") return;
    startPoint = { lat: selectedStart.lat, lng: selectedStart.lng };
    setLiveStatus("Live location: select 'My Live Location' to use device GPS.");
  }

  if (!startMarker) startMarker = window.L.marker([startPoint.lat, startPoint.lng]).addTo(mapInstance);
  else startMarker.setLatLng([startPoint.lat, startPoint.lng]);
  startMarker.bindPopup(`Start: ${startName}`);

  if (!destinationMarker) destinationMarker = window.L.marker([destination.lat, destination.lng]).addTo(mapInstance);
  else destinationMarker.setLatLng([destination.lat, destination.lng]);
  destinationMarker.bindPopup(`Destination: ${destination.name}`);

  highlightDestination(destination.name);
  if (routeLayer) mapInstance.removeLayer(routeLayer);

  if (!destination.verified) {
    updateRouteMeta(
      startName,
      destination,
      `${destination.name} is not verified yet. Route withheld to avoid inaccurate navigation. Ask admin to pin this location.`,
      "Unavailable"
    );
    mapInstance.setView([destination.lat, destination.lng], 18);
    window.LASU_SHARED.showToast("This destination still needs verification before routing.", "info");
    return;
  }

  if (startPoint.lat === destination.lat && startPoint.lng === destination.lng) {
    updateRouteMeta(startName, destination, `You are already at ${destination.name}.`, "0 minutes");
    mapInstance.setView([destination.lat, destination.lng], 18);
    return;
  }

  const routeUrl = `https://router.project-osrm.org/route/v1/foot/${startPoint.lng},${startPoint.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(routeUrl);
    const payload = await response.json();
    if (payload.code !== "Ok" || !payload.routes?.length) throw new Error("No route available");
    const route = payload.routes[0];
    const coords = route.geometry.coordinates.map((point) => [point[1], point[0]]);
    routeLayer = window.L.polyline(coords, { color: "#111827", weight: 5, opacity: 0.85 }).addTo(mapInstance);
    mapInstance.fitBounds(routeLayer.getBounds(), { padding: [24, 24] });
    updateRouteMeta(startName, destination, `From ${startName} to ${destination.name}. ${destination.summary}`, formatDuration(route.duration));
  } catch (_error) {
    routeLayer = window.L.polyline([
      [startPoint.lat, startPoint.lng],
      [destination.lat, destination.lng]
    ], { color: "#111827", weight: 4, opacity: 0.6, dashArray: "8, 8" }).addTo(mapInstance);
    mapInstance.fitBounds(routeLayer.getBounds(), { padding: [24, 24] });
    const fallbackSeconds = distanceMeters(startPoint, destination) / 1.35;
    updateRouteMeta(startName, destination, `From ${startName} to ${destination.name}. ${destination.summary} (Fallback straight-line route)`, formatDuration(fallbackSeconds));
  }
}

function setActiveView(viewName) {
  currentView = viewName;
  document.querySelectorAll(".student-view").forEach((section) => section.classList.toggle("hidden", section.id !== `view-${viewName}`));
  document.querySelectorAll(".student-tab").forEach((button) => {
    const active = button.dataset.viewTarget === viewName;
    button.classList.toggle("bg-ink", active);
    button.classList.toggle("text-white", active);
  });
  if (viewName === "notifications") {
    markNotificationsRead();
    renderNotifications();
  }
  if (viewName === "map") {
    renderMap();
    if (mapInstance) window.setTimeout(() => mapInstance.invalidateSize(), 150);
  }
}

function bindEvents() {
  document.getElementById("logout-btn").addEventListener("click", () => window.LASU_SHARED.logout());

  reportForm.addEventListener("submit", (e) => {
    e.preventDefault();
    reportFeedback.textContent = "";
    window.LASU_SHARED.clearFormErrors(reportForm);

    const type = document.getElementById("issue-type").value;
    const location = document.getElementById("issue-location").value;
    const description = document.getElementById("issue-description").value.trim();
    const imageFile = document.getElementById("issue-image").files[0];

    let valid = true;
    if (!type) { window.LASU_SHARED.setFieldError(reportForm, "issue-type", "Select an issue type."); valid = false; }
    if (!location) { window.LASU_SHARED.setFieldError(reportForm, "issue-location", "Select a location."); valid = false; }
    if (!description) { window.LASU_SHARED.setFieldError(reportForm, "issue-description", "Description is required."); valid = false; }
    else if (description.length < 10) { window.LASU_SHARED.setFieldError(reportForm, "issue-description", "Description should be at least 10 characters."); valid = false; }

    if (!valid) {
      window.LASU_SHARED.showToast("Please fix the report form errors.", "error");
      return;
    }

    window.LASU_SHARED.setFormLoading(reportForm, true, "Submitting...");
    const s = student();
    const nextId = state.issues.length ? Math.max(...state.issues.map((i) => i.id)) + 1 : 1000;
    state.issues.unshift({
      id: nextId,
      studentId: s.id,
      studentName: s.name,
      studentMatric: s.matricNo,
      studentFaculty: s.faculty,
      studentDepartment: s.department,
      studentLevel: s.level,
      studentSemester: s.semester,
      type,
      location,
      description,
      imageName: imageFile ? imageFile.name : "",
      status: "Pending",
      adminResponse: "",
      broadcast: false,
      createdAt: new Date().toISOString().slice(0, 16).replace("T", " ")
    });

    window.LASU_SHARED.saveState(state);
    reportFeedback.textContent = `Report #${nextId} submitted.`;
    window.LASU_SHARED.showToast(`Report #${nextId} submitted.`, "success");
    window.LASU_SHARED.setFormLoading(reportForm, false);
    e.target.reset();
    renderReports();
    renderNotifications();
  });

  document.querySelectorAll(".student-tab").forEach((button) => button.addEventListener("click", () => setActiveView(button.dataset.viewTarget)));
  document.getElementById("map-search-button").addEventListener("click", handleMapSearch);
  document.getElementById("map-search").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleMapSearch();
    }
  });
  document.getElementById("draw-route-button").addEventListener("click", drawSelectedRoute);
  document.getElementById("open-google-maps-button").addEventListener("click", () => {
    const destination = getLocationByName(routeDestinationSelect.value);
    if (!destination) return;
    const query = encodeURIComponent(`${destination.name}, Lagos State University Ojo`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank", "noopener");
  });
  if (markNotificationsReadButton) {
    markNotificationsReadButton.addEventListener("click", () => {
      markNotificationsRead();
      renderNotifications();
      window.LASU_SHARED.showToast("Notifications marked as read.", "success");
    });
  }
  routeStartSelect.addEventListener("change", drawSelectedRoute);
  routeDestinationSelect.addEventListener("change", drawSelectedRoute);

  window.addEventListener("storage", (event) => {
    if (event.key === window.LASU_DATA.storageKey) {
      syncStateFromStorageAndRefresh(true);
    }
  });
}

renderHeader();
populateForm();
ensureNotificationCursorInitialized();
lastStateSignature = stateSignature(state);
bindEvents();
renderTimetable();
renderReports();
renderNotifications({ alertOnNew: false });
setActiveView("timetable");
window.setInterval(() => syncStateFromStorageAndRefresh(true), 12000);

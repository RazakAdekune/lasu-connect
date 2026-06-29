const auth = window.LASU_SHARED.requireRole("student");
if (!auth) throw new Error("Student role required");

const defaults = {
  issues: window.LASU_DATA.reports,
  timetable: window.LASU_DATA.timetable,
  announcements: window.LASU_DATA.announcements
};
let state = window.LASU_SHARED.loadState(defaults);
const reportForm = document.getElementById("report-form");
const reportFeedback = document.getElementById("report-feedback");
const routeStartSelect = document.getElementById("route-start");
const routeDestinationSelect = document.getElementById("route-destination");
const MAP_LIVE_OPTION_VALUE = "__live_location__";
const routeVerificationHint = document.getElementById("route-verification-hint");
const liveLocationStatus = document.getElementById("live-location-status");
const refreshLiveLocationButton = document.getElementById("refresh-live-location-button");
const esc = window.LASU_SHARED.escapeHtml || ((value) => String(value ?? ""));
const LIVE_LOCATION_MAX_AGE_MS = 5000;
const LIVE_LOCATION_TIMEOUT_MS = 20000;
const ACCEPTABLE_LIVE_ACCURACY_METERS = 120;
const MAX_LIVE_ACCURACY_METERS = 1000;
const LIVE_LOCATION_REFRESH_TIMEOUT_MS = 30000;
const GOOD_LIVE_ACCURACY_METERS = 60;
const LIVE_LOCATION_OUTSIDE_CAMPUS_REJECT_ACCURACY_METERS = 80;
const CAMPUS_BUFFER_DEGREES = 0.01;

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
let liveAccuracy = null;
let locationWatchId = null;
const locationMarkers = new Map();

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

function isWithinCampusPoint(lat, lng, padding = 0) {
  return lat >= (CAMPUS_BOUNDS.minLat - padding) &&
    lat <= (CAMPUS_BOUNDS.maxLat + padding) &&
    lng >= (CAMPUS_BOUNDS.minLng - padding) &&
    lng <= (CAMPUS_BOUNDS.maxLng + padding);
}

function liveLocationLabel() {
  if (liveAccuracy === null) return "My Live Location";
  return `My Live Location (+/-${Math.round(liveAccuracy)}m)`;
}

function setLiveLocationStatus(message, tone = "neutral") {
  if (!liveLocationStatus) return;
  const toneClass = tone === "good"
    ? "text-green-700"
    : tone === "warn"
      ? "text-amber-700"
      : tone === "error"
        ? "text-red-700"
        : "text-slate";
  liveLocationStatus.className = `text-xs ${toneClass}`;
  liveLocationStatus.textContent = `Live location: ${message}`;
}

function applyLivePosition(position, source = "watch") {
  const lat = Number(position?.coords?.latitude);
  const lng = Number(position?.coords?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return false;
  }

  const accuracy = Number(position?.coords?.accuracy);
  const hasAccuracy = Number.isFinite(accuracy) && accuracy > 0;
  if (hasAccuracy && accuracy > MAX_LIVE_ACCURACY_METERS) {
    setLiveLocationStatus(`weak signal (+/-${Math.round(accuracy)}m), waiting for better fix`, "warn");
    return false;
  }

  const insideCampus = isWithinCampusPoint(lat, lng, 0);
  const nearCampus = isWithinCampusPoint(lat, lng, CAMPUS_BUFFER_DEGREES);
  if (!nearCampus && hasAccuracy && accuracy > LIVE_LOCATION_OUTSIDE_CAMPUS_REJECT_ACCURACY_METERS) {
    setLiveLocationStatus(`off-campus drift detected (+/-${Math.round(accuracy)}m), recalibrating`, "warn");
    return false;
  }

  const shouldAccept = !livePosition ||
    !hasAccuracy ||
    liveAccuracy === null ||
    accuracy <= ACCEPTABLE_LIVE_ACCURACY_METERS ||
    accuracy < liveAccuracy ||
    (insideCampus && !isWithinCampusPoint(livePosition.lat, livePosition.lng, 0));

  if (!shouldAccept) {
    return false;
  }

  livePosition = { lat, lng };
  liveAccuracy = hasAccuracy ? accuracy : liveAccuracy;

  if (mapInstance) {
    if (!liveMarker) {
      liveMarker = window.L.marker([lat, lng]).addTo(mapInstance);
    } else {
      liveMarker.setLatLng([lat, lng]);
    }
    liveMarker.bindPopup(liveLocationLabel());
  }

  if (liveAccuracy !== null && liveAccuracy <= GOOD_LIVE_ACCURACY_METERS) {
    setLiveLocationStatus(`locked at +/-${Math.round(liveAccuracy)}m (${source})`, "good");
  } else if (liveAccuracy !== null) {
    setLiveLocationStatus(`accuracy +/-${Math.round(liveAccuracy)}m (${source})`, "warn");
  } else {
    setLiveLocationStatus(`fix received (${source})`, "neutral");
  }
  return true;
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
  const rows = myTimetable();
  document.getElementById("timetable-list").innerHTML = rows.length
    ? rows.map((t) => `<div class="rounded border p-2 text-sm">${esc(t.courseCode)} - ${esc(t.courseTitle)} | ${esc(t.day)} ${window.LASU_SHARED.formatTime(t.start)}-${window.LASU_SHARED.formatTime(t.end)} | ${esc(t.location)}</div>`).join("")
    : `<p class="text-sm text-gray-600">No timetable entries for your department, level, and semester yet.</p>`;
}

function renderReports() {
  const rows = myReports().sort((a, b) => b.id - a.id);
  document.getElementById("report-list").innerHTML = rows.length
    ? rows.map((r) => `<div class="rounded border p-2 text-sm"><p class="font-medium">#${r.id} - ${esc(r.type)} (${esc(r.status)})</p><p>${esc(r.description)}</p>${r.adminResponse ? `<p class="mt-1 text-gray-700">Admin: ${esc(r.adminResponse)}</p>` : ""}</div>`).join("")
    : `<p class="text-sm text-gray-600">You have not submitted any report yet.</p>`;
}

function renderNotifications() {
  const rows = myNotifications();
  document.getElementById("notifications-list").innerHTML = rows.length
    ? rows.map((n) => `<div class="rounded border p-2 text-sm"><span class="font-medium">${esc(n.source)}:</span> ${esc(n.text)} <span class="text-xs text-gray-500">(${esc(n.time)})</span></div>`).join("")
    : `<p class="text-sm text-gray-600">No notifications yet.</p>`;
}

function populateForm() {
  document.getElementById("issue-type").innerHTML = window.LASU_DATA.issueTypes.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
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
  if (!window.isSecureContext) {
    setLiveLocationStatus("requires HTTPS or localhost for GPS access", "error");
    return;
  }
  if (!navigator.geolocation) {
    setLiveLocationStatus("not supported in this browser", "error");
    return;
  }
  if (locationWatchId !== null) return;
  setLiveLocationStatus("acquiring GPS fix...");
  locationWatchId = navigator.geolocation.watchPosition(
    (position) => {
      const accepted = applyLivePosition(position, "watch");
      if (accepted && routeStartSelect.value === MAP_LIVE_OPTION_VALUE) {
        drawSelectedRoute();
      }
    },
    (error) => {
      if (error && error.code === 1) {
        setLiveLocationStatus("permission denied, allow location in browser settings", "error");
        window.LASU_SHARED.showToast("Live location permission denied. Select a start location manually.", "error");
      } else if (error && error.code === 2) {
        setLiveLocationStatus("position unavailable, check network/GPS and retry", "warn");
      } else if (error && error.code === 3) {
        setLiveLocationStatus("location request timed out, retrying...", "warn");
      }
    },
    { enableHighAccuracy: true, maximumAge: LIVE_LOCATION_MAX_AGE_MS, timeout: LIVE_LOCATION_TIMEOUT_MS }
  );
}

async function refreshLiveLocation(triggerRoute = true) {
  if (!window.isSecureContext) {
    setLiveLocationStatus("requires HTTPS or localhost for GPS access", "error");
    return false;
  }
  if (!navigator.geolocation) {
    setLiveLocationStatus("not supported in this browser", "error");
    return false;
  }
  setLiveLocationStatus("refreshing GPS fix...");
  try {
    const currentPosition = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: LIVE_LOCATION_REFRESH_TIMEOUT_MS,
      maximumAge: 0
    }));
    const accepted = applyLivePosition(currentPosition, "refresh");
    if (!accepted) {
      setLiveLocationStatus("refresh received but accuracy is still weak", "warn");
      return false;
    }
    if (triggerRoute && routeStartSelect.value === MAP_LIVE_OPTION_VALUE) {
      drawSelectedRoute();
    }
    return true;
  } catch (error) {
    if (error && error.code === 1) {
      setLiveLocationStatus("permission denied, allow location in browser settings", "error");
    } else if (error && error.code === 2) {
      setLiveLocationStatus("position unavailable, move outdoors and retry", "warn");
    } else if (error && error.code === 3) {
      setLiveLocationStatus("refresh timed out, retry", "warn");
    } else {
      setLiveLocationStatus("refresh failed", "warn");
    }
    return false;
  }
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

let leafletRetryCount = 0;
function renderMap() {
  if (typeof window.L === "undefined") {
    // Leaflet may still be downloading from the CDN. Retry a few times before
    // giving up, so a slow connection doesn't permanently show an error.
    if (leafletRetryCount < 10) {
      leafletRetryCount += 1;
      document.getElementById("map-grid").innerHTML = `<div class="rounded-xl border border-line bg-white p-4 text-sm text-slate">Loading map…</div>`;
      window.setTimeout(renderMap, 500);
      return;
    }
    document.getElementById("map-grid").innerHTML = `<div class="rounded-xl border border-line bg-white p-4 text-sm text-slate">Map library could not load. Check your internet connection (the map needs access to unpkg.com and openstreetmap.org) and refresh.</div>`;
    return;
  }
  leafletRetryCount = 0;
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
  if (!livePosition) {
    setLiveLocationStatus("acquiring GPS fix...");
  }
  startLiveLocationWatch();
  drawSelectedRoute();
  refreshMapSize();
}

window.addEventListener("resize", () => {
  if (mapInstance && !document.getElementById("view-map").classList.contains("hidden")) {
    mapInstance.invalidateSize();
  }
});

async function drawSelectedRoute() {
  initializeLeafletMap();
  if (!mapInstance) return;

  const destination = getLocationByName(routeDestinationSelect.value);
  if (!destination || !hasCoordinates(destination) || !isWithinCampus(destination)) return;

  let startPoint = null;
  let startName = routeStartSelect.value;
  if (routeStartSelect.value === MAP_LIVE_OPTION_VALUE) {
    if (!livePosition) {
      const gotLivePosition = await refreshLiveLocation(false);
      if (!gotLivePosition) {
        window.LASU_SHARED.showToast("Could not get a reliable live location. Try refresh or select a start location manually.", "error");
        return;
      }
    }
    if (!livePosition) return;
    startPoint = { ...livePosition };
    startName = "My Live Location";
    if (!liveMarker) liveMarker = window.L.marker([startPoint.lat, startPoint.lng]).addTo(mapInstance);
    else liveMarker.setLatLng([startPoint.lat, startPoint.lng]);
    liveMarker.bindPopup(liveLocationLabel());
  } else {
    const selectedStart = getLocationByName(routeStartSelect.value);
    if (!selectedStart || typeof selectedStart.lat !== "number" || typeof selectedStart.lng !== "number") return;
    startPoint = { lat: selectedStart.lat, lng: selectedStart.lng };
  }

  if (!startMarker) startMarker = window.L.marker([startPoint.lat, startPoint.lng]).addTo(mapInstance);
  else startMarker.setLatLng([startPoint.lat, startPoint.lng]);
  startMarker.bindPopup(`Start: ${esc(startName)}`);

  if (!destinationMarker) destinationMarker = window.L.marker([destination.lat, destination.lng]).addTo(mapInstance);
  else destinationMarker.setLatLng([destination.lat, destination.lng]);
  destinationMarker.bindPopup(`Destination: ${esc(destination.name)}`);

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
  document.querySelectorAll(".student-view").forEach((section) => section.classList.toggle("hidden", section.id !== `view-${viewName}`));
  document.querySelectorAll(".student-tab").forEach((button) => {
    const active = button.dataset.viewTarget === viewName;
    button.classList.toggle("bg-ink", active);
    button.classList.toggle("text-white", active);
  });
  if (viewName === "map") {
    renderMap();
    refreshMapSize();
  }
}

// A freshly revealed Leaflet map often renders blank/gray until it is told to
// re-measure its (now visible) container. Fire a few passes to cover slow
// layout/tile settling on both desktop and mobile.
function refreshMapSize() {
  if (!mapInstance) return;
  [0, 150, 400, 800].forEach((delay) => {
    window.setTimeout(() => {
      if (mapInstance) mapInstance.invalidateSize();
    }, delay);
  });
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
  if (refreshLiveLocationButton) {
    refreshLiveLocationButton.addEventListener("click", () => {
      refreshLiveLocation(true);
    });
  }
  document.getElementById("open-google-maps-button").addEventListener("click", () => {
    const destination = getLocationByName(routeDestinationSelect.value);
    if (!destination) return;
    const query = encodeURIComponent(`${destination.name}, Lagos State University Ojo`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank", "noopener");
  });
  routeStartSelect.addEventListener("change", drawSelectedRoute);
  routeDestinationSelect.addEventListener("change", drawSelectedRoute);
}

renderHeader();
populateForm();
bindEvents();
renderTimetable();
renderReports();
renderNotifications();
setActiveView("timetable");

window.LASU_SHARED.syncStateWithCloud(defaults, (syncedState) => {
  state = syncedState;
  renderTimetable();
  renderReports();
  renderNotifications();
  if (!document.getElementById("view-map").classList.contains("hidden")) {
    renderMap();
  }
}).then((result) => {
  if (result?.enabled && result?.error) {
    window.LASU_SHARED.showToast("Supabase sync unavailable. Using local data.", "info");
  } else if (result?.enabled && result?.changed) {
    window.LASU_SHARED.showToast("Synced student data from Supabase.", "success");
  }
});


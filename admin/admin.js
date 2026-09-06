const API_BASE = "http://127.0.0.1:5000";

let map;
let busMarkers = {};
let routeLines = {};

let allBuses = [];
let allRoutes = {};

let currentFilter = "ALL";
let currentSearch = "";

// =====================================================
// MAP INITIALIZATION
// =====================================================

function initializeMap() {
  map = L.map("map").setView([23.2599, 77.4126], 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);
}

// =====================================================
// CLOCK
// =====================================================

function updateClock() {
  const now = new Date();

  const time = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  document.getElementById("liveClock").textContent = time;
}

setInterval(updateClock, 1000);
updateClock();

// =====================================================
// CONNECTION STATUS
// =====================================================

function setConnectionStatus(online) {
  const text = document.getElementById("connectionText");
  const dot = document.querySelector(".status-dot");
  const systemDot = document.getElementById("systemStatusDot");

  if (online) {
    text.textContent = "LIVE SYSTEM";
    dot.style.background = "#35c88a";
    systemDot.style.background = "#16845b";
  } else {
    text.textContent = "OFFLINE";
    dot.style.background = "#c0392b";
    systemDot.style.background = "#c0392b";
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

// Supports both Flask/local naming and Firebase naming

function getBusId(bus) {
  return bus.bus_id ?? bus.id ?? bus.busNumber ?? "--";
}

function getRouteId(bus) {
  return bus.route_id ?? bus.routeId ?? "--";
}

function getCurrentStop(bus) {
  return bus.current_stop ?? bus.currentStop ?? "--";
}

function getNextStop(bus) {
  return bus.next_stop ?? bus.nextStop ?? "--";
}

function getLatitude(bus) {
  return Number(bus.latitude ?? 0);
}

function getLongitude(bus) {
  return Number(bus.longitude ?? 0);
}

function getSpeed(bus) {
  return Number(bus.speed ?? 0);
}

function getStatus(bus) {
  return bus.status ?? "ON_TIME";
}

// Firebase uses etaMinutes.
// Existing Flask code may use eta_minutes.
// Support both.

function getETA(bus) {
  if (bus.etaMinutes !== undefined && bus.etaMinutes !== null) {
    return Number(bus.etaMinutes);
  }

  if (bus.eta_minutes !== undefined && bus.eta_minutes !== null) {
    return Number(bus.eta_minutes);
  }

  return null;
}

// =====================================================
// FETCH BUSES
// =====================================================

async function loadBuses() {
  try {
    const response = await fetch(`${API_BASE}/api/buses`);

    if (!response.ok) {
      throw new Error("API error");
    }

    const result = await response.json();

    // Support both:
    // { success: true, data: [...] }
    // and direct [...]
    const data = Array.isArray(result) ? result : result.data;

    if (!Array.isArray(data)) {
      throw new Error("Invalid bus data received from API");
    }

    allBuses = data;

    setConnectionStatus(true);

    updateDashboard(data);

    updateBusTable();

    // IMPORTANT:
    // Route analytics must be updated AFTER buses are loaded.
    updateRouteAnalytics();

    updateMap(data);

    updateLastUpdated();
  } catch (error) {
    console.error("Bus loading failed:", error);
    setConnectionStatus(false);
  }
}

// =====================================================
// DASHBOARD ANALYTICS
// =====================================================

function updateDashboard(buses) {
  const total = buses.length;

  const active = buses.filter((bus) => {
    const status = getStatus(bus);

    return (
      status !== "STOPPED" && status !== "BREAKDOWN" && status !== "COMPLETED"
    );
  }).length;

  const delayed = buses.filter((bus) => getStatus(bus) === "DELAYED").length;

  const breakdown = buses.filter(
    (bus) => getStatus(bus) === "BREAKDOWN",
  ).length;

  const onTime = buses.filter((bus) => {
    const status = getStatus(bus);

    return status === "ON_TIME" || status === "ON_ROUTE";
  }).length;

  const onTimePercentage = total > 0 ? Math.round((onTime / total) * 100) : 0;

  const delayedPercentage = total > 0 ? Math.round((delayed / total) * 100) : 0;

  const routeSet = new Set(
    buses.map((bus) => getRouteId(bus)).filter((route) => route !== "--"),
  );

  const movingBuses = buses.filter((bus) => {
    const status = getStatus(bus);

    return (
      status !== "STOPPED" && status !== "BREAKDOWN" && status !== "COMPLETED"
    );
  });

  const averageSpeed =
    movingBuses.length > 0
      ? Math.round(
          movingBuses.reduce((sum, bus) => sum + getSpeed(bus), 0) /
            movingBuses.length,
        )
      : 0;

  document.getElementById("totalBuses").textContent = total;

  document.getElementById("activeBuses").textContent = active;

  document.getElementById("delayedBuses").textContent = delayed;

  document.getElementById("breakdownBuses").textContent = breakdown;

  document.getElementById("onTimePercentage").textContent =
    `${onTimePercentage}%`;

  document.getElementById("delayedPercentage").textContent =
    `${delayedPercentage}%`;

  document.getElementById("activeRoutes").textContent = routeSet.size;

  document.getElementById("averageSpeed").textContent = `${averageSpeed} km/h`;

  document.getElementById("onTimeProgress").style.width =
    `${onTimePercentage}%`;

  document.getElementById("delayProgress").style.width =
    `${delayedPercentage}%`;
}

// =====================================================
// MAP
// =====================================================

function updateMap(buses) {
  const activeIds = new Set();

  buses.forEach((bus) => {
    const busId = getBusId(bus);

    activeIds.add(busId);

    const status = getStatus(bus);

    let statusClass = "on-time";

    if (status === "DELAYED") {
      statusClass = "delayed";
    }

    if (status === "BREAKDOWN") {
      statusClass = "breakdown";
    }

    if (status === "STOPPED" || status === "COMPLETED") {
      statusClass = "stopped";
    }

    const icon = L.divIcon({
      className: "",

      html: `
        <div class="bus-marker ${statusClass}">
          ${busId.replace("BUS", "")}
        </div>
      `,

      iconSize: [34, 34],

      iconAnchor: [17, 17],

      popupAnchor: [0, -18],
    });

    const latitude = getLatitude(bus);
    const longitude = getLongitude(bus);

    if (!busMarkers[busId]) {
      busMarkers[busId] = L.marker([latitude, longitude], {
        icon,
      }).addTo(map);
    } else {
      busMarkers[busId].setLatLng([latitude, longitude]).setIcon(icon);
    }

    busMarkers[busId].bindPopup(createPopup(bus));
  });

  // Remove buses that no longer exist

  Object.keys(busMarkers).forEach((id) => {
    if (!activeIds.has(id)) {
      map.removeLayer(busMarkers[id]);

      delete busMarkers[id];
    }
  });
}

// =====================================================
// POPUP
// =====================================================

function createPopup(bus) {
  const status = getStatus(bus);

  const speed =
    status === "STOPPED" || status === "BREAKDOWN" || status === "COMPLETED"
      ? 0
      : getSpeed(bus);

  const eta = getETA(bus);

  const etaText = eta !== null ? `${eta} min` : "--";

  return `
    <div class="popup-title">
      YUKTIX • ${getBusId(bus)}
    </div>

    <div class="popup-row">
      <span>Route</span>
      <strong>${getRouteId(bus)}</strong>
    </div>

    <div class="popup-row">
      <span>Status</span>
      <strong>${formatStatus(status)}</strong>
    </div>

    <div class="popup-row">
      <span>Speed</span>
      <strong>${speed} km/h</strong>
    </div>

    <div class="popup-row">
      <span>ETA</span>
      <strong>${etaText}</strong>
    </div>

    <div class="popup-row">
      <span>Coordinates</span>
      <strong>
        ${getLatitude(bus).toFixed(4)},
        ${getLongitude(bus).toFixed(4)}
      </strong>
    </div>
  `;
}

// =====================================================
// LOAD ROUTES
// =====================================================

async function loadRoutes() {
  try {
    const response = await fetch(`${API_BASE}/api/routes`);

    if (!response.ok) {
      throw new Error("Route API error");
    }

    const result = await response.json();

    allRoutes = result.data ?? result;

    drawRoutes(allRoutes);

    // This may run before buses are loaded.
    // updateRouteAnalytics() is also called from loadBuses()
    // after the bus data arrives.
    updateRouteAnalytics();
  } catch (error) {
    console.error("Route loading failed:", error);
  }
}

// =====================================================
// DRAW ROUTES
// =====================================================

function drawRoutes(routes) {
  Object.values(routeLines).forEach((line) => {
    map.removeLayer(line);
  });

  routeLines = {};

  Object.entries(routes).forEach(([routeId, route]) => {
    if (!route.stops || route.stops.length === 0) {
      return;
    }

    const points = route.stops.map((stop) => [stop.lat, stop.lon]);

    const line = L.polyline(points, {
      color: "#1f4e79",
      weight: 4,
      opacity: 0.65,
      dashArray: "8 6",
    }).addTo(map);

    routeLines[routeId] = line;
  });
}

// =====================================================
// ROUTE ANALYTICS
// =====================================================

function updateRouteAnalytics() {
  const container = document.getElementById("routeAnalytics");

  const routeEntries = Object.entries(allRoutes);

  if (routeEntries.length === 0) {
    container.innerHTML = `
      <div class="loading-card">
        No route information available.
      </div>
    `;

    return;
  }

  container.innerHTML = "";

  routeEntries.forEach(([routeId, route]) => {
    // IMPORTANT:
    // Use the normalized route ID so Firebase/API naming
    // differences do not cause 0-bus results.

    const routeBuses = allBuses.filter((bus) => getRouteId(bus) === routeId);

    const active = routeBuses.filter((bus) => {
      const status = getStatus(bus);

      return (
        status !== "STOPPED" && status !== "BREAKDOWN" && status !== "COMPLETED"
      );
    }).length;

    const delayed = routeBuses.filter(
      (bus) => getStatus(bus) === "DELAYED",
    ).length;

    const routeStatus =
      routeBuses.length === 0
        ? "NO SERVICE"
        : delayed > 0
          ? "DELAYED"
          : "ACTIVE";

    let badgeClass =
      routeStatus === "DELAYED"
        ? "delayed"
        : routeStatus === "ACTIVE"
          ? "active"
          : "stopped";

    const card = document.createElement("div");

    card.className = "route-card";

    card.innerHTML = `
      <div class="route-card-header">

        <div>

          <h4>${routeId}</h4>

          <div class="route-name">
            ${route.name}
          </div>

        </div>

        <span
          class="route-badge"
          style="
            ${
              badgeClass === "delayed"
                ? "background:#fff6df;color:#c58a18;"
                : badgeClass === "stopped"
                  ? "background:#edf0f2;color:#68747d;"
                  : ""
            }
          "
        >
          ${routeStatus}
        </span>

      </div>

      <div class="route-stats">

        <div class="route-stat">

          <span>Buses</span>

          <strong>
            ${routeBuses.length}
          </strong>

        </div>

        <div class="route-stat">

          <span>Active</span>

          <strong>
            ${active}
          </strong>

        </div>

        <div class="route-stat">

          <span>Stops</span>

          <strong>
            ${route.stops.length}
          </strong>

        </div>

      </div>
    `;

    container.appendChild(card);
  });
}

// =====================================================
// BUS TABLE
// =====================================================

function updateBusTable() {
  const table = document.getElementById("busTable");

  const filtered = allBuses.filter((bus) => {
    const status = getStatus(bus);
    const busId = getBusId(bus);
    const routeId = getRouteId(bus);
    const currentStop = getCurrentStop(bus);
    const nextStop = getNextStop(bus);

    const statusMatch = currentFilter === "ALL" || status === currentFilter;

    const searchText = currentSearch.toLowerCase();

    const routeName = allRoutes[routeId]?.name || "";

    const searchable = [busId, routeId, routeName, currentStop, nextStop]
      .join(" ")
      .toLowerCase();

    const searchMatch = searchable.includes(searchText);

    return statusMatch && searchMatch;
  });

  document.getElementById("visibleBusCount").textContent = filtered.length;

  if (filtered.length === 0) {
    table.innerHTML = `
      <tr>
        <td
          colspan="7"
          class="table-loading"
        >
          No buses match the selected filters.
        </td>
      </tr>
    `;

    return;
  }

  table.innerHTML = "";

  filtered.forEach((bus) => {
    const row = document.createElement("tr");

    const status = getStatus(bus);

    const speed =
      status === "STOPPED" || status === "BREAKDOWN" || status === "COMPLETED"
        ? 0
        : getSpeed(bus);

    const eta = getETA(bus);

    const etaText = eta !== null ? `${eta} min` : "--";

    const busId = getBusId(bus);
    const routeId = getRouteId(bus);
    const currentStop = getCurrentStop(bus);
    const nextStop = getNextStop(bus);

    row.innerHTML = `
      <td>
        <span class="bus-id">
          ${busId}
        </span>
      </td>

      <td>
        <span class="bus-route">
          ${routeId}
        </span>
      </td>

      <td>
        <span class="stop-name">
          ${currentStop}
        </span>
      </td>

      <td>
        ${nextStop}
      </td>

      <td>
        <span class="speed-value">
          ${speed} km/h
        </span>
      </td>

      <td>
        <span class="eta-value">
          ${etaText}
        </span>
      </td>

      <td>
        ${createStatusBadge(status)}
      </td>
    `;

    row.addEventListener("click", () => {
      if (busMarkers[busId]) {
        map.flyTo([getLatitude(bus), getLongitude(bus)], 14, {
          duration: 0.8,
        });

        setTimeout(() => {
          busMarkers[busId].openPopup();
        }, 500);
      }
    });

    table.appendChild(row);
  });
}

// =====================================================
// STATUS BADGE
// =====================================================

function createStatusBadge(status) {
  const classMap = {
    ON_TIME: "status-on-time",
    ON_ROUTE: "status-on-time",
    DELAYED: "status-delayed",
    BREAKDOWN: "status-breakdown",
    STOPPED: "status-stopped",
    COMPLETED: "status-stopped",
  };

  const labelMap = {
    ON_TIME: "ON TIME",
    ON_ROUTE: "ON TIME",
    DELAYED: "DELAYED",
    BREAKDOWN: "BREAKDOWN",
    STOPPED: "STOPPED",
    COMPLETED: "COMPLETED",
  };

  const className = classMap[status] || "status-stopped";

  const label = labelMap[status] || status;

  return `
    <span
      class="status-badge ${className}"
    >
      ${label}
    </span>
  `;
}

// =====================================================
// STATUS FORMAT
// =====================================================

function formatStatus(status) {
  const names = {
    ON_TIME: "On Time",
    ON_ROUTE: "On Route",
    DELAYED: "Delayed",
    BREAKDOWN: "Breakdown",
    STOPPED: "Stopped",
    COMPLETED: "Completed",
  };

  return names[status] || status;
}

// =====================================================
// SEARCH
// =====================================================

document.getElementById("busSearch").addEventListener("input", (event) => {
  currentSearch = event.target.value;

  updateBusTable();
});

// =====================================================
// FILTER
// =====================================================

document.getElementById("statusFilter").addEventListener("change", (event) => {
  currentFilter = event.target.value;

  updateBusTable();
});

// =====================================================
// FIT MAP
// =====================================================

function fitAllBuses() {
  const markers = Object.values(busMarkers);

  if (markers.length === 0) {
    return;
  }

  const group = L.featureGroup(markers);

  map.fitBounds(group.getBounds().pad(0.15));
}

document.getElementById("fitMapBtn").addEventListener("click", fitAllBuses);

// =====================================================
// REFRESH BUTTON
// =====================================================

document.getElementById("refreshMapBtn").addEventListener("click", async () => {
  const button = document.getElementById("refreshMapBtn");

  button.textContent = "↻ UPDATING...";

  await loadBuses();

  button.textContent = "↻ REFRESH";
});

// =====================================================
// LAST UPDATED
// =====================================================

function updateLastUpdated() {
  const now = new Date();

  document.getElementById("lastUpdated").textContent =
    `Last updated: ${now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })}`;
}

// =====================================================
// START
// =====================================================

initializeMap();

loadRoutes();

loadBuses();

// =====================================================
// AUTO REFRESH
// =====================================================

setInterval(loadBuses, 2000);

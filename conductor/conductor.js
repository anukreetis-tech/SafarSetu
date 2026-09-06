const API_BASE = "http://127.0.0.1:5000";

let buses = [];
let routes = {};
let selectedBusId = "BUS101";

let map = null;
let busMarker = null;
let routeLine = null;
let stopMarkers = [];

// ============================================================
// INITIALIZE
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  initializeMap();
  setupControls();

  loadRoutes();
  loadBuses();

  // Live Firebase/API refresh
  setInterval(loadBuses, 2000);

  // Live clock
  updateClock();
  setInterval(updateClock, 1000);
});

// ============================================================
// CLOCK
// ============================================================

function updateClock() {
  const clock = document.getElementById("liveClock");

  if (!clock) return;

  const now = new Date();

  clock.textContent = now.toLocaleTimeString("en-IN", {
    hour12: false,
  });
}

// ============================================================
// MAP INITIALIZATION
// ============================================================

function initializeMap() {
  const mapElement = document.getElementById("map");

  if (!mapElement) return;

  map = L.map("map").setView([28.718025, 77.0638], 14);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);
}

// ============================================================
// LOAD ROUTES
// ============================================================

async function loadRoutes() {
  try {
    const response = await fetch(`${API_BASE}/api/routes`);

    if (!response.ok) {
      throw new Error("Unable to load routes");
    }

    routes = await response.json();

    updateDashboard();
  } catch (error) {
    console.error("Route loading error:", error);
  }
}

// ============================================================
// LOAD BUSES
// ============================================================

async function loadBuses() {
  try {
    const response = await fetch(`${API_BASE}/api/buses`);

    if (!response.ok) {
      throw new Error("Unable to load buses");
    }

    buses = await response.json();

    if (buses.length === 0) {
      setConnection(false);
      return;
    }

    setConnection(true);

    // Keep selected bus if it still exists
    const selectedExists = buses.some((bus) => getBusId(bus) === selectedBusId);

    if (!selectedExists) {
      selectedBusId = getBusId(buses[0]);
    }

    updateBusSelector();
    updateDashboard();
  } catch (error) {
    console.error("Bus loading error:", error);

    setConnection(false);
  }
}

// ============================================================
// BUS SELECTOR
// ============================================================

function updateBusSelector() {
  const selector = document.getElementById("busSelect");

  if (!selector) return;

  const currentValue = selectedBusId;

  selector.innerHTML = "";

  buses.forEach((bus) => {
    const busId = getBusId(bus);

    const busNumber = bus.busNumber || bus.bus_number || busId;

    const option = document.createElement("option");

    option.value = busId;

    option.textContent = `BUS${busNumber}`;

    selector.appendChild(option);
  });

  selector.value = currentValue;
}

// ============================================================
// GET BUS ID
// ============================================================

function getBusId(bus) {
  return bus.bus_id || bus.id || bus.busId;
}

// ============================================================
// UPDATE DASHBOARD
// ============================================================

function updateDashboard() {
  const bus = buses.find((item) => getBusId(item) === selectedBusId);

  if (!bus) return;

  updateBusOverview(bus);
  updateServiceStatus(bus);
  updateInformationCards(bus);
  updateMap(bus);
  updateRouteStops(bus);
}

// ============================================================
// BUS OVERVIEW
// ============================================================

function updateBusOverview(bus) {
  const busNumber = bus.busNumber || bus.bus_number || selectedBusId;

  const routeNumber = bus.routeNumber || "--";

  const speed = Number(bus.speed ?? 0);

  const routeName = bus.route_name || getRouteName(bus.routeId);

  setText("busId", `BUS${busNumber}`);

  setText("routeName", routeName || `Route ${routeNumber}`);

  setText("currentSpeed", speed.toFixed(0));
}

// ============================================================
// ROUTE NAME
// ============================================================

function getRouteName(routeId) {
  if (!routeId || !routes) {
    return null;
  }

  const route = routes[routeId];

  if (!route) {
    return null;
  }

  return route.name || route.route_name || null;
}

// ============================================================
// SERVICE STATUS
// ============================================================

function updateServiceStatus(bus) {
  const status = bus.status || "UNKNOWN";

  const statusElement = document.getElementById("serviceStatus");

  if (!statusElement) return;

  let displayStatus = status;

  if (status === "ON_ROUTE") {
    displayStatus = "ON TIME";
  }

  statusElement.textContent = displayStatus;

  // Remove previous classes
  statusElement.classList.remove(
    "status-on-time",
    "status-delayed",
    "status-breakdown",
    "status-completed",
    "status-stopped",
  );

  // Add current status class
  if (status === "ON_ROUTE") {
    statusElement.classList.add("status-on-time");
  }

  if (status === "DELAYED") {
    statusElement.classList.add("status-delayed");
  }

  if (status === "BREAKDOWN") {
    statusElement.classList.add("status-breakdown");
  }

  if (status === "COMPLETED") {
    statusElement.classList.add("status-completed");
  }
}

// ============================================================
// INFORMATION CARDS
// ============================================================

function updateInformationCards(bus) {
  const currentStop = bus.currentStop || bus.current_stop || "--";

  const nextStop = bus.nextStop || bus.next_stop || "--";

  const eta = bus.etaMinutes ?? bus.eta_minutes ?? null;

  const route =
    bus.routeNumber || bus.route_number || bus.routeId || bus.route_id || "--";

  setText("currentStop", currentStop);

  setText("nextStop", nextStop);

  if (eta !== null) {
    setText("eta", `${Number(eta).toFixed(1)} min`);
  } else {
    setText("eta", "--");
  }

  setText("routeId", route);

  // Route information text
  const routeStops = document.getElementById("routeStops");

  if (routeStops) {
    const routeData = routes[bus.routeId || bus.route_id];

    if (routeData && routeData.stops) {
      routeStops.textContent = `${routeData.stops.length} stops`;
    } else {
      routeStops.textContent = `Route ${route}`;
    }
  }
}

// ============================================================
// MAP
// ============================================================

function updateMap(bus) {
  if (!map) return;

  const latitude = Number(bus.latitude);

  const longitude = Number(bus.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return;
  }

  const position = [latitude, longitude];

  // Create bus marker
  if (!busMarker) {
    busMarker = L.marker(position).addTo(map);
  } else {
    busMarker.setLatLng(position);
  }

  const busNumber = bus.busNumber || bus.bus_number || selectedBusId;

  const status = bus.status || "UNKNOWN";

  const speed = Number(bus.speed ?? 0);

  const eta = bus.etaMinutes ?? bus.eta_minutes ?? "--";

  busMarker.bindPopup(`
        <div class="bus-popup">
            <strong>BUS${busNumber}</strong>
            <br><br>
            <b>Status:</b> ${status}
            <br>
            <b>Speed:</b> ${speed.toFixed(0)} km/h
            <br>
            <b>ETA:</b> ${eta} min
            <br>
            <b>Current:</b>
            ${bus.currentStop || "--"}
            <br>
            <b>Next:</b>
            ${bus.nextStop || "--"}
        </div>
    `);

  // Center button uses this position
  busMarker._yuktixPosition = position;
}

// ============================================================
// DRAW ROUTE
// ============================================================

function drawRoute(bus) {
  if (!map) return;

  const routeId = bus.routeId || bus.route_id;

  const route = routes[routeId];

  if (!route || !route.stops || route.stops.length === 0) {
    return;
  }

  const coordinates = route.stops.map((stop) => [
    Number(stop.lat),
    Number(stop.lon),
  ]);

  if (routeLine) {
    map.removeLayer(routeLine);
  }

  routeLine = L.polyline(coordinates, {
    weight: 4,
  }).addTo(map);

  stopMarkers.forEach((marker) => {
    map.removeLayer(marker);
  });

  stopMarkers = [];

  route.stops.forEach((stop) => {
    const marker = L.circleMarker([Number(stop.lat), Number(stop.lon)], {
      radius: 5,
    })
      .addTo(map)
      .bindTooltip(stop.name);

    stopMarkers.push(marker);
  });
}

// ============================================================
// ROUTE STOPS
// ============================================================

function updateRouteStops(bus) {
  const stopsList = document.getElementById("stopsList");

  if (!stopsList) return;

  const routeId = bus.routeId || bus.route_id;

  const route = routes[routeId];

  // If local route is unavailable,
  // create live stop information
  // from Firebase instead.

  if (!route || !route.stops || route.stops.length === 0) {
    stopsList.innerHTML = `
            <div class="stop-item active">
                <div class="stop-marker"></div>
                <div class="stop-content">
                    <strong>
                        ${bus.currentStop || "--"}
                    </strong>
                    <small>
                        Current Stop
                    </small>
                </div>
            </div>

            <div class="stop-item">
                <div class="stop-marker"></div>
                <div class="stop-content">
                    <strong>
                        ${bus.nextStop || "--"}
                    </strong>
                    <small>
                        Next Stop
                    </small>
                </div>
            </div>
        `;

    return;
  }

  stopsList.innerHTML = "";

  route.stops.forEach((stop, index) => {
    const currentStop = bus.currentStop || bus.current_stop;

    const nextStop = bus.nextStop || bus.next_stop;

    let className = "stop-item";

    let label = "Route Stop";

    if (stop.name === currentStop) {
      className += " active";

      label = "Current Stop";
    } else if (stop.name === nextStop) {
      className += " next";

      label = "Next Stop";
    }

    const item = document.createElement("div");

    item.className = className;

    item.innerHTML = `
                <div class="stop-marker">
                    ${index + 1}
                </div>

                <div class="stop-content">
                    <strong>
                        ${stop.name}
                    </strong>

                    <small>
                        ${label}
                    </small>
                </div>
            `;

    stopsList.appendChild(item);
  });

  drawRoute(bus);
}

// ============================================================
// CONTROLS
// ============================================================

function setupControls() {
  // Bus selector
  const selector = document.getElementById("busSelect");

  if (selector) {
    selector.addEventListener("change", (event) => {
      selectedBusId = event.target.value;

      // Reset map
      resetMap();

      updateDashboard();
    });
  }

  // START TRIP
  const startButton = document.getElementById("startTripBtn");

  if (startButton) {
    startButton.addEventListener("click", startTrip);
  }

  // END TRIP
  const endButton = document.getElementById("endTripBtn");

  if (endButton) {
    endButton.addEventListener("click", endTrip);
  }

  // Status buttons
  const statusButtons = document.querySelectorAll(".status-btn");

  statusButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const status = button.dataset.status;

      handleStatus(status);
    });
  });

  // Center bus
  const centerButton = document.getElementById("centerBusBtn");

  if (centerButton) {
    centerButton.addEventListener("click", centerBus);
  }
}

// ============================================================
// START TRIP
// ============================================================

async function startTrip() {
  if (!selectedBusId) {
    showMessage("Please select a bus.");
    return;
  }

  await sendRequest(
    `/api/buses/${selectedBusId}/start`,
    "POST",
    "Trip started successfully.",
  );
}

// ============================================================
// END TRIP
// ============================================================

async function endTrip() {
  if (!selectedBusId) {
    showMessage("Please select a bus.");
    return;
  }

  await sendRequest(
    `/api/buses/${selectedBusId}/end`,
    "POST",
    "Trip completed successfully.",
  );
}

// ============================================================
// STATUS
// ============================================================

async function handleStatus(status) {
  if (!selectedBusId) {
    showMessage("Please select a bus.");

    return;
  }

  // Member 3 does NOT support STOPPED.
  if (status === "STOPPED") {
    showMessage("STOPPED is not supported by the tracking API.");

    return;
  }

  let apiStatus = status;

  // Frontend → Member 3
  if (status === "ON_TIME") {
    apiStatus = "ON_ROUTE";
  }

  await sendRequest(
    `/api/buses/${selectedBusId}/status`,
    "PUT",
    getStatusMessage(status),
    {
      status: apiStatus,
    },
  );
}

// ============================================================
// STATUS MESSAGE
// ============================================================

function getStatusMessage(status) {
  switch (status) {
    case "ON_TIME":
      return "Bus marked ON TIME.";

    case "DELAYED":
      return "Bus marked DELAYED.";

    case "BREAKDOWN":
      return "Bus marked BREAKDOWN.";

    default:
      return "Bus status updated.";
  }
}

// ============================================================
// SEND REQUEST
// ============================================================

async function sendRequest(endpoint, method, successMessage, body = null) {
  try {
    showMessage("Updating...");

    const options = {
      method: method,

      headers: {
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, options);

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Request failed.");
    }

    showMessage(successMessage);

    // Immediately refresh
    await loadBuses();
  } catch (error) {
    console.error("Request error:", error);

    showMessage(error.message);
  }
}

// ============================================================
// CENTER BUS
// ============================================================

function centerBus() {
  if (!busMarker || !map) {
    showMessage("Bus location unavailable.");

    return;
  }

  const position = busMarker.getLatLng();

  map.setView(position, 16, {
    animate: true,
  });

  busMarker.openPopup();
}

// ============================================================
// RESET MAP
// ============================================================

function resetMap() {
  if (busMarker) {
    map.removeLayer(busMarker);

    busMarker = null;
  }

  if (routeLine) {
    map.removeLayer(routeLine);

    routeLine = null;
  }

  stopMarkers.forEach((marker) => {
    map.removeLayer(marker);
  });

  stopMarkers = [];
}

// ============================================================
// CONNECTION STATUS
// ============================================================

function setConnection(connected) {
  const dot = document.getElementById("connectionDot");

  const text = document.getElementById("connectionText");

  if (!dot || !text) return;

  if (connected) {
    text.textContent = " LIVE SYSTEM";

    dot.classList.add("connected");
  } else {
    text.textContent = " CONNECTION LOST";

    dot.classList.remove("connected");
  }
}

// ============================================================
// MESSAGE
// ============================================================

function showMessage(message) {
  const element = document.getElementById("actionMessage");

  if (!element) return;

  element.textContent = message;

  element.classList.add("show");

  clearTimeout(window.yuktixMessageTimer);

  window.yuktixMessageTimer = setTimeout(() => {
    element.classList.remove("show");
  }, 3000);
}

// ============================================================
// TEXT HELPER
// ============================================================

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

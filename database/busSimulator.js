const { updateBusLocation } = require("./updateBus");
const { getBusStatus } = require("./statusService");
const routeData = require("./route");

const route = routeData.stops;
const routeId = routeData.routeId;
const routeNumber = routeData.routeNumber;

let currentPoint = 0;

function calculateETA(current, next, speedKmh) {
  const latDiff = next.latitude - current.latitude;
  const lonDiff = next.longitude - current.longitude;

  const distanceKm =
    Math.sqrt(
      Math.pow(latDiff * 111, 2) +
      Math.pow(lonDiff * 111, 2)
    );

  const timeHours = distanceKm / speedKmh;
  const timeMinutes = timeHours * 60;

  return Math.max(1, Math.round(timeMinutes));
}

async function moveBus() {
  const status = await getBusStatus("BUS101");

  // BREAKDOWN and COMPLETED buses do not move
  if (status === "BREAKDOWN" || status === "COMPLETED") {
    console.log(`BUS101 is ${status}. Bus is stopped.`);
    return;
  }

  // Normal speed vs delayed speed
  const speed = status === "DELAYED" ? 15 : 32;

  const point = route[currentPoint];
  const nextPoint = route[currentPoint + 1] || route[0];

  const etaMinutes = calculateETA(
    point,
    nextPoint,
    speed
  );

  await updateBusLocation(
    "BUS101",
    point.latitude,
    point.longitude,
    speed,
    point.stopName,
    nextPoint.stopName,
    etaMinutes,
    routeId,
    routeNumber
  );

  console.log(
    `BUS101 → ${point.stopName} | ` +
    `Next: ${nextPoint.stopName} | ` +
    `Speed: ${speed} km/h | ` +
    `ETA: ${etaMinutes} min | ` +
    `Status: ${status}`
  );

  currentPoint++;

  if (currentPoint >= route.length) {
    currentPoint = 0;
  }
}

moveBus();

setInterval(moveBus, 5000);
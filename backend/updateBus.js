const db = require("./firebase");

async function updateBusLocation(
  busId,
  latitude,
  longitude,
  speed,
  currentStop,
  nextStop,
  etaMinutes,
  routeId,
  routeNumber
) {
  await db.collection("buses").doc(busId).update({
    latitude: latitude,
    longitude: longitude,
    speed: speed,
    currentStop: currentStop,
    nextStop: nextStop,
    etaMinutes: etaMinutes,
    routeId: routeId,
    routeNumber: routeNumber,
    timestamp: new Date()
  });

  console.log("Bus location updated!");
}

module.exports = {
  updateBusLocation
};
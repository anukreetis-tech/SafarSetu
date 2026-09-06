const db = require("./firebase");

async function updateBusLocation(busId, latitude, longitude, speed) {
  await db.collection("buses").doc(busId).update({
  latitude: latitude,
  longitude: longitude,
  speed: speed,
  timestamp: new Date()
  });

  console.log("Bus location updated!");
}

module.exports = {
  updateBusLocation
};
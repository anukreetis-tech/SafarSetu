const db = require("./firebase");

async function getAllBuses() {
  const snapshot = await db.collection("buses").get();

  const buses = [];

  snapshot.forEach((doc) => {
    buses.push({
      id: doc.id,
      ...doc.data()
    });
  });

  return buses;
}

async function getBus(busId) {
  const doc = await db.collection("buses").doc(busId).get();

  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data()
  };
}

async function updateBusLocation(busId, latitude, longitude, speed) {
  await db.collection("buses").doc(busId).update({
    latitude,
    longitude,
    speed
  });
}

module.exports = {
  getAllBuses,
  getBus,
  updateBusLocation
};
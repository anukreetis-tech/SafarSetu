const db = require("./firebase");

async function updateBusStatus(busId, status) {
  await db.collection("buses").doc(busId).update({
    status: status
  });

  console.log(`Bus ${busId} status changed to ${status}`);
}

async function getBusStatus(busId) {
  const doc = await db.collection("buses").doc(busId).get();

  if (!doc.exists) {
    return null;
  }

  return doc.data().status;
}

module.exports = {
  updateBusStatus,
  getBusStatus
};
const db = require("./firebase");

async function updateBusStatus(busId, status) {
  await db.collection("buses").doc(busId).update({
    status: status
  });

  console.log(`Bus ${busId} status changed to ${status}`);
}

module.exports = {
  updateBusStatus
};
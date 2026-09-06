const db = require("./firebase");

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

module.exports = {
  getBus
};
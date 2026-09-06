const db = require("./firebase");

async function testConnection() {
  const snapshot = await db.collection("buses").get();

  console.log("Firebase connected successfully!");
  console.log("Number of buses:", snapshot.size);
}

testConnection();
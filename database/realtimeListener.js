const db = require("./firebase");

db.collection("buses").doc("BUS101").onSnapshot((doc) => {
  if (doc.exists) {
    console.log("BUS101 updated:");
    console.log(doc.data());
  }
});
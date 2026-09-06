const { updateBusLocation } = require("./updateBus");
const route = require("./route");

let currentPoint = 0;

async function moveBus() {
  const point = route[currentPoint];

  await updateBusLocation(
    "BUS101",
    point.latitude,
    point.longitude,
    32
  );

  console.log(
    `BUS101 → Point ${currentPoint + 1} | ` +
    `Latitude: ${point.latitude}, Longitude: ${point.longitude}`
  );

  currentPoint++;

  if (currentPoint >= route.length) {
    currentPoint = 0;
  }
}

moveBus();
setInterval(moveBus, 5000);
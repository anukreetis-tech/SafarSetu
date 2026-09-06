const {
  getAllBuses,
  getBus,
  updateBusLocation
} = require("./trackingService");

async function test() {
  console.log("ALL BUSES:");
  console.log(await getAllBuses());

  console.log("\nONE BUS:");
  console.log(await getBus("BUS101"));

  console.log("\nUPDATING BUS:");
  await updateBusLocation("BUS101", 28.6300, 77.2200, 35);

  console.log("BUS101 updated successfully!");
}

test();
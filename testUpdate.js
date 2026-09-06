const { updateBusLocation } = require("./updateBus");

async function test() {
  await updateBusLocation("BUS101", 28.6145, 77.2102, 32);
}

test();
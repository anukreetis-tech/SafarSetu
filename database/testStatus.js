const { updateBusStatus } = require("./statusService");

async function test() {
  await updateBusStatus("BUS101", "DELAYED");
}

test();
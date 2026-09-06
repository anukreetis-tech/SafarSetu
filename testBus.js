const { getBus } = require("./busService");

async function test() {
  const bus = await getBus("BUS101");

  console.log(bus);
}

test();
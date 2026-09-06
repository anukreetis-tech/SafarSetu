const express = require("express");

const {
  getAllBuses,
  getBus
} = require("./trackingService");

const { updateBusStatus } = require("./statusService");

const app = express();

app.use(express.json());

app.get("/buses", async (req, res) => {
  try {
    const buses = await getAllBuses();

    res.json({
      success: true,
      data: buses
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch buses"
    });
  }
});

app.get("/buses/:busId", async (req, res) => {
  try {
    const bus = await getBus(req.params.busId);

    if (!bus) {
      return res.status(404).json({
        success: false,
        message: "Bus not found"
      });
    }

    res.json({
      success: true,
      data: bus
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch bus"
    });
  }
});

app.patch("/buses/:busId/status", async (req, res) => {
  try {
    const { status } = req.body;

    const allowedStatuses = [
      "ON_ROUTE",
      "DELAYED",
      "BREAKDOWN",
      "COMPLETED"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bus status"
      });
    }

    const bus = await getBus(req.params.busId);

    if (!bus) {
      return res.status(404).json({
        success: false,
        message: "Bus not found"
      });
    }

    await updateBusStatus(req.params.busId, status);

    res.json({
      success: true,
      message: "Bus status updated",
      status: status
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to update bus status"
    });
  }
});

app.listen(3001, () => {
  console.log("Tracking API running on port 3001");
});
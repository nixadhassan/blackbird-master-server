require("dotenv/config");
const express = require("express");
const mongoose = require("mongoose");
const connectDb = require("./db/connectDb");
const fetchMasterDetails = require("./helpers/fetchMasterDetails");

const app = express();
// Middleware to parse JSON
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

global.onlineUsers = [];
global.masterDetails = {};
global.strategyChanged = false;

app.get("/live-hit", (req, res) => {
  res.status(200).json({ message: "Healthy" });
});

app.get("/fetch-master", async (req, res) => {
  try {
    res.status(200).json({ success: true, data: global.masterDetails });
  } catch (error) {
    res.status(500).json({ success: false, error: error });
    console.log("Error sending master details to server 1.\n", error);
  }
});

app.get("/master-changed", async (req, res) => {
  global.masterChanged = true;
  await fetchMasterDetails();
  res.status(200).json({ success: true, data: global.masterDetails });
});

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`App is listening on port ${port}`);
});

// Initial connection
connectDb();

// Optional: Reconnect if connection is lost after being established
mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB disconnected. Retrying...");
  connectDb();
});

process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Unhandled Rejection:", reason);
});

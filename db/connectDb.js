const mongoose = require("mongoose");
const fetchMasterDetails = require("../helpers/fetchMasterDetails");
require("dotenv/config");

let isConnecting = false;

async function connectDb(retryCount = 0) {
  if (isConnecting) return;
  isConnecting = true;

  console.log("🟡 Attempting to connect to MongoDB...");

  mongoose
    .connect(process.env.MONGODB_URI, {
      dbName: "copytrading",
    })
    .then(() => {
      console.log("✅ Connected to MongoDB");
      isConnecting = false

      fetchMasterDetails(); //Fetch every 4 minutes

    })
    .catch((err) => {
      console.error(
        `❌ MongoDB connection error (attempt ${retryCount + 1}):`,
        err.message
      );
      isConnecting = false;

      const delay = 2000;
      console.log(`🔁 Retrying MongoDB connection in ${delay / 1000}s...`);
      setTimeout(() => connectDb(retryCount + 1), delay);
    });
}

module.exports = connectDb;

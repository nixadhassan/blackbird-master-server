const cron = require("node-cron");
const moment = require("moment-timezone");
const InitialBalance = require("../models/InitialBalance");
const fetchMasterBalance = require("../helpers/fetchMasterBalance");

cron.schedule(
  "* * 1 * *",
  async () => {
    const now = moment().tz("Asia/Kolkata");

    // Only run within first hour
    if (now.hour() > 0) return;

    const currentMonth = now.format("YYYY-MM");

    // Check if we already stored for this month
    const existing = await InitialBalance.findOne({ month: currentMonth });
    if (existing) return; // Already saved, exit

    try {
      const balance = await fetchMasterBalance(); 
      await InitialBalance.create({ month: currentMonth, balance });
      console.log(`[✔] Stored master balance for ${currentMonth}: ${balance}`);
    } catch (err) {
      console.error(
        `[✖] Failed to store balance for ${currentMonth}:`,
        err.message
      );
    }
  },
  {
    timezone: "Asia/Kolkata",
  }
);

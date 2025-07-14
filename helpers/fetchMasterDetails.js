const { default: axios } = require("axios");
const System = require("../models/System");
const monitorTrades = require("../services/monitorTrades");
const fetchMasterBalance = require("./fetchMasterBalance");
const fetchMasterPnl = require("./fetchMasterPnl");
const fetchMasterTotalReturn = require("./fetchMasterTotalReturn");
const fetchMasterWinRate = require("./fetchMasterWinRate");

const fetchMasterDetails = async () => {
  console.log("Fetching master details");

  // Fetch master id and Master's trades
  const { masterAccountId, masterTrades, tg, admins, experience } = await System.findOne({
    admin: true,
  }).select("masterAccountId masterTrades tg admins experience");

  // Fetch master balance
  const masterBalance = await fetchMasterBalance(masterAccountId);

  // Compute today's pnl for master
  const masterTodayPnl = await fetchMasterPnl(masterAccountId);

  // Compute total return
  const masterTotalReturn = await fetchMasterTotalReturn(masterAccountId);

  // Compute win rate for the month
  const masterWinRate = await fetchMasterWinRate(masterAccountId);

  global.masterDetails = {
    masterBalance,
    masterTodayPnl,
    masterTotalReturn,
    masterWinRate,
    masterTrades,
    tg,
    admins,
    experience 
  };

  if (global.masterChanged) {
    //If master account was recently changed by the admin, re-start trades monitoring(for new master)
    monitorTrades();
    global.masterChanged = false;
  } else {
    //We need this condition so that when "fetchMasterDetails" is re-invoked, it doesn't re-invoke "monitorTrades" again because "monitorTrades" has its own self-re-invoking system
    if (!global.monitoring) {
      //Start trades monitoring for the first time
      monitorTrades();
      global.monitoring = true;
    }

    try {
      //Send regular master updates to server 1
      axios.post(`${process.env.SERVER_1_URL}/master`, {
        master: { ...global.masterDetails },
      });
    } catch (error) {
      console.log("Error sending master updates to server 1", error);
    }
  }

  // Prevent multiple intervals (when re-invoked)
  if (global.masterDetailsInterval) {
    clearInterval(global.masterDetailsInterval);
  }

  global.masterDetailsInterval = setInterval(() => {
    fetchMasterDetails();
  }, 240000); // Every 4 mins
};

module.exports = fetchMasterDetails;

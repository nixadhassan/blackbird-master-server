require("dotenv/config");
const MetaApi = require("metaapi.cloud-sdk").default;

// Initialize MetaApi
const token = process.env.META_API_TOKEN;
const metaApi = new MetaApi(token);

module.exports = fetchMasterWinRate = async (accountId) => {
  try {
    // Connect to the MetaTrader account
    const account = await metaApi.metatraderAccountApi.getAccount(accountId);
    const connection = account.getRPCConnection();
    await connection.connect();
    await connection.waitSynchronized();

    // Get date range (start of current month to now)
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0); // First day of current month
    const endDate = now; // Current time

    // Fetch closed trades for the period
    const result = await connection.getDealsByTimeRange(startDate, endDate);
    const deals = result.deals;

    // Count winning and total trades
    let winningTrades = 0;
    let totalTrades = 0;

    deals.forEach((deal) => {
      totalTrades++;
      if (deal.profit > 0) winningTrades++;
    });

    // Calculate win rate (%)
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const formattedWinRate = winRate.toFixed(0) 
    return formattedWinRate;
  } catch (error) {
    console.error("Error calculating win rate:", error);
    throw error;
  }
};
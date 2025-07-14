require("dotenv/config");
const MetaApi = require("metaapi.cloud-sdk").default;

// Initialize MetaApi with your token
const token = process.env.META_API_TOKEN;
const metaApi = new MetaApi(token);

module.exports = fetchMasterPnL = async (accountId) => {
  try {
    // Connect to the MetaTrader account
    const account = await metaApi.metatraderAccountApi.getAccount(accountId);
    const connection = account.getRPCConnection();
    await connection.connect();
    await connection.waitSynchronized();

    // Get today's date range (UTC)
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0
    );
    const todayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59
    );

    // Fetch today's closed trades
    let trades = await connection.getDealsByTimeRange(todayStart, todayEnd);
    trades = trades.deals;

    // Calculate PnL in USD (sum of profit/loss)
    let pnl = 0;
    trades.forEach((trade) => {
      pnl += trade.profit;
    });

    return pnl.toFixed(2);
  } catch (error) {
    console.error("Error fetching PnL:", error);
    throw error;
  }
};

require("dotenv/config");
const MetaApi = require("metaapi.cloud-sdk").default;
const token = process.env.META_API_TOKEN;
const metaApi = new MetaApi(token);

module.exports = fetchMasterTotalReturn = async (accountId) => {
  try {
    // Connect to the MetaTrader account
    const account = await metaApi.metatraderAccountApi.getAccount(accountId);
    const connection = account.getRPCConnection();
    await connection.connect();
    await connection.waitSynchronized();

    // Define date range (June 1, 2025, to now)
    const startDate = new Date("2025-06-01T00:00:00Z"); // UTC
    const endDate = new Date(); // Current time

    // Fetch all closed trades (deals) in the date range
    const result = await connection.getDealsByTimeRange(startDate, endDate);
    const deals = result.deals; // Extract the trades array

    // Sum all profits/losses from trades
    let totalProfit = 0;

    deals.forEach((deal) => {
      totalProfit += deal.profit;
    });

    // Given initial balance = $1,000
    const initialBalance = 1000;

    // Calculate total return (%)
    const totalReturnPercent = (totalProfit / initialBalance) * 100;
    const formattedReturn =
      (totalReturnPercent >= 0 ? "+" : "") +
      totalReturnPercent.toFixed(0) +
      "%";

    return formattedReturn;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
};

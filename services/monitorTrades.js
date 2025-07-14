require("dotenv").config();
const { CopyFactory, TransactionListener } = require("metaapi.cloud-sdk");
const System = require("../models/System");
const getAssetAbbrev = require("../helpers/getAssetAbbrev");
const User = require("../models/User");
const { default: axios } = require("axios");
const MetaApi = require("metaapi.cloud-sdk").default;
const token = process.env.META_API_TOKEN;
// const copyFactory = new CopyFactory(token);
const metaApi = new MetaApi(token);

let seenTrades = [];
let rpcConnection; // cache at module level

async function initializeConnection(account) {
  if (account.state !== "DEPLOYED") {
    console.log("Account not deployed, deploying...");
    await account.deploy();
  }

  if (
    !account.connectionStatus ||
    account.connectionStatus.status !== "CONNECTED"
  ) {
    console.log("Connecting to broker...");
    await account.waitConnected();
    console.log("Account connected to broker");
  }

  if (!rpcConnection || !rpcConnection.connected) {
    console.log("Establishing new RPC connection...");
    rpcConnection = account.getRPCConnection();
    await rpcConnection.connect();
    console.log("Terminal state synchronized");
  }

  return rpcConnection;
}

async function processTrades(connection, accountId) {
  // Set up time range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMinutes(endDate.getMinutes() - 10); //10 minutes before now

  // Fetch trades
  console.log(
    `\n\n\n======================================================================================\nFetching trades for account id-> (${accountId}) between 10 mins ago and now`
  );
  // Get all deals in time range
  const allDeals = await connection.getDealsByTimeRange(startDate, endDate);
  if (allDeals.deals.length == 0)
    return console.log(
      "No recent trades found. Re-fetching in 15 secs\n======================================================================================\n\n\n"
    );

  const recentClosedTrades = allDeals.deals
    .filter((e) => e.entryType == "DEAL_ENTRY_OUT")
    .reverse()
    .slice(0, 300); //300 trades max

  //Pull only unseen and closed trades
  const unseenClosedTrades = recentClosedTrades.filter(
    (e) => !seenTrades.includes(`${e.id}${new Date(e.time).toISOString()}`)
  );

  if (unseenClosedTrades.length == 0)
    return console.log(
      "No new trade(s) found. Re-fetching in 15 secs\n======================================================================================\n\n\n"
    );

  if (unseenClosedTrades.length > 0) {
    for (const trade of unseenClosedTrades) {
      const tradeId = `${trade.id}${new Date(trade.time).toISOString()}`;

      let tradeType = trade.type.split("DEAL_TYPE_")[1];
      tradeType = tradeType == "BUY" ? "SELL" : "BUY"; //for some unknown reason, i have to reverse this
      const price = trade.price;

      const profit = trade.profit;
      const time = `${new Date(trade.time).toISOString()}`;
      seenTrades.push(tradeId);

      const symbol = getAssetAbbrev(trade.symbol);
      const asset = symbol;
      const title = asset + "/USD";

      const tradeData = {
        symbol,
        title,
        tradeType,
        price,
        profit,
        time,
      };
      console.log("Accepted - ", tradeData);

      await System.updateOne(
        { admin: true },
        {
          $addToSet: {
            seenIds: tradeId,
          },
          $push: {
            masterTrades: tradeData,
          },
        }
      );

      //Save trade for all users with active subscriptions
      const batchSize = 1000;
      let skip = 0;
      let users;

      do {
        users = await User.find({ status: "COPYING", commissionOwed: 0 })
          .skip(skip)
          .limit(batchSize);
        skip += users.length;

        const ops = users.map((user) => ({
          updateOne: {
            filter: { chatId: user.chatId },
            update: {
              $push: { trades: tradeData, tradesForThisMonth: tradeData },
            },
          },
        }));

        await User.bulkWrite(ops);
      } while (users.length > 0);

      //Stream trade data to server 1
      axios.post(`${process.env.SERVER_1_URL}/new-trade`, {
        tradeData,
      });
    }
  }
}

module.exports = monitorTrades = async () => {
  try {
    //Init seen-trades
    let admin = await System.findOne({ admin: true });
    if (!admin) {
      //Highly unlikely
      admin = await System.create({});
    }
    seenTrades = admin.seenIds;

    const accountId = admin.masterAccountId;

    // Get account and wait for connection
    const account = await metaApi.metatraderAccountApi.getAccount(accountId);

    const connection = await initializeConnection(account);

    if (global.tradesFetchInterval) {
      clearInterval(tradesFetchInterval); //Clear existing intervals
    }

    global.tradesFetchInterval = setInterval(() => {
      processTrades(connection, account.id);
    }, 15000); //Fetch trades every 15 secs
  } catch (error) {
    console.log("Error fetching master's trades❌", error);
    monitorTrades();
  }
};

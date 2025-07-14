const System = require("../models/System");

require("dotenv/config");
const MetaApi = require("metaapi.cloud-sdk").default;
const apiToken = process.env.META_API_TOKEN;

const api = new MetaApi(apiToken);

module.exports = fetchMasterBalance = async (accountId) => {
  try {
    const account = await api.metatraderAccountApi.getAccount(accountId);
    await account.waitConnected(); // wait until connected to broker
    const connection = account.getRPCConnection();
    await connection.connect();

    const accountInfo = await connection.getAccountInformation();
    return accountInfo.balance.toFixed(2);
  } catch (err) {
    console.error("Error fetching balance:", err.message);
    return 0;
  }
};

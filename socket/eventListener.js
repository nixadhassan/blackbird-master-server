require("dotenv/config");
const { validate } = require("@telegram-apps/init-data-node");
const User = require("../models/User");
const sendToClient = require("./sendToClient");
const { activateCopytrade } = require("../services/activateCopytrade");
const scheduleReminders = require("../services/scheduleReminders");
const InitialBalance = require("../models/InitialBalance");
const moment = require("moment-timezone");
const System = require("../models/System");
const changeMasterCredentials = require("../services/changeMasterCredentials");
const { default: axios } = require("axios");

module.exports = eventListener = async (socket) => {
  // Fetch user on connection
  socket.on("fetch-user", async (chatId, authToken, update) => {
    // validate(authToken, botToken);
    try {
      console.log(`User:-${chatId} registered with socket ID ${socket.id}`);
      //Add to online users
      global.onlineUsers.push({ socketId: socket.id, chatId });

      console.log("Fetching user info");
      const now = moment().tz("Asia/Kolkata");
      const currentMonth = now.format("YYYY-MM"); //for InitialBalance fetch
      const [user, existingBalance] = await Promise.all([
        User.findOne({ chatId })
          .select(
            "photo balance referrals subscriptionEndsOn transactions commissionOwed status accountId createdAt"
          )
          .lean(),
        InitialBalance.findOne({ month: currentMonth }).lean(),
      ]);

      //Fetch user
      console.log("Fetched user info");
      //Send user info
      update({ success: true, user });
      console.log("Sent user info");

      //Manually fetch master details if unavailable for some reason
      if (!global.masterDetails.masterBalance) {
        console.log("Manual master details fetch from master server☹️");
        const res = await axios.get(
          `${process.env.MASTER_SERVER_URL}/fetch-master`
        );
        global.masterDetails = { ...global.masterDetails, ...res.data.data };
      } else {
        console.log("Quick master details pull from memory✅");
      }

      //fetch followers - count actual copy trading users
      let followers = 0;
      if (!global.masterDetails.followers) {
        // Get followers count from database
        const updateFollowersCount = require("../helpers/updateFollowersCount");
        followers = await updateFollowersCount();
      } else {
        followers = global.masterDetails.followers;
      }

      //Retrieve initial balance for this month (needed for trading metrics)
      //Check if we already stored initial balance for this month
      let initialBalanceForThisMonth = 0;
      if (!existingBalance) {
        initialBalanceForThisMonth = global.masterDetails.masterBalance; //use
        await InitialBalance.create({
          month: currentMonth,
          balance: initialBalanceForThisMonth,
        });
      } else {
        initialBalanceForThisMonth = existingBalance.balance;
      }

      //Retrieve initial balance
      const tradeCycleInitialBalance = initialBalanceForThisMonth;

      //Send trades info and master details
      sendToClient(chatId, "user", {
        ...global.masterDetails,
        tradeCycleInitialBalance,
        masterTrades: global.masterDetails.masterTrades.sort(
          (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
        ), //sort by time
        followers,
      });

      const admins = global.masterDetails.admins;
      if (!admins.includes(chatId)) return; //Stop here for normal users(non-admins)

      const [system, usersForAdmin] = await Promise.all([
        System.findOne({ admin: true })
          .select("admins masterAccountId strategyId withdrawalRequests tg profitShare")
          .lean(),
        User.find()
          .select("chatId username balance accountId status login")
          .lean(),
      ]);

      //Fetch admin specific data (for admins)
      const { masterAccountId, strategyId, withdrawalRequests, tg, profitShare } = system;

      const adminData = {
        admins,
        masterAccountId,
        strategyId,
        withdrawalRequests,
        usersForAdmin,
        tg,
        profitShare
      };
      //Send admins
      sendToClient(chatId, "admin", adminData);
      console.log("Sent admin info");
    } catch (error) {
      console.error("Error registering user:", error);
      update({ success: false, error });
    }
  });

  //First payment of new users
  socket.on("subscribe", async (chatId, authToken, accountId, update) => {
    console.log("Subscribing");
    try {
      // validate(authToken, botToken);
      //Activate subscription
      const now = new Date();

      const subscriptionEndsOn = new Date(
        now.getTime() + 30 * 24 * 60 * 60 * 1000
      ); //30 days time

      // const subscriptionEndsOn = new Date(now.getTime() + 30 * 60 * 1000); //30 mins time

      //Activate subscription
      const user = await User.findOneAndUpdate(
        { chatId },
        {
          status: "COPYING",
          firstReminderSent: false,
          secondReminderSent: false,
          subscriptionEndsOn,
        },
        { new: true }
      );

      // Update followers count when user starts copying
      const updateFollowersCount = require("../helpers/updateFollowersCount");
      await updateFollowersCount();

      update({ success: true, user });
      console.log("Subscribed😊");
      scheduleReminders(user);
    } catch (error) {
      update({ success: false, error });
      console.error("Error activating subscription:", error);
    }
  });

  //Commission payment events
  socket.on("pay-commission", async (chatId, authToken, accountId, update) => {
    try {
      // validate(authToken, botToken)
      //Remove commission owed
      const user = await User.findOneAndUpdate(
        { chatId },
        {
          commissionOwed: 0,
        }
      );
      update({ success: true, user });

      //Save commission record ()
      System.findOneAndUpdate(
        { admin: true },
        {
          $inc: {
            profitShare: Number(user.commissionOwed.toFixed(2)),
          },
        }
      );
    } catch (error) {
      update({ success: false, error });
      console.error("Error removing commission owed:", error);
    }
  });

  //Copytrade activation (with meta credentials)
  socket.on(
    "register-copytrade",
    async (chatId, metaApiCreds, authToken, update) => {
      try {
        const activationSuccessful = await activateCopytrade(
          chatId,
          metaApiCreds,
          update
        );
        const newFieldsForUser = {
          accountId: activationSuccessful.accountId,
        };
        update({ success: true, user: newFieldsForUser });
      } catch (error) {
        update({ success: false, error: error });
      }
    }
  );

  //Withdrawal request
  socket.on(
    "withdrawal-request",
    async (chatId, authToken, details, update) => {
      console.log("got here");
      try {
        const { amount, walletAddress } = details;

        const request = {
          amount,
          walletAddress,
          chatId,
          date: new Date(),
        };

        //Add to withdrawal queue
        const updatedQueue = await System.findOneAndUpdate(
          {
            admin: true,
          },
          {
            $push: {
              withdrawalRequests: request,
            },
          },
          { new: true }
        );

        if (updatedQueue.admins.length > 0) {
          for (const admin of updatedQueue.admins) {
            //Update admin dashboard in realtime with new withdrawal request
            sendToClient(admin, "withdrawal-requests", request);

            //Notify admin in telegram bot
            const message = `New withdrawal request🔔🔔\nAmount: *$${Number(
              amount.toFixed(2)
            )}*`;

            global.queue.enqueue(async () => {
              await global.bot.telegram.sendMessage(admin, message, {
                parse_mode: "Markdown",
                reply_markup: {
                  inline_keyboard: [
                    [
                      {
                        text: "Login to Pay",
                        web_app: {
                          url: process.env.MINI_APP_URL,
                        },
                      },
                    ],
                  ],
                },
              });
            });
          }
        }

        //Update user's withdrawal request status
        const user = await User.findOneAndUpdate(
          { chatId },
          {
            withdrawalPending: true,
          },
          { new: true }
        );

        update({ success: true, data: user });
      } catch (error) {
        console.log(error);
        update({ success: false, error: error });
      }
    }
  );

  //Withdrawal approval
  socket.on("withdrawal-approval", async (details, update) => {
    try {
      const { amount, tx, chatId } = details;

      const newTransaction = {
        txType: "WITHDRAWAL",
        amount,
        description: "Withdrawal to wallet address.",
        date: new Date(),
        tx,
      };

      //Update user's withdrawal-request and transaction state
      const user = await User.findOneAndUpdate(
        { chatId },
        {
          withdrawalPending: false,
          $inc: {
            balance: -amount, //Decrease balance by withdrawal amount
          },
          $push: {
            transactions: newTransaction,
          },
        },
        { new: true }
      );

      //Send to user mini app if online
      sendToClient(chatId, "user", user);

      //Notify user of withdrawal approval
      const message = `*$${amount}* sent to your wallet address✅\n\n${tx}`;
      global.queue.enqueue(() => {
        global.bot.telegram.sendMessage(chatId, message, {
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        });
      });

      //Remove from withdrawal queue
      const updatedQueue = await System.findOneAndUpdate(
        { admin: true },
        {
          $pull: {
            withdrawalRequests: {
              chatId,
            },
          },
        },
        { new: true }
      );

      update({ success: true, data: updatedQueue.withdrawalRequests });
    } catch (error) {
      console.log(error.message);
      update({ success: false, error: error });
    }
  });

  //Change master
  socket.on("change-master", async (authToken, accountId, update) => {
    try {
      changeMasterCredentials(accountId, update);
    } catch (error) {
      update({ success: false, error });
    }
  });

  socket.on("update-admins", async (authToken, admins, update) => {
    try {
      await System.findOneAndUpdate(
        { admin: true },
        {
          admins,
        }
      );

      update({ success: true });
    } catch (error) {
      update({ success: false, error });
    }
  });
};

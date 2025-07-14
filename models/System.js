const { model, Schema } = require("mongoose");

const systemSchema = new Schema(
  {
    admin: {
      type: Boolean,
      default: true,
    },
    seenIds: [String],
    experience:Number,
    masterAccountId: String,
    strategyId: String,
    withdrawalRequests: [
      {
        amount: Number,
        chatId: Number,
        walletAddress: String,
        date: Date,
      },
    ],
    masterTrades: [
      {
        symbol: String,
        title: String,
        tradeType: String,
        price: Number,
        profit: Number,
        time: String,
      },
    ],
    admins: [Number],
    tg: String,
  },
  { timestamps: true }
);

const System = model("System", systemSchema);
module.exports = System;

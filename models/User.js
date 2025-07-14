const { model, Schema } = require("mongoose");

const userSchema = new Schema(
  {
    chatId: Number,
    username: String,
    photo: { type: String },
    wallet: String,
    balance: { type: Number, default: 0 },
    referrals: [
      {
        username: String,
        photo: String,
      },
    ],
    subscriptionEndsOn: {
      type: Date,
      default: "",
    },
    submittedCredentials: Boolean,
    login: String,
    server: String,
    password: String,
    accountId: String, // MetaApi account ID
    nickname: String,
    trades: [], //array of trades (used for computing daily profits) - For admin inspection
    tradesForThisMonth:[], //array of trades (used for computing monthly profits) - For referrer commission calc
    status: String, //COPYING - EXPIRED -
    firstReminderSent: { type: Boolean, default: false },
    secondReminderSent: { type: Boolean, default: false },
    commissionOwed: { type: Number, default: 0 },
    transactions: [
      {
        txType: String,
        amount: Number,
        description: String,
        date: Date,
        tx: String,
      },
    ],
    referredBy: Number, //Chat id of referrer
    monthlyProfits: [{ month: String, profit: Number, year: String }],
    withdrawalPending: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

//Search by chatId
userSchema.index({ chatId: 1 });

//Search by status and commissionOwed
userSchema.index({ status: 1, commissionOwed: 1 });

//Search by status
userSchema.index({ status: 1 });

//Search by account id
userSchema.index({ accountId: 1 });

const User = model("User", userSchema);
module.exports = User;

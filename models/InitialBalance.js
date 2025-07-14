const { model, Schema } = require("mongoose");

const initialBalanceSchema = new Schema({
  month: String, // Format: YYYY-MM
  balance: Number,
  createdAt: { type: Date, default: Date.now },
});

const InitialBalance = model("InitialBalance", initialBalanceSchema);
module.exports = InitialBalance

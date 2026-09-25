const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    artist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      default: null,
      index: true,
    },
    subscriberType: {
      type: String,
      enum: ["User", "Artist"],
      default: "User",
      index: true,
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ["mock", "vnpay"],
      required: true,
    },
    transactionRef: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed", "cancelled"],
      default: "pending",
      index: true,
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Transaction", transactionSchema);

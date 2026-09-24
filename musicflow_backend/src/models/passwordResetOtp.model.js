const mongoose = require("mongoose");

const passwordResetOtpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "accountModel",
    },
    accountModel: {
      type: String,
      required: true,
      enum: ["User", "Artist"],
    },
    otpHash: {
      type: String,
      default: null,
    },
    otpExpiresAt: {
      type: Date,
      required: true,
    },
    otpVerified: {
      type: Boolean,
      default: false,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    resendAvailableAt: {
      type: Date,
      required: true,
    },
    resetTokenHash: {
      type: String,
      default: null,
      index: true,
      sparse: true,
    },
    resetTokenExpiresAt: {
      type: Date,
      default: null,
    },
    used: {
      type: Boolean,
      default: false,
      index: true,
    },
    cleanupAt: {
      type: Date,
      required: true,
      expires: 0, // MongoDB TTL index purely for automated background cleanup
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PasswordResetOtp", passwordResetOtpSchema);

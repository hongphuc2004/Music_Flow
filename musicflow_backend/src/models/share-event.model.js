const mongoose = require("mongoose");

const songShareEventSchema = new mongoose.Schema(
  {
    songId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Song",
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ["clipboard", "facebook", "zalo", "twitter", "x", "telegram", "qrcode", "other"],
      default: "clipboard",
    },
    medium: {
      type: String,
      default: "share",
    },
    campaign: {
      type: String,
      default: "social_sharing",
    },
    si: {
      type: String,
      index: true,
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    ip: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

songShareEventSchema.index({ songId: 1, createdAt: -1 });

module.exports = mongoose.model("SongShareEvent", songShareEventSchema);

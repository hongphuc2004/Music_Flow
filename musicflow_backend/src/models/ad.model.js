const mongoose = require("mongoose");

const adSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    type: {
      type: String,
      enum: ["audio", "banner"],
      default: "audio",
      index: true,
    },
    audioUrl: {
      type: String,
      default: "",
    },
    imageUrl: {
      type: String,
      default: "",
    },
    targetUrl: {
      type: String,
      default: "",
    },
    duration: {
      type: Number,
      default: 15, // Thời lượng ước tính (giây)
    },
    canSkip: {
      type: Boolean,
      default: false,
    },
    skipAfterSeconds: {
      type: Number,
      default: 5,
    },
    applicableTiers: {
      type: [String],
      enum: ["basic", "go", "plus", "premium"],
      default: ["basic", "go"],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    priority: {
      type: Number,
      default: 1,
    },
    impressionCount: {
      type: Number,
      default: 0,
    },
    clickCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Advertisement", adSchema);

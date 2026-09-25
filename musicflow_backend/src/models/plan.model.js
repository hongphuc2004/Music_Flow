const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    durationInDays: {
      type: Number,
      required: true,
      min: 1,
    },
    description: {
      type: [String],
      default: [],
    },
    targetRole: {
      type: String,
      enum: ["user", "artist"],
      default: "user",
      index: true,
    },
    aiLimitPerDay: {
      type: Number,
      default: 30,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Plan", planSchema);

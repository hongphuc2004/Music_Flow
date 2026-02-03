const mongoose = require("mongoose");

const topicSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      default: "",
    },
    imageUrl: {
      type: String,
      default: "",
    },
    color: {
      type: String,
      default: "#1DB954", // Màu mặc định giống Spotify
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Topic", topicSchema);

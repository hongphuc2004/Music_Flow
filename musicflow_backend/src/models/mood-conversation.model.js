const mongoose = require("mongoose");

const moodConversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "Mood Music",
    },
    lastMood: {
      type: String,
      default: "chill",
    },
    lastMessage: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("MoodConversation", moodConversationSchema);

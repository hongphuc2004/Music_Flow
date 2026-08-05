const mongoose = require("mongoose");

const assistantConversationSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "actorType",
      index: true,
    },
    actorType: {
      type: String,
      required: true,
      enum: ["User", "Artist"],
    },
    actorRole: {
      type: String,
      required: true,
      enum: ["user", "artist", "admin"],
    },
    scope: {
      type: String,
      enum: ["global", "mood"],
      default: "global",
    },
    title: {
      type: String,
      default: "Trợ lý MusicFlow",
    },
    lastMessage: {
      type: String,
      default: "",
    },
    contextSummary: {
      type: String,
      default: "",
    },
    legacyConversationId: {
      type: String,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("AssistantConversation", assistantConversationSchema);

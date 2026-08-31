const mongoose = require("mongoose");

const songLyricsSchema = new mongoose.Schema(
  {
    songId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Song",
      required: true,
      unique: true,
      index: true,
    },
    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
      index: true,
    },
    lyricsType: {
      type: String,
      enum: ["plain", "synced"],
      default: "plain",
    },
    status: {
      type: String,
      enum: ["not_added", "draft", "published"],
      default: "draft",
    },

    // 📝 DRAFT WORKSPACE (Dành riêng cho Artist soạn thảo, không lộ ra Client)
    plainLyrics: {
      type: String,
      default: "",
    },
    lrcData: {
      type: String,
      default: "",
    },
    syncedLines: [
      {
        startTime: { type: Number, required: true }, // Giây (float)
        text: { type: String, default: "" },
      },
    ],

    // 🚀 PUBLISHED SNAPSHOT (Phục vụ trực tiếp cho Client Music Player)
    publishedLyricsType: {
      type: String,
      enum: ["plain", "synced", null],
      default: null,
    },
    publishedPlainLyrics: {
      type: String,
      default: "",
    },
    publishedLrcData: {
      type: String,
      default: "",
    },
    publishedSyncedLines: [
      {
        startTime: { type: Number, required: true },
        text: { type: String, default: "" },
      },
    ],
    publishedAt: {
      type: Date,
      default: null,
    },

    // 🔒 Optimistic Concurrency Control Version
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("SongLyrics", songLyricsSchema);

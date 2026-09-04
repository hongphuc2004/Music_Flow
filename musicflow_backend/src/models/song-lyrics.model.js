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
      enum: ["not_added", "draft", "ready", "published"],
      default: "draft",
    },


    // 🏷️ SYNCHRONIZATION SOURCE METADATA
    syncSource: {
      type: String,
      enum: ["manual", "lrclib", "ai_alignment", "ai_aligned"],
      default: "manual",
    },

    lastAlignmentJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LyricsAlignmentJob",
      default: null,
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
        endTime: { type: Number, default: null },
        text: { type: String, default: "" },
        words: [
          {
            text: { type: String, default: "" },
            startTime: { type: Number, required: true },
            endTime: { type: Number, required: true },
          },
        ],
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
        endTime: { type: Number, default: null },
        text: { type: String, default: "" },
        words: [
          {
            text: { type: String, default: "" },
            startTime: { type: Number, required: true },
            endTime: { type: Number, required: true },
          },
        ],
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

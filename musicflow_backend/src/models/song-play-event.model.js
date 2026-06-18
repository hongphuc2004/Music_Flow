const mongoose = require("mongoose");

const songPlayEventSchema = new mongoose.Schema(
  {
    songId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Song",
      required: true,
      index: true,
    },
    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      default: null,
    },
    artistIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
    }],
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    anonymousKey: {
      type: String,
      default: null,
    },
    playedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    versionKey: false,
  }
);

songPlayEventSchema.index({ songId: 1, playedAt: -1 });
songPlayEventSchema.index({ artistId: 1, playedAt: -1 });
songPlayEventSchema.index({ userId: 1, playedAt: -1 });
songPlayEventSchema.index({ songId: 1, userId: 1, playedAt: -1 });
songPlayEventSchema.index({ songId: 1, anonymousKey: 1, playedAt: -1 });

module.exports = mongoose.model("SongPlayEvent", songPlayEventSchema);

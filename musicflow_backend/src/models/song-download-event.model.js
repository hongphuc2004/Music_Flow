const mongoose = require("mongoose");

const songDownloadEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    songId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Song",
      required: true,
      index: true,
    },
    downloadedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    versionKey: false,
  }
);

songDownloadEventSchema.index({ userId: 1, downloadedAt: -1 });
songDownloadEventSchema.index({ userId: 1, songId: 1, downloadedAt: -1 });

module.exports = mongoose.model("SongDownloadEvent", songDownloadEventSchema);

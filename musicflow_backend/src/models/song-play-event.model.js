const mongoose = require("mongoose");

const songPlayEventSchema = new mongoose.Schema(
  {
    songId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Song",
      required: true,
      index: true,
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

module.exports = mongoose.model("SongPlayEvent", songPlayEventSchema);

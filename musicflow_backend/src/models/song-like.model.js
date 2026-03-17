const mongoose = require("mongoose");

const songLikeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    songId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Song",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Mỗi user chỉ like 1 bài 1 lần
songLikeSchema.index({ userId: 1, songId: 1 }, { unique: true });

module.exports = mongoose.model("SongLike", songLikeSchema);

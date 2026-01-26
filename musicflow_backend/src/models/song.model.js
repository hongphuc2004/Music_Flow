const mongoose = require("mongoose");

const songSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },

    artist: {
      type: String,
      required: true,
    },

    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Topic",
      required: true,
    },

    // 🎵 AUDIO
    audioUrl: {
      type: String,
      required: true,
    },
    audioPublicId: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
    },

    // 🖼️ IMAGE (COVER)
    imageUrl: {
      type: String,
      required: true,
    },
    imagePublicId: {
      type: String,
      required: true,
    },

    // 📝 LYRICS
    lyrics: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Song", songSchema);

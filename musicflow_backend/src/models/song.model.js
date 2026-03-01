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
      required: false,
    },

    // 👤 UPLOADER
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // null = admin upload
    },

    // 🔒 VISIBILITY
    isPublic: {
      type: Boolean,
      default: false, // Mặc định private, chỉ user thấy
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

    // 🖼️ IMAGE (COVER) - Tùy chọn, có ảnh mặc định
    imageUrl: {
      type: String,
      default: "https://res.cloudinary.com/dvhpcqpkq/image/upload/v1735403257/musicflow/images/tgdfbp3zivuqoxqxpltj.jpg",
    },
    imagePublicId: {
      type: String,
      default: null,
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

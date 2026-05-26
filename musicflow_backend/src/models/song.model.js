const mongoose = require("mongoose");
const { defaultSongImageUrl } = require("../config/cloudinaryFolders");

const songSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },


    // Danh sách ca sĩ thể hiện (có thể nhiều ca sĩ)
    artists: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      required: false,
    }],

    // Danh sách thể loại/chủ đề (có thể nhiều topic)
    topicIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Topic",
      required: false,
    }],

    // 👤 UPLOADER
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // null = admin upload
    },

    // 🔒 VISIBILITY
    isPublic: {
      type: Boolean,
      default: false,
    },

    // 🎵 AUDIO
    audioUrl: {
      type: String,
      required: true,
    },
    audioPublicId: {
      type: String,
      required: false,
      default: null,
    },
    duration: {
      type: Number,
    },

    // 🖼️ IMAGE
    imageUrl: {
      type: String,
      default: defaultSongImageUrl,
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

    // Phân biệt admin upload hay user upload
    source: {
      type: String,
      enum: ["admin", "artist", "user"],
      default: "admin",
    },

    // Cho phép download hay không
    allowDownload: {
      type: Boolean,
      default: true,
    },

    // 📊 THỐNG KÊ
    playCount: {
      type: Number,
      default: 0,
    },

    likeCount: {
      type: Number,
      default: 0,
    },

    commentCount: {
      type: Number,
      default: 0,
    },

    shareCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

songSchema.index({ isPublic: 1, createdAt: -1 });
songSchema.index({ artists: 1, createdAt: -1 });
songSchema.index({ topicIds: 1, createdAt: -1 });
songSchema.index({ uploadedBy: 1, createdAt: -1 });
songSchema.index({ title: "text" });

module.exports = mongoose.model("Song", songSchema);

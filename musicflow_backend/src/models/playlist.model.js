const mongoose = require("mongoose");

const playlistSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    // User sở hữu playlist
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Danh sách bài hát trong playlist
    songs: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Song",
    }],
    // Ảnh bìa playlist (có thể lấy từ bài hát đầu tiên hoặc upload riêng)
    coverImage: {
      type: String,
      default: "",
    },
    // Nguồn ảnh bìa (unsplash | upload | "")
    coverSource: {
      type: String,
      enum: ["unsplash", "upload", ""],
      default: "",
    },
    // Metadata ảnh từ Unsplash phục vụ cho attribution
    coverMetadata: {
      photoId: { type: String, default: "" },
      photographer: { type: String, default: "" },
      photographerUrl: { type: String, default: "" },
      unsplashUrl: { type: String, default: "" }
    },
    // Playlist công khai hay riêng tư
    isPublic: {
      type: Boolean,
      default: false,
    },
    // Playlist do hệ thống/admin phát hành hay người dùng tạo
    isSystem: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual để lấy số lượng bài hát
playlistSchema.virtual("songCount").get(function() {
  return Array.isArray(this.songs) ? this.songs.length : 0;
});

// Virtual alias createdBy trỏ về userId để tương thích ngược với code admin cũ
playlistSchema.virtual("createdBy").get(function() {
  return this.userId;
});

// Đảm bảo virtuals được include trong JSON
playlistSchema.set("toJSON", { virtuals: true });
playlistSchema.set("toObject", { virtuals: true });

playlistSchema.index({ userId: 1, createdAt: -1 });
playlistSchema.index({ isPublic: 1, createdAt: -1 });
playlistSchema.index({ isSystem: 1, isPublic: 1, createdAt: -1 });

module.exports = mongoose.model("Playlist", playlistSchema);

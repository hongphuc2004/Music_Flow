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
    // Playlist công khai hay riêng tư
    isPublic: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual để lấy số lượng bài hát
playlistSchema.virtual("songCount").get(function() {
  return this.songs.length;
});

// Đảm bảo virtuals được include trong JSON
playlistSchema.set("toJSON", { virtuals: true });
playlistSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Playlist", playlistSchema);

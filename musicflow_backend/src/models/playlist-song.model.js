const mongoose = require("mongoose");

const playlistSongSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    songs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Song",
      },
    ],
    coverImage: {
      type: String,
      default: "",
      trim: true,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "system_playlist",
  }
);

playlistSongSchema.virtual("songCount").get(function getSongCount() {
  return this.songs.length;
});

playlistSongSchema.set("toJSON", { virtuals: true });
playlistSongSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("PlaylistSong", playlistSongSchema);

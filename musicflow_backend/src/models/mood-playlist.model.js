const mongoose = require("mongoose");

const songSnapshotSchema = new mongoose.Schema(
  {
    songId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Song",
      required: true,
    },
    title: String,
    artists: [String],
    imageUrl: String,
    audioUrl: String,
    duration: Number,
  },
  { _id: false }
);

const moodPlaylistSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MoodConversation",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "Mood Music",
    },
    description: {
      type: String,
      default: "",
    },
    prompt: {
      type: String,
      required: true,
    },
    mood: {
      type: String,
      default: "chill",
    },
    energy: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    inputKeywords: {
      type: [String],
      default: [],
    },
    matchedTopicIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Topic",
    }],
    matchedArtistIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
    }],
    matchStatus: {
      type: String,
      enum: ["matched", "partial", "fallback"],
      default: "fallback",
    },
    source: {
      type: String,
      enum: ["artist_match", "topic_match", "topic_partial", "fallback"],
      default: "fallback",
    },
    songs: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Song",
    }],
    songSnapshots: {
      type: [songSnapshotSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("MoodPlaylist", moodPlaylistSchema);

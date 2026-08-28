const mongoose = require("mongoose");
const { defaultSongImageUrl } = require("../config/cloudinaryFolders");

const songSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      index: true,
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
    fileSize: {
      type: Number,
      default: 0,
    },
    audioMetadata: {
      format: {
        type: String,
        default: "mp3",
      },
      bitrate: {
        type: Number,
        default: null,
      },
      hasHighQualitySource: {
        type: Boolean,
        default: false,
      },
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
      enum: ["admin", "artist", "user", "jamendo"],
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
    sourceId: {
      type: String,
      default: null
    },

    sourceUrl: {
      type: String,
      default: null
    },

    // 🧠 AI SONG INTELLIGENCE & AUTO-TAGGING (PHASE 5A / PHASE 8)
    aiAnalysis: {
      status: {
        type: String,
        enum: ["none", "pending", "completed", "failed"],
        default: "none",
      },
      genre: {
        type: String,
        default: "",
      },
      suggestedGenres: {
        type: [String],
        default: [],
      },
      moodTags: {
        type: [String],
        default: [],
      },
      energyLevel: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "medium",
      },
      themes: {
        type: [String],
        default: [],
      },
      tags: {
        type: [String],
        default: [],
      },
      storySummary: {
        type: String,
        default: "",
      },
      healingQuotes: {
        type: [String],
        default: [],
      },
      confidence: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "medium",
      },
      retryCount: {
        type: Number,
        default: 0,
      },
      lastAttemptAt: {
        type: Date,
        default: null,
      },
      analyzedAt: {
        type: Date,
        default: null,
      },
    },

    // 🛡️ AI CONTENT MODERATION (PHASE 7)
    moderation: {
      status: {
        type: String,
        enum: ["PENDING", "SAFE", "REVIEW", "BLOCK", "pending", "safe", "review", "block"],
        default: "SAFE",
      },
      riskLevel: {
        type: String,
        enum: ["none", "low", "medium", "high"],
        default: "none",
      },
      flags: {
        type: [String],
        default: [],
      },
      reason: {
        type: String,
        default: "",
      },
      confidence: {
        type: Number,
        default: 1.0,
      },
      source: {
        type: String,
        enum: ["lyrics", "audio", "metadata", "manual", "none"],
        default: "none",
      },
      audioTrackType: {
        type: String,
        enum: ["vocal", "instrumental", "unclear", "none"],
        default: "none",
      },
      audioAnalyzed: {
        type: Boolean,
        default: false,
      },
      moderatedAt: {
        type: Date,
        default: null,
      },

      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      reviewedAt: {
        type: Date,
        default: null,
      },
      reviewDecision: {
        type: String,
        enum: ["none", "approved", "flagged", "rejected"],
        default: "none",
      },
      reviewNote: {
        type: String,
        default: "",
      },
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
songSchema.index({ "aiAnalysis.status": 1 });
songSchema.index({ "moderation.status": 1 });
songSchema.index({ title: "text", lyrics: "text" }, { weights: { title: 10, lyrics: 2 } });


module.exports = mongoose.model("Song", songSchema);


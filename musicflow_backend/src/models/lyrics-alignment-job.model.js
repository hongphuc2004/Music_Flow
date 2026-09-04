const mongoose = require("mongoose");
const config = require("../config/alignmentConfig");

const lyricsAlignmentJobSchema = new mongoose.Schema(
  {
    songId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Song",
      required: true,
      index: true,
    },
    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "succeeded", "failed", "cancelled"],
      default: "pending",
      index: true,
    },
    stage: {
      type: String,
      default: "PENDING",
    },
    progressPercent: {
      type: Number,
      default: 0,
    },
    progressMessage: {
      type: String,
      default: "",
    },

    // Execution & Worker details
    attemptCount: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: config.MAX_JOB_ATTEMPTS || 2,
    },
    workerId: {
      type: String,
      default: null,
    },
    processingStartedAt: {
      type: Date,
      default: null,
    },
    lastHeartbeatAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },

    // Pipeline Mode & Capabilities
    pipelineMode: {
      type: String,
      enum: ["lyrics_provided", "auto_transcribe"],
      default: "lyrics_provided",
      index: true,
    },
    transcriptionProvider: {
      type: String,
      default: null,
    },
    transcriptionModel: {
      type: String,
      default: null,
    },
    transcriptionVersion: {
      type: String,
      default: null,
    },
    rawTranscript: {
      type: String,
      default: "",
    },
    normalizedTranscript: {
      type: String,
      default: "",
    },
    transcriptionConfidence: {
      type: Number,
      default: 1.0,
    },

    // Input Snapshot & Idempotency
    audioPublicId: {
      type: String,
      required: true,
    },
    plainLyricsHash: {
      type: String,
      required: true,
    },
    inputFingerprint: {
      type: String,
      required: true,
    },
    pipelineFingerprint: {
      type: String,
      required: true,
    },
    fingerprint: {
      type: String,
      required: true,
      index: true,
    },
    expectedDraftVersion: {
      type: Number,
      required: true,
    },

    // Pipeline Metadata
    metadata: {
      separatorModel: {
        type: String,
        default: config.SEPARATOR_MODEL,
      },
      alignmentModel: {
        type: String,
        default: config.ALIGNMENT_MODEL,
      },
      pipelineVersion: {
        type: String,
        default: config.PIPELINE_VERSION,
      },
      postProcessVersion: {
        type: String,
        default: config.POSTPROCESS_VERSION,
      },
    },

    // Embedded Output Result
    result: {
      syncedLines: [
        {
          lineIndex: Number,
          startTime: Number,
          endTime: Number,
          text: String,
          words: [
            {
              text: String,
              startTime: Number,
              endTime: Number,
              rawStartTime: Number,
              rawEndTime: Number,
              tailExtensionAppliedSec: Number,
            },
          ],
        },
      ],
      lrcData: {
        type: String,
        default: "",
      },
      qualityStatus: {
        type: String,
        enum: ["GOOD", "WARNING", "FAILED", null],
        default: null,
      },
      qualityNotes: {
        type: [String],
        default: [],
      },
    },

    // Error Information
    errorCode: {
      type: String,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for queue operations, worker health & query lookup
lyricsAlignmentJobSchema.index({ status: 1, createdAt: 1 });
lyricsAlignmentJobSchema.index({ status: 1, lastHeartbeatAt: 1 });
lyricsAlignmentJobSchema.index({ songId: 1, inputFingerprint: 1, pipelineFingerprint: 1 });

// Partial unique index preventing duplicate concurrent active jobs for the same song & fingerprint
lyricsAlignmentJobSchema.index(
  { songId: 1, fingerprint: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["pending", "processing"] } },
  }
);

module.exports = mongoose.model("LyricsAlignmentJob", lyricsAlignmentJobSchema);

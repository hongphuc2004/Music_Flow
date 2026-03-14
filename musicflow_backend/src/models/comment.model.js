const mongoose = require("mongoose");

const reactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["like"],
      required: true,
    },
  },
  {
    _id: false,
  }
);

const commentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    songId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Song",
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    parentCommentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      index: true,
    },
    reactions: {
      type: [reactionSchema],
      default: [],
    },
    reactionCount: {
      type: Number,
      default: 0,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

commentSchema.index({ songId: 1, parentCommentId: 1, createdAt: -1 });
commentSchema.index({ songId: 1, reactionCount: -1, createdAt: -1 });

commentSchema.pre("save", function updateReactionCount() {
  this.reactionCount = this.reactions.length;
});

module.exports = mongoose.model("Comment", commentSchema);

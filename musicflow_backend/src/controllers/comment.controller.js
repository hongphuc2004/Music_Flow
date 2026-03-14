const mongoose = require("mongoose");
const Comment = require("../models/comment.model");
const Song = require("../models/song.model");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const buildReactionSummary = (reactions = []) => {
  const summary = { like: 0 };

  reactions.forEach((reaction) => {
    if (summary[reaction.type] !== undefined) {
      summary[reaction.type] += 1;
    }
  });

  return summary;
};

const mapComment = (comment) => {
  const user = comment.userId || {};

  return {
    _id: comment._id,
    user: {
      _id: user._id || null,
      name: user.name || "",
      avatar: user.avatar || "",
    },
    songId: comment.songId,
    content: comment.content,
    parentCommentId: comment.parentCommentId,
    reactions: (comment.reactions || []).map((reaction) => ({
      userId: reaction.userId?._id || reaction.userId || null,
      type: reaction.type,
    })),
    reactionCount: comment.reactionCount,
    reactionSummary: buildReactionSummary(comment.reactions),
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
};

const getDescendantIds = async (commentId) => {
  const descendants = [];
  let currentLevelIds = [commentId];

  while (currentLevelIds.length > 0) {
    const children = await Comment.find({
      parentCommentId: { $in: currentLevelIds },
    })
      .select("_id")
      .lean();

    const childIds = children.map((child) => child._id);
    descendants.push(...childIds);
    currentLevelIds = childIds;
  }

  return descendants;
};

exports.createComment = async (req, res) => {
  try {
    const { songId, content, parentCommentId } = req.body;

    if (!req.userId || !isValidObjectId(req.userId)) {
      return res.status(401).json({
        success: false,
        message: "Token không hợp lệ hoặc đã hết hạn",
      });
    }

    if (!songId || !content) {
      return res.status(400).json({
        success: false,
        message: "Thiếu songId hoặc content",
      });
    }

    if (!isValidObjectId(songId)) {
      return res.status(400).json({
        success: false,
        message: "songId không hợp lệ",
      });
    }

    if (parentCommentId && !isValidObjectId(parentCommentId)) {
      return res.status(400).json({
        success: false,
        message: "parentCommentId không hợp lệ",
      });
    }

    const song = await Song.findById(songId).select("_id").lean();
    if (!song) {
      return res.status(404).json({
        success: false,
        message: "Bài hát không tồn tại",
      });
    }

    let parentComment = null;
    if (parentCommentId) {
      parentComment = await Comment.findById(parentCommentId)
        .select("_id songId")
        .lean();

      if (!parentComment) {
        return res.status(404).json({
          success: false,
          message: "Bình luận cha không tồn tại",
        });
      }

      if (String(parentComment.songId) !== String(songId)) {
        return res.status(400).json({
          success: false,
          message: "Bình luận cha không thuộc bài hát này",
        });
      }
    }

    const comment = await Comment.create({
      userId: req.userId,
      songId,
      content,
      parentCommentId: parentCommentId || null,
    });

    const populatedComment = await Comment.findById(comment._id)
      .populate("userId", "name avatar")
      .populate("reactions.userId", "name avatar");

    return res.status(201).json({
      success: true,
      message: "Thêm bình luận thành công",
      comment: mapComment(populatedComment),
    });
  } catch (error) {
    console.error("Create comment error:", error);

    const isClientInputError =
      error?.name === "ValidationError" || error?.name === "CastError";

    const message = isClientInputError ? error.message : "Thêm bình luận thất bại";

    return res.status(isClientInputError ? 400 : 500).json({
      success: false,
      message,
      error: error.message,
    });
  }
};

exports.updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;

    if (!isValidObjectId(commentId)) {
      return res.status(400).json({
        success: false,
        message: "commentId không hợp lệ",
      });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Nội dung bình luận không được để trống",
      });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Bình luận không tồn tại",
      });
    }

    if (String(comment.userId) !== String(req.userId)) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền chỉnh sửa bình luận này",
      });
    }

    comment.content = content;
    await comment.save();

    const populatedComment = await Comment.findById(comment._id)
      .populate("userId", "name avatar")
      .populate("reactions.userId", "name avatar");

    return res.json({
      success: true,
      message: "Cập nhật bình luận thành công",
      comment: mapComment(populatedComment),
    });
  } catch (error) {
    console.error("Update comment error:", error);
    return res.status(500).json({
      success: false,
      message: "Cập nhật bình luận thất bại",
      error: error.message,
    });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;

    if (!isValidObjectId(commentId)) {
      return res.status(400).json({
        success: false,
        message: "commentId không hợp lệ",
      });
    }

    const comment = await Comment.findById(commentId).select("_id userId");
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Bình luận không tồn tại",
      });
    }

    if (String(comment.userId) !== String(req.userId)) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xóa bình luận này",
      });
    }

    const descendantIds = await getDescendantIds(comment._id);
    const deleteIds = [comment._id, ...descendantIds];

    const result = await Comment.deleteMany({
      _id: { $in: deleteIds },
    });

    return res.json({
      success: true,
      message: "Xóa bình luận thành công",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Delete comment error:", error);
    return res.status(500).json({
      success: false,
      message: "Xóa bình luận thất bại",
      error: error.message,
    });
  }
};

exports.reactToComment = async (req, res) => {
  try {
    const { commentId } = req.params;

    if (!isValidObjectId(commentId)) {
      return res.status(400).json({
        success: false,
        message: "commentId không hợp lệ",
      });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Bình luận không tồn tại",
      });
    }

    const reactionIndex = comment.reactions.findIndex(
      (reaction) => String(reaction.userId) === String(req.userId)
    );

    if (reactionIndex === -1) {
      comment.reactions.push({ userId: req.userId, type: "like" });
    } else {
      comment.reactions[reactionIndex].type = "like";
    }

    comment.reactionCount = comment.reactions.length;
    await comment.save();

    return res.json({
      success: true,
      message: "Thả cảm xúc thành công",
      reactionCount: comment.reactionCount,
      reactionSummary: buildReactionSummary(comment.reactions),
      userReaction: "like",
    });
  } catch (error) {
    console.error("React comment error:", error);
    return res.status(500).json({
      success: false,
      message: "Thả cảm xúc thất bại",
      error: error.message,
    });
  }
};

exports.removeReaction = async (req, res) => {
  try {
    const { commentId } = req.params;

    if (!isValidObjectId(commentId)) {
      return res.status(400).json({
        success: false,
        message: "commentId không hợp lệ",
      });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Bình luận không tồn tại",
      });
    }

    comment.reactions = comment.reactions.filter(
      (reaction) => String(reaction.userId) !== String(req.userId)
    );
    comment.reactionCount = comment.reactions.length;
    await comment.save();

    return res.json({
      success: true,
      message: "Đã gỡ cảm xúc",
      reactionCount: comment.reactionCount,
      reactionSummary: buildReactionSummary(comment.reactions),
    });
  } catch (error) {
    console.error("Remove reaction error:", error);
    return res.status(500).json({
      success: false,
      message: "Gỡ cảm xúc thất bại",
      error: error.message,
    });
  }
};

exports.getSongComments = async (req, res) => {
  try {
    const { songId } = req.params;
    const { sort = "top", page = "1", limit = "10" } = req.query;

    if (!isValidObjectId(songId)) {
      return res.status(400).json({
        success: false,
        message: "songId không hợp lệ",
      });
    }

    const song = await Song.findById(songId).select("_id").lean();
    if (!song) {
      return res.status(404).json({
        success: false,
        message: "Bài hát không tồn tại",
      });
    }

    const parsedPage = Math.max(Number.parseInt(page, 10) || 1, 1);
    const parsedLimit = Math.min(
      Math.max(Number.parseInt(limit, 10) || 10, 1),
      50
    );
    const skip = (parsedPage - 1) * parsedLimit;

    const rootFilter = { songId, parentCommentId: null };
    const totalCommentsPromise = Comment.countDocuments({ songId });
    const totalRootCommentsPromise = Comment.countDocuments(rootFilter);

    const rootSort =
      sort === "new"
        ? { createdAt: -1 }
        : { reactionCount: -1, createdAt: -1 };

    const rootComments = await Comment.find(rootFilter)
      .sort(rootSort)
      .skip(skip)
      .limit(parsedLimit)
      .populate("userId", "name avatar")
      .populate("reactions.userId", "name avatar")
      .lean();

    const descendants = [];
    let currentParentIds = rootComments.map((comment) => comment._id);

    while (currentParentIds.length > 0) {
      const childComments = await Comment.find({
        songId,
        parentCommentId: { $in: currentParentIds },
      })
        .sort({ createdAt: 1 })
        .populate("userId", "name avatar")
        .populate("reactions.userId", "name avatar")
        .lean();

      if (childComments.length === 0) {
        break;
      }

      descendants.push(...childComments);
      currentParentIds = childComments.map((comment) => comment._id);
    }

    const allComments = [...rootComments, ...descendants];

    const nodeMap = new Map();

    allComments.forEach((comment) => {
      nodeMap.set(String(comment._id), {
        ...mapComment(comment),
        replies: [],
      });
    });

    const rootNodes = [];

    nodeMap.forEach((node) => {
      if (node.parentCommentId) {
        const parentNode = nodeMap.get(String(node.parentCommentId));
        if (parentNode) {
          parentNode.replies.push(node);
        } else {
          rootNodes.push(node);
        }
      } else {
        rootNodes.push(node);
      }
    });

    const sortRepliesByCreatedAt = (nodes) => {
      nodes.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      nodes.forEach((node) => sortRepliesByCreatedAt(node.replies));
    };

    sortRepliesByCreatedAt(rootNodes);

    const orderedRootNodes = rootComments
      .map((comment) => nodeMap.get(String(comment._id)))
      .filter(Boolean);

    const [totalComments, totalRootComments] = await Promise.all([
      totalCommentsPromise,
      totalRootCommentsPromise,
    ]);

    const hasMore = skip + orderedRootNodes.length < totalRootComments;

    return res.json({
      success: true,
      songId,
      sort: sort === "new" ? "new" : "top",
      page: parsedPage,
      limit: parsedLimit,
      hasMore,
      totalComments,
      totalRootComments,
      comments: orderedRootNodes,
    });
  } catch (error) {
    console.error("Get song comments error:", error);
    return res.status(500).json({
      success: false,
      message: "Lấy danh sách bình luận thất bại",
      error: error.message,
    });
  }
};

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const AssistantService = require("../services/assistant.service");
const AssistantConversation = require("../models/assistant-conversation.model");
const AssistantMessage = require("../models/assistant-message.model");
const MoodPlaylist = require("../models/mood-playlist.model");

exports.sendMessage = async (req, res) => {
  try {
    const { prompt, conversationId, scope = "global", model } = req.body;
    const actorId = req.userId;
    const actorRole = req.userRole || "user";
    const actorType = actorRole === "artist" ? "Artist" : "User";

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập nội dung tin nhắn.",
      });
    }

    const result = await AssistantService.processMessage({
      prompt,
      conversationId,
      actorId,
      actorType,
      actorRole,
      scope,
      preferredModel: model,
    });

    return res.json({
      success: true,
      data: {
        conversation: result.conversation,
        messages: result.messages,
        message: result.messages[1] || null,
        playlist: result.playlist,
        songs: result.songs,
        clientActions: result.clientActions,
        pendingConfirmations: result.pendingConfirmations || [],
        assistantMessage: result.assistantMessage,
      },
    });
  } catch (error) {
    console.error("Assistant sendMessage error:", error);
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Đã xảy ra lỗi khi trợ lý xử lý tin nhắn.",
    });
  }
};

exports.getConversations = async (req, res) => {
  try {
    const actorId = req.userId;
    const { scope } = req.query;

    const filter = { actorId };
    if (scope && scope !== "all") {
      filter.scope = scope;
    }

    const conversations = await AssistantConversation.find(filter)
      .sort({ updatedAt: -1 })
      .lean();

    return res.json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    console.error("Assistant getConversations error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể tải danh sách cuộc hội thoại.",
    });
  }
};

exports.getConversationDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const actorId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "ID cuộc hội thoại không hợp lệ.",
      });
    }

    const conversation = await AssistantConversation.findOne({ _id: id, actorId }).lean();
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy cuộc hội thoại.",
      });
    }

    const [messages, playlists] = await Promise.all([
      AssistantMessage.find({ conversationId: id }).sort({ createdAt: 1 }).lean(),
      MoodPlaylist.find({ conversationId: id })
        .populate({
          path: "songs",
          match: { isPublic: true },
          populate: [
            { path: "artists", select: "name avatar" },
            { path: "topicIds", select: "name description" },
          ],
        })
        .populate("matchedTopicIds", "name description")
        .populate("matchedArtistIds", "name avatar")
        .sort({ createdAt: 1 })
        .lean(),
    ]);

    return res.json({
      success: true,
      data: {
        conversation,
        messages,
        playlists,
      },
    });
  } catch (error) {
    console.error("Assistant getConversationDetail error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể tải thông tin cuộc hội thoại.",
    });
  }
};

exports.deleteConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const actorId = req.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "ID cuộc hội thoại không hợp lệ.",
      });
    }

    const existing = await AssistantConversation.findOne({ _id: id, actorId }).select("_id");
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy cuộc hội thoại hoặc bạn không có quyền xóa.",
      });
    }

    await Promise.all([
      AssistantMessage.deleteMany({ conversationId: id }),
      MoodPlaylist.deleteMany({ conversationId: id }),
      AssistantConversation.deleteOne({ _id: id, actorId }),
    ]);

    return res.json({
      success: true,
      message: "Đã xóa cuộc hội thoại thành công.",
    });
  } catch (error) {
    console.error("Assistant deleteConversation error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể xóa cuộc hội thoại.",
    });
  }
};

exports.confirmAction = async (req, res) => {
  try {
    const { actionId } = req.params;
    if (!actionId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu Action ID để xác nhận.",
      });
    }

    // Verify Action ID (JWT short-lived token)
    const decoded = jwt.verify(actionId, process.env.JWT_SECRET);
    if (!decoded || !decoded.type) {
      return res.status(400).json({
        success: false,
        message: "Hành động xác nhận không hợp lệ.",
      });
    }

    // Process action based on decoded type
    // Note: Actions will be expanded in future versions.
    let responseData = null;

    if (decoded.type === "CREATE_PLAYLIST") {
      // Stub for creating playlist action confirmation
      responseData = {
        action: "CREATE_PLAYLIST",
        status: "completed",
      };
    }

    return res.json({
      success: true,
      message: "Xác nhận hành động thành công.",
      data: responseData,
    });
  } catch (error) {
    console.error("Assistant confirmAction error:", error);
    if (error.name === "TokenExpiredError") {
      return res.status(400).json({
        success: false,
        message: "Yêu cầu xác nhận đã hết hạn (giới hạn trong 5 phút).",
      });
    }
    return res.status(400).json({
      success: false,
      message: "Không thể xác nhận hành động này.",
    });
  }
};

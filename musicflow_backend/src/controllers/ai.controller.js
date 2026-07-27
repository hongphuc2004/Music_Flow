const mongoose = require("mongoose");
const AssistantService = require("../services/assistant.service");
const AssistantConversation = require("../models/assistant-conversation.model");
const AssistantMessage = require("../models/assistant-message.model");
const MoodPlaylist = require("../models/mood-playlist.model");

async function serializeConversation(conversationId, userId) {
  const [conversation, messages, playlists] = await Promise.all([
    AssistantConversation.findOne({ _id: conversationId, actorId: userId }).lean(),
    AssistantMessage.find({ conversationId }).sort({ createdAt: 1 }).lean(),
    MoodPlaylist.find({ conversationId })
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

  const mappedMessages = (messages || []).map(msg => ({
    ...msg,
    role: msg.role === "model" ? "assistant" : "user",
    userId
  }));

  return { conversation, messages: mappedMessages, playlists };
}

exports.aiPlaylist = async (req, res) => {
  try {
    const { prompt, conversationId, model: preferredModel } = req.body;
    const userId = req.userId;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập mô tả cảm xúc hoặc trạng thái của bạn.",
      });
    }

    const result = await AssistantService.processMessage({
      prompt,
      conversationId,
      actorId: userId,
      actorType: "User",
      actorRole: req.userRole || "user",
      scope: "mood",
      preferredModel,
    });

    const mappedMessages = result.messages.map(msg => {
      const obj = msg.toObject ? msg.toObject() : msg;
      return {
        ...obj,
        role: obj.role === "model" ? "assistant" : "user",
        userId
      };
    });

    return res.status(200).json({
      success: true,
      conversation: result.conversation,
      messages: mappedMessages,
      playlist: result.playlist ? {
        ...result.playlist.toObject(),
        songs: result.songs,
      } : null,
      songs: result.songs,
      matchStatus: result.playlist ? result.playlist.matchStatus : "chat_only",
      assistantMessage: result.assistantMessage,
    });
  } catch (error) {
    console.error("AI Playlist error:", error);
    if (error.message === "Missing GEMINI_API_KEY") {
      return res.status(503).json({
        success: false,
        message: "AI chat chưa sẵn sàng: thiếu cấu hình GEMINI_API_KEY ở backend.",
      });
    }
    return res.status(500).json({
      success: false,
      message: `Đã xảy ra lỗi khi xử lý AI: ${error.message || "unknown error"}`,
    });
  }
};

exports.getMoodHistory = async (req, res) => {
  try {
    const userId = req.userId;
    const conversations = await AssistantConversation.find({ actorId: userId, scope: "mood" })
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();

    const conversationIds = conversations.map((item) => item._id);
    const playlists = await MoodPlaylist.find({
      conversationId: { $in: conversationIds },
    })
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
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      conversations,
      playlists,
    });
  } catch (error) {
    console.error("Mood history error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể tải lịch sử Mood Music.",
    });
  }
};

exports.getMoodConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Conversation không hợp lệ.",
      });
    }

    const data = await serializeConversation(conversationId, req.userId);
    if (!data.conversation) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hội thoại.",
      });
    }

    return res.json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error("Mood conversation error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể tải hội thoại Mood Music.",
    });
  }
};

exports.deleteMoodConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        message: "Conversation không hợp lệ.",
      });
    }

    const existing = await AssistantConversation.findOne({
      _id: conversationId,
      actorId: req.userId,
    }).select("_id");

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy hội thoại.",
      });
    }

    await Promise.all([
      AssistantMessage.deleteMany({ conversationId }),
      MoodPlaylist.deleteMany({ conversationId }),
      AssistantConversation.deleteOne({ _id: conversationId, actorId: req.userId }),
    ]);

    return res.json({
      success: true,
      message: "Đã xóa mood conversation.",
    });
  } catch (error) {
    console.error("Delete mood conversation error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể xóa hội thoại Mood Music.",
    });
  }
};

const AssistantConversation = require("../models/assistant-conversation.model");
const AssistantMessage = require("../models/assistant-message.model");
const User = require("../models/user.model");
const { hasPremiumAccess } = require("../utils/premium.util");

/**
 * Kiểm tra hạn mức sử dụng AI DJ & Chat của người dùng.
 * @param {string} userId - ID người dùng cần kiểm tra
 */
async function checkQuota(userId) {
  const user = await User.findById(userId).select("isPremium premiumExpiry");
  if (!user) {
    const error = new Error("Người dùng không tồn tại");
    error.status = 404;
    throw error;
  }

  // 1. Tài khoản Premium còn hạn được miễn phí không giới hạn cước
  if (hasPremiumAccess(user)) {
    return { isPremium: true, remaining: -1 };
  }

  // 2. Tài khoản Free: Giới hạn tối đa 5 yêu cầu trong rolling 24 giờ qua.
  // Chỉ tính các tin nhắn do chính user gửi (role: "user").
  // Không tính model response, internal tool calls, system messages.
  const conversations = await AssistantConversation.find({ actorId: userId }).select("_id").lean();
  const conversationIds = conversations.map((c) => c._id);

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const count = await AssistantMessage.countDocuments({
    conversationId: { $in: conversationIds },
    role: "user",
    createdAt: { $gte: oneDayAgo },
  });

  const limit = 10;
  if (count >= limit) {
    const error = new Error(`Bạn đã vượt quá hạn mức ${limit} yêu cầu AI trong 24 giờ. Vui lòng nâng cấp tài khoản Premium để không giới hạn.`);
    error.status = 403;
    throw error;
  }

  return { isPremium: false, remaining: limit - count };
}

module.exports = {
  checkQuota,
};

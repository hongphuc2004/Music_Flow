const AssistantConversation = require("../models/assistant-conversation.model");
const AssistantMessage = require("../models/assistant-message.model");
const User = require("../models/user.model");
const { hasPremiumAccess } = require("../utils/premium.util");

/**
 * Kiểm tra hạn mức sử dụng AI DJ & Chat của người dùng.
 * @param {string} userId - ID người dùng cần kiểm tra
 */
async function checkQuota(userId) {
  const user = await User.findById(userId).populate("premiumPlan");
  if (!user) {
    const error = new Error("Người dùng không tồn tại");
    error.status = 404;
    throw error;
  }

  let limit = 10; // Free: 10 yêu cầu
  let planLabel = "miễn phí";
  let isUnlimited = false;

  if (hasPremiumAccess(user)) {
    const planName = user.premiumPlan?.name || "";
    if (planName === "Gói GO") {
      limit = 30;
      planLabel = "Premium GO";
    } else if (planName === "Gói PLUS") {
      limit = 100;
      planLabel = "Premium PLUS";
    } else {
      isUnlimited = true;
    }
  }

  if (isUnlimited) {
    return { isPremium: true, remaining: -1 };
  }

  // Tài khoản Free hoặc Gói Premium giới hạn (GO/PLUS)
  const conversations = await AssistantConversation.find({ actorId: userId }).select("_id").lean();
  const conversationIds = conversations.map((c) => c._id);

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const count = await AssistantMessage.countDocuments({
    conversationId: { $in: conversationIds },
    role: "user",
    createdAt: { $gte: oneDayAgo },
  });

  if (count >= limit) {
    const error = new Error(`Bạn đã vượt quá hạn mức ${limit} yêu cầu AI trong 24 giờ của tài khoản ${planLabel}. Vui lòng nâng cấp gói cao hơn để không giới hạn.`);
    error.status = 403;
    throw error;
  }

  return { isPremium: user.isPremium, remaining: limit - count };
}

module.exports = {
  checkQuota,
};

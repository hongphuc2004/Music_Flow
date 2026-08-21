const AssistantConversation = require("../models/assistant-conversation.model");
const AssistantMessage = require("../models/assistant-message.model");
const User = require("../models/user.model");
const { hasPremiumAccess } = require("../utils/premium.util");

// Concurrency lock tracking
const activeRequests = new Set();

/**
 * Acquires a concurrent request lock for the user.
 * Throws 429 if another request is already in progress.
 */
function acquireLock(userId) {
  const userKey = userId.toString();
  if (activeRequests.has(userKey)) {
    const error = new Error("Bạn đang có một yêu cầu AI đang xử lý. Vui lòng đợi trong giây lát.");
    error.status = 429;
    throw error;
  }
  activeRequests.add(userKey);
}

/**
 * Releases the concurrent request lock for the user.
 */
function releaseLock(userId) {
  const userKey = userId.toString();
  activeRequests.delete(userKey);
}

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

  let limit = 5; // Free: 5 yêu cầu
  let planLabel = "miễn phí";

  if (hasPremiumAccess(user)) {
    const planName = user.premiumPlan?.name || "";
    if (planName === "Gói GO") {
      limit = 10;
      planLabel = "Gói GO";
    } else if (planName === "Gói PLUS") {
      limit = 15;
      planLabel = "Gói PLUS";
    } else {
      limit = 20; // Gói PREMIUM mặc định hoặc bất kỳ gói premium nào khác
      planLabel = "Gói PREMIUM";
    }
  }

  // Tài khoản Free hoặc Gói Premium giới hạn
  const conversations = await AssistantConversation.find({ actorId: userId }).select("_id").lean();
  const conversationIds = conversations.map((c) => c._id);

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const count = await AssistantMessage.countDocuments({
    conversationId: { $in: conversationIds },
    role: "user",
    createdAt: { $gte: oneDayAgo },
  });

  if (count >= limit) {
    const error = new Error(`Bạn đã vượt quá hạn mức ${limit} yêu cầu AI trong 24 giờ của tài khoản ${planLabel}. Vui lòng nâng cấp/đổi gói để có hạn mức cao hơn.`);
    error.status = 403;
    throw error;
  }

  return { isPremium: user.isPremium, remaining: limit - count };
}

module.exports = {
  checkQuota,
  acquireLock,
  releaseLock,
};

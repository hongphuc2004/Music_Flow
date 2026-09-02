const AssistantConversation = require("../models/assistant-conversation.model");
const AssistantMessage = require("../models/assistant-message.model");
const User = require("../models/user.model");
const { hasPremiumAccess } = require("../utils/premium.util");

// Concurrency lock tracking with safety expiration (15 seconds)
const activeRequests = new Map();
const LOCK_TIMEOUT_MS = 15000;

/**
 * Acquires a concurrent request lock for the user.
 * Throws 429 if another request is already in progress within safety window.
 */
function acquireLock(userId) {
  const userKey = userId.toString();
  const now = Date.now();
  const existingTime = activeRequests.get(userKey);

  if (existingTime && (now - existingTime < LOCK_TIMEOUT_MS)) {
    const error = new Error("Bạn đang có một yêu cầu AI đang xử lý. Vui lòng đợi trong giây lát.");
    error.status = 429;
    throw error;
  }
  activeRequests.set(userKey, now);
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

  let tierLimit = 5; // Free: 5 yêu cầu
  let planLabel = "miễn phí";

  if (hasPremiumAccess(user)) {
    const planName = user.premiumPlan?.name || "";
    if (planName === "Gói GO") {
      tierLimit = 10;
      planLabel = "Gói GO";
    } else if (planName === "Gói PLUS") {
      tierLimit = 15;
      planLabel = "Gói PLUS";
    } else {
      tierLimit = 20; // Gói PREMIUM mặc định hoặc bất kỳ gói premium nào khác
      planLabel = "Gói PREMIUM";
    }
  }

  // Admin custom AI limit override (nếu admin set giá trị cố định)
  const baseLimit = (user.customAiLimit !== null && user.customAiLimit !== undefined && user.customAiLimit >= 0)
    ? Number(user.customAiLimit)
    : tierLimit;

  // Số lượt tặng thêm từ Admin
  const bonusQuota = Number(user.bonusAiQuota || 0);
  const effectiveLimit = baseLimit + bonusQuota;

  // Tài khoản Free hoặc Gói Premium giới hạn
  const conversations = await AssistantConversation.find({ actorId: userId }).select("_id").lean();
  const conversationIds = conversations.map((c) => c._id);

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const count = await AssistantMessage.countDocuments({
    conversationId: { $in: conversationIds },
    role: "user",
    createdAt: { $gte: oneDayAgo },
  });

  if (count >= effectiveLimit) {
    const error = new Error(`Bạn đã vượt quá hạn mức ${effectiveLimit} yêu cầu AI trong 24 giờ của tài khoản ${planLabel}. Vui lòng nâng cấp gói hoặc liên hệ quản trị viên.`);
    error.status = 403;
    throw error;
  }

  if (count < effectiveLimit) {
    // Fire-and-forget background check for quota restored event
    checkAndTriggerQuotaRestored(userId).catch((err) =>
      console.error("Background quota restored check error:", err.message)
    );
  }

  return {
    isPremium: user.isPremium,
    tierLimit,
    customAiLimit: user.customAiLimit,
    bonusAiQuota: bonusQuota,
    effectiveLimit,
    used24h: count,
    remaining: Math.max(0, effectiveLimit - count),
  };
}

/**
 * Evaluates whether the user's rolling 24h AI quota transitioned from exhausted (>= limit)
 * back to available (< limit). If so, triggers triggerQuotaRestoredNotification.
 */
async function checkAndTriggerQuotaRestored(userId) {
  try {
    const user = await User.findById(userId).populate("premiumPlan").lean();
    if (!user) return;

    let tierLimit = 5;
    if (hasPremiumAccess(user)) {
      const planName = user.premiumPlan?.name || "";
      if (planName === "Gói GO") tierLimit = 10;
      else if (planName === "Gói PLUS") tierLimit = 15;
      else tierLimit = 20;
    }

    const baseLimit = (user.customAiLimit !== null && user.customAiLimit !== undefined && user.customAiLimit >= 0)
      ? Number(user.customAiLimit)
      : tierLimit;
    const limit = baseLimit + Number(user.bonusAiQuota || 0);

    const conversations = await AssistantConversation.find({ actorId: userId }).select("_id").lean();
    const conversationIds = conversations.map((c) => c._id);
    if (conversationIds.length === 0) return;

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const currentCount = await AssistantMessage.countDocuments({
      conversationId: { $in: conversationIds },
      role: "user",
      createdAt: { $gte: oneDayAgo },
    });


    if (currentCount < limit) {
      const oldestMessage24h = await AssistantMessage.findOne({
        conversationId: { $in: conversationIds },
        role: "user",
        createdAt: { $gte: oneDayAgo },
      }).sort({ createdAt: 1 }).lean();

      if (oldestMessage24h) {
        const oldestMessageExpiryTimestamp = new Date(oldestMessage24h.createdAt).getTime() + 24 * 60 * 60 * 1000;
        const notificationTriggerService = require("./notificationTrigger.service");
        await notificationTriggerService.triggerQuotaRestoredNotification({
          userId,
          previousCount: limit,
          currentCount,
          limit,
          oldestMessageExpiryTimestamp,
        });
      }
    }
  } catch (err) {
    console.error("Failed to check and trigger quota restored notification:", err.message);
  }
}

/**
 * Resolves the subscription tier code ("premium" | "plus" | "go" | "basic") for a user document.
 * @param {Object} user - Mongoose User document or user object
 * @returns {string} Tier code
 */
function getUserTier(user) {
  if (!user || !hasPremiumAccess(user)) {
    return "basic";
  }
  const planName = user.premiumPlan?.name || "";
  if (planName === "Gói GO") {
    return "go";
  }
  if (planName === "Gói PLUS") {
    return "plus";
  }
  return "premium";
}

module.exports = {
  checkQuota,
  acquireLock,
  releaseLock,
  getUserTier,
  checkAndTriggerQuotaRestored,
};


const AssistantConversation = require("../models/assistant-conversation.model");
const AssistantMessage = require("../models/assistant-message.model");
const User = require("../models/user.model");
const Artist = require("../models/artist.model");
const { hasPremiumAccess, getUserTier } = require("../utils/premium.util");

// Concurrency lock tracking with safety expiration (15 seconds)
const activeRequests = new Map();
const LOCK_TIMEOUT_MS = 15000;

/**
 * Acquires a concurrent request lock for the user.
 * Throws 429 if another request is already in progress within safety window.
 * Admin role bypasses the user concurrency lock.
 */
function acquireLock(userId, userRole = null) {
  if (userRole === "admin") {
    return;
  }

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
 * Kiểm tra hạn mức sử dụng AI DJ & Chat của người dùng (User/Admin).
 * @param {string} userId - ID người dùng cần kiểm tra
 * @param {string} [userRole] - Role từ token xác thực (nếu có)
 */
async function checkQuota(userId, userRole = null) {
  if (userRole === "admin") {
    return {
      role: "admin",
      unlimited: true,
      used24h: 0,
      remaining: null,
      limit: null,
      planLabel: "Quản trị viên (Không giới hạn)",
    };
  }

  const user = await User.findById(userId).populate("premiumPlan");
  if (!user) {
    const error = new Error("Người dùng không tồn tại");
    error.status = 404;
    throw error;
  }

  if (user.role === "admin") {
    return {
      role: "admin",
      unlimited: true,
      used24h: 0,
      remaining: null,
      limit: null,
      planLabel: "Quản trị viên (Không giới hạn)",
    };
  }

  let tierLimit = 5; // Free: 5 yêu cầu
  let planLabel = "miễn phí";

  if (hasPremiumAccess(user)) {
    const planName = user.premiumPlan?.name || "";
    if (planName === "Gói GO") {
      tierLimit = 20;
      planLabel = "Gói GO";
    } else if (planName === "Gói PLUS") {
      tierLimit = 50;
      planLabel = "Gói PLUS";
    } else {
      tierLimit = 100; // Gói PREMIUM: 100 yêu cầu / 24h
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

  // Lọc chính xác các hội thoại của User (phân lập tuyệt đối với Artist)
  const conversations = await AssistantConversation.find({ actorId: userId, actorType: "User" }).select("_id").lean();
  const conversationIds = conversations.map((c) => c._id);

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const count = conversationIds.length > 0
    ? await AssistantMessage.countDocuments({
        conversationId: { $in: conversationIds },
        role: "user", // CHỈ ĐẾM TIN NHẮN DO USER GỬI LÊN, KHÔNG ĐẾM 'model'
        createdAt: { $gte: oneDayAgo },
      })
    : 0;

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
    role: "user",
    unlimited: false,
    isPremium: user.isPremium,
    tierLimit,
    customAiLimit: user.customAiLimit,
    bonusAiQuota: bonusQuota,
    effectiveLimit,
    limit: effectiveLimit,
    used24h: count,
    remaining: Math.max(0, effectiveLimit - count),
    planLabel,
  };
}

/**
 * Kiểm tra hạn mức sử dụng Trợ lý Studio dành cho Nghệ sĩ (Artist).
 * Hạn mức an toàn mặc định: 30 requests / 24h.
 * @param {string} artistId - ID nghệ sĩ từ token xác thực
 */
async function checkArtistQuota(artistId) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Kiem tra trang thai Artist Studio Pro
  const artist = await Artist.findById(artistId).populate("proPlan").lean();
  const isPro = Boolean(artist && artist.isPro && artist.proExpiry && new Date(artist.proExpiry) > new Date());
  const limit = isPro ? (artist.proPlan?.aiLimitPerDay || 150) : 30;
  const planLabel = isPro ? "Artist Studio Pro" : "Artist Studio (Free)";

  const conversations = await AssistantConversation.find({
    actorId: artistId,
    actorType: "Artist",
  }).select("_id").lean();

  if (!conversations || conversations.length === 0) {
    return {
      role: "artist",
      isPro,
      unlimited: false,
      used24h: 0,
      remaining: limit,
      limit,
      planLabel,
    };
  }

  const conversationIds = conversations.map((c) => c._id);

  const count = await AssistantMessage.countDocuments({
    conversationId: { $in: conversationIds },
    role: "user", // CHỈ ĐẾM CÁC PROMPT DO ARTIST GỬI LÊN
    createdAt: { $gte: oneDayAgo },
  });

  if (count >= limit) {
    const error = new Error(
      isPro
        ? `Bạn đã đạt giới hạn ${limit} yêu cầu AI trong 24 giờ của gói Artist Studio Pro. Vui lòng quay lại sau.`
        : `Bạn đã đạt giới hạn ${limit} yêu cầu AI trong 24 giờ dành cho Nghệ sĩ miễn phí. Vui lòng nâng cấp gói Artist Studio Pro để nhận 150 lượt/24h.`
    );
    error.status = 403;
    error.code = "QUOTA_EXCEEDED";
    error.isPro = isPro;
    throw error;
  }

  return {
    role: "artist",
    isPro,
    unlimited: false,
    used24h: count,
    remaining: Math.max(0, limit - count),
    limit,
    planLabel,
  };
}

/**
 * Evaluates whether the user's rolling 24h AI quota transitioned from exhausted (>= limit)
 * back to available (< limit). If so, triggers triggerQuotaRestoredNotification.
 */
async function checkAndTriggerQuotaRestored(userId) {
  try {
    const user = await User.findById(userId).populate("premiumPlan").lean();
    if (!user || user.role === "admin") return;

    let tierLimit = 5;
    if (hasPremiumAccess(user)) {
      const planName = user.premiumPlan?.name || "";
      if (planName === "Gói GO") tierLimit = 20;
      else if (planName === "Gói PLUS") tierLimit = 50;
      else tierLimit = 100;
    }

    const baseLimit = (user.customAiLimit !== null && user.customAiLimit !== undefined && user.customAiLimit >= 0)
      ? Number(user.customAiLimit)
      : tierLimit;
    const limit = baseLimit + Number(user.bonusAiQuota || 0);

    const conversations = await AssistantConversation.find({ actorId: userId, actorType: "User" }).select("_id").lean();
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

module.exports = {
  checkQuota,
  checkArtistQuota,
  acquireLock,
  releaseLock,
  getUserTier,
  checkAndTriggerQuotaRestored,
};


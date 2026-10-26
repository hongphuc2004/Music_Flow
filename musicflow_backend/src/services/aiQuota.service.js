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
 * Lấy mốc 00:00:00 bắt đầu ngày theo múi giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7)
 * @param {Date} [date] - Ngày cần tính (mặc định là thời điểm hiện tại)
 * @returns {Date}
 */
function getStartOfDayVN(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year").value;
  const month = parts.find((p) => p.type === "month").value;
  const day = parts.find((p) => p.type === "day").value;
  return new Date(`${year}-${month}-${day}T00:00:00.000+07:00`);
}

/**
 * Lấy chuỗi YYYY-MM-DD theo múi giờ Việt Nam (Asia/Ho_Chi_Minh)
 * @param {Date} [date]
 * @returns {string}
 */
function getDateStrVN(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year").value;
  const month = parts.find((p) => p.type === "month").value;
  const day = parts.find((p) => p.type === "day").value;
  return `${year}-${month}-${day}`;
}

/**
 * Kiểm tra hạn mức sử dụng AI DJ & Chat của người dùng (User/Admin).
 * Hạn mức được làm mới hàng ngày vào lúc 00:00 (múi giờ Việt Nam).
 * @param {string} userId - ID người dùng cần kiểm tra
 * @param {string} [userRole] - Role từ token xác thực (nếu có)
 */
async function checkQuota(userId, userRole = null) {
  if (userRole === "admin") {
    return {
      role: "admin",
      unlimited: true,
      usedToday: 0,
      used24h: 0,
      remaining: null,
      limit: null,
      planLabel: "Quản trị viên (Không giới hạn)",
      resetTime: "00:00",
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
      usedToday: 0,
      used24h: 0,
      remaining: null,
      limit: null,
      planLabel: "Quản trị viên (Không giới hạn)",
      resetTime: "00:00",
    };
  }

  let tierLimit = 3; // Free: 3 yêu cầu / ngày
  let planLabel = "miễn phí";

  if (hasPremiumAccess(user)) {
    const planName = user.premiumPlan?.name || "";
    if (planName === "Gói PLUS") {
      tierLimit = 20;
      planLabel = "Gói PLUS";
    } else {
      tierLimit = 50; // Gói PREMIUM: 50 yêu cầu / ngày
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

  // Đếm số tin nhắn đã gửi từ 00:00 hôm nay
  const startOfToday = getStartOfDayVN();
  const count = conversationIds.length > 0
    ? await AssistantMessage.countDocuments({
        conversationId: { $in: conversationIds },
        role: "user", // CHỈ ĐẾM TIN NHẮN DO USER GỬI LÊN, KHÔNG ĐẾM 'model'
        createdAt: { $gte: startOfToday },
      })
    : 0;

  if (count >= effectiveLimit) {
    if (!hasPremiumAccess(user)) {
      const error = new Error("🤖 Bạn đã sử dụng hết lượt AI hôm nay. Hạn mức sẽ tự động hồi lại sau 00:00. Nâng cấp Gói PLUS để có thêm lượt sử dụng AI.");
      error.status = 403;
      error.code = "AI_QUOTA_EXCEEDED";
      throw error;
    }
    const error = new Error(`Bạn đã vượt quá hạn mức ${effectiveLimit} yêu cầu AI trong ngày hôm nay của tài khoản ${planLabel}. Hạn mức sẽ tự động làm mới sau 00:00.`);
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
    usedToday: count,
    used24h: count, // Giữ để tương thích ngược với Web Admin / App cũ
    remaining: Math.max(0, effectiveLimit - count),
    planLabel,
    resetTime: "00:00",
  };
}

/**
 * Kiểm tra hạn mức sử dụng Trợ lý Studio dành cho Nghệ sĩ (Artist).
 * Hạn mức làm mới vào 00:00 hàng ngày (múi giờ Việt Nam).
 * Hạn mức an toàn mặc định: 10 requests / ngày (Free), 70 requests / ngày (Artist Studio Pro).
 * @param {string} artistId - ID nghệ sĩ từ token xác thực
 */
async function checkArtistQuota(artistId) {
  const startOfToday = getStartOfDayVN();

  // Kiem tra trang thai Artist Studio Pro
  const artist = await Artist.findById(artistId).populate("proPlan").lean();
  const isPro = Boolean(artist && artist.isPro && artist.proExpiry && new Date(artist.proExpiry) > new Date());
  const limit = isPro ? (artist.proPlan?.aiLimitPerDay || 70) : 10;
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
      usedToday: 0,
      used24h: 0,
      remaining: limit,
      limit,
      planLabel,
      resetTime: "00:00",
    };
  }

  const conversationIds = conversations.map((c) => c._id);

  const count = await AssistantMessage.countDocuments({
    conversationId: { $in: conversationIds },
    role: "user", // CHỈ ĐẾM CÁC PROMPT DO ARTIST GỬI LÊN
    createdAt: { $gte: startOfToday },
  });

  if (count >= limit) {
    const error = new Error(
      isPro
        ? `Bạn đã đạt giới hạn ${limit} yêu cầu AI trong ngày của gói Artist Studio Pro. Hạn mức sẽ tự động làm mới sau 00:00.`
        : `Bạn đã đạt giới hạn ${limit} yêu cầu AI trong ngày dành cho Nghệ sĩ miễn phí. Hạn mức sẽ tự động làm mới sau 00:00 hoặc nâng cấp gói Artist Studio Pro để nhận 70 lượt/ngày.`
    );
    error.status = 403;
    error.code = "QUOTA_EXCEEDED";
    error.isPro = isPro;
    error.limit = limit;
    throw error;
  }

  return {
    role: "artist",
    isPro,
    unlimited: false,
    usedToday: count,
    used24h: count,
    remaining: Math.max(0, limit - count),
    limit,
    planLabel,
    resetTime: "00:00",
  };
}

/**
 * Kiểm tra xem người dùng có từng bị cạn kiệt hạn mức vào ngày hoạt động gần nhất (>= limit)
 * và hôm nay đã bước sang ngày mới để được hồi phục đầy đủ hạn mức (3/3) hay không.
 * Nếu thỏa mãn, bắn thông báo làm mới hạn mức (chỉ 1 lần duy nhất trong ngày).
 */
async function checkAndTriggerQuotaRestored(userId) {
  try {
    const user = await User.findById(userId).populate("premiumPlan").lean();
    if (!user || user.role === "admin") return;

    let tierLimit = 3;
    if (hasPremiumAccess(user)) {
      const planName = user.premiumPlan?.name || "";
      if (planName === "Gói PLUS") tierLimit = 20;
      else tierLimit = 50;
    }

    const baseLimit = (user.customAiLimit !== null && user.customAiLimit !== undefined && user.customAiLimit >= 0)
      ? Number(user.customAiLimit)
      : tierLimit;
    const limit = baseLimit + Number(user.bonusAiQuota || 0);

    const conversations = await AssistantConversation.find({ actorId: userId, actorType: "User" }).select("_id").lean();
    const conversationIds = conversations.map((c) => c._id);
    if (conversationIds.length === 0) return;

    const startOfToday = getStartOfDayVN();
    const todayDateStr = getDateStrVN();

    // 1. Kiểm tra số lượng đã dùng hôm nay
    const currentCount = await AssistantMessage.countDocuments({
      conversationId: { $in: conversationIds },
      role: "user",
      createdAt: { $gte: startOfToday },
    });

    if (currentCount >= limit) {
      // Hôm nay đã dùng hết rồi, không bắn thông báo restored
      return;
    }

    // 2. Tìm tin nhắn gần nhất trước ngày hôm nay để kiểm tra xem ngày hoạt động trước đó có bị hết hạn mức không
    const lastMessageBeforeToday = await AssistantMessage.findOne({
      conversationId: { $in: conversationIds },
      role: "user",
      createdAt: { $lt: startOfToday },
    }).sort({ createdAt: -1 }).lean();

    if (!lastMessageBeforeToday) {
      // Chưa từng chat ngày nào trước hôm nay -> không cần bắn thông báo
      return;
    }

    const lastActiveDayStart = getStartOfDayVN(new Date(lastMessageBeforeToday.createdAt));
    const lastActiveDayEnd = new Date(lastActiveDayStart.getTime() + 24 * 60 * 60 * 1000);

    const countOnLastActiveDay = await AssistantMessage.countDocuments({
      conversationId: { $in: conversationIds },
      role: "user",
      createdAt: { $gte: lastActiveDayStart, $lt: lastActiveDayEnd },
    });

    // Chỉ bắn thông báo nếu ngày hoạt động trước đó user THẬT SỰ đã dùng hết lượt (>= limit)
    if (countOnLastActiveDay >= limit) {
      const notificationTriggerService = require("./notificationTrigger.service");
      await notificationTriggerService.triggerQuotaRestoredNotification({
        userId,
        previousCount: limit,
        currentCount,
        limit,
        dateStr: todayDateStr,
      });
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
  getStartOfDayVN,
  getDateStrVN,
};

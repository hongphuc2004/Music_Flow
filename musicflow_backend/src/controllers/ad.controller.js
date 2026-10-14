const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const Advertisement = require("../models/ad.model");
const { getUserTier } = require("../utils/premium.util");

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Trợ giúp trích xuất và xác định User Tier từ Authorization Header (nếu có).
 * Khách (Guest) không có token sẽ mặc định là "basic".
 */
async function resolveUserTierFromReq(req) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { user: null, tier: "basic" };
    }

    const token = authHeader.split(" ")[1];
    if (!token || !JWT_SECRET) {
      return { user: null, tier: "basic" };
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const resolvedUserId = decoded.userId || decoded.id || decoded._id || null;
    if (!resolvedUserId) {
      return { user: null, tier: "basic" };
    }

    const user = await User.findById(resolvedUserId).populate("premiumPlan");
    if (!user) {
      return { user: null, tier: "basic" };
    }

    const tier = getUserTier(user);
    return { user, tier };
  } catch (err) {
    // Token hết hạn hoặc không hợp lệ -> fallback về basic
    return { user: null, tier: "basic" };
  }
}

/**
 * Tự động tạo dữ liệu quảng cáo mẫu nếu hệ thống chưa có quảng cáo Audio nào.
 */
async function ensureSeedAds() {
  const countAudio = await Advertisement.countDocuments({ type: "audio" });
  if (countAudio < 3) {
    await Advertisement.deleteMany({ type: "audio" });
    await Advertisement.create([
      {
        title: "Đừng để âm nhạc bị ngắt quãng!",
        description: "Nâng cấp Gói PLUS chỉ 20.000đ/tháng để chuyển bài không giới hạn và nghe nhạc không quảng cáo.",
        type: "audio",
        audioUrl: "https://res.cloudinary.com/dzuhbme19/video/upload/v1768844449/musicflow/audio/j5dt9cbb8r6z8fpyihyu.mp3",
        imageUrl: "https://res.cloudinary.com/dzuhbme19/image/upload/v1768844450/musicflow/images/vfy22bgfnmve88gpkgp9.jpg",
        targetUrl: "/client/premium",
        duration: 12,
        canSkip: false,
        skipAfterSeconds: 5,
        applicableTiers: ["basic"],
        isActive: true,
        priority: 15,
      },
      {
        title: "Mở khóa âm thanh Studio HQ 320kbps",
        description: "Thưởng thức từng chi tiết âm bass và vocal rõ nét cùng Gói PLUS chỉ 49.000đ/tháng - Hoàn toàn không quảng cáo.",
        type: "audio",
        audioUrl: "https://res.cloudinary.com/dzuhbme19/video/upload/v1768844449/musicflow/audio/j5dt9cbb8r6z8fpyihyu.mp3",
        imageUrl: "https://res.cloudinary.com/dzuhbme19/image/upload/v1768844450/musicflow/images/vfy22bgfnmve88gpkgp9.jpg",
        targetUrl: "/client/premium",
        duration: 12,
        canSkip: false,
        skipAfterSeconds: 5,
        applicableTiers: ["basic"],
        isActive: true,
        priority: 10,
      },
      {
        title: "Trò chuyện & Tạo Playlist cùng AI DJ",
        description: "Mở khóa tới 100 lượt tương tác AI DJ mỗi ngày và tải offline 1GB cùng Gói PREMIUM.",
        type: "audio",
        audioUrl: "https://res.cloudinary.com/dzuhbme19/video/upload/v1768844449/musicflow/audio/j5dt9cbb8r6z8fpyihyu.mp3",
        imageUrl: "https://res.cloudinary.com/dzuhbme19/image/upload/v1768844450/musicflow/images/vfy22bgfnmve88gpkgp9.jpg",
        targetUrl: "/client/ai-dj",
        duration: 15,
        canSkip: false,
        skipAfterSeconds: 5,
        applicableTiers: ["basic"],
        isActive: true,
        priority: 5,
      },
    ]);
  }

  const countBanner = await Advertisement.countDocuments({ type: "banner" });
  if (countBanner < 2) {
    await Advertisement.deleteMany({ type: "banner" });
    await Advertisement.create([
      {
        title: "Nâng cấp Gói PLUS — Trọn vẹn không quảng cáo",
        description: "Mở khóa âm thanh Studio HQ 320kbps và nghe nhạc liền mạch không quảng cáo.",
        type: "banner",
        imageUrl: "https://res.cloudinary.com/dzuhbme19/image/upload/v1768844450/musicflow/images/vfy22bgfnmve88gpkgp9.jpg",
        targetUrl: "/client/premium",
        applicableTiers: ["basic"],
        isActive: true,
        priority: 10,
      },
      {
        title: "AI DJ — Âm nhạc theo từng cảm xúc",
        description: "Trò chuyện bằng giọng nói và tạo playlist cảm xúc độc quyền cùng Trợ lý AI.",
        type: "banner",
        imageUrl: "https://res.cloudinary.com/dzuhbme19/image/upload/v1768844450/musicflow/images/vfy22bgfnmve88gpkgp9.jpg",
        targetUrl: "/client/ai-dj",
        applicableTiers: ["basic"],
        isActive: true,
        priority: 5,
      },
    ]);
  }
}

/**
 * POST /api/ads/check-next
 * Kiểm tra xem sau bài hát hiện tại có cần phát Audio Ad xen kẽ không.
 * Backend là Single Source of Truth cho quyền lợi và ngưỡng phát.
 */
exports.checkNextAd = async (req, res) => {
  try {
    const { songsPlayedCount = 0 } = req.body;
    const { user, tier } = await resolveUserTierFromReq(req);

    // 1. Gói PLUS & PREMIUM: Miễn 100% quảng cáo
    if (tier === "plus" || tier === "premium") {
      return res.json({
        success: true,
        hasAd: false,
        tier,
        reason: "ad_free_tier",
      });
    }

    // 2. Định mức phát quảng cáo theo từng Tier (chuẩn Zing MP3)
    // - Gói FREE (basic): Cứ sau 5 bài hát
    const threshold = 5;

    if (Number(songsPlayedCount) < threshold) {
      return res.json({
        success: true,
        hasAd: false,
        tier,
        songsPlayedCount: Number(songsPlayedCount),
        threshold,
        songsUntilNextAd: threshold - Number(songsPlayedCount),
      });
    }

    // Đã đạt ngưỡng -> tìm kiếm Audio Ad khả dụng
    await ensureSeedAds();

    const candidateAds = await Advertisement.find({
      type: "audio",
      isActive: true,
      applicableTiers: tier,
    }).sort({ priority: -1, createdAt: -1 });

    if (!candidateAds || candidateAds.length === 0) {
      return res.json({
        success: true,
        hasAd: false,
        tier,
        reason: "no_ads_available",
      });
    }

    // Lấy ngẫu nhiên 1 trong các ad ưu tiên
    const selectedAd = candidateAds[Math.floor(Math.random() * candidateAds.length)];

    const canSkip = Boolean(selectedAd.canSkip);
    const skipAfterSeconds = selectedAd.skipAfterSeconds || 0;

    return res.json({
      success: true,
      hasAd: true,
      tier,
      songsPlayedCount: Number(songsPlayedCount),
      threshold,
      ad: {
        id: selectedAd._id,
        title: selectedAd.title,
        description: selectedAd.description,
        type: selectedAd.type,
        audioUrl: selectedAd.audioUrl,
        imageUrl: selectedAd.imageUrl,
        targetUrl: selectedAd.targetUrl,
        duration: selectedAd.duration || 15,
        canSkip,
        skipAfterSeconds,
      },
    });
  } catch (error) {
    console.error("[AdController] checkNextAd error:", error);
    // Fallback an toàn: nếu lỗi hệ thống, không làm gián đoạn nghe nhạc của user
    return res.status(200).json({
      success: true,
      hasAd: false,
      reason: "server_fallback_error",
      message: error.message,
    });
  }
};

/**
 * GET /api/ads/banners
 * Lấy danh sách banner quảng cáo hiển thị trên trang chủ / view player.
 * Chỉ dành cho tài khoản FREE (basic).
 */
exports.getBannerAds = async (req, res) => {
  try {
    const { user, tier } = await resolveUserTierFromReq(req);

    // Gói PLUS, PREMIUM được tắt toàn bộ Banner Ads
    if (tier !== "basic") {
      return res.json({
        success: true,
        tier,
        data: [],
      });
    }

    await ensureSeedAds();

    const banners = await Advertisement.find({
      type: "banner",
      isActive: true,
      applicableTiers: "basic",
    }).sort({ priority: -1, createdAt: -1 }).limit(5);

    return res.json({
      success: true,
      tier,
      data: banners,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/ads/:id/impression
 * Ghi nhận lượt hiển thị / nghe quảng cáo
 */
exports.recordImpression = async (req, res) => {
  try {
    const { id } = req.params;
    await Advertisement.findByIdAndUpdate(id, { $inc: { impressionCount: 1 } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(200).json({ success: false });
  }
};

/**
 * POST /api/ads/:id/click
 * Ghi nhận lượt click quảng cáo
 */
exports.recordClick = async (req, res) => {
  try {
    const { id } = req.params;
    await Advertisement.findByIdAndUpdate(id, { $inc: { clickCount: 1 } });
    return res.json({ success: true });
  } catch (error) {
    return res.status(200).json({ success: false });
  }
};

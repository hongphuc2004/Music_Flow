const Advertisement = require("../models/ad.model");

/**
 * GET /api/admin/ads/stats/overview
 * Thống kê toàn diện từ dữ liệu tracking thực tế
 */
exports.getOverviewStats = async (req, res) => {
  try {
    const [totalAds, activeAds, audioCount, bannerCount, aggregationResult] = await Promise.all([
      Advertisement.countDocuments(),
      Advertisement.countDocuments({ isActive: true }),
      Advertisement.countDocuments({ type: "audio" }),
      Advertisement.countDocuments({ type: "banner" }),
      Advertisement.aggregate([
        {
          $group: {
            _id: null,
            totalImpressions: { $sum: "$impressionCount" },
            totalClicks: { $sum: "$clickCount" },
          },
        },
      ]),
    ]);

    const totalImpressions = aggregationResult[0]?.totalImpressions || 0;
    const totalClicks = aggregationResult[0]?.totalClicks || 0;
    const ctr = totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0;

    return res.json({
      success: true,
      data: {
        totalAds,
        activeAds,
        audioCount,
        bannerCount,
        totalImpressions,
        totalClicks,
        ctr,
      },
    });
  } catch (error) {
    console.error("[AdminAdController] getOverviewStats error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/admin/ads
 * Lấy danh sách quảng cáo kèm phân trang và lọc
 */
exports.getAds = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      status,
      search,
      sortBy = "priority",
      sortOrder = "desc",
    } = req.query;

    const filter = {};

    if (type && type !== "all") {
      filter.type = type;
    }

    if (status && status !== "all") {
      filter.isActive = status === "active";
    }

    if (search && String(search).trim()) {
      const regex = new RegExp(String(search).trim(), "i");
      filter.$or = [{ title: regex }, { description: regex }];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;
    if (sortBy !== "createdAt") {
      sortOptions.createdAt = -1;
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const skip = (pageNum - 1) * limitNum;

    const [ads, total] = await Promise.all([
      Advertisement.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Advertisement.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: ads,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error("[AdminAdController] getAds error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/admin/ads/:id
 */
exports.getAdById = async (req, res) => {
  try {
    const ad = await Advertisement.findById(req.params.id);
    if (!ad) {
      return res.status(404).json({ success: false, message: "Không tìm thấy quảng cáo." });
    }
    return res.json({ success: true, data: ad });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/admin/ads
 * Tạo chiến dịch quảng cáo mới
 */
exports.createAd = async (req, res) => {
  try {
    const {
      title,
      description = "",
      type = "audio",
      audioUrl = "",
      imageUrl = "",
      targetUrl = "",
      duration = 15,
      canSkip = false,
      skipAfterSeconds = 5,
      applicableTiers = ["basic", "go"],
      isActive = true,
      priority = 1,
    } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: "Tiêu đề quảng cáo không được để trống." });
    }

    if (!["audio", "banner"].includes(type)) {
      return res.status(400).json({ success: false, message: "Loại quảng cáo không hợp lệ (audio hoặc banner)." });
    }

    if (type === "audio" && !audioUrl) {
      return res.status(400).json({ success: false, message: "Quảng cáo âm thanh yêu cầu phải có Audio URL." });
    }

    const newAd = await Advertisement.create({
      title: String(title).trim(),
      description: String(description).trim(),
      type,
      audioUrl: String(audioUrl).trim(),
      imageUrl: String(imageUrl).trim(),
      targetUrl: String(targetUrl).trim(),
      duration: Number(duration) || 15,
      canSkip: Boolean(canSkip),
      skipAfterSeconds: Number(skipAfterSeconds) || 5,
      applicableTiers: Array.isArray(applicableTiers) && applicableTiers.length > 0 ? applicableTiers : ["basic", "go"],
      isActive: Boolean(isActive),
      priority: Number(priority) || 1,
      impressionCount: 0,
      clickCount: 0,
    });

    return res.status(201).json({
      success: true,
      message: "Tạo chiến dịch quảng cáo thành công.",
      data: newAd,
    });
  } catch (error) {
    console.error("[AdminAdController] createAd error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/admin/ads/:id
 * Cập nhật chiến dịch quảng cáo (giữ nguyên impression/click tracking data)
 */
exports.updateAd = async (req, res) => {
  try {
    const { id } = req.params;
    const ad = await Advertisement.findById(id);
    if (!ad) {
      return res.status(404).json({ success: false, message: "Không tìm thấy quảng cáo để cập nhật." });
    }

    const {
      title,
      description,
      type,
      audioUrl,
      imageUrl,
      targetUrl,
      duration,
      canSkip,
      skipAfterSeconds,
      applicableTiers,
      isActive,
      priority,
    } = req.body;

    if (title !== undefined) {
      if (!String(title).trim()) {
        return res.status(400).json({ success: false, message: "Tiêu đề không được để trống." });
      }
      ad.title = String(title).trim();
    }

    if (description !== undefined) ad.description = String(description).trim();
    if (type !== undefined && ["audio", "banner"].includes(type)) ad.type = type;
    if (audioUrl !== undefined) ad.audioUrl = String(audioUrl).trim();
    if (imageUrl !== undefined) ad.imageUrl = String(imageUrl).trim();
    if (targetUrl !== undefined) ad.targetUrl = String(targetUrl).trim();
    if (duration !== undefined) ad.duration = Number(duration) || 15;
    if (canSkip !== undefined) ad.canSkip = Boolean(canSkip);
    if (skipAfterSeconds !== undefined) ad.skipAfterSeconds = Number(skipAfterSeconds) || 5;
    if (applicableTiers !== undefined && Array.isArray(applicableTiers)) ad.applicableTiers = applicableTiers;
    if (isActive !== undefined) ad.isActive = Boolean(isActive);
    if (priority !== undefined) ad.priority = Number(priority) || 1;

    await ad.save();

    return res.json({
      success: true,
      message: "Cập nhật quảng cáo thành công.",
      data: ad,
    });
  } catch (error) {
    console.error("[AdminAdController] updateAd error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/admin/ads/:id/toggle
 * Bật / tắt nhanh trạng thái hoạt động của quảng cáo
 */
exports.toggleAdStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const ad = await Advertisement.findById(id);
    if (!ad) {
      return res.status(404).json({ success: false, message: "Không tìm thấy quảng cáo." });
    }

    ad.isActive = !ad.isActive;
    await ad.save();

    return res.json({
      success: true,
      message: `Đã ${ad.isActive ? "kích hoạt" : "tạm dừng"} quảng cáo thành công.`,
      data: ad,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/admin/ads/:id
 * Xóa chiến dịch quảng cáo
 */
exports.deleteAd = async (req, res) => {
  try {
    const { id } = req.params;
    const ad = await Advertisement.findByIdAndDelete(id);
    if (!ad) {
      return res.status(404).json({ success: false, message: "Không tìm thấy quảng cáo." });
    }

    return res.json({
      success: true,
      message: "Đã xóa quảng cáo thành công.",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

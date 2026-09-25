const Plan = require("../models/plan.model");

/**
 * Lấy danh sách các gói cước đang hoạt động
 */
exports.getActivePlans = async (req, res) => {
  try {
    // Tự động dọn dẹp các gói cước cũ để đồng bộ sang 3 gói tháng mới
    const hasOldPlanName = await Plan.exists({
      name: { $in: ["Premium 1 Tháng", "Premium 3 Tháng", "Premium 6 Tháng", "Premium 12 Tháng", "Gói PRO"] }
    });
    if (hasOldPlanName) {
      await Plan.deleteMany({});
    }

    const { targetRole = "user" } = req.query;

    // Tự động kiểm tra và seed gói Artist Studio Pro nếu chưa có trong DB
    const artistPlanExists = await Plan.findOne({ name: "Artist Studio Pro" });
    if (!artistPlanExists) {
      await Plan.create({
        name: "Artist Studio Pro",
        price: 99000,
        durationInDays: 30,
        description: [
          "Trợ lý AI Studio nâng cấp (150 yêu cầu / 24 giờ)",
          "Tải lên bài hát tối đa 150MB / bài",
          "Kho lưu trữ nhạc Studio mở rộng 5GB",
          "Huy hiệu PRO dành riêng cho Nghệ sĩ chuyên nghiệp",
          "Ưu tiên tài nguyên AI phản hồi nhanh"
        ],
        targetRole: "artist",
        aiLimitPerDay: 150,
        isActive: true,
      });
    }

    // Tự động seed gói User mặc định nếu DB trống gói User
    const goPlanExists = await Plan.findOne({ name: "Gói GO" });
    if (!goPlanExists) {
      const defaultUserPlans = [
        {
          name: "Gói GO",
          price: 19000,
          durationInDays: 30,
          description: [
            "Chất lượng âm thanh Tiêu chuẩn (128kbps)",
            "Tải nhạc ngoại tuyến 128kbps (Tối đa 300MB)",
            "Tải lên tối đa 250MB bài hát lưu trữ",
            "Trò chuyện AI DJ (20 lượt/ngày)"
          ],
          targetRole: "user",
          aiLimitPerDay: 20,
          isActive: true
        },
        {
          name: "Gói PLUS",
          price: 49000,
          durationInDays: 30,
          description: [
            "Mở khóa Âm thanh chất lượng cao HQ 320kbps",
            "Tải nhạc ngoại tuyến HQ 320kbps (Tối đa 700MB)",
            "Tải lên tối đa 500MB bài hát lưu trữ",
            "Trò chuyện AI DJ (50 lượt/ngày)"
          ],
          targetRole: "user",
          aiLimitPerDay: 50,
          isActive: true
        },
        {
          name: "Gói PREMIUM",
          price: 89000,
          durationInDays: 30,
          description: [
            "Âm thanh chất lượng cao HQ 320kbps toàn diện",
            "Tải nhạc ngoại tuyến HQ 320kbps (Tối đa 1GB)",
            "Tải lên tối đa 1GB bài hát lưu trữ",
            "Trò chuyện AI DJ (100 lượt/ngày, mô hình AI thông minh nhất)"
          ],
          targetRole: "user",
          aiLimitPerDay: 100,
          isActive: true
        }
      ];
      await Plan.insertMany(defaultUserPlans);
    }


    const filter = { isActive: true };
    if (targetRole !== "all") {
      filter.targetRole = targetRole === "artist" ? "artist" : { $ne: "artist" };
    }

    const plans = await Plan.find(filter).sort({ price: 1 });

    return res.json({
      success: true,
      data: plans,
    });
  } catch (error) {
    console.error("Get active plans error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách gói cước",
      error: error.message,
    });
  }
};

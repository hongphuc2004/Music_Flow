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

    let plans = await Plan.find({ isActive: true }).sort({ price: 1 });
    
    // Nếu chưa có gói cước nào, tự động seed các gói mặc định
    if (plans.length === 0) {
      const defaultPlans = [
        {
          name: "Gói GO",
          price: 19000,
          durationInDays: 30,
          description: [
            "Tải lên tối đa 100MB bài hát lưu trữ",
            "Tải nhạc ngoại tuyến không giới hạn",
            "Trò chuyện AI DJ không giới hạn 24/7"
          ],
          isActive: true
        },
        {
          name: "Gói PLUS",
          price: 49000,
          durationInDays: 30,
          description: [
            "Tải lên tối đa 500MB bài hát lưu trữ",
            "Tải nhạc ngoại tuyến không giới hạn",
            "Trò chuyện AI DJ không giới hạn 24/7"
          ],
          isActive: true
        },
        {
          name: "Gói PREMIUM",
          price: 89000,
          durationInDays: 30,
          description: [
            "Tải lên không giới hạn dung lượng lưu trữ",
            "Tải nhạc ngoại tuyến không giới hạn",
            "Trò chuyện AI DJ không giới hạn 24/7"
          ],
          isActive: true
        }
      ];
      await Plan.insertMany(defaultPlans);
      plans = await Plan.find({ isActive: true }).sort({ price: 1 });
    }

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

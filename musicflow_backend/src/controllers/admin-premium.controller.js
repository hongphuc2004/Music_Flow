const Plan = require("../models/plan.model");
const Transaction = require("../models/transaction.model");
const Subscription = require("../models/subscription.model");
const User = require("../models/user.model");

/**
 * Lấy số liệu thống kê doanh thu & người dùng Premium
 */
exports.getStats = async (req, res) => {
  try {
    // 1. Tính doanh thu thực tế (chỉ tính Transaction status === "success")
    const revenueResult = await Transaction.aggregate([
      { $match: { status: "success" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    // 2. Đếm số lượng giao dịch theo trạng thái
    const successCount = await Transaction.countDocuments({ status: "success" });
    const failedCount = await Transaction.countDocuments({ status: "failed" });
    const pendingCount = await Transaction.countDocuments({ status: "pending" });
    const cancelledCount = await Transaction.countDocuments({ status: "cancelled" });

    // 3. Đếm số lượng User DUY NHẤT đang có Premium hoạt động
    const activePremiumUsers = await User.countDocuments({
      isPremium: true,
      premiumExpiry: { $gt: new Date() }
    });

    return res.json({
      success: true,
      data: {
        totalRevenue,
        successCount,
        failedCount,
        pendingCount,
        cancelledCount,
        activePremiumUsers
      }
    });
  } catch (error) {
    console.error("Admin get stats error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy số liệu thống kê Premium",
      error: error.message
    });
  }
};

/**
 * Lấy toàn bộ danh sách gói cước (kể cả inactive)
 */
exports.getPlans = async (req, res) => {
  try {
    const plans = await Plan.find().sort({ price: 1 });
    return res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error("Admin get plans error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể tải danh sách gói cước",
      error: error.message
    });
  }
};

/**
 * Tạo mới một gói cước
 */
exports.createPlan = async (req, res) => {
  try {
    const { name, price, durationInDays, description, isActive } = req.body;

    if (!name || price === undefined || !durationInDays) {
      return res.status(400).json({
        success: false,
        message: "Tên gói, giá cước và thời hạn sử dụng là bắt buộc"
      });
    }

    const descriptionArray = Array.isArray(description) 
      ? description 
      : String(description || "").split(",").map(d => d.trim()).filter(Boolean);

    const plan = await Plan.create({
      name: name.trim(),
      price: Number(price),
      durationInDays: Number(durationInDays),
      description: descriptionArray,
      isActive: isActive !== false
    });

    return res.status(201).json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error("Admin create plan error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể tạo gói cước",
      error: error.message
    });
  }
};

/**
 * Cập nhật gói cước
 */
exports.updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, durationInDays, description, isActive } = req.body;

    const plan = await Plan.findById(id);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Gói cước không tồn tại"
      });
    }

    if (name) plan.name = name.trim();
    if (price !== undefined) plan.price = Number(price);
    if (durationInDays) plan.durationInDays = Number(durationInDays);
    if (description !== undefined) {
      plan.description = Array.isArray(description) 
        ? description 
        : String(description || "").split(",").map(d => d.trim()).filter(Boolean);
    }
    if (isActive !== undefined) plan.isActive = isActive;

    await plan.save();

    return res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error("Admin update plan error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể cập nhật gói cước",
      error: error.message
    });
  }
};

/**
 * Xóa gói cước (hoặc hủy kích hoạt nếu đã có giao dịch sử dụng)
 */
exports.deletePlan = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await Plan.findById(id);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Gói cước không tồn tại"
      });
    }

    // Kiểm tra xem gói cước đã được liên kết với Transaction hoặc Subscription nào chưa
    const isReferencedInTx = await Transaction.exists({ plan: id });
    const isReferencedInSub = await Subscription.exists({ plan: id });

    if (isReferencedInTx || isReferencedInSub) {
      // Gói cước đã có giao dịch -> deactive thay vì xóa vật lý
      plan.isActive = false;
      await plan.save();
      return res.json({
        success: true,
        message: "Gói cước đã có lịch sử giao dịch sử dụng. Hệ thống tự động chuyển trạng thái ngưng hoạt động (deactivate) thay vì xóa.",
        data: plan
      });
    }

    // Chưa được sử dụng -> xóa vật lý an toàn
    await Plan.findByIdAndDelete(id);
    return res.json({
      success: true,
      message: "Xóa gói cước thành công."
    });
  } catch (error) {
    console.error("Admin delete plan error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể xóa gói cước",
      error: error.message
    });
  }
};

/**
 * Xem lịch sử các giao dịch thanh toán
 */
exports.getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, paymentMethod, search } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      // Tìm các user có tên hoặc email trùng khớp search query
      const users = await User.find({
        $or: [
          { name: { $regex: searchRegex } },
          { email: { $regex: searchRegex } }
        ]
      }).select("_id");

      const userIds = users.map(u => u._id);
      
      filter.$or = [
        { user: { $in: userIds } },
        { transactionRef: { $regex: searchRegex } }
      ];
    }

    const txs = await Transaction.find(filter)
      .populate("user", "name email avatar")
      .populate("plan", "name price")
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Transaction.countDocuments(filter);

    return res.json({
      success: true,
      data: txs,
      total,
      page: Number(page),
      limit: Number(limit)
    });
  } catch (error) {
    console.error("Admin get transactions error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể tải danh sách giao dịch",
      error: error.message
    });
  }
};

/**
 * Xem lịch sử các Subscription Premium
 */
exports.getSubscriptions = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const filter = {};

    if (status) filter.status = status;

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      const users = await User.find({
        $or: [
          { name: { $regex: searchRegex } },
          { email: { $regex: searchRegex } }
        ]
      }).select("_id");

      const userIds = users.map(u => u._id);
      filter.user = { $in: userIds };
    }

    const subs = await Subscription.find(filter)
      .populate("user", "name email avatar")
      .populate("plan", "name durationInDays")
      .populate("transaction", "transactionRef amount paymentMethod status")
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await Subscription.countDocuments(filter);

    return res.json({
      success: true,
      data: subs,
      total,
      page: Number(page),
      limit: Number(limit)
    });
  } catch (error) {
    console.error("Admin get subscriptions error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể tải danh sách Subscription",
      error: error.message
    });
  }
};

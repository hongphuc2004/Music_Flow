const express = require("express");
const adminPremiumController = require("../controllers/admin-premium.controller");
const authMiddleware = require("../middleware/auth.middleware");
const User = require("../models/user.model");

const router = express.Router();

// Middleware kiểm tra quyền admin
const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select("role");
    if (!user || user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Quyền truy cập bị từ chối. Chỉ dành cho Admin."
      });
    }
    next();
  } catch (error) {
    console.error("Require admin check error:", error);
    res.status(500).json({ success: false, message: "Lỗi kiểm tra quyền Admin" });
  }
};

// Yêu cầu xác thực tài khoản & phân quyền quản trị viên cho tất cả các endpoint bên dưới
router.use(authMiddleware);
router.use(requireAdmin);

// Thống kê doanh thu & người dùng
router.get("/stats", adminPremiumController.getStats);

// CRUD Plans
router.get("/plans", adminPremiumController.getPlans);
router.post("/plans", adminPremiumController.createPlan);
router.put("/plans/:id", adminPremiumController.updatePlan);
router.delete("/plans/:id", adminPremiumController.deletePlan);

// Transactions & Subscriptions lists
router.get("/transactions", adminPremiumController.getTransactions);
router.get("/subscriptions", adminPremiumController.getSubscriptions);

module.exports = router;

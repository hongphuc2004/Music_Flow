const express = require("express");
const adminAdController = require("../controllers/admin-ad.controller");
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
        message: "Quyền truy cập bị từ chối. Chỉ dành cho Admin.",
      });
    }
    next();
  } catch (error) {
    console.error("Require admin check error:", error);
    res.status(500).json({ success: false, message: "Lỗi kiểm tra quyền Admin" });
  }
};

// Yêu cầu xác thực tài khoản & phân quyền admin cho tất cả các endpoint bên dưới
router.use(authMiddleware);
router.use(requireAdmin);

// Thống kê tổng quan
router.get("/stats/overview", adminAdController.getOverviewStats);

// CRUD Quảng cáo
router.get("/", adminAdController.getAds);
router.get("/:id", adminAdController.getAdById);
router.post("/", adminAdController.createAd);
router.put("/:id", adminAdController.updateAd);
router.patch("/:id/toggle", adminAdController.toggleAdStatus);
router.delete("/:id", adminAdController.deleteAd);

module.exports = router;

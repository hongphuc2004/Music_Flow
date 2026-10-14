const express = require("express");
const router = express.Router();
const adController = require("../controllers/ad.controller");

// Kiểm tra quyền và lấy quảng cáo âm thanh tiếp theo (nếu đủ điều kiện)
router.post("/check-next", adController.checkNextAd);

// Lấy danh sách banner quảng cáo cho UI (chỉ trả về cho tài khoản basic)
router.get("/banners", adController.getBannerAds);

// Tracking lượt hiển thị / nghe
router.post("/:id/impression", adController.recordImpression);

// Tracking lượt click
router.post("/:id/click", adController.recordClick);

module.exports = router;

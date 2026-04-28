const express = require("express");
const router = express.Router();
const aiController = require("../controllers/ai.controller");
const authMiddleware = require("../middleware/auth.middleware");

// route: POST /api/ai/playlist
// Cần authMiddleware nếu bạn muốn chỉ user đăng nhập mới được dùng
router.post("/playlist", authMiddleware, aiController.aiPlaylist);

module.exports = router;
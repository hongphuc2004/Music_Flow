const express = require("express");
const router = express.Router();

const Song = require("../models/song.model");
const authMiddleware = require("../middleware/auth.middleware");

// Lấy tổng like cho bài hát (isLiked không lưu DB, quản lý phía client)
router.get("/status/:songId", authMiddleware, async (req, res) => {
  try {
    const { songId } = req.params;

    const song = await Song.findById(songId).select("_id likeCount");
    if (!song) {
      return res.status(404).json({
        success: false,
        message: "Bai hat khong ton tai",
      });
    }

    res.json({
      success: true,
      isLiked: false,
      likeCount: song.likeCount || 0,
    });
  } catch (error) {
    console.error("Get like status error:", error);
    res.status(500).json({
      success: false,
      message: "Khong the lay trang thai like",
      error: error.message,
    });
  }
});

// Tăng/giảm likeCount trực tiếp trên Song (liked: true = thích, false = bỏ thích)
router.post("/toggle/:songId", authMiddleware, async (req, res) => {
  try {
    const { songId } = req.params;
    const { liked } = req.body;

    const song = await Song.findById(songId);
    if (!song) {
      return res.status(404).json({
        success: false,
        message: "Bai hat khong ton tai",
      });
    }

    if (liked) {
      song.likeCount = (song.likeCount || 0) + 1;
    } else {
      song.likeCount = Math.max(0, (song.likeCount || 0) - 1);
    }

    await song.save();

    res.json({
      success: true,
      isLiked: !!liked,
      likeCount: song.likeCount,
      message: liked ? "Da thich bai hat" : "Da bo thich bai hat",
    });
  } catch (error) {
    console.error("Toggle like error:", error);
    res.status(500).json({
      success: false,
      message: "Khong the cap nhat luot thich",
      error: error.message,
    });
  }
});

module.exports = router;

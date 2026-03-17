const express = require("express");
const router = express.Router();

const SongLike = require("../models/song-like.model");
const Song = require("../models/song.model");
const authMiddleware = require("../middleware/auth.middleware");

// Lấy trạng thái like + tổng like cho bài hát
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

    const liked = await SongLike.findOne({ userId: req.userId, songId });

    res.json({
      success: true,
      isLiked: !!liked,
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

// Toggle like cho bài hát
router.post("/toggle/:songId", authMiddleware, async (req, res) => {
  try {
    const { songId } = req.params;

    const song = await Song.findById(songId);
    if (!song) {
      return res.status(404).json({
        success: false,
        message: "Bai hat khong ton tai",
      });
    }

    const existing = await SongLike.findOne({ userId: req.userId, songId });

    let isLiked;
    if (existing) {
      await SongLike.findByIdAndDelete(existing._id);
      song.likeCount = Math.max(0, (song.likeCount || 0) - 1);
      isLiked = false;
    } else {
      await SongLike.create({ userId: req.userId, songId });
      song.likeCount = (song.likeCount || 0) + 1;
      isLiked = true;
    }

    await song.save();

    res.json({
      success: true,
      isLiked,
      likeCount: song.likeCount || 0,
      message: isLiked ? "Da thich bai hat" : "Da bo thich bai hat",
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

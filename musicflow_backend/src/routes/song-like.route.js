const express = require("express");
const router = express.Router();

const Song = require("../models/song.model");
const Favorite = require("../models/favorite.model");
const authMiddleware = require("../middleware/auth.middleware");

// Lấy tổng like và trạng thái đã like cho bài hát (Hỗ trợ Mobile Flutter)
router.get("/status/:songId", authMiddleware, async (req, res) => {
  try {
    const { songId } = req.params;

    const [song, existingFav] = await Promise.all([
      Song.findById(songId).select("_id likeCount"),
      Favorite.findOne({ userId: req.userId, songId }),
    ]);

    if (!song) {
      return res.status(404).json({
        success: false,
        message: "Bai hat khong ton tai",
      });
    }

    res.json({
      success: true,
      isLiked: !!existingFav,
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

// Toggle trạng thái like (Đồng bộ trực tiếp với Favorite collection cho Mobile Flutter)
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

    const existingFav = await Favorite.findOne({ userId: req.userId, songId });
    let isLikedNow;

    if (typeof liked === "boolean") {
      isLikedNow = liked;
      if (liked) {
        await Favorite.updateOne(
          { userId: req.userId, songId },
          { $setOnInsert: { userId: req.userId, songId } },
          { upsert: true }
        );
      } else {
        await Favorite.deleteOne({ userId: req.userId, songId });
      }
    } else {
      // Nếu client không gửi liked boolean, tự toggle theo trạng thái hiện tại
      if (existingFav) {
        await Favorite.deleteOne({ userId: req.userId, songId });
        isLikedNow = false;
      } else {
        await Favorite.create({ userId: req.userId, songId });
        isLikedNow = true;
      }
    }

    // Đồng bộ lại likeCount tuyệt đối cho bài hát
    const exactLikeCount = await Favorite.countDocuments({ songId });
    await Song.updateOne({ _id: songId }, { $set: { likeCount: exactLikeCount } });

    res.json({
      success: true,
      isLiked: isLikedNow,
      likeCount: exactLikeCount,
      message: isLikedNow ? "Da thich bai hat" : "Da bo thich bai hat",
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

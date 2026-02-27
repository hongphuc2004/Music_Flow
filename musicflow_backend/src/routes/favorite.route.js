const express = require("express");
const router = express.Router();
const Favorite = require("../models/favorite.model");
const Song = require("../models/song.model");
const authRoute = require("./auth.route");

// Sử dụng auth middleware từ auth.route
const authMiddleware = authRoute.authMiddleware;

// =================================================
// 📋 GET FAVORITE SONGS - Lấy danh sách bài hát yêu thích
router.get("/", authMiddleware, async (req, res) => {
  try {
    const favorites = await Favorite.find({ userId: req.userId })
      .populate("songId")
      .sort({ createdAt: -1 });

    // Trả về danh sách songs
    const songs = favorites
      .filter(fav => fav.songId != null)  // Lọc bỏ song đã bị xóa
      .map(fav => fav.songId);

    res.json({
      success: true,
      favorites: songs,
    });
  } catch (error) {
    console.error("Get favorites error:", error);
    res.status(500).json({
      success: false,
      message: "Lấy danh sách yêu thích thất bại",
      error: error.message,
    });
  }
});

// =================================================
// ➕ ADD TO FAVORITES - Thêm bài hát vào yêu thích
router.post("/add/:songId", authMiddleware, async (req, res) => {
  try {
    const { songId } = req.params;

    // Kiểm tra bài hát có tồn tại không
    const song = await Song.findById(songId);
    if (!song) {
      return res.status(404).json({
        success: false,
        message: "Bài hát không tồn tại",
      });
    }

    // Kiểm tra đã có trong favorites chưa
    const existingFav = await Favorite.findOne({ 
      userId: req.userId, 
      songId: songId 
    });

    if (existingFav) {
      return res.status(400).json({
        success: false,
        message: "Bài hát đã có trong danh sách yêu thích",
      });
    }

    // Thêm vào favorites
    const favorite = await Favorite.create({
      userId: req.userId,
      songId: songId,
    });

    res.json({
      success: true,
      message: "Đã thêm vào danh sách yêu thích",
      favorite,
    });
  } catch (error) {
    console.error("Add favorite error:", error);
    res.status(500).json({
      success: false,
      message: "Thêm yêu thích thất bại",
      error: error.message,
    });
  }
});

// =================================================
// ➖ REMOVE FROM FAVORITES - Xóa bài hát khỏi yêu thích
router.delete("/remove/:songId", authMiddleware, async (req, res) => {
  try {
    const { songId } = req.params;

    const result = await Favorite.findOneAndDelete({
      userId: req.userId,
      songId: songId,
    });

    if (!result) {
      return res.status(400).json({
        success: false,
        message: "Bài hát không có trong danh sách yêu thích",
      });
    }

    res.json({
      success: true,
      message: "Đã xóa khỏi danh sách yêu thích",
    });
  } catch (error) {
    console.error("Remove favorite error:", error);
    res.status(500).json({
      success: false,
      message: "Xóa yêu thích thất bại",
      error: error.message,
    });
  }
});

// =================================================
// 🔄 TOGGLE FAVORITE - Toggle trạng thái yêu thích
router.post("/toggle/:songId", authMiddleware, async (req, res) => {
  try {
    const { songId } = req.params;
    console.log("🔄 Toggle favorite - userId:", req.userId, "songId:", songId);

    // Kiểm tra bài hát có tồn tại không
    const song = await Song.findById(songId);
    if (!song) {
      console.log("❌ Song not found:", songId);
      return res.status(404).json({
        success: false,
        message: "Bài hát không tồn tại",
      });
    }

    // Kiểm tra đã có trong favorites chưa
    const existingFav = await Favorite.findOne({
      userId: req.userId,
      songId: songId,
    });
    console.log("📦 Existing favorite:", existingFav);

    let isFavorite;

    if (existingFav) {
      // Đã có -> xóa đi
      await Favorite.findByIdAndDelete(existingFav._id);
      isFavorite = false;
      console.log("🗑️ Removed favorite");
    } else {
      // Chưa có -> thêm vào
      const newFav = await Favorite.create({
        userId: req.userId,
        songId: songId,
      });
      isFavorite = true;
      console.log("✅ Added favorite:", newFav);
    }

    res.json({
      success: true,
      message: isFavorite ? "Đã thêm vào yêu thích" : "Đã xóa khỏi yêu thích",
      isFavorite,
    });
  } catch (error) {
    console.error("Toggle favorite error:", error);
    res.status(500).json({
      success: false,
      message: "Toggle yêu thích thất bại",
      error: error.message,
    });
  }
});

// =================================================
// ✅ CHECK IF FAVORITE - Kiểm tra bài hát có trong yêu thích không
router.get("/check/:songId", authMiddleware, async (req, res) => {
  try {
    const { songId } = req.params;

    const favorite = await Favorite.findOne({
      userId: req.userId,
      songId: songId,
    });

    res.json({
      success: true,
      isFavorite: !!favorite,
    });
  } catch (error) {
    console.error("Check favorite error:", error);
    res.status(500).json({
      success: false,
      message: "Kiểm tra yêu thích thất bại",
      error: error.message,
    });
  }
});

module.exports = router;

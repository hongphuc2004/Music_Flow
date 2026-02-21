const express = require("express");
const router = express.Router();
const Playlist = require("../models/playlist.model");
const User = require("../models/user.model");
const authMiddleware = require("../middleware/auth.middleware");

// ================= GET ALL PLAYLISTS (của user hiện tại) =================
router.get("/", authMiddleware, async (req, res) => {
  try {
    const playlists = await Playlist.find({ userId: req.userId })
      .populate("songs")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      playlists,
    });
  } catch (error) {
    console.error("Get playlists error:", error);
    res.status(500).json({
      success: false,
      message: "Lấy danh sách playlist thất bại",
      error: error.message,
    });
  }
});

// ================= GET SINGLE PLAYLIST =================
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id)
      .populate("songs")
      .populate("userId", "name email");

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist không tồn tại",
      });
    }

    // Kiểm tra quyền truy cập (chỉ chủ sở hữu hoặc playlist public)
    if (playlist.userId._id.toString() !== req.userId && !playlist.isPublic) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền truy cập playlist này",
      });
    }

    res.json({
      success: true,
      playlist,
    });
  } catch (error) {
    console.error("Get playlist error:", error);
    res.status(500).json({
      success: false,
      message: "Lấy playlist thất bại",
      error: error.message,
    });
  }
});

// ================= CREATE PLAYLIST =================
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { name, description, isPublic, coverImage } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Tên playlist là bắt buộc",
      });
    }

    const playlist = await Playlist.create({
      name,
      description: description || "",
      userId: req.userId,
      isPublic: isPublic || false,
      coverImage: coverImage || "",
      songs: [],
    });

    // Thêm playlist ID vào user
    await User.findByIdAndUpdate(req.userId, {
      $push: { playlists: playlist._id },
    });

    res.status(201).json({
      success: true,
      message: "Tạo playlist thành công",
      playlist,
    });
  } catch (error) {
    console.error("Create playlist error:", error);
    res.status(500).json({
      success: false,
      message: "Tạo playlist thất bại",
      error: error.message,
    });
  }
});

// ================= UPDATE PLAYLIST (tên, mô tả, ảnh bìa, public/private) =================
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { name, description, isPublic, coverImage } = req.body;

    const playlist = await Playlist.findById(req.params.id);

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist không tồn tại",
      });
    }

    // Kiểm tra quyền sở hữu
    if (playlist.userId.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền chỉnh sửa playlist này",
      });
    }

    // Cập nhật các trường được gửi lên
    if (name !== undefined) playlist.name = name;
    if (description !== undefined) playlist.description = description;
    if (isPublic !== undefined) playlist.isPublic = isPublic;
    if (coverImage !== undefined) playlist.coverImage = coverImage;

    await playlist.save();
    await playlist.populate("songs");

    res.json({
      success: true,
      message: "Cập nhật playlist thành công",
      playlist,
    });
  } catch (error) {
    console.error("Update playlist error:", error);
    res.status(500).json({
      success: false,
      message: "Cập nhật playlist thất bại",
      error: error.message,
    });
  }
});

// ================= DELETE PLAYLIST =================
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist không tồn tại",
      });
    }

    // Kiểm tra quyền sở hữu
    if (playlist.userId.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xóa playlist này",
      });
    }

    // Xóa playlist ID khỏi user
    await User.findByIdAndUpdate(req.userId, {
      $pull: { playlists: playlist._id },
    });

    await Playlist.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Xóa playlist thành công",
    });
  } catch (error) {
    console.error("Delete playlist error:", error);
    res.status(500).json({
      success: false,
      message: "Xóa playlist thất bại",
      error: error.message,
    });
  }
});

// ================= ADD SONG TO PLAYLIST =================
router.post("/:id/songs", authMiddleware, async (req, res) => {
  try {
    const { songId } = req.body;

    if (!songId) {
      return res.status(400).json({
        success: false,
        message: "Song ID là bắt buộc",
      });
    }

    const playlist = await Playlist.findById(req.params.id);

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist không tồn tại",
      });
    }

    // Kiểm tra quyền sở hữu
    if (playlist.userId.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền thêm bài hát vào playlist này",
      });
    }

    // Kiểm tra bài hát đã có trong playlist chưa
    if (playlist.songs.includes(songId)) {
      return res.status(400).json({
        success: false,
        message: "Bài hát đã có trong playlist",
      });
    }

    playlist.songs.push(songId);
    await playlist.save();
    await playlist.populate("songs");

    res.json({
      success: true,
      message: "Thêm bài hát vào playlist thành công",
      playlist,
    });
  } catch (error) {
    console.error("Add song to playlist error:", error);
    res.status(500).json({
      success: false,
      message: "Thêm bài hát thất bại",
      error: error.message,
    });
  }
});

// ================= REMOVE SONG FROM PLAYLIST =================
router.delete("/:id/songs/:songId", authMiddleware, async (req, res) => {
  try {
    const { id, songId } = req.params;

    const playlist = await Playlist.findById(id);

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist không tồn tại",
      });
    }

    // Kiểm tra quyền sở hữu
    if (playlist.userId.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xóa bài hát khỏi playlist này",
      });
    }

    // Xóa bài hát khỏi playlist
    playlist.songs = playlist.songs.filter(
      (id) => id.toString() !== songId
    );
    await playlist.save();
    await playlist.populate("songs");

    res.json({
      success: true,
      message: "Xóa bài hát khỏi playlist thành công",
      playlist,
    });
  } catch (error) {
    console.error("Remove song from playlist error:", error);
    res.status(500).json({
      success: false,
      message: "Xóa bài hát thất bại",
      error: error.message,
    });
  }
});

// ================= REORDER SONGS IN PLAYLIST =================
router.put("/:id/reorder", authMiddleware, async (req, res) => {
  try {
    const { songIds } = req.body;

    if (!songIds || !Array.isArray(songIds)) {
      return res.status(400).json({
        success: false,
        message: "Danh sách songIds là bắt buộc",
      });
    }

    const playlist = await Playlist.findById(req.params.id);

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: "Playlist không tồn tại",
      });
    }

    // Kiểm tra quyền sở hữu
    if (playlist.userId.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền sắp xếp lại playlist này",
      });
    }

    playlist.songs = songIds;
    await playlist.save();
    await playlist.populate("songs");

    res.json({
      success: true,
      message: "Sắp xếp lại playlist thành công",
      playlist,
    });
  } catch (error) {
    console.error("Reorder playlist error:", error);
    res.status(500).json({
      success: false,
      message: "Sắp xếp lại thất bại",
      error: error.message,
    });
  }
});

module.exports = router;

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");
const cloudinary = require("../config/cloudinary");
const User = require("../models/user.model");
const Song = require("../models/song.model");
const Playlist = require("../models/playlist.model");
const PlaylistSong = require("../models/playlist-song.model");
const Topic = require("../models/topic.model");
const authMiddleware = require("../middleware/auth.middleware");

// Multer config for image upload
const upload = multer({ dest: "uploads/" });

const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select("role");
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }
    next();
  } catch (error) {
    console.error("Admin role check error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const parseSongsField = (songsField) => {
  if (Array.isArray(songsField)) {
    return songsField;
  }

  if (typeof songsField === "string") {
    const trimmed = songsField.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  return [];
};

const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || "").trim());

const safeUnlink = (filePath) => {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("Failed to remove temp file:", error.message);
  }
};

// ================= ADMIN AUTH =================
// Admin login (dùng email/password hoặc tạo admin account riêng)
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Tìm user với email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Kiểm tra password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Kiểm tra quyền admin
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admin only." });
    }

    // Tạo JWT token cho admin
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= DASHBOARD STATS =================
router.get("/stats/dashboard", async (req, res) => {
  try {
    const [totalUsers, totalSongs, totalPlaylists] = await Promise.all([
      User.countDocuments(),
      Song.countDocuments(),
      Playlist.countDocuments(),
    ]);

    // Users đăng ký trong 30 ngày qua
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newUsers = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    // Recent users
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name email avatar createdAt");

    // Recent songs
    const recentSongs = await Song.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("title artist imageUrl createdAt");

    res.json({
      stats: {
        totalUsers,
        totalSongs,
        totalPlaylists,
        newUsers,
      },
      recentUsers,
      recentSongs,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= USERS MANAGEMENT =================
// Get all users with pagination
router.get("/users", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const skip = (page - 1) * limit;

    const query = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-password"),
      User.countDocuments(query),
    ]);

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get single user
router.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")
      .populate("favoriteSongs")
      .populate("playlists");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete user
router.delete("/users/:id", async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Also delete user's playlists
    await Playlist.deleteMany({ userId: req.params.id });

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update user role
router.patch("/users/:id/role", async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "Role updated successfully", user });
  } catch (error) {
    console.error("Update role error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= SONGS MANAGEMENT =================
// Get all songs with pagination
router.get("/songs", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const skip = (page - 1) * limit;

    const query = search
      ? {
          $or: [
            { title: { $regex: search, $options: "i" } },
            { artist: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const [songs, total] = await Promise.all([
      Song.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("uploadedBy", "name email")
        .populate("topicId", "name"),
      Song.countDocuments(query),
    ]);

    res.json({
      songs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get songs error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Create song (with audio + optional image upload)
router.post(
  "/songs",
  upload.fields([
    { name: "audio", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  async (req, res) => {
    const audioFile = req.files?.audio?.[0] || null;
    const imageFile = req.files?.image?.[0] || null;

    try {
      const { title, artist, topicId, lyrics, isPublic } = req.body;

      if (!title || !artist) {
        return res.status(400).json({
          message: "Missing required fields (title, artist)",
        });
      }

      if (!audioFile) {
        return res.status(400).json({
          message: "Audio file is required",
        });
      }

      const audioUpload = await cloudinary.uploader.upload(audioFile.path, {
        resource_type: "video",
        folder: "musicflow/audio",
      });

      let imageUrl =
        "https://res.cloudinary.com/dvhpcqpkq/image/upload/v1735403257/musicflow/images/tgdfbp3zivuqoxqxpltj.jpg";
      let imagePublicId = null;

      if (imageFile) {
        const imageUpload = await cloudinary.uploader.upload(imageFile.path, {
          folder: "musicflow/images",
        });
        imageUrl = imageUpload.secure_url;
        imagePublicId = imageUpload.public_id;
      }

      const songData = {
        title,
        artist,
        lyrics: lyrics || "",
        isPublic: isPublic === "true" || isPublic === true,
        audioUrl: audioUpload.secure_url,
        audioPublicId: audioUpload.public_id,
        duration: audioUpload.duration,
        imageUrl,
        imagePublicId,
        source: "admin",
        uploadedBy: null,
      };

      if (topicId) {
        songData.topicId = topicId;
      }

      const song = await Song.create(songData);

      res.status(201).json({
        message: "Song created successfully",
        song,
      });
    } catch (error) {
      console.error("Create song error:", error);
      res.status(500).json({ message: "Server error" });
    } finally {
      safeUnlink(audioFile?.path);
      safeUnlink(imageFile?.path);
    }
  }
);

// Update song (metadata + optional audio/image upload)
router.put(
  "/songs/:id",
  upload.fields([
    { name: "audio", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  async (req, res) => {
    const audioFile = req.files?.audio?.[0] || null;
    const imageFile = req.files?.image?.[0] || null;

    try {
      const song = await Song.findById(req.params.id);
      if (!song) {
        return res.status(404).json({ message: "Song not found" });
      }

      const { title, artist, topicId, lyrics, isPublic } = req.body;

      if (typeof title !== "undefined") {
        song.title = String(title).trim();
      }

      if (typeof artist !== "undefined") {
        song.artist = String(artist).trim();
      }

      if (typeof lyrics !== "undefined") {
        song.lyrics = lyrics;
      }

      if (typeof isPublic !== "undefined") {
        song.isPublic = isPublic === "true" || isPublic === true;
      }

      if (typeof topicId !== "undefined") {
        song.topicId = topicId ? topicId : null;
      }

      if (audioFile) {
        const audioUpload = await cloudinary.uploader.upload(audioFile.path, {
          resource_type: "video",
          folder: "musicflow/audio",
        });
        song.audioUrl = audioUpload.secure_url;
        song.audioPublicId = audioUpload.public_id;
        song.duration = audioUpload.duration;
      }

      if (imageFile) {
        const imageUpload = await cloudinary.uploader.upload(imageFile.path, {
          folder: "musicflow/images",
        });
        song.imageUrl = imageUpload.secure_url;
        song.imagePublicId = imageUpload.public_id;
      }

      await song.save();

      res.json({
        message: "Song updated successfully",
        song,
      });
    } catch (error) {
      console.error("Update song error:", error);
      res.status(500).json({ message: "Server error" });
    } finally {
      safeUnlink(audioFile?.path);
      safeUnlink(imageFile?.path);
    }
  }
);

// Delete song
router.delete("/songs/:id", async (req, res) => {
  try {
    const song = await Song.findByIdAndDelete(req.params.id);
    if (!song) {
      return res.status(404).json({ message: "Song not found" });
    }

    res.json({ message: "Song deleted successfully" });
  } catch (error) {
    console.error("Delete song error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update song visibility
router.patch("/songs/:id/visibility", async (req, res) => {
  try {
    const { isPublic } = req.body;
    const song = await Song.findByIdAndUpdate(
      req.params.id,
      { isPublic },
      { new: true }
    );

    if (!song) {
      return res.status(404).json({ message: "Song not found" });
    }

    res.json(song);
  } catch (error) {
    console.error("Update song visibility error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= PLAYLISTS MANAGEMENT =================
// Get all system playlists with pagination
router.get("/playlists", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const skip = (page - 1) * limit;

    const query = search
      ? { name: { $regex: search, $options: "i" } }
      : {};

    const [playlists, total] = await Promise.all([
      PlaylistSong.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "name email")
        .populate("songs", "title artist imageUrl"),
      PlaylistSong.countDocuments(query),
    ]);

    res.json({
      playlists,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get playlists error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get single system playlist
router.get("/playlists/:id", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const playlist = await PlaylistSong.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("songs", "title artist imageUrl");

    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    res.json(playlist);
  } catch (error) {
    console.error("Get playlist detail error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Create system playlist
router.post("/playlists", authMiddleware, requireAdmin, upload.single("coverImageFile"), async (req, res) => {
  const coverImageFile = req.file || null;
  try {
    const { name, description, isPublic, coverImage, songs } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Playlist name is required" });
    }

    let finalCoverImage = coverImage ? String(coverImage).trim() : "";
    if (coverImageFile) {
      const uploadResult = await cloudinary.uploader.upload(coverImageFile.path, {
        folder: "musicflow/playlists",
      });
      finalCoverImage = uploadResult.secure_url;
    } else if (isHttpUrl(finalCoverImage) && !finalCoverImage.includes("res.cloudinary.com")) {
      try {
        const uploadResult = await cloudinary.uploader.upload(finalCoverImage, {
          folder: "musicflow/playlists",
        });
        finalCoverImage = uploadResult.secure_url;
      } catch (error) {
        return res.status(400).json({
          message: "Cover image URL is invalid or cannot be accessed",
        });
      }
    }

    const playlist = await PlaylistSong.create({
      name: String(name).trim(),
      description: description ? String(description).trim() : "",
      isPublic: isPublic === true || isPublic === "true",
      coverImage: finalCoverImage,
      songs: parseSongsField(songs),
      createdBy: req.userId,
    });

    const populatedPlaylist = await PlaylistSong.findById(playlist._id)
      .populate("createdBy", "name email")
      .populate("songs", "title artist imageUrl");

    res.status(201).json(populatedPlaylist);
  } catch (error) {
    console.error("Create playlist error:", error);
    res.status(500).json({ message: "Server error" });
  } finally {
    safeUnlink(coverImageFile?.path);
  }
});

// Update system playlist
router.put("/playlists/:id", authMiddleware, requireAdmin, upload.single("coverImageFile"), async (req, res) => {
  const coverImageFile = req.file || null;
  try {
    const { name, description, isPublic, coverImage, songs } = req.body;

    const updateData = {};
    if (typeof name !== "undefined") {
      updateData.name = String(name).trim();
    }
    if (typeof description !== "undefined") {
      updateData.description = String(description).trim();
    }
    if (typeof coverImage !== "undefined") {
      updateData.coverImage = String(coverImage).trim();

      if (
        isHttpUrl(updateData.coverImage) &&
        !updateData.coverImage.includes("res.cloudinary.com")
      ) {
        try {
          const uploadResult = await cloudinary.uploader.upload(updateData.coverImage, {
            folder: "musicflow/playlists",
          });
          updateData.coverImage = uploadResult.secure_url;
        } catch (error) {
          return res.status(400).json({
            message: "Cover image URL is invalid or cannot be accessed",
          });
        }
      }
    }
    if (coverImageFile) {
      const uploadResult = await cloudinary.uploader.upload(coverImageFile.path, {
        folder: "musicflow/playlists",
      });
      updateData.coverImage = uploadResult.secure_url;
    }
    if (typeof songs !== "undefined") {
      updateData.songs = parseSongsField(songs);
    }
    if (typeof isPublic !== "undefined") {
      updateData.isPublic = isPublic === true || isPublic === "true";
    }

    const playlist = await PlaylistSong.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
      .populate("createdBy", "name email")
      .populate("songs", "title artist imageUrl");

    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    res.json(playlist);
  } catch (error) {
    console.error("Update playlist error:", error);
    res.status(500).json({ message: "Server error" });
  } finally {
    safeUnlink(coverImageFile?.path);
  }
});

// Delete system playlist
router.delete("/playlists/:id", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const playlist = await PlaylistSong.findByIdAndDelete(req.params.id);
    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    res.json({ message: "Playlist deleted successfully" });
  } catch (error) {
    console.error("Delete playlist error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ================= TOPICS MANAGEMENT =================
// Get all topics
router.get("/topics", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const skip = (page - 1) * limit;

    const query = search
      ? { name: { $regex: search, $options: "i" } }
      : {};

    const [topics, total] = await Promise.all([
      Topic.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Topic.countDocuments(query),
    ]);

    // Get song count for each topic
    const topicsWithCount = await Promise.all(
      topics.map(async (topic) => {
        const songCount = await Song.countDocuments({ topicId: topic._id });
        return { ...topic.toObject(), songCount };
      })
    );

    res.json({
      topics: topicsWithCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get topics error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Create topic (with avatar upload)
router.post("/topics", upload.single("avatar"), async (req, res) => {
  try {
    const { name, description, avatarUrl } = req.body;
    let avatar = "";
    let songs = [];
    if (req.body.songs) {
      try {
        songs = JSON.parse(req.body.songs);
      } catch {}
    }

    // Ưu tiên file upload
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "musicflow/topics",
        transformation: [{ width: 500, height: 500, crop: "fill" }],
      });
      avatar = result.secure_url;
      fs.unlinkSync(req.file.path);
    } else if (avatarUrl && /^https?:\/\//i.test(avatarUrl.trim())) {
      // Nếu có avatarUrl là URL, upload lên Cloudinary
      const result = await cloudinary.uploader.upload(avatarUrl.trim(), {
        folder: "musicflow/topics",
        transformation: [{ width: 500, height: 500, crop: "fill" }],
      });
      avatar = result.secure_url;
    }

    const topic = new Topic({ name, description, avatar });
    await topic.save();

    // Gán topicId cho các bài hát đã chọn
    if (Array.isArray(songs) && songs.length > 0) {
      await Song.updateMany({ _id: { $in: songs } }, { topicId: topic._id });
    }

    res.status(201).json(topic);
  } catch (error) {
    console.error("Create topic error:", error);
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: "Server error" });
  }
});

// Update topic (with avatar upload)
router.put("/topics/:id", upload.single("avatar"), async (req, res) => {
  try {
    const { name, description, avatarUrl } = req.body;
    const updateData = { name, description };
    let songs = [];
    if (req.body.songs) {
      try {
        songs = JSON.parse(req.body.songs);
      } catch {}
    }

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "musicflow/topics",
        transformation: [{ width: 500, height: 500, crop: "fill" }],
      });
      updateData.avatar = result.secure_url;
      fs.unlinkSync(req.file.path);
    } else if (avatarUrl && /^https?:\/\//i.test(avatarUrl.trim())) {
      const result = await cloudinary.uploader.upload(avatarUrl.trim(), {
        folder: "musicflow/topics",
        transformation: [{ width: 500, height: 500, crop: "fill" }],
      });
      updateData.avatar = result.secure_url;
    }

    const topic = await Topic.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!topic) {
      return res.status(404).json({ message: "Topic not found" });
    }

    // Clear topicId cho các bài hát cũ không còn thuộc topic này
    await Song.updateMany({ topicId: topic._id, _id: { $nin: songs } }, { topicId: null });
    // Gán topicId cho các bài hát mới được chọn
    if (Array.isArray(songs) && songs.length > 0) {
      await Song.updateMany({ _id: { $in: songs } }, { topicId: topic._id });
    }

    res.json(topic);
  } catch (error) {
    console.error("Update topic error:", error);
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete topic
router.delete("/topics/:id", async (req, res) => {
  try {
    const topic = await Topic.findByIdAndDelete(req.params.id);
    if (!topic) {
      return res.status(404).json({ message: "Topic not found" });
    }

    // Set topicId to null for songs with this topic
    await Song.updateMany({ topicId: req.params.id }, { topicId: null });

    res.json({ message: "Topic deleted successfully" });
  } catch (error) {
    console.error("Delete topic error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Lấy danh sách bài hát thuộc topic
router.get("/topics/:id/songs", async (req, res) => {
  try {
    const topicId = req.params.id;
    const songs = await Song.find({ topicId: topicId });
    res.json({ songs });
  } catch (error) {
    console.error("Get songs by topic error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

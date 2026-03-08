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
const Topic = require("../models/topic.model");
const authMiddleware = require("../middleware/auth.middleware");

// Multer config for image upload
const upload = multer({ dest: "uploads/" });

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
// Get all playlists with pagination
router.get("/playlists", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const skip = (page - 1) * limit;

    const query = search
      ? { name: { $regex: search, $options: "i" } }
      : {};

    const [playlists, total] = await Promise.all([
      Playlist.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "name email"),
      Playlist.countDocuments(query),
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

// Delete playlist
router.delete("/playlists/:id", async (req, res) => {
  try {
    const playlist = await Playlist.findByIdAndDelete(req.params.id);
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
    const { name, description } = req.body;
    let avatar = "";

    // Upload avatar to Cloudinary if file provided
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "musicflow/topics",
        transformation: [{ width: 500, height: 500, crop: "fill" }],
      });
      avatar = result.secure_url;
      // Clean up temp file
      fs.unlinkSync(req.file.path);
    }

    const topic = new Topic({ name, description, avatar });
    await topic.save();
    res.status(201).json(topic);
  } catch (error) {
    console.error("Create topic error:", error);
    // Clean up temp file on error
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: "Server error" });
  }
});

// Update topic (with avatar upload)
router.put("/topics/:id", upload.single("avatar"), async (req, res) => {
  try {
    const { name, description } = req.body;
    const updateData = { name, description };

    // Upload new avatar to Cloudinary if file provided
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "musicflow/topics",
        transformation: [{ width: 500, height: 500, crop: "fill" }],
      });
      updateData.avatar = result.secure_url;
      // Clean up temp file
      fs.unlinkSync(req.file.path);
    }

    const topic = await Topic.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!topic) {
      return res.status(404).json({ message: "Topic not found" });
    }

    res.json(topic);
  } catch (error) {
    console.error("Update topic error:", error);
    // Clean up temp file on error
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

module.exports = router;

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

const Artist = require("../models/artist.model");

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
  }
};

const parseArtistNames = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const resolveArtistIds = async (artistValue) => {
  const artistNames = parseArtistNames(artistValue);
  if (artistNames.length === 0) return [];

  const conditions = artistNames.map((name) => ({
    name: { $regex: new RegExp(`^${escapeRegex(name)}$`, "i") },
  }));

  const artists = await Artist.find({ $or: conditions }).select("_id");
  return artists.map((artist) => artist._id);
};

const serializeAdminSong = (song) => {
  const plainSong = song.toObject ? song.toObject() : song;
  const artistNames = Array.isArray(plainSong.artists)
    ? plainSong.artists
        .map((artist) => (artist && typeof artist === "object" ? artist.name : ""))
        .filter(Boolean)
    : [];
  const topics = Array.isArray(plainSong.topicIds) ? plainSong.topicIds : [];

  return {
    ...plainSong,
    artist: artistNames.join(", "),
    artists: plainSong.artists,
    topicId: topics[0] || null,
    topicIds: topics,
  };
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
    res.status(500).json({ message: "Server error" });
  }
});

// ================= DASHBOARD STATS =================
router.get("/stats/dashboard", async (req, res) => {
  try {

    // Đếm tất cả user (mọi role) và artist
    const [totalUsers, totalArtists, totalSongs, totalPlaylists] = await Promise.all([
      User.countDocuments(),
      Artist.countDocuments(),
      Song.countDocuments(),
      Playlist.countDocuments(),
    ]);

    // Accounts đăng ký trong 30 ngày qua (mọi role)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const [newUsers, newArtists] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      Artist.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    ]);

    // Recent accounts (user mọi role + artist)
    const [recentUsers, recentArtists] = await Promise.all([
      User.find().sort({ createdAt: -1 }).limit(10).select("name email avatar createdAt role"),
      Artist.find().sort({ createdAt: -1 }).limit(10).select("name email avatar createdAt role"),
    ]);
    // Gắn role cho artist
    const recentArtistsWithRole = recentArtists.map(a => ({ ...a.toObject(), role: "artist" }));
    // Gộp, sort lại theo createdAt, lấy 5 account mới nhất
    const allRecentAccounts = [...recentUsers, ...recentArtistsWithRole]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    // Recent songs
    const recentSongs = await Song.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("title artist imageUrl createdAt");

    res.json({
      stats: {
        totalUsers: totalUsers + totalArtists,
        totalSongs,
        totalPlaylists,
        newUsers: newUsers + newArtists,
      },
      recentAccounts: allRecentAccounts,
      recentSongs,
    });
  } catch (error) {
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
    res.status(500).json({ message: "Server error" });
  }
});

// ================= ACCOUNTS MANAGEMENT (User + Artist) =================
// Get all accounts (users + artists)
router.get("/accounts", async (req, res) => {
  try {
    // Lấy tất cả user (kể cả admin), gắn role rõ ràng
    const users = await User.find().select("-password");
    const userAccounts = users.map(u => ({ ...u.toObject(), role: u.role || "user" }));
    // Lấy tất cả artist, gắn role là artist
    const artists = await Artist.find().select("-password");
    const artistAccounts = artists.map(a => ({ ...a.toObject(), role: "artist" }));
    res.json({ accounts: [...userAccounts, ...artistAccounts] });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// ================= SONGS MANAGEMENT =================
// Get all songs with pagination
router.get("/songs", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = String(req.query.search || "").trim();
    const skip = (page - 1) * limit;

    let query = {};
    if (search) {
      const artistMatches = await Artist.find({
        name: { $regex: search, $options: "i" },
      }).select("_id");
      const artistIds = artistMatches.map((artist) => artist._id);

      query = {
        $or: [
          { title: { $regex: search, $options: "i" } },
          ...(artistIds.length > 0 ? [{ artists: { $in: artistIds } }] : []),
        ],
      };
    }

    const [songs, total] = await Promise.all([
      Song.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("uploadedBy", "name email")
        .populate("artists", "name")
        .populate("topicIds", "name"),
      Song.countDocuments(query),
    ]);

    res.json({
      songs: songs.map(serializeAdminSong),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
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
        const { title, artist, topicId, lyrics, isPublic, imageUrl } = req.body;

        if (!title || !artist) {
          return res.status(400).json({
            message: "Missing required fields (title, artist)",
          });
      }

      // Xử lý audio: ưu tiên file, nếu không có thì lấy URL
      let finalAudioUrl = null;
      let audioPublicId = null;
      let duration = null;
      if (audioFile) {
        const audioUpload = await cloudinary.uploader.upload(audioFile.path, {
          resource_type: "video",
          folder: "musicflow/audio",
        });
        finalAudioUrl = audioUpload.secure_url;
        audioPublicId = audioUpload.public_id;
        duration = audioUpload.duration;
      }

      if (!finalAudioUrl) {
        return res.status(400).json({
          message: "Audio file hoặc Audio URL là bắt buộc",
        });
      }

      // Xử lý image: ưu tiên file, nếu không có thì lấy URL hoặc default
      let finalImageUrl =
        "https://res.cloudinary.com/dvhpcqpkq/image/upload/v1735403257/musicflow/images/tgdfbp3zivuqoxqxpltj.jpg";
      let imagePublicId = null;
      if (imageFile) {
        const imageUpload = await cloudinary.uploader.upload(imageFile.path, {
          folder: "musicflow/images",
        });
        finalImageUrl = imageUpload.secure_url;
        imagePublicId = imageUpload.public_id;
        } else if (imageUrl && isHttpUrl(imageUrl)) {
        // Nếu có imageUrl là URL, upload lên Cloudinary
        try {
          const imageUpload = await cloudinary.uploader.upload(imageUrl.trim(), {
            folder: "musicflow/images",
          });
          finalImageUrl = imageUpload.secure_url;
          imagePublicId = imageUpload.public_id;
        } catch (err) {
          // Nếu upload thất bại, fallback dùng link gốc
          finalImageUrl = imageUrl.trim();
        }
        }

        const artistIds = await resolveArtistIds(artist);

        const songData = {
          title,
          artists: artistIds,
          lyrics: lyrics || "",
          isPublic: isPublic === "true" || isPublic === true,
          audioUrl: finalAudioUrl,
          audioPublicId,
          duration,
        imageUrl: finalImageUrl,
        imagePublicId,
          source: "admin",
          uploadedBy: null,
        };

        if (topicId) {
          songData.topicIds = [topicId];
        }

        const song = await Song.create(songData);
        const populatedSong = await Song.findById(song._id)
          .populate("uploadedBy", "name email")
          .populate("artists", "name")
          .populate("topicIds", "name");

        res.status(201).json({
          message: "Song created successfully",
          song: serializeAdminSong(populatedSong),
        });
      } catch (error) {
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

      const { title, artist, topicId, lyrics, isPublic, imageUrl } = req.body;

      if (typeof title !== "undefined") {
        song.title = String(title).trim();
      }

      if (typeof artist !== "undefined") {
        song.artists = await resolveArtistIds(artist);
      }

      if (typeof lyrics !== "undefined") {
        song.lyrics = lyrics;
      }

      if (typeof isPublic !== "undefined") {
        song.isPublic = isPublic === "true" || isPublic === true;
      }

      if (typeof topicId !== "undefined") {
        song.topicIds = topicId ? [topicId] : [];
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
      } else if (imageUrl && isHttpUrl(imageUrl)) {
        song.imageUrl = imageUrl.trim();
      }

      await song.save();
      const populatedSong = await Song.findById(song._id)
        .populate("uploadedBy", "name email")
        .populate("artists", "name")
        .populate("topicIds", "name");

      res.json({
        message: "Song updated successfully",
        song: serializeAdminSong(populatedSong),
      });
    } catch (error) {
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
        .populate({ path: "songs", select: "title artists imageUrl", populate: { path: "artists", select: "name" } }),
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
    res.status(500).json({ message: "Server error" });
  }
});

// Get single system playlist
router.get("/playlists/:id", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const playlist = await PlaylistSong.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate({ path: "songs", select: "title artists imageUrl", populate: { path: "artists", select: "name" } });

    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    res.json(playlist);
  } catch (error) {
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
      .populate({ path: "songs", select: "title artists imageUrl", populate: { path: "artists", select: "name" } });

    res.status(201).json(populatedPlaylist);
  } catch (error) {
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
      .populate({ path: "songs", select: "title artists imageUrl", populate: { path: "artists", select: "name" } });

    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found" });
    }

    res.json(playlist);
  } catch (error) {
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
        const songCount = await Song.countDocuments({ topicIds: topic._id });
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
      await Song.updateMany({ _id: { $in: songs } }, { $addToSet: { topicIds: topic._id } });
    }

    res.status(201).json(topic);
  } catch (error) {
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
    await Song.updateMany({ topicIds: topic._id, _id: { $nin: songs } }, { $pull: { topicIds: topic._id } });
    // Gán topicId cho các bài hát mới được chọn
    if (Array.isArray(songs) && songs.length > 0) {
      await Song.updateMany({ _id: { $in: songs } }, { $addToSet: { topicIds: topic._id } });
    }

    res.json(topic);
  } catch (error) {
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
    await Song.updateMany({ topicIds: req.params.id }, { $pull: { topicIds: req.params.id } });

    res.json({ message: "Topic deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Lấy danh sách bài hát thuộc topic
router.get("/topics/:id/songs", async (req, res) => {
  try {
    const topicId = req.params.id;
    const songs = await Song.find({ topicIds: topicId });
    res.json({ songs });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;

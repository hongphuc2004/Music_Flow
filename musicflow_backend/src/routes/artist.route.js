const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const artistController = require("../controllers/artist.controller");
const Artist = require("../models/artist.model");
const Song = require("../models/song.model");
const SongPlayEvent = require("../models/song-play-event.model");
const User = require("../models/user.model");
const authMiddleware = require("../middleware/auth.middleware");
const cloudinary = require("../config/cloudinary");
const { cloudinaryFolder } = require("../config/cloudinaryFolders");

const upload = multer({ dest: "uploads/" });

const safeUnlink = (filePath) => {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
  }
};

// Đăng ký artist
router.post("/register", artistController.register);
// Đăng nhập artist
router.post("/login", artistController.login);
// Đăng nhập artist bằng Google
router.post("/google", artistController.googleLogin);

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const artist = await Artist.findById(req.userId).select("-password");

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Artist not found",
      });
    }

    return res.json({
      success: true,
      artist,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Get current artist failed",
      error: error.message,
    });
  }
});

router.put("/profile", authMiddleware, upload.single("avatarFile"), async (req, res) => {
  try {
    const artist = await Artist.findById(req.userId);

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Artist not found",
      });
    }

    const { name, email, bio, avatar, avatarUrl } = req.body;
    const normalizedName = typeof name === "string" ? name.trim() : undefined;
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : undefined;
    const normalizedBio = typeof bio === "string" ? bio.trim() : undefined;
    const normalizedAvatar = typeof avatar === "string" ? avatar.trim() : undefined;
    const normalizedAvatarUrl =
      typeof avatarUrl === "string" ? avatarUrl.trim() : undefined;

    if (typeof normalizedName !== "undefined") {
      if (!normalizedName) {
        return res.status(400).json({
          success: false,
          message: "Name is required",
        });
      }
      artist.name = normalizedName;
    }

    if (typeof normalizedEmail !== "undefined") {
      if (!normalizedEmail) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }

      const existingArtist = await Artist.findOne({
        email: normalizedEmail,
        _id: { $ne: artist._id },
      }).select("_id");

      if (existingArtist) {
        return res.status(409).json({
          success: false,
          message: "Email already exists",
        });
      }

      artist.email = normalizedEmail;
    }

    if (typeof normalizedBio !== "undefined") {
      artist.bio = normalizedBio;
    }

    if (req.file) {
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: cloudinaryFolder("artists"),
        transformation: [{ width: 500, height: 500, crop: "fill" }],
      });
      artist.avatar = uploadResult.secure_url;
    } else if (typeof normalizedAvatarUrl !== "undefined") {
      if (normalizedAvatarUrl.startsWith("http") && !normalizedAvatarUrl.includes("cloudinary.com")) {
        try {
          const uploadResult = await cloudinary.uploader.upload(normalizedAvatarUrl, {
            folder: cloudinaryFolder("artists"),
            transformation: [{ width: 500, height: 500, crop: "fill" }],
          });
          artist.avatar = uploadResult.secure_url;
        } catch (cloudErr) {
          console.error("Cloudinary URL upload error:", cloudErr);
          artist.avatar = normalizedAvatarUrl;
        }
      } else {
        artist.avatar = normalizedAvatarUrl;
      }
    } else if (typeof normalizedAvatar !== "undefined") {
      artist.avatar = normalizedAvatar;
    }

    await artist.save();

    return res.json({
      success: true,
      message: "Profile updated successfully",
      artist: artist.toJSON(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Update artist profile failed",
      error: error.message,
    });
  } finally {
    safeUnlink(req.file?.path);
  }
});

router.get("/profile", async (req, res) => {
  try {
    const { id, name } = req.query;

    const query = id
      ? { _id: id }
      : name
        ? { name: { $regex: new RegExp(`^${String(name).trim()}$`, "i") } }
        : null;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Missing artist id or name",
      });
    }

    const artist = await Artist.findOne(query).select("-password");
    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Artist not found",
      });
    }

    const publicSongFilter = { artists: artist._id, isPublic: true };

    const [songs, totalSongs, followerCount, totalLikesAgg] = await Promise.all([
      Song.find(publicSongFilter)
        .populate("artists", "name avatar")
        .sort({ createdAt: -1 })
        .limit(20),
      Song.countDocuments(publicSongFilter),
      User.countDocuments({ followedArtists: artist._id }),
      Song.aggregate([
        { $match: publicSongFilter },
        { $group: { _id: null, totalLikes: { $sum: { $ifNull: ["$likeCount", 0] } } } },
      ]),
    ]);

    const totalLikes = (totalLikesAgg[0]?.totalLikes || 0);
    const monthlyListeners = artist.monthlyListeners || 0;

    // Cache updated stats back to the Artist document
    await Artist.updateOne(
      { _id: artist._id },
      { $set: { followersCount: followerCount } }
    );

    return res.json({
      success: true,
      artist: {
        _id: artist._id,
        name: artist.name,
        avatar: artist.avatar || "",
        coverUrl: artist.avatar || "",
        bio: artist.bio || "",
        isVerified: artist.isVerified || false,
        totalSongs,
        totalLikes,
        monthlyListeners,
        followers: followerCount,
        latestReleaseLabel:
          songs.length > 0 && songs[0].createdAt
            ? new Date(songs[0].createdAt).toLocaleDateString("vi-VN")
            : "Chua cap nhat",
        songs,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Get artist profile failed",
      error: error.message,
    });
  }
});

router.get("/:id/follow-status", authMiddleware, async (req, res) => {
  try {
    const [artist, user] = await Promise.all([
      Artist.findById(req.params.id).select("_id"),
      User.findById(req.userId).select("followedArtists"),
    ]);

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Artist not found",
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isFollowing = (user.followedArtists || []).some(
      (artistId) => artistId.toString() === req.params.id,
    );

    return res.json({
      success: true,
      isFollowing,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Get follow status failed",
      error: error.message,
    });
  }
});

router.post("/:id/follow", authMiddleware, async (req, res) => {
  try {
    const [artist, user] = await Promise.all([
      Artist.findById(req.params.id).select("_id name"),
      User.findById(req.userId),
    ]);

    if (!artist) {
      return res.status(404).json({
        success: false,
        message: "Artist not found",
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.followedArtists) {
      user.followedArtists = [];
    }

    const artistId = artist._id.toString();
    const alreadyFollowing = user.followedArtists.some(
      (followedArtistId) => followedArtistId.toString() === artistId,
    );

    if (alreadyFollowing) {
      user.followedArtists = user.followedArtists.filter(
        (followedArtistId) => followedArtistId.toString() !== artistId,
      );
    } else {
      user.followedArtists.push(artist._id);
    }

    await user.save();

    const followers = await User.countDocuments({ followedArtists: artist._id });

    // Cache followers count back to the Artist document
    await Artist.updateOne(
      { _id: artist._id },
      { $set: { followersCount: followers } }
    );

    return res.json({
      success: true,
      isFollowing: !alreadyFollowing,
      followers,
      message: alreadyFollowing
        ? `Đã bỏ theo dõi ${artist.name}`
        : `Đã theo dõi ${artist.name}`,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Toggle follow artist failed",
      error: error.message,
    });
  }
});

// Bulk check follow statuses for a list of artist IDs
router.post("/follow-statuses", authMiddleware, async (req, res) => {
  try {
    const { artistIds } = req.body;
    if (!Array.isArray(artistIds)) {
      return res.status(400).json({
        success: false,
        message: "artistIds must be an array",
      });
    }

    const user = await User.findById(req.userId).select("followedArtists");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const followedSet = new Set(
      (user.followedArtists || []).map((id) => id.toString())
    );

    const followStatusMap = {};
    for (const id of artistIds) {
      if (id) {
        followStatusMap[id] = followedSet.has(id.toString());
      }
    }

    return res.json({
      success: true,
      followStatusMap,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Batch checking follow statuses failed",
      error: error.message,
    });
  }
});

module.exports = router;

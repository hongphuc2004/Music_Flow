const express = require("express");
const router = express.Router();
const artistController = require("../controllers/artist.controller");
const Artist = require("../models/artist.model");
const Song = require("../models/song.model");
const User = require("../models/user.model");
const authMiddleware = require("../middleware/auth.middleware");

// Đăng ký artist
router.post("/register", artistController.register);
// Đăng nhập artist
router.post("/login", artistController.login);

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

    const [songs, totalSongs, followerCount] = await Promise.all([
      Song.find({ artists: artist._id, isPublic: true })
        .populate("artists", "name avatar")
        .sort({ createdAt: -1 })
        .limit(20),
      Song.countDocuments({ artists: artist._id, isPublic: true }),
      User.countDocuments({ followedArtists: artist._id }),
    ]);

    const totalLikes = songs.reduce(
      (sum, song) => sum + (Number(song.likeCount) || 0),
      0,
    );

    return res.json({
      success: true,
      artist: {
        _id: artist._id,
        name: artist.name,
        avatar: artist.avatar || "",
        coverUrl: artist.avatar || "",
        bio: artist.bio || "",
        totalSongs,
        totalLikes,
        monthlyListeners: totalLikes * 37 + totalSongs * 125,
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

    const isFollowing = user.followedArtists.some(
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
      Artist.findById(req.params.id).select("_id"),
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

    return res.json({
      success: true,
      isFollowing: !alreadyFollowing,
      followers,
      message: alreadyFollowing
        ? "Da bo theo doi artist"
        : "Da theo doi artist",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Toggle follow artist failed",
      error: error.message,
    });
  }
});

module.exports = router;

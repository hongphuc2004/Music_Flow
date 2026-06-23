const express = require("express");
const router = express.Router();
const multer = require("multer");
const authMiddleware = require("../middleware/auth.middleware");
const songController = require("../controllers/song.controller");

// ================= MULTER CONFIG =================
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// 📋 GET SONGS BY ARTIST NAME (PUBLIC + ADMIN UPLOAD)
router.get("/by-artist", songController.getSongsByArtist);

// 📈 GET FLOWCHART DATA (REAL HOURLY STREAM COUNTS)
router.get("/flowchart", songController.getFlowchart);

// 🎤 GET RANKINGS
router.get("/rankings", songController.getRankings);

// 🎤 GET LYRICS BY SONG ID
router.get("/:id/lyrics", songController.getSongLyrics);

// Record a qualified play
router.post("/:id/play", songController.registerPlay);

// Return the Cloudinary URL redirect
router.get("/:id/stream", songController.streamSong);

// ⬇️ DOWNLOAD SONG (AUTH REQUIRED)
router.post("/:songId/download", authMiddleware, songController.downloadSong);

// 📌 GET ALL SONGS (PUBLIC ONLY)
router.get("/", songController.getAllSongs);

// 🎲 GET RECOMMENDED SONGS (Random - PUBLIC ONLY)
router.get("/recommended", songController.getRecommendedSongs);

// 🔍 SEARCH SONGS (PUBLIC ONLY)
router.get("/search", songController.searchSongs);

// 📁 GET MY UPLOADS (User's uploaded songs - AUTH REQUIRED)
router.get("/my-uploads", authMiddleware, songController.getMyUploads);

// ⬇️ GET MY DOWNLOAD HISTORY (AUTH REQUIRED)
router.get("/download-history", authMiddleware, songController.getDownloadHistory);

// 🗑️ REMOVE DOWNLOAD HISTORY
router.delete("/download-history/:songId", authMiddleware, songController.removeFromDownloadHistory);

// 🔄 SYNC MY DOWNLOAD HISTORY FROM CLIENT (AUTH REQUIRED)
router.post("/download-history/sync", authMiddleware, songController.syncDownloadHistory);

// 🎵 UPLOAD SONG (AUTH REQUIRED)
router.post(
  "/",
  authMiddleware,
  upload.fields([
    { name: "audio", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  songController.uploadSong
);

// ✏️ UPDATE SONG (AUTH REQUIRED - OWNER OR ARTIST)
router.put(
  "/:id",
  authMiddleware,
  upload.fields([
    { name: "audio", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  songController.updateSong
);

// 🔄 TOGGLE PUBLIC/PRIVATE (AUTH REQUIRED - OWNER OR ARTIST)
router.patch("/:id/toggle-public", authMiddleware, songController.togglePublic);

// 🗑️ DELETE SONG (AUTH REQUIRED - OWNER OR ARTIST)
router.delete("/:id", authMiddleware, songController.deleteSong);

module.exports = router;

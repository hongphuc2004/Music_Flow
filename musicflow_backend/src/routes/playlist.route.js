const express = require("express");
const router = express.Router();
const multer = require("multer");
const authMiddleware = require("../middleware/auth.middleware");
const playlistController = require("../controllers/playlist.controller");

// Multer config for playlist cover upload (JPEG, PNG, WebP under 5MB)
const fileFilter = (req, file, cb) => {
  if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Định dạng file không hợp lệ. Chỉ chấp nhận JPEG, PNG và WebP."), false);
  }
};
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter
});

// ================= GET SYSTEM PLAYLISTS (public) =================
router.get("/system", playlistController.getSystemPlaylists);

// ================= GET SINGLE SYSTEM PLAYLIST (public) =================
router.get("/system/:id", playlistController.getSystemPlaylistById);

// ================= GET RANDOM COVERS FOR PRESETS (Unsplash API) =================
router.get("/random-covers", authMiddleware, playlistController.getRandomCovers);

// ================= GET ALL PLAYLISTS (của user hiện tại) =================
router.get("/", authMiddleware, playlistController.getUserPlaylists);

// ================= GET SINGLE PLAYLIST =================
router.get("/:id", authMiddleware, playlistController.getPlaylistById);

// ================= CREATE PLAYLIST =================
router.post("/", authMiddleware, upload.single("coverImageFile"), playlistController.createPlaylist);

// ================= UPDATE PLAYLIST (tên, mô tả, ảnh bìa, public/private) =================
router.put("/:id", authMiddleware, upload.single("coverImageFile"), playlistController.updatePlaylist);

// ================= DELETE PLAYLIST =================
router.delete("/:id", authMiddleware, playlistController.deletePlaylist);

// ================= ADD SONG TO PLAYLIST =================
router.post("/:id/songs", authMiddleware, playlistController.addSongToPlaylist);

// ================= REMOVE SONG FROM PLAYLIST =================
router.delete("/:id/songs/:songId", authMiddleware, playlistController.removeSongFromPlaylist);

// ================= REORDER SONGS IN PLAYLIST =================
router.put("/:id/reorder", authMiddleware, playlistController.reorderPlaylistSongs);

module.exports = router;

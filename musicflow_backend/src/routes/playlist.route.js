const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const playlistController = require("../controllers/playlist.controller");

// ================= GET SYSTEM PLAYLISTS (public) =================
router.get("/system", playlistController.getSystemPlaylists);

// ================= GET SINGLE SYSTEM PLAYLIST (public) =================
router.get("/system/:id", playlistController.getSystemPlaylistById);

// ================= GET ALL PLAYLISTS (của user hiện tại) =================
router.get("/", authMiddleware, playlistController.getUserPlaylists);

// ================= GET SINGLE PLAYLIST =================
router.get("/:id", authMiddleware, playlistController.getPlaylistById);

// ================= CREATE PLAYLIST =================
router.post("/", authMiddleware, playlistController.createPlaylist);

// ================= UPDATE PLAYLIST (tên, mô tả, ảnh bìa, public/private) =================
router.put("/:id", authMiddleware, playlistController.updatePlaylist);

// ================= DELETE PLAYLIST =================
router.delete("/:id", authMiddleware, playlistController.deletePlaylist);

// ================= ADD SONG TO PLAYLIST =================
router.post("/:id/songs", authMiddleware, playlistController.addSongToPlaylist);

// ================= REMOVE SONG FROM PLAYLIST =================
router.delete("/:id/songs/:songId", authMiddleware, playlistController.removeSongFromPlaylist);

// ================= REORDER SONGS IN PLAYLIST =================
router.put("/:id/reorder", authMiddleware, playlistController.reorderPlaylistSongs);

module.exports = router;

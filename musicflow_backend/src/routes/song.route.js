const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const cloudinary = require("../config/cloudinary");
const Song = require("../models/song.model");

// ================= MULTER CONFIG =================
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// =================================================
// 📌 GET ALL SONGS (CHO FLUTTER APP)
router.get("/", async (req, res) => {
  try {
    const songs = await Song.find().sort({ createdAt: -1 });

    res.json(songs);
  } catch (error) {
    console.error("Get songs error:", error);
    res.status(500).json({ message: "Get songs failed", error: error.message });
  }
});

// =================================================
// 🔍 SEARCH SONGS (by title, artist, first letter)
router.get("/search", async (req, res) => {
  try {
    const { query, artist, letter } = req.query;
    
    let filter = {};
    
    // Tìm kiếm theo query (tên bài hát hoặc ca sĩ)
    if (query) {
      const searchRegex = new RegExp(query, "i"); // case-insensitive
      filter.$or = [
        { title: searchRegex },
        { artist: searchRegex }
      ];
    }
    
    // Lọc theo ca sĩ cụ thể
    if (artist) {
      filter.artist = new RegExp(artist, "i");
    }
    
    // Lọc theo chữ cái đầu của tên bài hát
    if (letter) {
      filter.title = new RegExp(`^${letter}`, "i"); // bắt đầu bằng chữ cái
    }
    
    const songs = await Song.find(filter).sort({ createdAt: -1 });
    
    res.json(songs);
  } catch (error) {
    console.error("Search songs error:", error);
    res.status(500).json({ message: "Search failed", error: error.message });
  }
});

// =================================================
// 🎵 UPLOAD SONG (audio + image)
router.post(
  "/",
  upload.fields([
    { name: "audio", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { title, artist, topicId, lyrics } = req.body;

      if (!title || !artist || !topicId) {
        return res.status(400).json({
          message: "Missing required fields",
        });
      }

      if (!req.files?.audio || !req.files?.image) {
        return res.status(400).json({
          message: "Audio or image file missing",
        });
      }

      const audioFile = req.files.audio[0];
      const imageFile = req.files.image[0];

      // ================= CLOUDINARY UPLOAD =================
      const audioUpload = await cloudinary.uploader.upload(
        audioFile.path,
        {
          resource_type: "video", 
          folder: "musicflow/audio",
        }
      );

      const imageUpload = await cloudinary.uploader.upload(
        imageFile.path,
        {
          folder: "musicflow/images",
        }
      );

      // Xoá file tạm sau khi upload
      fs.unlinkSync(audioFile.path);
      fs.unlinkSync(imageFile.path);

      // ================= SAVE MONGODB =================
      const song = await Song.create({
        title,
        artist,
        topicId,
        lyrics,
        audioUrl: audioUpload.secure_url,
        audioPublicId: audioUpload.public_id,
        duration: audioUpload.duration,
        imageUrl: imageUpload.secure_url,
        imagePublicId: imageUpload.public_id,
      });

      res.status(201).json({
        message: "Upload song successfully",
        song,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Upload failed",
        error: error.message,
      });
    }
  }
);

module.exports = router;

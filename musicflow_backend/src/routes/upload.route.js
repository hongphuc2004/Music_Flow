const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("../config/cloudinary");

// multer config
const upload = multer({ dest: "uploads/" });

// POST /api/upload/audio
router.post("/audio", upload.single("audio"), async (req, res) => {
  try {
    // ✅ FIX LỖI
    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded. Field name must be 'audio'",
      });
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      resource_type: "video", // BẮT BUỘC cho mp3
      folder: "musicflow/audio",
    });

    res.json({
      url: result.secure_url,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Upload failed" });
  }
});

module.exports = router;

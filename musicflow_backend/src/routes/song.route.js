const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const https = require("https");
const http = require("http");
const cloudinary = require("../config/cloudinary");
const Song = require("../models/song.model");
const authMiddleware = require("../middleware/auth.middleware");
const { downloadSong } = require("../controllers/song.controller");

// ================= MULTER CONFIG =================
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// =================================================
// 🎤 GET LYRICS BY SONG ID
router.get("/:id/lyrics", async (req, res) => {
  try {
    const { id } = req.params;

    const song = await Song.findById(id).select("_id title artist lyrics");
    if (!song) {
      return res.status(404).json({
        success: false,
        message: "Khong tim thay bai hat",
      });
    }

    return res.status(200).json({
      success: true,
      songId: song._id,
      title: song.title,
      artist: song.artist,
      lyrics: song.lyrics || "",
    });
  } catch (error) {
    console.error("Get lyrics error:", error);
    return res.status(500).json({
      success: false,
      message: "Khong the tai lyrics",
      error: error.message,
    });
  }
});

// =================================================
// 🎵 AUDIO STREAMING - HTTP Range Requests (HTTP 206)
// Hỗ trợ seek/tua nhanh mà không cần tải lại từ đầu
router.get("/:id/stream", async (req, res) => {
  try {
    const { id } = req.params;
    
    const song = await Song.findById(id);
    if (!song) {
      return res.status(404).json({ message: "Song not found" });
    }

    const audioUrl = song.audioUrl;
    
    // Parse URL để xác định protocol
    const urlObj = new URL(audioUrl);
    const protocol = urlObj.protocol === "https:" ? https : http;
    
    // Forward Range header nếu có
    const range = req.headers.range;
    const headers = {
      "User-Agent": "MusicFlow-Streaming/1.0",
    };
    
    if (range) {
      headers["Range"] = range;
    }

    // Proxy request đến Cloudinary
    const proxyReq = protocol.get(audioUrl, { headers }, (proxyRes) => {
      const contentType = proxyRes.headers["content-type"] || "audio/mpeg";
      const contentLength = proxyRes.headers["content-length"];
      const contentRange = proxyRes.headers["content-range"];
      const acceptRanges = proxyRes.headers["accept-ranges"] || "bytes";
      
      // Set response headers cho streaming
      const responseHeaders = {
        "Content-Type": contentType,
        "Accept-Ranges": acceptRanges,
        "Cache-Control": "public, max-age=86400", // Cache 1 ngày
        "X-Content-Duration": song.duration || 0,
      };
      
      if (contentLength) {
        responseHeaders["Content-Length"] = contentLength;
      }
      
      if (contentRange) {
        responseHeaders["Content-Range"] = contentRange;
      }
      
      // HTTP 206 Partial Content nếu có Range request
      const statusCode = range && proxyRes.statusCode === 206 ? 206 : 200;
      
      res.writeHead(statusCode, responseHeaders);
      
      // Pipe stream từ Cloudinary đến client
      proxyRes.pipe(res);
    });
    
    proxyReq.on("error", (err) => {
      console.error("Stream proxy error:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Streaming failed" });
      }
    });
    
    // Cleanup khi client disconnect
    req.on("close", () => {
      proxyReq.destroy();
    });
    
  } catch (error) {
    console.error("Stream error:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Streaming failed", error: error.message });
    }
  }
});

// =================================================
// ⬇️ DOWNLOAD SONG (AUTH REQUIRED)
router.post("/:songId/download", authMiddleware, downloadSong);

// =================================================
// 📌 GET ALL SONGS (PUBLIC ONLY)
router.get("/", async (req, res) => {
  try {
    // Public thực sự cho cả admin và user upload
    const songs = await Song.find({ isPublic: true }).sort({ createdAt: -1 });

    res.json(songs);
  } catch (error) {
    console.error("Get songs error:", error);
    res.status(500).json({ message: "Get songs failed", error: error.message });
  }
});

// =================================================
// 🎲 GET RECOMMENDED SONGS (Random - PUBLIC ONLY)
router.get("/recommended", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 12;
    
    // Public thực sự cho cả admin và user upload
    const songs = await Song.aggregate([
      { $match: { isPublic: true } },
      { $sample: { size: limit } }
    ]);
    
    res.json(songs);
  } catch (error) {
    console.error("Get recommended songs error:", error);
    res.status(500).json({ message: "Get recommended songs failed", error: error.message });
  }
});

// =================================================
// 🔍 SEARCH SONGS (PUBLIC ONLY)
router.get("/search", async (req, res) => {
  try {
    const { query, artist, letter } = req.query;

    const conditions = [{ isPublic: true }];

    if (query) {
      const searchRegex = new RegExp(query, "i");
      conditions.push({ $or: [{ title: searchRegex }, { artist: searchRegex }] });
    }

    if (artist) {
      conditions.push({ artist: new RegExp(artist, "i") });
    }

    if (letter) {
      conditions.push({ title: new RegExp(`^${letter}`, "i") });
    }

    const filter = conditions.length === 1 ? conditions[0] : { $and: conditions };

    const songs = await Song.find(filter).sort({ createdAt: -1 });
    
    res.json(songs);
  } catch (error) {
    console.error("Search songs error:", error);
    res.status(500).json({ message: "Search failed", error: error.message });
  }
});

// =================================================
// 📁 GET MY UPLOADS (User's uploaded songs - AUTH REQUIRED)
router.get("/my-uploads", authMiddleware, async (req, res) => {
  try {
    const songs = await Song.find({ uploadedBy: req.userId })
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      songs,
      count: songs.length
    });
  } catch (error) {
    console.error("Get my uploads error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Lấy danh sách thất bại" 
    });
  }
});

// =================================================
// 🎵 UPLOAD SONG (AUTH REQUIRED)
router.post(
  "/",
  authMiddleware,
  upload.fields([
    { name: "audio", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { title, artist, topicId, lyrics, isPublic } = req.body;

      if (!title || !artist) {
        return res.status(400).json({
          message: "Missing required fields (title, artist)",
        });
      }

      if (!req.files?.audio) {
        return res.status(400).json({
          message: "Audio file is required",
        });
      }

      const audioFile = req.files.audio[0];
      const imageFile = req.files.image ? req.files.image[0] : null;

      // ================= CLOUDINARY UPLOAD =================
      const audioUpload = await cloudinary.uploader.upload(
        audioFile.path,
        {
          resource_type: "video", 
          folder: "musicflow/audio",
        }
      );

      // Upload image nếu có, không thì dùng ảnh mặc định
      let imageUrl = "https://res.cloudinary.com/dvhpcqpkq/image/upload/v1735403257/musicflow/images/tgdfbp3zivuqoxqxpltj.jpg";
      let imagePublicId = null;
      
      if (imageFile) {
        const imageUpload = await cloudinary.uploader.upload(
          imageFile.path,
          {
            folder: "musicflow/images",
          }
        );
        imageUrl = imageUpload.secure_url;
        imagePublicId = imageUpload.public_id;
        fs.unlinkSync(imageFile.path);
      }

      // Xoá file tạm sau khi upload
      fs.unlinkSync(audioFile.path);

      // ================= SAVE MONGODB =================
      const songData = {
        title,
        artist,
        lyrics,
        uploadedBy: req.userId,
        isPublic: isPublic === 'true' || isPublic === true,
        audioUrl: audioUpload.secure_url,
        audioPublicId: audioUpload.public_id,
        duration: audioUpload.duration,
        imageUrl: imageUrl,
        imagePublicId: imagePublicId,
      };

      if (topicId) {
        songData.topicId = topicId;
      }

      const song = await Song.create(songData);

      res.status(201).json({
        success: true,
        message: "Upload thành công",
        song,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: "Upload thất bại",
        error: error.message,
      });
    }
  }
);

// =================================================
// ✏️ UPDATE SONG (AUTH REQUIRED - OWNER ONLY)
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, artist, lyrics, topicId } = req.body;

    const song = await Song.findById(id);
    
    if (!song) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài hát"
      });
    }

    // Kiểm tra quyền sở hữu
    if (!song.uploadedBy || song.uploadedBy.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền sửa bài hát này"
      });
    }

    // Cập nhật
    if (title) song.title = title;
    if (artist) song.artist = artist;
    if (lyrics !== undefined) song.lyrics = lyrics;
    if (topicId) song.topicId = topicId;

    await song.save();

    res.json({
      success: true,
      message: "Cập nhật thành công",
      song
    });
  } catch (error) {
    console.error("Update song error:", error);
    res.status(500).json({
      success: false,
      message: "Cập nhật thất bại"
    });
  }
});

// =================================================
// 🔄 TOGGLE PUBLIC/PRIVATE (AUTH REQUIRED - OWNER ONLY)
router.patch("/:id/toggle-public", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const song = await Song.findById(id);
    
    if (!song) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài hát"
      });
    }

    // Kiểm tra quyền sở hữu
    if (!song.uploadedBy || song.uploadedBy.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền thay đổi"
      });
    }

    song.isPublic = !song.isPublic;
    await song.save();

    res.json({
      success: true,
      message: song.isPublic ? "Đã công khai bài hát" : "Đã chuyển sang riêng tư",
      isPublic: song.isPublic
    });
  } catch (error) {
    console.error("Toggle public error:", error);
    res.status(500).json({
      success: false,
      message: "Thay đổi thất bại"
    });
  }
});

// =================================================
// 🗑️ DELETE SONG (AUTH REQUIRED - OWNER ONLY)
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const song = await Song.findById(id);
    
    if (!song) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bài hát"
      });
    }

    // Kiểm tra quyền sở hữu
    if (!song.uploadedBy || song.uploadedBy.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xóa bài hát này"
      });
    }

    // Xóa file trên Cloudinary
    try {
      await cloudinary.uploader.destroy(song.audioPublicId, { resource_type: "video" });
      await cloudinary.uploader.destroy(song.imagePublicId);
    } catch (cloudErr) {
      console.error("Cloudinary delete error:", cloudErr);
    }

    // Xóa khỏi database
    await Song.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Đã xóa bài hát"
    });
  } catch (error) {
    console.error("Delete song error:", error);
    res.status(500).json({
      success: false,
      message: "Xóa thất bại"
    });
  }
});

module.exports = router;

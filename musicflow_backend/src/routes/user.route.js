const express = require("express");
const fs = require("fs");
const multer = require("multer");

const User = require("../models/user.model");
const authMiddleware = require("../middleware/auth.middleware");
const cloudinary = require("../config/cloudinary");

const router = express.Router();

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User khong ton tai",
      });
    }

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get current user error:", error);
    return res.status(500).json({
      success: false,
      message: "Khong the tai thong tin nguoi dung",
      error: error.message,
    });
  }
});

router.put("/update", authMiddleware, upload.single("avatar"), async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User khong ton tai",
      });
    }

    const nextName = req.body.name?.trim();
    const avatarUrl = req.body.avatarUrl?.trim();

    if (nextName) {
      user.name = nextName;
    }

    if (req.file) {
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: "musicflow/avatars",
      });
      user.avatar = uploadResult.secure_url;
    } else if (avatarUrl && /^https?:\/\//i.test(avatarUrl)) {
      const uploadResult = await cloudinary.uploader.upload(avatarUrl, {
        folder: "musicflow/avatars",
      });
      user.avatar = uploadResult.secure_url;
    }

    await user.save();

    return res.json({
      success: true,
      message: "Cap nhat thong tin thanh cong",
      user,
    });
  } catch (error) {
    console.error("Update user error:", error);
    return res.status(500).json({
      success: false,
      message: "Cap nhat thong tin that bai",
      error: error.message,
    });
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
});

module.exports = router;

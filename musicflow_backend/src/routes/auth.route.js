const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const RefreshToken = require("../models/refreshToken.model");
const crypto = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET || "musicflow_secret_key_2024";
const JWT_EXPIRES_IN = "2h"; // Access token hết hạn sau 2h
const REFRESH_EXPIRES_IN = 30; // Refresh token sống 30 ngày

function generateRefreshToken(userId) {
  const token = crypto.randomBytes(64).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_IN * 24 * 60 * 60 * 1000);
  return { token, expiresAt };
}

// ================= REGISTER =================
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ thông tin",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu phải có ít nhất 6 ký tự",
      });
    }

    // Check email đã tồn tại chưa
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email đã được sử dụng",
      });
    }

    // Tạo user mới
    const user = await User.create({
      name,
      email,
      password,
    });

    // Tạo access token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });
    // Tạo refresh token
    const { token: refreshToken, expiresAt } = generateRefreshToken(user._id);
    await RefreshToken.create({ userId: user._id, token: refreshToken, expiresAt });

    res.status(201).json({
      success: true,
      message: "Đăng ký thành công",
      token,
      refreshToken,
      user,
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Đăng ký thất bại",
      error: error.message,
    });
  }
});

// ================= LOGIN =================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập email và mật khẩu",
      });
    }

    // Tìm user theo email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Email hoặc mật khẩu không đúng",
      });
    }

    // Kiểm tra password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Email hoặc mật khẩu không đúng",
      });
    }

    // Tạo access token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });
    // Tạo refresh token mới (rolling)
    const { token: refreshToken, expiresAt } = generateRefreshToken(user._id);
    await RefreshToken.findOneAndDelete({ userId: user._id });
    await RefreshToken.create({ userId: user._id, token: refreshToken, expiresAt });

    res.json({
      success: true,
      message: "Đăng nhập thành công",
      token,
      refreshToken,
      user,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Đăng nhập thất bại",
      error: error.message,
    });
  }
});

// ================= GOOGLE LOGIN =================
router.post("/google", async (req, res) => {
  try {
    const { googleId, email, name, avatar } = req.body;

    // Validate input
    if (!googleId || !email || !name) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin từ Google",
      });
    }

    // Tìm user theo googleId hoặc email
    let user = await User.findOne({
      $or: [{ googleId }, { email }],
    });

    if (user) {
      // User đã tồn tại
      if (!user.googleId) {
        // User đã đăng ký bằng email/password, liên kết với Google
        user.googleId = googleId;
        user.provider = "google";
        if (avatar && !user.avatar) {
          user.avatar = avatar;
        }
        await user.save();
      }
    } else {
      // Tạo user mới
      user = await User.create({
        googleId,
        email,
        name,
        avatar: avatar || "",
        provider: "google",
      });
    }

    // Tạo access token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });
    // Tạo refresh token mới (rolling)
    const { token: refreshToken, expiresAt } = generateRefreshToken(user._id);
    await RefreshToken.findOneAndDelete({ userId: user._id });
    await RefreshToken.create({ userId: user._id, token: refreshToken, expiresAt });

    res.json({
      success: true,
      message: "Đăng nhập Google thành công",
      token,
      refreshToken,
      user,
    });

  // ================= REFRESH TOKEN =================
  router.post("/refresh", async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({ success: false, message: "Thiếu refresh token" });
      }
      const found = await RefreshToken.findOne({ token: refreshToken });
      if (!found || found.expiresAt < new Date()) {
        return res.status(401).json({ success: false, message: "Refresh token hết hạn hoặc không hợp lệ" });
      }
      const user = await User.findById(found.userId);
      if (!user) {
        return res.status(401).json({ success: false, message: "User không tồn tại" });
      }
      // Rolling: xóa refresh token cũ, tạo mới
      await RefreshToken.deleteOne({ token: refreshToken });
      const { token: newRefreshToken, expiresAt } = generateRefreshToken(user._id);
      await RefreshToken.create({ userId: user._id, token: newRefreshToken, expiresAt });
      // Tạo access token mới
      const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      res.json({
        success: true,
        token,
        refreshToken: newRefreshToken,
        user,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: "Lỗi refresh token", error: error.message });
    }
  });
  } catch (error) {
    console.error("Google login error:", error);
    res.status(500).json({
      success: false,
      message: "Đăng nhập Google thất bại",
      error: error.message,
    });
  }
});

// ================= GET PROFILE =================
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User không tồn tại",
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi server",
    });
  }
});

// ================= AUTH MIDDLEWARE =================
function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Không có token",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const resolvedUserId = decoded.userId || decoded.id || decoded._id || null;

    if (!resolvedUserId) {
      return res.status(401).json({
        success: false,
        message: "Token không chứa thông tin user",
      });
    }

    req.userId = resolvedUserId;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Token không hợp lệ",
    });
  }
}

// Export middleware để dùng ở routes khác
router.authMiddleware = authMiddleware;

module.exports = router;

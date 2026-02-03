const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

const JWT_SECRET = process.env.JWT_SECRET || "musicflow_secret_key_2024";
const JWT_EXPIRES_IN = "7d"; // Token hết hạn sau 7 ngày

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

    // Tạo token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    res.status(201).json({
      success: true,
      message: "Đăng ký thành công",
      token,
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

    // Tạo token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    res.json({
      success: true,
      message: "Đăng nhập thành công",
      token,
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
    req.userId = decoded.userId;
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

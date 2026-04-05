const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const User = require("../models/user.model");
const RefreshToken = require("../models/refreshToken.model");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "musicflow_secret_key_2024";
const JWT_EXPIRES_IN = "2h";
const REFRESH_EXPIRES_IN = 30;

function generateRefreshToken() {
  const token = crypto.randomBytes(64).toString("hex");
  const expiresAt = new Date(
    Date.now() + REFRESH_EXPIRES_IN * 24 * 60 * 60 * 1000
  );
  return { token, expiresAt };
}

function signAccessToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

async function rotateRefreshToken(userId, existingToken = null) {
  if (existingToken) {
    await RefreshToken.deleteOne({ token: existingToken });
  } else {
    await RefreshToken.findOneAndDelete({ userId });
  }

  const { token, expiresAt } = generateRefreshToken();
  await RefreshToken.create({ userId, token, expiresAt });
  return token;
}

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui long nhap day du thong tin",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Mat khau phai co it nhat 6 ky tu",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email da duoc su dung",
      });
    }

    const user = await User.create({
      name,
      email,
      password,
    });

    const token = signAccessToken(user._id);
    const refreshToken = await rotateRefreshToken(user._id);

    res.status(201).json({
      success: true,
      message: "Dang ky thanh cong",
      token,
      refreshToken,
      user,
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({
      success: false,
      message: "Dang ky that bai",
      error: error.message,
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui long nhap email va mat khau",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Email hoac mat khau khong dung",
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Email hoac mat khau khong dung",
      });
    }

    const token = signAccessToken(user._id);
    const refreshToken = await rotateRefreshToken(user._id);

    res.json({
      success: true,
      message: "Dang nhap thanh cong",
      token,
      refreshToken,
      user,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Dang nhap that bai",
      error: error.message,
    });
  }
});

router.post("/google", async (req, res) => {
  try {
    const { googleId, email, name, avatar } = req.body;

    if (!googleId || !email || !name) {
      return res.status(400).json({
        success: false,
        message: "Thieu thong tin tu Google",
      });
    }

    let user = await User.findOne({
      $or: [{ googleId }, { email }],
    });

    if (user) {
      if (!user.googleId) {
        user.googleId = googleId;
        user.provider = "google";
        if (avatar && !user.avatar) {
          user.avatar = avatar;
        }
        await user.save();
      }
    } else {
      user = await User.create({
        googleId,
        email,
        name,
        avatar: avatar || "",
        provider: "google",
      });
    }

    const token = signAccessToken(user._id);
    const refreshToken = await rotateRefreshToken(user._id);

    res.json({
      success: true,
      message: "Dang nhap Google thanh cong",
      token,
      refreshToken,
      user,
    });
  } catch (error) {
    console.error("Google login error:", error);
    res.status(500).json({
      success: false,
      message: "Dang nhap Google that bai",
      error: error.message,
    });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Thieu refresh token",
      });
    }

    const found = await RefreshToken.findOne({ token: refreshToken });
    if (!found || found.expiresAt < new Date()) {
      return res.status(401).json({
        success: false,
        message: "Refresh token het han hoac khong hop le",
      });
    }

    const user = await User.findById(found.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User khong ton tai",
      });
    }

    const token = signAccessToken(user._id);
    const newRefreshToken = await rotateRefreshToken(user._id, refreshToken);

    res.json({
      success: true,
      token,
      refreshToken: newRefreshToken,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Loi refresh token",
      error: error.message,
    });
  }
});

router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User khong ton tai",
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Loi server",
    });
  }
});

function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Khong co token",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const resolvedUserId = decoded.userId || decoded.id || decoded._id || null;

    if (!resolvedUserId) {
      return res.status(401).json({
        success: false,
        message: "Token khong chua thong tin user",
      });
    }

    req.userId = resolvedUserId;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Token khong hop le",
    });
  }
}

router.authMiddleware = authMiddleware;

module.exports = router;

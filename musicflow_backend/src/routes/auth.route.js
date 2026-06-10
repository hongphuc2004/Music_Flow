const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middleware/auth.middleware");

const User = require("../models/user.model");
const RefreshToken = require("../models/refreshToken.model");
const { verifyGoogleCredential } = require("../utils/googleAuth");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET environment variable");
}

const JWT_EXPIRES_IN = "2h";
const REFRESH_EXPIRES_IN = 30;
const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || "mf_refresh_token";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

function parseCookies(req) {
  const rawCookie = req.headers.cookie;
  if (!rawCookie) return {};

  return rawCookie.split(";").reduce((acc, part) => {
    const [name, ...valueParts] = part.trim().split("=");
    if (!name) return acc;
    acc[name] = decodeURIComponent(valueParts.join("="));
    return acc;
  }, {});
}

function setRefreshCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? "none" : "lax",
    maxAge: REFRESH_EXPIRES_IN * 24 * 60 * 60 * 1000,
    path: "/api/auth",
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? "none" : "lax",
    path: "/api/auth",
  });
}

function generateRefreshToken() {
  const token = crypto.randomBytes(64).toString("hex");
  const expiresAt = new Date(
    Date.now() + REFRESH_EXPIRES_IN * 24 * 60 * 60 * 1000
  );
  return { token, expiresAt };
}

function hashRefreshToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function signAccessToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

async function rotateRefreshToken(userId, existingToken = null) {
  if (existingToken) {
    await RefreshToken.deleteOne({ tokenHash: hashRefreshToken(existingToken) });
  } else {
    await RefreshToken.findOneAndDelete({ userId });
  }

  const { token, expiresAt } = generateRefreshToken();
  await RefreshToken.create({ userId, tokenHash: hashRefreshToken(token), expiresAt });
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
    setRefreshCookie(res, refreshToken);

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
    setRefreshCookie(res, refreshToken);

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
    const { credential, tokenType } = req.body;
    const { googleId, email, name, avatar } = await verifyGoogleCredential(credential, tokenType);

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
    setRefreshCookie(res, refreshToken);

    res.json({
      success: true,
      message: "Dang nhap Google thanh cong",
      token,
      refreshToken,
      user,
    });
  } catch (error) {
    console.error("Google login error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Dang nhap Google that bai",
      error: error.message,
    });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const refreshTokenFromBody = req.body?.refreshToken;
    const refreshTokenFromCookie = parseCookies(req)[REFRESH_COOKIE_NAME];
    const refreshToken = refreshTokenFromBody || refreshTokenFromCookie;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Thieu refresh token",
      });
    }

    const found = await RefreshToken.findOne({ tokenHash: hashRefreshToken(refreshToken) });
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
    setRefreshCookie(res, newRefreshToken);

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

router.post("/logout", async (req, res) => {
  try {
    const refreshTokenFromBody = req.body?.refreshToken;
    const refreshTokenFromCookie = parseCookies(req)[REFRESH_COOKIE_NAME];
    const refreshToken = refreshTokenFromBody || refreshTokenFromCookie;

    if (refreshToken) {
      await RefreshToken.deleteOne({ tokenHash: hashRefreshToken(refreshToken) });
    }

    clearRefreshCookie(res);
    return res.json({
      success: true,
      message: "Đăng xuất thành công",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Đăng xuất thất bại",
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

router.authMiddleware = authMiddleware;

module.exports = router;

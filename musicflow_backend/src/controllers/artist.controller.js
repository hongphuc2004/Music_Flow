const Artist = require("../models/artist.model");
const jwt = require("jsonwebtoken");
const { verifyGoogleCredential } = require("../utils/googleAuth");
const {
  JWT_SECRET,
  rotateRefreshToken,
  setRefreshCookie,
} = require("../utils/token.util");

// Đăng ký artist
exports.register = async (req, res) => {
  try {
    const { name, email, password, avatar, bio } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
    }
    const existing = await Artist.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Email đã tồn tại" });
    }
    const artist = new Artist({ name, email, password, avatar, bio, role: "artist" });
    await artist.save();
    const artistObj = artist.toJSON();
    artistObj.role = "artist";
    res.status(201).json({ message: "Đăng ký thành công", artist: artistObj });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

// Đăng nhập artist
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const artist = await Artist.findOne({ email });
    if (!artist) {
      return res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
    }
    const isMatch = await artist.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Email hoặc mật khẩu không đúng" });
    }
    // Tạo JWT
    const token = jwt.sign(
      { id: artist._id, userId: artist._id, role: artist.role || "artist" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    const refreshToken = await rotateRefreshToken(artist._id);
    setRefreshCookie(res, refreshToken);

    const artistObj = artist.toJSON();
    artistObj.role = artist.role || "artist";

    res.json({ message: "Đăng nhập thành công", token, refreshToken, artist: artistObj });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

// Đăng nhập artist bằng Google
exports.googleLogin = async (req, res) => {
  try {
    const { credential, tokenType } = req.body;
    const { googleId, email, name, avatar } = await verifyGoogleCredential(credential, tokenType);

    let artist = await Artist.findOne({
      $or: [{ googleId }, { email }],
    });

    if (artist) {
      if (!artist.googleId) {
        artist.googleId = googleId;
      }
      artist.provider = "google";
      if (!artist.role) {
        artist.role = "artist";
      }
      if (avatar && !artist.avatar) {
        artist.avatar = avatar;
      }
      if (name && !artist.name) {
        artist.name = name;
      }
      await artist.save();
    } else {
      artist = await Artist.create({
        googleId,
        email,
        name,
        avatar: avatar || "",
        provider: "google",
        role: "artist",
      });
    }

    const token = jwt.sign(
      { id: artist._id, userId: artist._id, role: artist.role || "artist" },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    const refreshToken = await rotateRefreshToken(artist._id);
    setRefreshCookie(res, refreshToken);

    const artistObj = artist.toJSON();
    artistObj.role = artist.role || "artist";

    res.json({
      message: "Đăng nhập thành công",
      token,
      refreshToken,
      artist: artistObj,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      message: err.statusCode ? err.message : "Lỗi server",
      error: err.message,
    });
  }
};


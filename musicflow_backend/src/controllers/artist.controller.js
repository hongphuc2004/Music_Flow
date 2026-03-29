const Artist = require("../models/artist.model");
const jwt = require("jsonwebtoken");

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
    const artist = new Artist({ name, email, password, avatar, bio });
    await artist.save();
    res.status(201).json({ message: "Đăng ký thành công", artist: artist.toJSON() });
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
      { id: artist._id, role: artist.role },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "7d" }
    );
    res.json({ message: "Đăng nhập thành công", token, artist: artist.toJSON() });
  } catch (err) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

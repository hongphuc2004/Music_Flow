const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "musicflow_secret_key_2024";

const authMiddleware = (req, res, next) => {
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
};

module.exports = authMiddleware;

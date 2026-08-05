const User = require("../models/user.model");
const { hasPremiumAccess } = require("../utils/premium.util");

/**
 * Middleware yêu cầu tài khoản Premium đang còn hoạt động
 */
exports.requirePremium = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select("isPremium premiumExpiry");
    
    if (!user || !hasPremiumAccess(user)) {
      return res.status(403).json({
        success: false,
        message: "Tính năng này chỉ dành cho tài khoản Premium. Vui lòng nâng cấp tài khoản để sử dụng.",
      });
    }
    
    next();
  } catch (error) {
    console.error("Require premium middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi xác thực tài khoản Premium",
      error: error.message,
    });
  }
};

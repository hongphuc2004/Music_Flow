const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middleware/auth.middleware");

const User = require("../models/user.model");
const Artist = require("../models/artist.model");
const RefreshToken = require("../models/refreshToken.model");
const PasswordResetOtp = require("../models/passwordResetOtp.model");
const { verifyGoogleCredential } = require("../utils/googleAuth");
const { sendOtpEmail } = require("../services/email.service");

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
    path: "/",
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: IS_PRODUCTION ? "none" : "lax",
    path: "/",
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

    const userObj = user.toJSON();
    userObj.hasPassword = Boolean(user.password);

    res.json({
      success: true,
      user: userObj,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Loi server",
    });
  }
});

/**
 * PUT /api/auth/change-password
 * Authenticated: User or Artist changes their password
 */
router.put("/change-password", authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ thông tin mật khẩu",
      });
    }

    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới phải có ít nhất 6 ký tự",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Xác nhận mật khẩu mới không khớp",
      });
    }

    // Role-based model selection: req.userRole determines User or Artist
    const AccountModel = req.userRole === "artist" ? Artist : User;
    const account = await AccountModel.findById(req.userId);

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Tài khoản không tồn tại",
      });
    }

    // Source of truth: Google-only accounts have no password
    if (!account.password) {
      return res.status(400).json({
        success: false,
        message: "Tài khoản đăng nhập bằng Google không có mật khẩu để thay đổi",
      });
    }

    const isMatch = await account.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu hiện tại không chính xác",
      });
    }

    const isSame = await account.comparePassword(newPassword);
    if (isSame) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới không được trùng với mật khẩu hiện tại",
      });
    }

    account.password = newPassword;
    await account.save();

    // Revoke all refresh tokens for this user
    await RefreshToken.deleteMany({ userId: account._id });
    clearRefreshCookie(res);

    return res.json({
      success: true,
      message: "Đổi mật khẩu thành công. Các phiên đăng nhập cũ đã được thu hồi.",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({
      success: false,
      message: "Đổi mật khẩu thất bại",
      error: error.message,
    });
  }
});

const GENERIC_FORGOT_SUCCESS =
  "Nếu email của bạn tồn tại trên hệ thống và đủ điều kiện, bạn sẽ nhận được mã OTP xác thực trong giây lát.";

/**
 * POST /api/auth/forgot-password
 * Public: Request password reset OTP
 */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập địa chỉ email",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find account by checking specified portal role hint first, then the other model
    let account = null;
    let accountModel = "User";

    if (role === "artist") {
      account = await Artist.findOne({ email: normalizedEmail });
      accountModel = "Artist";
      if (!account) {
        account = await User.findOne({ email: normalizedEmail });
        accountModel = "User";
      }
    } else {
      account = await User.findOne({ email: normalizedEmail });
      accountModel = "User";
      if (!account) {
        account = await Artist.findOne({ email: normalizedEmail });
        accountModel = "Artist";
      }
    }

    // Anti-enumeration: Email doesn't exist -> Return generic success
    if (!account) {
      return res.json({
        success: true,
        message: GENERIC_FORGOT_SUCCESS,
      });
    }

    // Anti-enumeration: Account is Google-only (!account.password) -> Return generic success
    if (!account.password) {
      return res.json({
        success: true,
        message: GENERIC_FORGOT_SUCCESS,
      });
    }

    // Anti-enumeration: Check cooldown of active OTP record (< 60s).
    // Return generic success silently without re-sending email to prevent account enumeration via 429.
    const latestOtp = await PasswordResetOtp.findOne({
      email: normalizedEmail,
      used: false,
    }).sort({ createdAt: -1 });

    if (latestOtp && latestOtp.resendAvailableAt > new Date()) {
      return res.json({
        success: true,
        message: GENERIC_FORGOT_SUCCESS,
      });
    }

    // Invalidate previous unused OTPs for this email
    await PasswordResetOtp.deleteMany({ email: normalizedEmail, used: false });

    // Generate cryptographically secure 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    const resendAvailableAt = new Date(Date.now() + 60 * 1000); // 60 seconds cooldown
    const cleanupAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour TTL cleanup

    const otpRecord = await PasswordResetOtp.create({
      email: normalizedEmail,
      accountId: account._id,
      accountModel,
      otpHash,
      otpExpiresAt,
      resendAvailableAt,
      cleanupAt,
    });

    // Send email with immediate rollback on failure
    try {
      await sendOtpEmail({
        toEmail: normalizedEmail,
        otpCode: otp,
        recipientName: account.name || "Người dùng",
      });
    } catch (emailError) {
      console.error("Send OTP email failed:", emailError);
      await PasswordResetOtp.findByIdAndDelete(otpRecord._id);
      return res.status(500).json({
        success: false,
        message: "Không thể gửi email lúc này. Vui lòng thử lại sau.",
      });
    }

    return res.json({
      success: true,
      message: GENERIC_FORGOT_SUCCESS,
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
      error: error.message,
    });
  }
});

/**
 * POST /api/auth/verify-otp
 * Public: Verify 6-digit OTP and obtain one-time resetToken
 */
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập email và mã OTP",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = String(otp).trim();

    const record = await PasswordResetOtp.findOne({
      email: normalizedEmail,
      used: false,
    }).sort({ createdAt: -1 });

    if (!record || record.otpVerified || !record.otpHash) {
      return res.status(400).json({
        success: false,
        message: "Mã OTP không hợp lệ hoặc đã được sử dụng.",
      });
    }

    // Check attempts already >= 5
    if (record.attempts >= 5) {
      record.used = true;
      await record.save();
      return res.status(400).json({
        success: false,
        message: "Mã OTP đã bị vô hiệu hóa do nhập sai quá 5 lần. Vui lòng yêu cầu mã mới.",
      });
    }

    // Check expiration (5 minutes)
    if (new Date() > record.otpExpiresAt) {
      record.used = true;
      await record.save();
      return res.status(400).json({
        success: false,
        message: "Mã OTP đã hết hạn sau 5 phút. Vui lòng yêu cầu mã mới.",
      });
    }

    const candidateHash = crypto.createHash("sha256").update(normalizedOtp).digest("hex");
    if (candidateHash !== record.otpHash) {
      record.attempts += 1;
      // Invalidate immediately on 5th failure
      if (record.attempts >= 5) {
        record.used = true;
        await record.save();
        return res.status(400).json({
          success: false,
          message: "Bạn đã nhập sai mã OTP 5 lần. Mã OTP này đã bị vô hiệu hóa. Vui lòng yêu cầu mã mới.",
        });
      }
      await record.save();
      return res.status(400).json({
        success: false,
        message: `Mã OTP không chính xác. Bạn còn ${5 - record.attempts} lần thử.`,
      });
    }

    // Verified successfully: generate 32-byte cryptographically secure reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");

    record.otpVerified = true;
    record.otpHash = null; // Clear OTP hash to prevent reuse
    record.resetTokenHash = resetTokenHash;
    record.resetTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await record.save();

    return res.json({
      success: true,
      message: "Xác thực mã OTP thành công.",
      resetToken,
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
      error: error.message,
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Public: Reset password using one-time resetToken
 */
router.post("/reset-password", async (req, res) => {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body;

    if (!resetToken || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ thông tin",
      });
    }

    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới phải có ít nhất 6 ký tự",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Xác nhận mật khẩu mới không khớp",
      });
    }

    const resetTokenHash = crypto.createHash("sha256").update(String(resetToken).trim()).digest("hex");

    const record = await PasswordResetOtp.findOne({
      resetTokenHash,
      used: false,
      otpVerified: true,
    });

    if (!record) {
      return res.status(400).json({
        success: false,
        message: "Mã xác thực đặt lại mật khẩu không hợp lệ hoặc đã được sử dụng.",
      });
    }

    if (new Date() > record.resetTokenExpiresAt) {
      record.used = true;
      await record.save();
      return res.status(400).json({
        success: false,
        message: "Phiên đặt lại mật khẩu đã hết hạn sau 10 phút. Vui lòng thực hiện lại từ đầu.",
      });
    }

    // Resolve account accurately from DB record (independent of any client-supplied parameters)
    const AccountModel = record.accountModel === "Artist" ? Artist : User;
    const account = await AccountModel.findById(record.accountId);

    if (!account) {
      record.used = true;
      await record.save();
      return res.status(404).json({
        success: false,
        message: "Tài khoản không tồn tại trên hệ thống.",
      });
    }

    const isSame = await account.comparePassword(newPassword);
    if (isSame) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu mới không được trùng với mật khẩu cũ.",
      });
    }

    // Update password
    account.password = newPassword;
    await account.save();

    // Revoke one-time reset token and cleanup OTPs for this account
    record.used = true;
    await record.save();
    await PasswordResetOtp.deleteMany({ accountId: account._id });

    // Revoke all refresh tokens for this user
    await RefreshToken.deleteMany({ userId: account._id });

    return res.json({
      success: true,
      message: "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại bằng mật khẩu mới.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      success: false,
      message: "Đặt lại mật khẩu thất bại",
      error: error.message,
    });
  }
});

router.authMiddleware = authMiddleware;

module.exports = router;

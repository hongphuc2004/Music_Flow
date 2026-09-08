/**
 * Kiểm tra xem người dùng có quyền truy cập Premium hợp lệ hay không.
 * @param {object} user - Bản ghi User từ DB (chứa isPremium và premiumExpiry)
 * @returns {boolean}
 */
function hasPremiumAccess(user) {
  if (!user) return false;
  if (user.isPremium === false) return false;
  if (!user.premiumExpiry) return false;
  return new Date(user.premiumExpiry) > new Date();
}

/**
 * Phân giải mã gói cước của người dùng ("basic" | "go" | "plus" | "premium").
 * @param {object} user - Bản ghi User từ DB (có thể đã populate premiumPlan)
 * @returns {"basic" | "go" | "plus" | "premium"}
 */
function getUserTier(user) {
  if (!user || !hasPremiumAccess(user)) {
    return "basic";
  }
  const planName = user.premiumPlan?.name || "";
  if (planName === "Gói GO") {
    return "go";
  }
  if (planName === "Gói PLUS") {
    return "plus";
  }
  return "premium";
}

/**
 * Kiểm tra xem người dùng có quyền truy cập chất lượng cao (HQ 320kbps) hay không.
 * Chỉ có Gói PLUS và Gói PREMIUM mới được phép.
 * @param {object} user
 * @returns {boolean}
 */
function canAccessHQQuality(user) {
  const tier = getUserTier(user);
  return tier === "plus" || tier === "premium";
}

module.exports = {
  hasPremiumAccess,
  getUserTier,
  canAccessHQQuality,
};

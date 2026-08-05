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

module.exports = {
  hasPremiumAccess,
};

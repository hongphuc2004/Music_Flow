const Notification = require("../models/notification.model");

/**
 * Lấy danh sách 50 thông báo mới nhất của user
 * GET /api/notifications
 */
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.userId;
    const { type } = req.query;

    const query = { user: userId };
    if (type) {
      query.type = type;
    }

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).limit(50),
      Notification.countDocuments({ user: userId, isRead: false }),
    ]);

    return res.status(200).json({
      success: true,
      data: notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách thông báo",
      error: error.message,
    });
  }
};

/**
 * Đánh dấu đã đọc một thông báo
 * PUT /api/notifications/:id/read
 */
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Bảo mật: Chỉ cập nhật thông báo thuộc sở hữu của user
    const notification = await Notification.findOneAndUpdate(
      { _id: id, user: userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông báo hoặc bạn không có quyền cập nhật thông báo này",
      });
    }

    return res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    console.error("Mark notification as read error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể cập nhật trạng thái thông báo",
      error: error.message,
    });
  }
};

/**
 * Đánh dấu đã đọc tất cả thông báo
 * PUT /api/notifications/read-all
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.userId;

    // Bảo mật: Chỉ cập nhật các thông báo thuộc sở hữu của user
    await Notification.updateMany({ user: userId, isRead: false }, { isRead: true });

    return res.status(200).json({
      success: true,
      message: "Đã đánh dấu đọc tất cả thông báo thành công",
    });
  } catch (error) {
    console.error("Mark all notifications as read error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể cập nhật toàn bộ thông báo",
      error: error.message,
    });
  }
};

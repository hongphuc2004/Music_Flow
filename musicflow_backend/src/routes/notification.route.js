const router = require("express").Router();
const authMiddleware = require("../middleware/auth.middleware");
const notificationController = require("../controllers/notification.controller");

// Tất cả các endpoints thông báo đều yêu cầu đăng nhập
router.use(authMiddleware);

router.get("/", notificationController.getNotifications);
router.put("/:id/read", notificationController.markAsRead);
router.put("/read-all", notificationController.markAllAsRead);

module.exports = router;

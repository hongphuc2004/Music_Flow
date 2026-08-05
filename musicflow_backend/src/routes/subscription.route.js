const express = require("express");
const subscriptionController = require("../controllers/subscription.controller");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();

// 💳 Khởi tạo yêu cầu thanh toán (Auth required)
router.post("/checkout", authMiddleware, subscriptionController.checkout);

// 🕹️ Xác nhận thanh toán giả lập Mock (Auth required)
router.post("/mock-confirm", authMiddleware, subscriptionController.mockConfirm);

// 🔗 Xử lý Return và Webhook IPN từ VNPay (Public endpoints)
router.get("/vnpay-return", subscriptionController.vnpayReturn);
router.get("/vnpay-ipn", subscriptionController.vnpayIpn);

// 🔍 Kiểm tra trạng thái giao dịch cụ thể (Auth required)
router.get("/transactions/:ref/status", authMiddleware, subscriptionController.getTransactionStatus);

// 📋 Lấy thông tin Premium hiện tại và lịch sử (Auth required)
router.get("/current", authMiddleware, subscriptionController.getCurrentSubscription);

module.exports = router;

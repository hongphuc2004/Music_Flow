const paymentService = require("../services/payment.service");
const vnpayUtil = require("../utils/vnpay.util");
const Transaction = require("../models/transaction.model");
const Subscription = require("../models/subscription.model");
const User = require("../models/user.model");

/**
 * Khởi tạo yêu cầu thanh toán (Checkout)
 * POST /api/subscriptions/checkout
 */
exports.checkout = async (req, res) => {
  try {
    const { planId, paymentMethod } = req.body;
    const userId = req.userId;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    if (!planId || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp đầy đủ thông tin gói cước và phương thức thanh toán",
      });
    }

    if (!["mock", "vnpay"].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Phương thức thanh toán không hỗ trợ",
      });
    }

    const result = await paymentService.checkout({
      planId,
      paymentMethod,
      userId,
      ipAddress,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("Subscription checkout error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Không thể khởi tạo yêu cầu thanh toán",
    });
  }
};

/**
 * Xác nhận thanh toán giả lập (Mock Payment)
 * POST /api/subscriptions/mock-confirm
 */
exports.mockConfirm = async (req, res) => {
  try {
    const { transactionRef } = req.body;
    const userId = req.userId;

    if (!transactionRef) {
      return res.status(400).json({
        success: false,
        message: "Thiếu mã tham chiếu giao dịch",
      });
    }

    // Kiểm tra giao dịch thuộc sở hữu của user và đang ở trạng thái pending
    const transaction = await Transaction.findOne({ transactionRef, user: userId });
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin giao dịch hoặc giao dịch không thuộc quyền sở hữu của bạn",
      });
    }

    const result = await paymentService.activateSubscription(
      transactionRef,
      { source: "mock_payment_client_confirmation" },
      new Date()
    );

    // Lấy thông tin user mới nhất
    const user = await User.findById(userId).select("-password");

    return res.status(200).json({
      success: true,
      message: "Nâng cấp tài khoản Premium thành công",
      data: {
        transaction: result.transaction,
        subscription: result.subscription,
        user,
      },
    });
  } catch (error) {
    console.error("Subscription mock confirm error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Xác nhận thanh toán giả lập thất bại",
    });
  }
};

/**
 * Xử lý phản hồi Return từ VNPay (Thường gọi bởi Frontend)
 * GET /api/subscriptions/vnpay-return
 */
exports.vnpayReturn = async (req, res) => {
  try {
    const vnpParams = req.query;
    const hashSecret = process.env.VNP_HASHSECRET;

    if (!hashSecret) {
      return res.status(500).json({
        success: false,
        message: "Hệ thống chưa cấu hình VNP_HASHSECRET ở backend",
      });
    }

    // 1. Xác minh chữ ký phản hồi
    const isVerified = vnpayUtil.verifySecureHash(vnpParams, hashSecret);
    if (!isVerified) {
      return res.status(400).json({
        success: false,
        message: "Sai chữ ký bảo mật phản hồi từ VNPay",
      });
    }

    const transactionRef = vnpParams.vnp_TxnRef;
    const responseCode = vnpParams.vnp_ResponseCode;

    // 2. Truy vấn giao dịch tương ứng
    const transaction = await Transaction.findOne({ transactionRef }).populate("plan");
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin giao dịch tương ứng",
      });
    }

    // Đối soát số tiền thanh toán trong Return URL
    const vnpAmount = parseInt(vnpParams.vnp_Amount, 10) / 100;
    if (transaction.amount !== vnpAmount) {
      return res.status(400).json({
        success: false,
        message: "Số tiền giao dịch không hợp lệ",
      });
    }

    // 3. Nếu giao dịch vẫn là pending (IPN chưa xử lý), kiểm tra cờ cấu hình fallback để quyết định kích hoạt
    if (transaction.status === "pending") {
      const isFallbackEnabled = process.env.VNP_RETURN_ACTIVATION_FALLBACK === "true";
      if (isFallbackEnabled) {
        if (responseCode === "00") {
          await paymentService.activateSubscription(transactionRef, vnpParams, new Date());
        } else {
          await paymentService.failSubscription(transactionRef, vnpParams);
        }
      }
    }

    // 4. Lấy trạng thái giao dịch mới nhất sau cập nhật
    const updatedTx = await Transaction.findOne({ transactionRef }).populate("plan");
    const user = await User.findById(updatedTx.user).select("-password");

    return res.status(200).json({
      success: updatedTx.status === "success",
      message: updatedTx.status === "success" ? "Thanh toán thành công" : "Thanh toán thất bại hoặc đã hủy",
      data: {
        transaction: updatedTx,
        user,
      },
    });
  } catch (error) {
    console.error("VNPay Return error:", error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || "Xử lý phản hồi Return từ VNPay thất bại",
    });
  }
};

/**
 * Xử lý webhook Server-to-Server từ VNPay (IPN) - Source of Truth thực tế
 * GET /api/subscriptions/vnpay-ipn
 */
exports.vnpayIpn = async (req, res) => {
  try {
    const vnpParams = req.query;
    const hashSecret = process.env.VNP_HASHSECRET;

    if (!hashSecret) {
      return res.status(200).json({ RspCode: "99", Message: "Server hashsecret config missing" });
    }

    // 1. Xác minh chữ ký bảo mật VNPay
    const isVerified = vnpayUtil.verifySecureHash(vnpParams, hashSecret);
    if (!isVerified) {
      return res.status(200).json({ RspCode: "97", Message: "Invalid checksum" });
    }

    const transactionRef = vnpParams.vnp_TxnRef;
    const vnpAmount = parseInt(vnpParams.vnp_Amount, 10) / 100; // Chuyển từ đơn vị VNPay (xu) sang đồng

    // 2. Tìm kiếm Transaction
    const transaction = await Transaction.findOne({ transactionRef }).populate("plan");
    if (!transaction) {
      return res.status(200).json({ RspCode: "01", Message: "Order not found" });
    }

    // 3. Đối soát số tiền thanh toán
    if (transaction.amount !== vnpAmount) {
      return res.status(200).json({ RspCode: "04", Message: "Invalid amount" });
    }

    // 4. Đối soát trạng thái giao dịch
    if (transaction.status !== "pending") {
      return res.status(200).json({ RspCode: "02", Message: "Order already confirmed" });
    }

    // 5. Kiểm tra mã giao dịch từ cổng thanh toán
    const responseCode = vnpParams.vnp_ResponseCode;
    if (responseCode === "00") {
      await paymentService.activateSubscription(transactionRef, vnpParams, new Date());
    } else {
      await paymentService.failSubscription(transactionRef, vnpParams);
    }

    return res.status(200).json({ RspCode: "00", Message: "Confirm success" });
  } catch (error) {
    console.error("VNPay IPN error:", error);
    return res.status(200).json({ RspCode: "99", Message: "Confirm fail" });
  }
};

/**
 * Lấy trạng thái giao dịch cụ thể (thăm dò từ Frontend)
 * GET /api/subscriptions/transactions/:ref/status
 */
exports.getTransactionStatus = async (req, res) => {
  try {
    const { ref } = req.params;
    const userId = req.userId;

    const transaction = await Transaction.findOne({ transactionRef: ref, user: userId }).populate("plan");
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông tin giao dịch",
      });
    }

    return res.status(200).json({
      success: true,
      status: transaction.status,
      data: transaction,
    });
  } catch (error) {
    console.error("Get transaction status error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy trạng thái giao dịch",
      error: error.message,
    });
  }
};

/**
 * Lấy thông tin đăng ký gói hiện tại của người dùng
 * GET /api/subscriptions/current
 */
exports.getCurrentSubscription = async (req, res) => {
  try {
    const userId = req.userId;

    // Tìm Subscription đang hoạt động
    const activeSub = await Subscription.findOne({
      user: userId,
      status: "active",
      endDate: { $gt: new Date() },
    })
      .populate("plan")
      .populate("transaction")
      .sort({ endDate: -1 });

    // Lấy lịch sử giao dịch thanh toán
    const history = await Transaction.find({ user: userId })
      .populate("plan")
      .sort({ createdAt: -1 })
      .limit(10);

    return res.status(200).json({
      success: true,
      data: {
        activeSubscription: activeSub,
        history,
      },
    });
  } catch (error) {
    console.error("Get current subscription error:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy thông tin đăng ký dịch vụ",
      error: error.message,
    });
  }
};

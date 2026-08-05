const Transaction = require("../models/transaction.model");
const Subscription = require("../models/subscription.model");
const Plan = require("../models/plan.model");
const User = require("../models/user.model");
const vnpayUtil = require("../utils/vnpay.util");

/**
 * Định dạng ngày tạo giao dịch theo chuẩn VNPay (yyyyMMddHHmmss)
 */
function getVNPayCreateDate() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/**
 * Khởi tạo yêu cầu thanh toán (Checkout)
 */
async function checkout({ planId, paymentMethod, userId, ipAddress }) {
  // 1. Kiểm tra tài khoản người dùng
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error("Người dùng không tồn tại");
    err.status = 404;
    throw err;
  }

  // 2. Lấy thông tin gói từ Database để đảm bảo tính an toàn dữ liệu (không tin giá gửi từ Client)
  const plan = await Plan.findById(planId);
  if (!plan || !plan.isActive) {
    const err = new Error("Gói cước không khả dụng hoặc đã bị tắt");
    err.status = 404;
    throw err;
  }

  // 3. Tạo mã tham chiếu giao dịch độc nhất (vnp_TxnRef hoặc Mock Transaction ID)
  // Định dạng: timestamp_6 ký tự cuối của userId
  const transactionRef = `${Date.now()}_${String(userId).slice(-6)}`;

  // 4. Tạo Transaction ở trạng thái pending
  const transaction = await Transaction.create({
    user: userId,
    plan: plan._id,
    amount: plan.price,
    paymentMethod,
    transactionRef,
    status: "pending",
  });

  // 5. Tạo Subscription ở trạng thái pending để ánh xạ 1-1 với Transaction
  const subscription = await Subscription.create({
    user: userId,
    plan: plan._id,
    status: "pending",
    transaction: transaction._id,
  });

  // 6. Xử lý theo phương thức thanh toán
  if (paymentMethod === "vnpay") {
    const tmnCode = process.env.VNP_TMNCODE;
    const hashSecret = process.env.VNP_HASHSECRET;
    const vnpUrl = process.env.VNP_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    const returnUrl = process.env.VNP_RETURNURL;

    if (!tmnCode || !hashSecret || !returnUrl) {
      const err = new Error("Hệ thống chưa cấu hình đầy đủ các biến môi trường VNPay (TMNCODE, HASHSECRET, RETURNURL)");
      err.status = 500;
      throw err;
    }

    const paymentUrl = vnpayUtil.createPaymentUrl({
      tmnCode,
      hashSecret,
      vnpUrl,
      returnUrl,
      ipAddress,
      amount: plan.price,
      txnRef: transactionRef,
      orderInfo: `Thanh toan goi cuoc premium ${plan.name}`,
      createDate: getVNPayCreateDate(),
    });

    return {
      success: true,
      transaction,
      subscription,
      paymentUrl,
    };
  }

  // Phương thức Mock Payment
  return {
    success: true,
    transaction,
    subscription,
    mockToken: `mock_token_${transactionRef}`,
  };
}

/**
 * Kích hoạt trạng thái Premium (Thành công) - Đảm bảo Idempotency nguyên tử
 */
async function activateSubscription(transactionRef, gatewayResponse, paidAt) {
  // 1. Cập nhật Transaction từ pending -> success một cách nguyên tử
  const transaction = await Transaction.findOneAndUpdate(
    { transactionRef, status: "pending" },
    { status: "success", gatewayResponse, paidAt: paidAt || new Date() },
    { new: true }
  ).populate("plan");

  // 2. Nếu trả về null, có nghĩa giao dịch này không ở trạng thái pending (đã hoàn thành hoặc không tồn tại)
  if (!transaction) {
    const existingTx = await Transaction.findOne({ transactionRef }).populate("plan");
    if (!existingTx) {
      const err = new Error("Không tìm thấy thông tin giao dịch");
      err.status = 404;
      throw err;
    }

    if (existingTx.status === "success") {
      // Đã được kích hoạt trước đó -> Trả về kết quả Idempotent
      return { success: true, alreadyActivated: true };
    }

    const err = new Error(`Giao dịch đã kết thúc với trạng thái: ${existingTx.status}`);
    err.status = 400;
    throw err;
  }

  // 3. Tìm Subscription pending liên kết với Transaction này
  const subscription = await Subscription.findOne({ transaction: transaction._id });
  if (!subscription) {
    const err = new Error("Không tìm thấy Subscription tương ứng với giao dịch");
    err.status = 404;
    throw err;
  }

  // 4. Tìm và cập nhật thông tin người dùng
  const user = await User.findById(transaction.user);
  if (!user) {
    const err = new Error("Không tìm thấy người dùng sở hữu giao dịch");
    err.status = 404;
    throw err;
  }

  let startDate = new Date();

  // Logic Gia hạn: Cộng dồn nếu Premium cũ vẫn còn hạn
  if (user.isPremium && user.premiumExpiry && user.premiumExpiry > new Date()) {
    startDate = new Date(user.premiumExpiry);
  }

  let durationInDays = transaction.plan.durationInDays;
  if (transaction.paymentMethod === "mock") {
    // Để tiện test hết hạn gói cước, giao dịch Mock Payment chỉ được cấp hạn dùng trong 24 giờ (1 ngày)
    durationInDays = 1;
  }
  const endDate = new Date(startDate.getTime() + durationInDays * 24 * 60 * 60 * 1000);

  // 5. Cập nhật Subscription thành active
  subscription.startDate = startDate;
  subscription.endDate = endDate;
  subscription.status = "active";
  await subscription.save();

  // 6. Cập nhật User thành Premium
  user.isPremium = true;
  user.premiumExpiry = endDate;
  user.premiumPlan = transaction.plan._id;
  await user.save();

  return {
    success: true,
    alreadyActivated: false,
    transaction,
    subscription,
  };
}

/**
 * Đánh dấu giao dịch thanh toán thất bại
 */
async function failSubscription(transactionRef, gatewayResponse) {
  // 1. Cập nhật Transaction từ pending -> failed
  const transaction = await Transaction.findOneAndUpdate(
    { transactionRef, status: "pending" },
    { status: "failed", gatewayResponse },
    { new: true }
  );

  if (transaction) {
    // 2. Cập nhật Subscription tương ứng từ pending -> cancelled
    await Subscription.findOneAndUpdate(
      { transaction: transaction._id, status: "pending" },
      { status: "cancelled" }
    );
  }

  return {
    success: false,
    transaction,
  };
}

module.exports = {
  checkout,
  activateSubscription,
  failSubscription,
};

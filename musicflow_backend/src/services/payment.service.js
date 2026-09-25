const Transaction = require("../models/transaction.model");
const Subscription = require("../models/subscription.model");
const Plan = require("../models/plan.model");
const User = require("../models/user.model");
const Artist = require("../models/artist.model");
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
async function checkout({ planId, paymentMethod, userId, userRole = "user", ipAddress }) {
  // 1. Lấy thông tin gói từ Database để đảm bảo tính an toàn dữ liệu (không tin giá gửi từ Client)
  const plan = await Plan.findById(planId);
  if (!plan || !plan.isActive) {
    const err = new Error("Gói cước không khả dụng hoặc đã bị tắt");
    err.status = 404;
    throw err;
  }

  const isArtist = userRole === "artist";
  const targetRole = plan.targetRole || "user";

  if (isArtist && targetRole !== "artist") {
    const err = new Error("Gói cước này không dành cho nghệ sĩ");
    err.status = 400;
    throw err;
  }
  if (!isArtist && targetRole === "artist") {
    const err = new Error("Gói cước này chỉ dành cho nghệ sĩ");
    err.status = 400;
    throw err;
  }

  // 2. Kiểm tra tài khoản người dùng / nghệ sĩ
  if (isArtist) {
    const artist = await Artist.findById(userId);
    if (!artist) {
      const err = new Error("Nghệ sĩ không tồn tại");
      err.status = 404;
      throw err;
    }
  } else {
    const user = await User.findById(userId);
    if (!user) {
      const err = new Error("Người dùng không tồn tại");
      err.status = 404;
      throw err;
    }
  }

  // 3. Tạo mã tham chiếu giao dịch độc nhất (vnp_TxnRef hoặc Mock Transaction ID)
  // Định dạng: timestamp_6 ký tự cuối của userId
  const transactionRef = `${Date.now()}_${String(userId).slice(-6)}`;

  // 4. Tạo Transaction ở trạng thái pending
  const transactionData = {
    plan: plan._id,
    amount: plan.price,
    paymentMethod,
    transactionRef,
    status: "pending",
    subscriberType: isArtist ? "Artist" : "User",
  };
  if (isArtist) {
    transactionData.artist = userId;
  } else {
    transactionData.user = userId;
  }
  const transaction = await Transaction.create(transactionData);

  // 5. Tạo Subscription ở trạng thái pending để ánh xạ 1-1 với Transaction
  const subscriptionData = {
    plan: plan._id,
    status: "pending",
    transaction: transaction._id,
    subscriberType: isArtist ? "Artist" : "User",
  };
  if (isArtist) {
    subscriptionData.artist = userId;
  } else {
    subscriptionData.user = userId;
  }
  const subscription = await Subscription.create(subscriptionData);

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

    const orderDesc = isArtist
      ? `Thanh toán Studio Pro ${plan.name}`
      : `Thanh toán gói cước premium ${plan.name}`;

    const paymentUrl = vnpayUtil.createPaymentUrl({
      tmnCode,
      hashSecret,
      vnpUrl,
      returnUrl,
      ipAddress,
      amount: plan.price,
      txnRef: transactionRef,
      orderInfo: orderDesc,
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
 * Kích hoạt trạng thái Premium / Pro (Thành công) - Đảm bảo Idempotency nguyên tử
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

  // 4. Phân nhánh xử lý theo subscriberType: Artist vs User
  if (transaction.subscriberType === "Artist") {
    const artist = await Artist.findById(transaction.artist);
    if (!artist) {
      const err = new Error("Không tìm thấy nghệ sĩ sở hữu giao dịch");
      err.status = 404;
      throw err;
    }

    let startDate = new Date();
    const isRenewal = Boolean(artist.isPro && artist.proExpiry && artist.proExpiry > new Date());
    if (isRenewal) {
      startDate = new Date(artist.proExpiry);
    }

    let durationInDays = transaction.plan.durationInDays || 30;
    if (transaction.paymentMethod === "mock") {
      durationInDays = 1;
    }
    const endDate = new Date(startDate.getTime() + durationInDays * 24 * 60 * 60 * 1000);

    // Cập nhật Subscription thành active
    subscription.startDate = startDate;
    subscription.endDate = endDate;
    subscription.status = "active";
    await subscription.save();

    // Cập nhật Artist thành Pro (Tuyệt đối không sửa isVerified)
    artist.isPro = true;
    artist.proExpiry = endDate;
    artist.proPlan = transaction.plan._id;
    await artist.save();

    return {
      success: true,
      alreadyActivated: false,
      transaction,
      subscription,
      artist,
    };
  }

  // 5. Cập nhật thông tin User thông thường
  const user = await User.findById(transaction.user);
  if (!user) {
    const err = new Error("Không tìm thấy người dùng sở hữu giao dịch");
    err.status = 404;
    throw err;
  }

  let startDate = new Date();

  const isRenewal = Boolean(user.isPremium && user.premiumExpiry && user.premiumExpiry > new Date());

  // Logic Gia hạn: Cộng dồn nếu Premium cũ vẫn còn hạn
  if (isRenewal) {
    startDate = new Date(user.premiumExpiry);
  }

  let durationInDays = transaction.plan.durationInDays;
  if (transaction.paymentMethod === "mock") {
    // Để tiện test hết hạn gói cước, giao dịch Mock Payment chỉ được cấp hạn dùng trong 24 giờ (1 ngày)
    durationInDays = 1;
  }
  const endDate = new Date(startDate.getTime() + durationInDays * 24 * 60 * 60 * 1000);

  // Cập nhật Subscription thành active
  subscription.startDate = startDate;
  subscription.endDate = endDate;
  subscription.status = "active";
  await subscription.save();

  // Cập nhật User thành Premium
  user.isPremium = true;
  user.premiumExpiry = endDate;
  user.premiumPlan = transaction.plan._id;
  await user.save();

  // Trigger subscription notification (purchase vs renewal)
  const notificationTriggerService = require("./notificationTrigger.service");
  notificationTriggerService.triggerSubscriptionNotification({
    userId: user._id,
    action: isRenewal ? "renewal" : "purchase",
    planName: transaction.plan?.name || "PREMIUM",
    subscriptionId: subscription._id,
  }).catch((err) => console.error("Subscription notification trigger error:", err.message));

  return {
    success: true,
    alreadyActivated: false,
    transaction,
    subscription,
    user,
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

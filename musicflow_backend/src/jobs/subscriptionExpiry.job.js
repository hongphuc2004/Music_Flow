const Subscription = require("../models/subscription.model");
const Notification = require("../models/notification.model");

const activeLocks = new Set();
const LOCK_KEY = "subscription_expiry_job_lock";

const acquireLock = async (lockKey, safetyTimeoutMs = 30 * 60 * 1000) => {
  if (activeLocks.has(lockKey)) return false;
  activeLocks.add(lockKey);
  // Thúc đẩy an toàn tối đa đề phòng trường hợp deadlock
  setTimeout(() => activeLocks.delete(lockKey), safetyTimeoutMs);
  return true;
};

const releaseLock = async (lockKey) => {
  activeLocks.delete(lockKey);
};

async function checkSubscriptionExpirations() {
  const lockAcquired = await acquireLock(LOCK_KEY);
  if (!lockAcquired) {
    console.log("[Job] Khong the lay duoc Lock. Job dang duoc chay boi process khac.");
    return;
  }

  try {
    console.log("[Job] Bat dau kiem tra han thue bao (Subscription Expiry)...");

    // 1. Tinh toan moc thoi gian theo Timezone Asia/Ho_Chi_Minh (UTC+7)
    const now = new Date();
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + 3);

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(targetDate);
    const year = parts.find((p) => p.type === "year").value;
    const month = parts.find((p) => p.type === "month").value;
    const day = parts.find((p) => p.type === "day").value;
    const dateStr = `${year}-${month}-${day}`; // Dạng YYYY-MM-DD

    // Khởi tạo mốc bắt đầu và kết thúc ngày đích theo Timezone-Aware (+07:00)
    const startOfTargetInUTC = new Date(`${dateStr}T00:00:00.000+07:00`);
    const endOfTargetInUTC = new Date(`${dateStr}T23:59:59.999+07:00`);

    console.log(`[Job] Quet cac Subscription het han tu ${startOfTargetInUTC.toISOString()} den ${endOfTargetInUTC.toISOString()}`);

    // 2. Tim kiem cac subscription sap het han trong ngay dich
    const expiringSubs = await Subscription.find({
      status: "active",
      endDate: { $gte: startOfTargetInUTC, $lte: endOfTargetInUTC },
    }).populate("plan user");

    console.log(`[Job] Da tim thay ${expiringSubs.length} dang ky sap het han sau 3 ngay.`);

    for (const sub of expiringSubs) {
      if (!sub.user || !sub.plan) continue;

      const uniqueKey = `reminder_${sub._id}_${sub.user._id}_3`;

      try {
        const planName = sub.plan.name || "Premium";
        await Notification.create({
          user: sub.user._id,
          title: "Gói dịch vụ sắp hết hạn",
          content: `Gói cước ${planName} của bạn sẽ hết hạn vào ngày ${sub.endDate.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}. Hãy gia hạn để tiếp tục nghe nhạc chất lượng cao không quảng cáo!`,
          type: "subscription",
          uniqueKey,
          metadata: {
            subscriptionId: sub._id,
            alertDays: 3,
          },
        });
        console.log(`[Job] Da tao thong bao het han cho user ${sub.user._id} cua subscription ${sub._id}`);
      } catch (err) {
        if (err.code === 11000) {
          console.log(`[Job] Thong bao cho subscription ${sub._id} da ton tai (Idempotency check).`);
        } else {
          console.error(`[Job] Loi tao thong bao cho subscription ${sub._id}:`, err);
        }
      }
    }

    console.log("[Job] Hoan tat kiem tra han thue bao.");
  } catch (error) {
    console.error("[Job] Loi khi chay Job Subscription Expiry:", error);
  } finally {
    await releaseLock(LOCK_KEY);
  }
}

function startSubscriptionExpiryJob() {
  // Chay ngay khi bat dau
  checkSubscriptionExpirations();

  // Chay dinh ky moi 24 gio
  const INTERVAL_24H = 24 * 60 * 60 * 1000;
  setInterval(() => {
    checkSubscriptionExpirations();
  }, INTERVAL_24H);

  console.log("[Job] Da khoi dong Job quet han thue bao Subscription (Chu ky 24H).");
}

module.exports = {
  checkSubscriptionExpirations,
  startSubscriptionExpiryJob,
};

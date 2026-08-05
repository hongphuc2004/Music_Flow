const crypto = require("crypto");

/**
 * Sắp xếp các tham số theo bảng chữ cái và tạo chuỗi truy vấn để ký/gửi dữ liệu.
 * VNPay yêu cầu mã hóa URL và thay thế khoảng trắng (%20) thành dấu cộng (+).
 */
function buildQueryString(params) {
  const sortedKeys = Object.keys(params).sort();
  const signDataParts = [];
  const queryParts = [];

  for (const key of sortedKeys) {
    const value = params[key];
    if (value !== undefined && value !== null && value !== "") {
      const encodedKey = encodeURIComponent(key);
      const encodedVal = encodeURIComponent(value).replace(/%20/g, "+");
      signDataParts.push(`${encodedKey}=${encodedVal}`);
      queryParts.push(`${encodedKey}=${encodedVal}`);
    }
  }

  const signData = signDataParts.join("&");
  const queryString = queryParts.join("&");
  return { signData, queryString };
}

/**
 * Tạo URL thanh toán VNPay Sandbox
 * @param {object} options
 * @returns {string} Payment URL
 */
function createPaymentUrl({
  tmnCode,
  hashSecret,
  vnpUrl,
  returnUrl,
  ipAddress,
  amount,
  txnRef,
  orderInfo,
  createDate, // Định dạng YYYYMMDDHHmmss
}) {
  const vnpParams = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: tmnCode,
    vnp_Locale: "vn",
    vnp_CurrCode: "VND",
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: "other",
    vnp_Amount: amount * 100, // VNPay yêu cầu nhân 100 (đơn vị xu)
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddress || "127.0.0.1",
    vnp_CreateDate: createDate,
  };

  const { signData, queryString } = buildQueryString(vnpParams);
  
  const hmac = crypto.createHmac("sha512", hashSecret);
  const secureHash = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  return `${vnpUrl}?${queryString}&vnp_SecureHash=${secureHash}`;
}

/**
 * Xác minh chữ ký phản hồi từ VNPay (IPN và Return URL)
 * @param {object} vnpParams - Các tham số nhận về từ VNPay (req.query hoặc req.body)
 * @param {string} hashSecret - Khóa bảo mật VNPay
 * @returns {boolean}
 */
function verifySecureHash(vnpParams, hashSecret) {
  const secureHash = vnpParams["vnp_SecureHash"];
  
  // Tạo bản sao và loại bỏ các tham số chữ ký
  const params = { ...vnpParams };
  delete params["vnp_SecureHash"];
  delete params["vnp_SecureHashType"];

  const { signData } = buildQueryString(params);

  const hmac = crypto.createHmac("sha512", hashSecret);
  const calculatedHash = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  return calculatedHash.toLowerCase() === String(secureHash || "").toLowerCase();
}

module.exports = {
  createPaymentUrl,
  verifySecureHash,
};

const nodemailer = require("nodemailer");
const logger = require("../utils/logger");

function getTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Sends an OTP email for password reset
 * @param {Object} options
 * @param {string} options.toEmail
 * @param {string} options.otpCode
 * @param {string} [options.recipientName]
 * @returns {Promise<boolean>}
 */
async function sendOtpEmail({ toEmail, otpCode, recipientName = "Người dùng" }) {
  const transporter = getTransporter();
  const fromEmail = process.env.EMAIL_FROM || '"MusicFlow" <no-reply@musicflow.com>';

  const htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mã xác thực đặt lại mật khẩu - MusicFlow</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="min-width: 100%; background-color: #0b0f19;">
    <tr>
      <td align="center" style="padding: 40px 15px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background: linear-gradient(145deg, #131b2e 0%, #0d1222 100%); border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 32px 30px 20px 30px; background: linear-gradient(90deg, rgba(108,99,255,0.15) 0%, rgba(0,188,212,0.15) 100%); border-bottom: 1px solid rgba(255,255,255,0.06);">
              <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; background: linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                MusicFlow
              </h1>
              <p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 13px; font-weight: 500;">
                Bảo Mật &amp; Đặt Lại Mật Khẩu
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 30px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #e2e8f0; line-height: 1.6;">
                Xin chào <strong>${recipientName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #94a3b8; line-height: 1.6;">
                Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản MusicFlow liên kết với email <strong>${toEmail}</strong>. Vui lòng sử dụng mã xác thực (OTP) dưới đây để tiếp tục:
              </p>

              <!-- OTP Box -->
              <div style="background: rgba(108, 99, 255, 0.08); border: 1.5px dashed #6c63ff; border-radius: 12px; padding: 22px 16px; text-align: center; margin: 24px 0;">
                <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #00bcd4; font-family: monospace;">
                  ${otpCode}
                </div>
                <div style="margin-top: 10px; font-size: 12px; color: #cbd5e1;">
                  Mã có hiệu lực trong <strong>5 phút</strong>
                </div>
              </div>

              <!-- Security Caution -->
              <div style="background-color: rgba(239, 68, 68, 0.08); border-left: 3px solid #ef4444; border-radius: 4px; padding: 12px 14px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 12px; color: #fca5a5; line-height: 1.5;">
                  <strong>Lưu ý an toàn:</strong> Tuyệt đối không chia sẻ mã này cho bất kỳ ai, kể cả nhân viên hỗ trợ của MusicFlow. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.
                </p>
              </div>

              <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.6;">
                Trân trọng,<br>
                <strong>Đội ngũ bảo mật MusicFlow</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 20px 30px; background-color: rgba(0,0,0,0.25); border-top: 1px solid #1e293b; color: #64748b; font-size: 11px;">
              Email này được tạo tự động từ hệ thống MusicFlow. Vui lòng không trả lời thư này.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  if (!transporter) {
    logger.warn(`[EmailService] SMTP credentials not set. OTP for ${toEmail} is: ${otpCode}`);
    console.log(`\n========================================\n[DEV EMAIL OTP] To: ${toEmail}\nOTP Code: ${otpCode}\n========================================\n`);
    return true;
  }

  const info = await transporter.sendMail({
    from: fromEmail,
    to: toEmail,
    subject: `[MusicFlow] Mã xác thực đặt lại mật khẩu: ${otpCode}`,
    html: htmlContent,
  });

  logger.info(`[EmailService] Sent password reset OTP to ${toEmail}. MessageId: ${info.messageId}`);
  return true;
}

module.exports = {
  sendOtpEmail,
};

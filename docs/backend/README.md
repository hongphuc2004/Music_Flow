# Backend — musicflow_backend

Backend cung cấp hệ thống API RESTful toàn diện cho nền tảng âm nhạc MusicFlow, xây dựng trên nền tảng Node.js / Express 5 và MongoDB, tích hợp đa mô hình AI (Google Gemini & Mistral AI), Cloudinary CDN, và hàng đợi xử lý âm thanh đồng bộ nhịp lời bài hát.

---

## Cấu trúc thư mục

```
musicflow_backend/
├── package.json
├── .env.dev                           ← Cấu hình môi trường local dev
├── .env.prod                          ← Cấu hình production
├── server.js                          ← Entry point (load dotenv + import src/server.js)
└── src/
    ├── server.js                      ← Khởi tạo Express app, rate limiters, routes, OpenGraph sharing, DB
    ├── config/
    │   ├── alignmentConfig.js         ← Cấu hình pipeline căn nhịp lyrics
    │   ├── cloudinary.js              ← SDK Cloudinary
    │   └── cloudinaryFolders.js       ← Định nghĩa thư mục CDN Cloudinary
    ├── middleware/
    │   └── auth.middleware.js         ← verifyToken, verifyAdmin, verifyArtist
    ├── models/                        ← 24 Mongoose models (User, Song, Subscription, Lyrics...)
    ├── controllers/                   ← 12 controllers xử lý HTTP request/response
    │   ├── admin-premium.controller.js
    │   ├── ai.controller.js
    │   ├── artist-analytics.controller.js
    │   ├── artist.controller.js
    │   ├── assistant.controller.js
    │   ├── comment.controller.js
    │   ├── lyrics.controller.js
    │   ├── notification.controller.js
    │   ├── plan.controller.js
    │   ├── playlist.controller.js
    │   ├── song.controller.js
    │   └── subscription.controller.js
    ├── services/                      ← 20 services xử lý nghiệp vụ lõi & AI Suite
    │   ├── adaptiveRecommendation.service.js
    │   ├── aiAutoTagging.service.js
    │   ├── aiLyricsAlignerRouter.service.js
    │   ├── aiModeration.service.js
    │   ├── aiOrchestrator.service.js
    │   ├── aiQuota.service.js
    │   ├── artist-analytics.service.js
    │   ├── assistant.service.js
    │   ├── geminiRouter.service.js
    │   ├── imageGenerator.service.js
    │   ├── lyrics.service.js
    │   ├── mistralEnricher.service.js
    │   ├── mistralProvider.service.js
    │   ├── notificationTrigger.service.js
    │   ├── payment.service.js
    │   ├── personalization.service.js
    │   ├── recommendation.service.js
    │   ├── search.service.js
    │   ├── song.service.js
    │   └── songIntelligence.service.js
    ├── jobs/                          ← Các tác vụ nền tự động (Cron/Interval)
    │   ├── monthlyListeners.job.js    ← Tính toán lượt nghe hàng tháng của nghệ sĩ
    │   ├── subscriptionExpiry.job.js  ← Quét & cập nhật gói cước Premium hết hạn
    │   └── songIntelligence.job.js   ← Quét phân tích AI gắn thẻ nhạc tự động
    ├── routes/                        ← 17 Express routes
    ├── utils/                         ← Tiện ích hỗ trợ (logger winston, string, JWT, Google Auth...)
    └── scripts/                       ← One-off migration & maintenance scripts
```

---

## Dependencies chính

| Package | Phiên bản | Mục đích sử dụng |
|---------|-----------|------------------|
| `express` | ^5.2 | Framework web HTTP engine chính |
| `mongoose` | ^9.1 | MongoDB ODM và Schema definition |
| `jsonwebtoken` | ^9.0 | Tạo và xác thực JWT token (Access & Refresh) |
| `bcrypt` / `bcryptjs` | ^6.0 / ^3.0 | Mã hóa hash mật khẩu người dùng & nghệ sĩ |
| `google-auth-library` | ^10.6 | Xác thực Google OAuth ID token phía backend |
| `cloudinary` | ^1.41 | Lưu trữ & phân phối Audio, Video, Ảnh bìa |
| `multer` | ^2.0 | Xử lý upload multipart/form-data |
| `multer-storage-cloudinary` | ^4.0 | Adapter tích hợp trực tiếp Multer với Cloudinary |
| `@google/generative-ai` | ^0.24 | Google Gemini API (AI DJ, Chatbot, Auto-tagging) |
| `@mistralai/mistralai` | ^2.6 | Mistral AI API (Multi-provider fallback, NLP enricher) |
| `music-metadata` | ^7.14 | Đọc bitrate, codec, duration gốc từ file âm thanh |
| `express-rate-limit` | ^8.6 | Giới hạn tần suất request (chống spam/brute-force) |
| `winston` + `morgan` | ^3.19 + ^1.11 | Hệ thống log chi tiết cấu trúc JSON & file/console |
| `cors` | ^2.8 | Xử lý Cross-Origin Resource Sharing |
| `dotenv` | ^17.3 | Nạp biến môi trường từ file cấu hình |

---

## Khởi động & Môi trường

```bash
cd musicflow_backend

# Chạy môi trường Dev (nodemon tự reload khi đổi code)
npm run dev

# Chạy môi trường Production
npm start
```

### Các biến môi trường (.env.dev / .env.prod)

```env
PORT=5001
NODE_ENV=development

# Database
MONGO_URI=mongodb://127.0.0.1:27017/musicflow_db

# JWT Secrets
JWT_SECRET=your_jwt_secret_key
REFRESH_TOKEN_SECRET=your_refresh_token_secret_key

# Cloudinary CDN
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Google OAuth Client
GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com

# AI API Keys
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
MISTRAL_API_KEY=your_mistral_api_key

# CORS & Domain
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
CLIENT_URL=http://localhost:5173

# Payment Gateway (VNPay Sandbox)
VNPAY_TMN_CODE=your_vnpay_tmn_code
VNPAY_HASH_SECRET=your_vnpay_hash_secret
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://localhost:5173/client/payment/return
```

---

## Luồng xử lý Middleware

```
Incoming Request
  ↓
Trust Proxy Config (hỗ trợ reverse proxy như Render, Cloudflare)
  ↓
CORS verification (kiểm tra origin hợp lệ)
  ↓
Morgan Logger → Pipe tới Winston Stream
  ↓
Rate Limiter:
  ├─ Auth Rate Limiter (50 req / 15 phút trên /api/auth, /login)
  └─ General API Limiter (200 req / 1 phút trên toàn bộ /api)
  ↓
express.json() body parsing
  ↓
OpenGraph Social Share routes (/share/:artistSlug/:songSlug)
  ↓
API Route Matching
  ↓
[Optional] authMiddleware (verifyToken)
  ↓
[Optional] verifyAdmin / verifyArtist
  ↓
[Optional] Multer storage upload
  ↓
Service Layer & Business Controllers
  ↓
Standardized JSON Response
```

---

## Danh sách Route Mounts (`src/server.js`)

```js
// Các route chức năng cốt lõi
app.use("/api/upload",         uploadRoute);
app.use("/api/songs",          songRoute);
app.use("/api/auth",           authRoute);
app.use("/api/topics",         topicRoute);
app.use("/api/playlists",      playlistRoute);
app.use("/api/favorites",      favoriteRoute);
app.use("/api/song-likes",     songLikeRoute);
app.use("/api/users",          userRoute);
app.use("/api/comments",       commentRoute);

// Gói cước Premium & Thanh toán
app.use("/api/plans",          planRoute);
app.use("/api/subscriptions",  subscriptionRoute);
app.use("/api/admin/premium",  adminPremiumRoute);

// Thông báo người dùng
app.use("/api/notifications",  notificationRoute);

// Quản trị viên
app.use("/api/admin",          adminRoute);

// Nghệ sĩ (Upload, quản lý bài hát, lời bài hát, analytics)
app.use("/api/artist",         artistRoute);

// AI DJ & AI Assistant
app.use("/api/ai",             aiRoute);
app.use("/api/ai/assistant",   assistantRoute);

// OpenGraph Social Share Crawlers
app.get("/share/:artistSlug/:songSlug", ...);
app.get("/share/songs/:id", ...);
```

---

## Background Jobs

1. **`monthlyListeners.job.js`**: Chạy định kỳ tính toán tổng số lượt người nghe duy nhất trong 30 ngày qua cho từng nghệ sĩ từ `SongPlayEvent`, cập nhật vào `artist.monthlyListeners`.
2. **`subscriptionExpiry.job.js`**: Tự động rà soát người dùng có `isPremium: true` nhưng `premiumExpiry < now`, thu hồi trạng thái Premium và chuyển trạng thái Subscription sang `expired`.
3. **`songIntelligence.job.js`**: Tác vụ nền tự động gắn thẻ thể loại, mood tags, trích xuất tóm tắt nội dung bài hát bằng AI cho các bài hát mới upload.

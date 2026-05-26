# Backend — musicflow_backend

## Cấu trúc thư mục

```
musicflow_backend/
├── server.js                      ← Entry point (load dotenv, gọi src/server.js)
├── package.json
├── .env.example
└── src/
    ├── server.js                  ← Express app: CORS, middleware, routes, DB
    ├── config/
    │   ├── cloudinary.js          ← Khởi tạo Cloudinary SDK
    │   └── cloudinaryFolders.js   ← Hằng số tên folder + default URLs
    ├── middleware/
    │   └── auth.middleware.js     ← verifyToken, verifyAdmin
    ├── utils/
    │   └── googleAuth.js          ← Verify Google ID token / access token
    ├── models/                    ← 15 Mongoose schemas
    ├── controllers/               ← Business logic
    │   ├── song.controller.js
    │   ├── comment.controller.js
    │   ├── artist.controller.js
    │   └── ai.controller.js
    ├── routes/                    ← Express routers
    └── scripts/
        └── fix-song-source-by-role.js  ← Migration script
```

---

## Dependencies chính

| Package | Mục đích |
|---------|---------|
| `express` ^5.2 | Web framework |
| `mongoose` ^9.1 | MongoDB ODM |
| `jsonwebtoken` ^9 | JWT encode/decode |
| `bcryptjs` ^3 | Hash password |
| `google-auth-library` ^10 | Verify Google OAuth tokens |
| `cloudinary` ^1.41 | Upload/serve audio + image |
| `multer` ^2 | Parse multipart form data |
| `multer-storage-cloudinary` ^4 | Multer storage adapter cho Cloudinary |
| `@google/generative-ai` ^0.24 | Gemini AI API |
| `cors` ^2.8 | CORS headers |
| `dotenv` ^17 | Load .env file |
| `axios` ^1.13 | HTTP client (dùng trong AI controller) |

---

## Khởi động

```bash
cd musicflow_backend

# Dev (nodemon hot reload)
npm run dev

# Production
node server.js
```

---

## Biến môi trường bắt buộc

```env
PORT=5001
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb://127.0.0.1:27017/musicflow_db

# JWT
JWT_SECRET=<your_secret>

# Cloudinary
CLOUDINARY_CLOUD_NAME=<cloud_name>
CLOUDINARY_API_KEY=<api_key>
CLOUDINARY_API_SECRET=<api_secret>

# Google OAuth
GOOGLE_CLIENT_ID=<oauth_client_id>.apps.googleusercontent.com

# Gemini AI
GEMINI_API_KEY=<gemini_key>
GEMINI_MODEL=gemini-2.5-flash   # optional, có fallback chain

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

---

## Middleware chain

```
Request
  ↓
CORS (cors package, origins từ CORS_ORIGINS env)
  ↓
express.json() body parser
  ↓
Rate Limiter (50 req/15min trên /api/auth/*)
  ↓
Route matching
  ↓
[Optional] authMiddleware (verifyToken)
  ↓
[Optional] verifyAdmin
  ↓
[Optional] Multer (file upload)
  ↓
Controller function
  ↓
Response JSON
```

---

## Route mounting

```js
// src/server.js
app.use("/api/auth",       authRoute);
app.use("/api/songs",      songRoute);
app.use("/api/upload",     uploadRoute);
app.use("/api/users",      userRoute);
app.use("/api/playlists",  playlistRoute);
app.use("/api/favorites",  favoriteRoute);
app.use("/api/song-likes", songLikeRoute);
app.use("/api/comments",   commentRoute);
app.use("/api/topics",     topicRoute);
app.use("/api/artist",     artistRoute);
app.use("/api/ai",         aiRoute);
app.use("/api/admin",      adminRoute);
```

---

## Cloudinary folder structure

```
musicflow/              (dev)
musicflow_prod/         (production)
├── audio/             ← File nhạc (.mp3, .wav) — resource_type: "video"
├── images/            ← Ảnh bìa bài hát
├── avatars/           ← Ảnh đại diện user/artist
├── artists/           ← Ảnh bìa nghệ sĩ
├── topics/            ← Ảnh topic/genre
└── playlists/         ← Ảnh bìa playlist
```

> Audio upload với `resource_type: "video"` vì Cloudinary yêu cầu với file âm thanh có duration.

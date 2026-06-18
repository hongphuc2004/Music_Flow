# Tech — Backend (Node.js/Express/MongoDB)

## Stack

| Layer | Lựa chọn |
|-------|---------|
| Runtime | Node.js 18+ |
| Framework | Express 5 |
| Database | MongoDB + Mongoose |
| Auth | JWT (`jsonwebtoken`) + Google OAuth (`google-auth-library`) |
| Storage | Cloudinary + Multer (`multer-storage-cloudinary`) |
| AI | Google Gemini API (`@google/generative-ai`) |
| Password | `bcrypt` / `bcryptjs` |

---

## Cấu trúc thư mục

```
musicflow_backend/
├── server.js              ← Entry (chỉ require dotenv + gọi src/server.js)
└── src/
    ├── server.js          ← Express app: CORS, routes, DB connect, rate limiter
    ├── config/
    │   ├── cloudinary.js          ← Cloudinary config
    │   └── cloudinaryFolders.js   ← Folder constants + default URLs
    ├── controllers/        ← Xử lý request, return JSON
    ├── models/             ← Mongoose schemas
    ├── routes/             ← Express routers
    ├── middleware/
    │   └── auth.middleware.js  ← verifyToken, verifyAdmin, verifyArtist
    ├── utils/
    └── scripts/            ← One-off migration scripts
```

---

## Mongoose Model Convention

```js
const mongoose = require("mongoose");

const songSchema = new mongoose.Schema({
  title:      { type: String, required: true },
  artists:    [{ type: mongoose.Schema.Types.ObjectId, ref: "Artist" }],
  topicIds:   [{ type: mongoose.Schema.Types.ObjectId, ref: "Topic" }],
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
  isPublic:   { type: Boolean, default: false },
  audioUrl:   { type: String, required: true },
  imageUrl:   { type: String, default: "" },
  source:     { type: String, enum: ["admin", "artist", "user"], default: "admin" },
  playCount:  { type: Number, default: 0 },
  likeCount:  { type: Number, default: 0 },
}, { timestamps: true });  // BẮT BUỘC — tự thêm createdAt, updatedAt

module.exports = mongoose.model("Song", songSchema);
```

**Rules:**
- `timestamps: true` mọi schema — không tự thêm `createdAt`/`updatedAt`
- PK là `ObjectId` (Mongoose tự tạo `_id`) — không dùng int
- `ref` phải đúng tên Model (case-sensitive, khớp với `mongoose.model("Name", ...)`)
- Enum: luôn khai báo để tránh giá trị rác vào DB
- Không dùng soft delete — xóa thật hoặc dùng `isPublic: false`

---

## Controller Pattern

```js
// controllers/song.controller.js
const Song = require("../models/song.model");

exports.getSongs = async (req, res) => {
  try {
    const { page = 1, limit = 20, topicId } = req.query;
    const filter = { isPublic: true };
    if (topicId) filter.topicIds = topicId;

    const songs = await Song.find(filter)
      .populate("artists", "name avatar")
      .populate("topicIds", "name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Song.countDocuments(filter);
    return res.json({ success: true, data: songs, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
```

**Response format chuẩn:**
```js
{ success: true, data: ... }                            // 200 list
{ success: true, data: ..., total, page, limit }        // 200 paginated
{ success: true, message: "Deleted successfully" }      // 200 action
{ success: false, message: "Not found" }                // 404
{ success: false, message: error.message }              // 500
```

---

## Auth Middleware

```js
// middleware/auth.middleware.js
const jwt = require("jsonwebtoken");

exports.verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.userRole = decoded.role;  // "admin" | "artist" | "user"
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

exports.verifyAdmin = (req, res, next) => {
  if (req.userRole !== "admin") return res.status(403).json({ success: false, message: "Admin only" });
  next();
};
```

---

## Route Convention

```js
// routes/song.route.js
const router = require("express").Router();
const { verifyToken, verifyAdmin } = require("../middleware/auth.middleware");
const songController = require("../controllers/song.controller");

router.get("/", songController.getSongs);                           // public
router.get("/:id", songController.getSongById);                    // public
router.post("/", verifyToken, songController.createSong);          // auth required
router.put("/:id", verifyToken, songController.updateSong);
router.delete("/:id", verifyToken, verifyAdmin, songController.deleteSong);

module.exports = router;
```

**App mounting (src/server.js):**
```js
app.use("/api/songs", songRoute);
app.use("/api/auth", authRoute);
app.use("/api/artist", artistRoute);
app.use("/api/ai", aiRoute);
```

---

## Naming Conventions

| Type | Pattern | Ví dụ |
|------|---------|-------|
| Model | `{name}.model.js` | `song.model.js` |
| Controller | `{name}.controller.js` | `song.controller.js` |
| Route | `{name}.route.js` | `song.route.js` |
| Route prefix | `/api/{names}` (plural, kebab-case) | `/api/songs`, `/api/song-likes` |
| Env var | `UPPER_SNAKE_CASE` | `JWT_SECRET`, `MONGO_URI` |

---

## Nguyên tắc

- `async/await` mọi nơi, không callback
- `try/catch` trong mọi controller — không để unhandled rejection
- Không hardcode URL hay secret — luôn qua `process.env.*`
- Không thêm ORM/ODM mới — chỉ Mongoose
- Rate limiter tự implement (xem `src/server.js`) — không thêm `express-rate-limit`
- Env từ `.env.dev` / `.env.prod` tương ứng Docker profile

# AGENTS.md — Codex Instructions for MusicFlow

> Converted from `.claude/` for OpenAI Codex / Codex CLI.
> Place this file at the repository root: `Music_Flow/AGENTS.md`.
> Codex should follow these instructions for all work in this repo.

---

## How Codex should work in this repo

- Always inspect the relevant module before editing.
- Prefer small, safe changes over broad rewrites.
- Do not commit secrets, tokens, `.env`, API keys, database URLs, or credential files.
- Do not hardcode API URLs or secrets; use environment variables/config files.
- When changing behavior, update the matching service/component and check related call sites.
- Before finalizing code changes, run the most relevant checks that are available locally.
- Explain what changed, where, and what to test.

---

# MusicFlow Project Context

Dự án cá nhân: **MusicFlow** — Hệ sinh thái ứng dụng âm nhạc đa nền tảng.

---

## Ngữ cảnh dự án

MusicFlow gồm 3 thành phần:

```
Music_Flow/
├── .claude/             ← Claude Code config (thư mục này)
├── musicflow_backend/   ← Node.js/Express + MongoDB
├── musicflow_web/       ← React 19 + Vite + MUI
└── musicflow_app/       ← Flutter (Android, iOS, Web, Desktop)
```

**Tính năng chính:**
- Nghe nhạc online, playlist cá nhân, yêu thích
- Tìm kiếm bài hát, nghệ sĩ, album
- Upload nhạc (artist)
- AI DJ — mood-based playlist bằng Gemini API
- Bảng xếp hạng, thể loại
- Đăng ký/đăng nhập, Google OAuth

---

## Tech Stack

### Backend (`musicflow_backend/`)
- **Runtime:** Node.js 18+ + Express 5
- **Database:** MongoDB + Mongoose
- **Auth:** JWT (access 1h + refresh) + Google OAuth (`google-auth-library`)
- **Storage:** Cloudinary (audio + image) + Multer
- **AI:** Google Gemini API (`@google/generative-ai`)
- **Roles:** `admin`, `artist`, `user`
- **API prefix:** `/api/*`
- Entry: `src/server.js`

### Web (`musicflow_web/`)
- **Framework:** React 19 + Vite
- **UI:** MUI v7 (Material UI) — theme primary `#6c63ff`, secondary `#00bcd4`
- **Router:** React Router DOM v7
- **HTTP:** Axios qua `src/services/api.js`
- **Language:** JavaScript (JSX) — không TypeScript
- **Auth state:** `localStorage` (role, accessToken, refreshToken)
- **Portals:** Admin (`/`) · Artist (`/artist/*`) · Client/User (`/client/*`)

### Mobile (`musicflow_app/`)
- **Framework:** Flutter (Dart) — Expo managed KHÔNG dùng
- **Audio:** `just_audio` + `audio_service` + `audio_session`
- **HTTP:** `http` package
- **Storage:** `flutter_secure_storage` (token) + `Hive` (offline cache)
- **Auth:** `google_sign_in`
- **AI:** `speech_to_text` (voice search cho AI DJ)

---

## Codex Prompt Shortcuts

| Command | Khi nào dùng |
|---------|-------------|
| `mf` | Xem `.codex/prompts/mf.md` |
| `mf-task` | Bắt đầu feature/fix — phân tích codebase, code |
| `mf-reviewcode` | Review code trước khi ship |
| `mf-test` | Chạy test |
| `mf-ship` | Push branch + tạo PR |
| `mf-reviewpr` | Review PR |

**Workflow đơn giản (solo):**
```
code → mf-reviewcode → mf-ship
```

---

## Cấu trúc hệ thống

```
[Flutter App]          [React Web]
      ↓                    ↓
  [Node.js/Express API — /api/*]
      ↓                    ↓
  [MongoDB]          [Cloudinary]
      ↓
  [Gemini AI API]
```

---

## Rules

| File | Nội dung |
|------|----------|
| `rules/tech/be.md` | Node.js/Express/MongoDB conventions |
| `rules/tech/fe.md` | React + MUI + Vite conventions |
| `rules/tech/mobile.md` | Flutter conventions |
| `rules/workflow.md` | Git flow + workflow solo dev |


---

# Memory — MusicFlow

> Thông tin bổ sung không có trong rules/tech/ hay CLAUDE.md.

---

## Môi trường

| Môi trường | Backend port | Web port | MongoDB |
|-----------|-------------|---------|---------|
| Dev | 5001 | 5173 | localhost:27017 |
| Prod | 5000 | 8080 | MongoDB Atlas |

**Docker Compose:**
```bash
docker compose --profile dev up --build   # dev
docker compose --profile prod up --build -d  # prod
```

---

## Deploy

| Service | Platform | Config |
|---------|---------|--------|
| Backend | Render | Root: `musicflow_backend`, Start: `npm start` |
| Web | Vercel | Root: `musicflow_web`, Build: `npm run build`, Out: `dist` |
| Database | MongoDB Atlas | M0 cluster |

**Vercel env:**
```
VITE_API_URL=https://<render-domain>.onrender.com/api
VITE_GOOGLE_CLIENT_ID=<google-oauth-client-id>
```

**Render env:**
```
NODE_ENV=production
MONGO_URI=mongodb+srv://...
JWT_SECRET=...
CORS_ORIGINS=https://<vercel-domain>
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
GOOGLE_CLIENT_ID=...
GEMINI_API_KEY=...
```

---

## AI DJ — Gemini Integration

- Model: `gemini-2.5-flash` → fallback `gemini-2.0-flash` → `gemini-1.5-flash-latest`
- Mood map: sad, happy, chill, focus, energetic, romantic, sleep, party, angry
- Max playlist: 20 bài
- Logic: phân tích mood → match topic → rank song theo playCount/likeCount
- Lưu lịch sử: `MoodConversation`, `MoodMessage`, `MoodPlaylist`

---

## Lỗi thường gặp khi deploy

| Lỗi | Nguyên nhân | Fix |
|-----|------------|-----|
| `origin_mismatch` Google | Thiếu domain trong JS origins | Thêm vào Google Cloud Console |
| `Not allowed by CORS` | Thiếu domain trong `CORS_ORIGINS` | Thêm vào Render env |
| `/accountlogin 404` | SPA route chưa có rewrite | `musicflow_web/vercel.json` đã fix |
| `querySrv ENOTFOUND` | Sai `MONGO_URI` | Check password có `@` → encode thành `%40` |

---

## Cloudinary Folder Structure

```
musicflow/
├── songs/     ← audio files
├── images/    ← song thumbnails
└── avatars/   ← user/artist avatars
```


---

## Workflow Rules

# Workflow — MusicFlow (Solo Dev)

## Vòng đời một task

```
code → /mf-reviewcode → /mf-ship
```

Không cần plan.md bắt buộc, không cần approve từ ai.

---

## Git

- Branch: `feature/ten-ngan` hoặc `fix/ten-bug`
- Commit: `feat: mô tả` / `fix: mô tả` / `refactor: mô tả` / `chore: mô tả`
- PR vào `main` — có thể self-merge (solo project)
- Không push thẳng vào `main`

---

## Dev commands hàng ngày

```bash
# Backend
cd musicflow_backend
npm run dev        # nodemon src/server.js — hot reload

# Web
cd musicflow_web
npm run dev        # Vite dev server — http://localhost:5173

# Flutter
cd musicflow_app
flutter run        # chọn device
flutter run --dart-define=API_BASE_URL=http://<lan-ip>:5001  # physical device
```

---

## Test

| Layer | Lệnh | Ghi chú |
|-------|------|---------|
| Backend | `npm test` | Nếu có Jest |
| Web | `npm run lint` | ESLint check |
| Flutter | `flutter test` | Widget tests |

---

## Definition of Done

Task xong khi:
1. `/mf-reviewcode` → PASS (không có lỗi nghiêm trọng)
2. Chạy thủ công trên localhost — feature hoạt động đúng
3. PR merge vào `main`

---

## Quy tắc bắt buộc

- Không commit `.env` — chỉ commit `.env.example`
- Không hardcode URL hay secret trong code
- Không push thẳng vào `main` — luôn qua PR


---

## Backend Rules

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


---

## Web Frontend Rules

# Tech — Frontend Web (React + MUI)

## Stack

| Quyết định | Lựa chọn | Ghi chú |
|-----------|---------|---------|
| Framework | React 19 + Vite | |
| UI | MUI v7 (Material UI) | Không dùng shadcn/Tailwind |
| Router | React Router DOM v7 | `BrowserRouter` + `Routes` + `Route` |
| HTTP | Axios | Qua `src/services/api.js` |
| Language | JavaScript (JSX) | Không TypeScript |
| Auth state | `localStorage` | `role`, `accessToken`, `refreshToken` |
| Theme | primary `#6c63ff`, secondary `#00bcd4` | Đã cấu hình trong `App.jsx` |

---

## Cấu trúc `src/`

```
src/
├── main.jsx
├── App.jsx                       ← ThemeProvider, ClientPlayerProvider, Router, Routes
├── components/
│   └── Layout/
│       ├── admin/
│       │   ├── Layout.jsx        ← Admin layout (sidebar + header)
│       │   ├── Header.jsx
│       │   └── Sidebar.jsx
│       ├── artist/
│       │   ├── ArtistLayout.jsx
│       │   ├── ArtistHeader.jsx
│       │   └── ArtistSidebar.jsx
│       └── client/
│           ├── ClientLayout.jsx
│           ├── ClientHeader.jsx
│           ├── ClientSidebar.jsx
│           ├── NowPlayingBar.jsx       ← Audio player bar
│           ├── ClientPlayerProvider.jsx ← Audio state context
│           └── SongMoreMenu.jsx
├── pages/
│   ├── AccountLogin.jsx          ← Login chung (user + artist redirect)
│   ├── admin/                    ← Dashboard, Accounts, Songs, Topics, Playlists, Settings
│   ├── artist/                   ← ArtistDashboard, ArtistSong, ArtistAnalytics, ArtistProfile
│   └── client/                   ← ClientHome, ClientDiscover, ClientLibrary, ClientFavorites...
├── services/
│   └── api.js                    ← Axios instance + tất cả API call functions
└── utils/
    ├── artistSession.js
    ├── artistProfile.js
    └── lyrics.js
```

---

## Roles và Route Protection

3 roles: `admin`, `artist`, `user` — lưu trong `localStorage.getItem("role")`.

```jsx
// App.jsx — ProtectedRoute đã có sẵn
const ProtectedRoute = ({ children, role }) => {
  const userRole = localStorage.getItem("role");
  if (!userRole) return <Navigate to={role === "artist" ? "/artistlogin" : "/accountlogin"} replace />;
  if (role && userRole !== role) return <Navigate to={roleDefaultRoute[userRole] || "/accountlogin"} replace />;
  return children;
};
```

**Routes theo role:**
```
/              → admin Dashboard    (ProtectedRoute role="admin")
/artist/*      → Artist portal      (ProtectedRoute role="artist")
/client/*      → User/Client portal (ProtectedRoute role="user")
/accountlogin  → login page (PublicRoute)
/adminlogin    → admin login (PublicRoute)
/artistlogin   → artist login (PublicRoute)
```

---

## API Convention

Tất cả API calls qua `src/services/api.js`:

```js
// src/services/api.js
import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

// Interceptor: tự attach token
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default API;
```

**Không gọi `axios.*` trực tiếp trong component hoặc page** — luôn qua `services/api.js`.

---

## Naming Conventions

| Type | Pattern | Ví dụ |
|------|---------|-------|
| Page | `{Role}{Name}.jsx` | `ClientHome.jsx`, `ArtistDashboard.jsx` |
| Layout | `{Role}Layout.jsx` | `ArtistLayout.jsx` |
| Generic component | `PascalCase.jsx` | `NowPlayingBar.jsx`, `SongMoreMenu.jsx` |
| Utility | `camelCase.js` | `artistSession.js` |
| Env var | `VITE_UPPER_SNAKE` | `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID` |

---

## Nguyên tắc

- UI dùng MUI components — không tự viết CSS từ đầu nếu MUI có sẵn
- Không TypeScript — thuần JSX
- Không tạo Axios instance mới — chỉ dùng `src/services/api.js`
- Không hardcode URL — dùng `import.meta.env.VITE_API_URL`
- Không thêm state management library — `localStorage` cho auth, `useState`/`useContext` cho UI
- SPA route rewrite đã config trong `vercel.json` — không cần thay đổi
- `ClientPlayerProvider` là global audio context cho toàn bộ Client portal


---

## Mobile Rules

# Tech — Mobile (Flutter)

## Stack

| Quyết định | Lựa chọn | Ghi chú |
|-----------|---------|---------|
| Framework | Flutter (Dart) | SDK ^3.9.2 |
| Audio | `just_audio` + `audio_service` + `audio_session` | Background play, lock screen controls |
| HTTP | `http` package | Không dùng Dio |
| Auth | `flutter_secure_storage` (token) + `google_sign_in` | |
| Local cache | `Hive` + `hive_flutter` | Offline songs |
| AI | `speech_to_text` | Voice input cho AI DJ |
| File | `file_picker` + `path_provider` | Upload nhạc |
| Image | `image_picker` | Avatar |
| Storage (offline) | `shared_preferences` | Settings nhẹ |

---

## Cấu trúc `lib/`

```
lib/
├── main.dart
├── core/
│   ├── audio/
│   │   ├── audio_handler.dart       ← AudioHandler cho audio_service
│   │   ├── audio_player_service.dart ← just_audio wrapper
│   │   └── global_audio_state.dart  ← State toàn app
│   ├── config/
│   │   └── api_config.dart          ← API base URL (dart-define)
│   └── utils/
│       └── lrc_parser.dart          ← Parse LRC lyrics
│
├── data/
│   ├── models/                      ← Data classes (song, playlist, artist...)
│   └── services/                    ← API calls qua http package
│       ├── song_api_service.dart
│       ├── auth_service.dart
│       ├── playlist_api_service.dart
│       ├── artist_api_service.dart
│       └── offline_song_service.dart ← Hive offline
│
└── presentation/
    ├── screens/
    │   ├── home/           ← HomeScreen + sections
    │   ├── player/         ← PlayerScreen (full player)
    │   ├── search/         ← SearchScreen
    │   ├── library/        ← LibraryScreen, PlaylistsScreen, FavoritesScreen, HistoryScreen
    │   ├── artist/         ← ArtistScreen
    │   ├── ai_dj/          ← AI DJ Screen (Gemini chat)
    │   ├── chart/          ← FlowchartScreen (bảng xếp hạng)
    │   ├── login/          ← LoginScreen, RegisterScreen
    │   ├── settings/       ← SettingsScreen, EditProfileScreen
    │   └── splash/         ← SplashScreen
    └── widgets/
        ├── mini_player.dart           ← Player mini bar
        ├── mini_player_wrapper.dart
        ├── song_options_menu.dart
        ├── song_comments_sheet.dart
        ├── player_bottom_action_bar.dart
        └── synced_lyrics_view.dart    ← LRC karaoke view
```

---

## API Config

URL backend truyền qua `--dart-define`:

```dart
// lib/core/config/api_config.dart
class ApiConfig {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:5001',  // Android emulator → localhost
  );
}
```

```bash
# Run với custom URL
flutter run --dart-define=API_BASE_URL=http://192.168.1.x:5001

# Build APK production
flutter build apk --dart-define=API_BASE_URL=https://<render-domain>.onrender.com
```

---

## Naming Conventions

| Type | Pattern | Ví dụ |
|------|---------|-------|
| Screen | `{name}_screen.dart` | `home_screen.dart` |
| Widget | `{name}.dart` | `mini_player.dart` |
| Model | `{name}_model.dart` | `song_model.dart` |
| Service | `{name}_service.dart` | `song_api_service.dart` |
| Section widget | `{screen}_{section}_section.dart` | `home_artist_section.dart` |

---

## Audio Architecture

```
audio_service (background)
    └── AudioHandler (audio_handler.dart)
            └── just_audio AudioPlayer
                    └── audio_session (iOS/Android session management)

global_audio_state.dart ← ChangeNotifier/ValueNotifier for UI
```

- `AudioHandler` handles media controls (play/pause/skip) từ lock screen / notification
- `global_audio_state.dart` expose current song, position, queue cho UI
- `MiniPlayerWrapper` wrap mọi screen để mini player luôn hiển thị

---

## Nguyên tắc

- Không eject/modify native code nếu không cần thiết
- Token lưu bằng `flutter_secure_storage` — không dùng `SharedPreferences` cho token
- HTTP qua `http` package — không thêm Dio
- Offline cache dùng `Hive` — không dùng SQLite cho scope hiện tại
- Background audio qua `audio_service` — không tự implement Android service
- Không thêm package mới nếu stack hiện tại đủ dùng

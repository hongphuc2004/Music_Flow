# Claude Agent System — MusicFlow

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

## Commands

| Command | Khi nào dùng |
|---------|-------------|
| `/mf` | Hiện menu lệnh |
| `/mf-task` | Bắt đầu feature/fix — phân tích codebase, code |
| `/mf-reviewcode` | Review code trước khi ship |
| `/mf-test` | Chạy test |
| `/mf-ship` | Push branch + tạo PR |
| `/mf-reviewpr` | Review PR |

**Workflow đơn giản (solo):**
```
code → /mf-reviewcode → /mf-ship
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

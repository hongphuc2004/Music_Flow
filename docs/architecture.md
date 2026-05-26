# Kiến trúc hệ thống — MusicFlow

## Sơ đồ tổng thể

```
┌─────────────────────────────────────────────────────────┐
│                      CLIENTS                            │
│                                                         │
│  ┌──────────────────┐      ┌──────────────────────┐    │
│  │   Flutter App    │      │     React Web App    │    │
│  │  (Android/iOS)   │      │   (Admin/Artist/User │    │
│  │                  │      │       Portals)        │    │
│  └────────┬─────────┘      └──────────┬───────────┘    │
└───────────┼───────────────────────────┼────────────────┘
            │                           │
            │     HTTPS / REST API      │
            ▼                           ▼
┌───────────────────────────────────────────────────────┐
│              Node.js / Express Backend                │
│                     /api/*                            │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │   Auth   │  │  Songs   │  │    AI DJ         │   │
│  │  Routes  │  │  Routes  │  │  (Gemini API)    │   │
│  └──────────┘  └──────────┘  └──────────────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │Playlists │  │ Comments │  │  Admin Routes    │   │
│  │  Routes  │  │  Routes  │  │                  │   │
│  └──────────┘  └──────────┘  └──────────────────┘   │
└────────┬──────────────────┬────────────────────────┘
         │                  │
         ▼                  ▼
   ┌──────────┐      ┌────────────┐
   │ MongoDB  │      │ Cloudinary │
   │ Database │      │  Storage   │
   │          │      │(audio+img) │
   └──────────┘      └────────────┘
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Mobile App** | Flutter + Dart | SDK ^3.9.2 |
| **Web App** | React + Vite | React 19 |
| **Backend** | Node.js + Express | Express 5 |
| **Database** | MongoDB + Mongoose | Mongoose 9 |
| **File Storage** | Cloudinary | SDK v1 |
| **AI** | Google Gemini API | `@google/generative-ai` ^0.24 |
| **Auth** | JWT + Google OAuth | `google-auth-library` |

---

## Luồng dữ liệu chính

### 1. Phát nhạc (Streaming)

```
Flutter App
  └─ GlobalAudioState.playSong(song)
       ├─ Kiểm tra offline → file:///local_path
       └─ Stream từ server → GET /api/songs/:id/stream
            └─ Backend proxy 206 Partial Content từ Cloudinary
                 └─ AudioPlayer (just_audio) nhận stream
```

### 2. Đăng nhập

```
User nhập email/password  →  POST /api/auth/login
                               └─ bcrypt.compare(password, hash)
                                    └─ JWT access (2h) + refresh (30d)
                                         └─ Token lưu flutter_secure_storage
```

```
User nhấn Google Sign-In  →  google_sign_in package
                               └─ idToken/accessToken
                                    └─ POST /api/auth/google
                                         └─ google-auth-library verify
                                              └─ JWT access + refresh
```

### 3. AI DJ

```
User nhập mood prompt  →  POST /api/ai/playlist {prompt, conversationId}
                            └─ Gemini: phân tích mood (sad/happy/chill...)
                                 └─ Match Topics + Artists từ MongoDB
                                      └─ Chọn songs phù hợp
                                           └─ Gemini: generate text response
                                                └─ Lưu MoodPlaylist + Messages
                                                     └─ Flutter: render playlist
```

### 4. Upload nhạc

```
Flutter/Web chọn file  →  POST /api/songs (multipart/form-data)
                            └─ Multer parse file
                                 └─ multer-storage-cloudinary → upload audio
                                      └─ Upload image (hoặc dùng default)
                                           └─ Tạo Song document MongoDB
                                                └─ Trả về song object
```

---

## Môi trường

### Backend ports
- Dev: `http://localhost:5001`
- Prod: `https://music-flow-30us.onrender.com`

### Web
- Dev: `http://localhost:5173`
- Prod: Vercel deployment

### Flutter API endpoint
- Android emulator: `http://10.0.2.2:5001`
- Physical device: `http://<LAN-IP>:5001`
- Production: `https://music-flow-30us.onrender.com`

---

## Vai trò người dùng

| Role | Khả năng |
|------|---------|
| `user` | Nghe nhạc, tạo playlist cá nhân, yêu thích, comment, upload nhạc cá nhân |
| `artist` | Tất cả của `user` + có profile nghệ sĩ, bài hát mặc định public |
| `admin` | Full CRUD trên tất cả tài nguyên, dashboard, quản lý tài khoản |

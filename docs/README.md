# MusicFlow — Tài liệu kỹ thuật

> Hệ sinh thái ứng dụng âm nhạc đa nền tảng: Flutter mobile app + React web + Node.js/Express backend.

---

## Mục lục

### Tổng quan hệ thống
- [Kiến trúc hệ thống](./architecture.md) — Sơ đồ tổng thể, luồng dữ liệu, tech stack

### Backend (`musicflow_backend`)
- [Backend overview](./backend/README.md) — Cấu trúc, cách chạy, môi trường
- [API Reference](./backend/api.md) — Toàn bộ endpoints (method, path, auth, mô tả)
- [Database Models](./backend/models.md) — Tất cả Mongoose schemas
- [Auth Flow](./backend/auth.md) — JWT, Google OAuth, refresh token
- [AI DJ — Backend](./backend/ai.md) — Gemini integration, mood analysis, playlist generation

### Mobile App (`musicflow_app`)
- [App overview](./mobile/README.md) — Cấu trúc dự án, dependencies, cách build
- [Kiến trúc app](./mobile/architecture.md) — Layers, navigation, dependency graph
- [Audio System](./mobile/audio-system.md) — just_audio, audio_service, GlobalAudioState
- [Màn hình & Navigation](./mobile/screens.md) — Tất cả screens, widget tree
- [State Management](./mobile/state-management.md) — ChangeNotifier, SharedPreferences, Hive
- [Authentication](./mobile/auth.md) — Login, Google Sign-In, token management
- [AI DJ — Mobile](./mobile/ai-dj.md) — Mood chat UI, playlist generation
- [Offline & Downloads](./mobile/offline.md) — Download flow, quota, LRU eviction
- [API Integration](./mobile/api-calls.md) — Services layer, endpoints, error handling

---

## Cấu trúc repo

```
Music_Flow/
├── docs/                   ← Tài liệu kỹ thuật (thư mục này)
├── musicflow_backend/      ← Node.js + Express + MongoDB
├── musicflow_web/          ← React 19 + Vite + MUI
└── musicflow_app/          ← Flutter (Android, iOS, Web, Desktop)
```

## Khởi động nhanh

```bash
# Backend
cd musicflow_backend
npm run dev          # nodemon → http://localhost:5001

# Web
cd musicflow_web
npm run dev          # Vite → http://localhost:5173

# Flutter (Android emulator)
cd musicflow_app
flutter run          # chọn device
```

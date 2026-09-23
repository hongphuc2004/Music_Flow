# MusicFlow — Tài liệu Kỹ thuật Dự án

> Hệ sinh thái ứng dụng âm nhạc đa nền tảng toàn diện: **Flutter Mobile App** + **React 19 Web App** + **Node.js/Express Backend** + **AI Lyrics Alignment Worker**.

---

## Mục lục Tài liệu

### 1. Kiến trúc Tổng quan
- [Kiến trúc hệ thống](./architecture.md) — Sơ đồ 4 thành phần, luồng dữ liệu, tech stack tổng thể.

### 2. Backend API (`musicflow_backend`)
- [Backend Overview](./backend/README.md) — Cấu trúc dự án, môi trường, background jobs, middleware chain.
- [Database Models](./backend/models.md) — Toàn bộ 24 Mongoose Schemas (User, Song, Plan, Subscription, Lyrics...).
- [API Reference](./backend/api.md) — Toàn bộ 18 nhóm REST endpoints chi tiết.
- [Authentication Flow](./backend/auth.md) — Quy trình xác thực JWT, Google OAuth, Refresh token.
- [AI Architecture & Suite](./backend/ai.md) — AI Orchestrator, Gemini Multi-model, Mistral Enricher, Auto-Tagging & Moderation.

### 3. Mobile App (`musicflow_app`)
- [Mobile Overview](./mobile/README.md) — Cấu trúc thư mục Flutter, dependencies, hướng dẫn build APK.
- [Màn hình & Navigation](./mobile/screens.md) — Cây điều hướng, Floating Navigation, màn hình AI Assistant, Premium, Bottom Sheets.
- [Hệ thống Âm thanh](./mobile/audio-system.md) — Engine phát nhạc just_audio, audio_service background, GlobalAudioState.
- [API Integration](./mobile/api-calls.md) — Chi tiết các API Services, Playback ticket, Quota.
- [Trải nghiệm AI trên Mobile](./mobile/ai-dj.md) — Voice AI DJ Bottom Sheet, AI Assistant Screen và Floating Orb.
- [Tải nhạc & Nghe Ngoại tuyến](./mobile/offline.md) — Cơ chế lưu trữ offline Hive NoSQL, hạn mức quota bộ nhớ.
- [Quản lý Trạng thái](./mobile/state-management.md) — Luồng dữ liệu ChangeNotifier và đồng bộ local.

### 4. Web Frontend (`musicflow_web`)
- [Web Overview & 3 Portals](./web/README.md) — React 19 + MUI v7, kiến trúc 3 cổng Client, Artist và Admin, Karaoke Player.

### 5. Dịch vụ AI Lyrics Alignment (`musicflow_lyrics_sync`)
- [Hướng dẫn Triển khai Render](./deploy_lyrics_sync_render.md) — Cách chạy Worker 24/7 với Docker trên Render.
- [Pipeline Căn nhịp Tự động](./lyrics_alignment_pipeline.md) — Kiến trúc xử lý âm thanh AI Whisper, tạo mốc thời gian karaoke [mm:ss.xx].

---

## Cấu trúc Mã nguồn Dự án

```
Music_Flow/
├── docs/                      ← Thư mục tài liệu kỹ thuật dự án (thư mục này)
├── musicflow_backend/         ← Node.js / Express 5 + MongoDB (API & AI Suite)
├── musicflow_web/             ← React 19 + Vite + MUI v7 (Client, Artist, Admin)
├── musicflow_app/             ← Flutter (Android, iOS, Web, Desktop)
└── musicflow_lyrics_sync/     ← Worker Python / Whisper AI căn nhịp lời bài hát
```

---

## Khởi động Nhanh Dự án

```bash
# 1. Chạy Backend (Cổng 5001)
cd musicflow_backend
npm run dev

# 2. Chạy Web Frontend (Cổng 5173)
cd musicflow_web
npm run dev

# 3. Chạy Ứng dụng Di động Flutter
cd musicflow_app
flutter run

# 4. Chạy AI Lyrics Alignment Worker (nếu thử nghiệm cục bộ)
cd musicflow_lyrics_sync
python main.py
```

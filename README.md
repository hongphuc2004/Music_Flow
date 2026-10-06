# 🎵 MusicFlow — Hệ Sinh Thái Ứng Dụng Âm Nhạc Đa Nền Tảng

MusicFlow là một hệ sinh thái ứng dụng quản lý, phát nhạc trực tuyến và sáng tạo âm nhạc đa nền tảng, bao gồm 4 phân hệ chính:

- 🚀 [**musicflow_backend/**](./musicflow_backend/README.md): RESTful API Node.js/Express 5 phục vụ nghiệp vụ, xác thực JWT & Google OAuth, upload đa phương tiện Cloudinary và AI DJ / Semantic Search qua Gemini API.
- 🌐 [**musicflow_web/**](./musicflow_web/README.md): Giao diện web đa cổng (Admin, Artist, Client) xây dựng bằng React 19 + Vite + Material UI (MUI v7).
- 📱 [**musicflow_app/**](./musicflow_app/README.md): Ứng dụng di động Flutter (Android & iOS) phát nhạc nền (background audio), hát karaoke theo lyric LRC và trợ lý giọng nói AI.
- 🎙️ [**musicflow_lyrics_sync/**](./musicflow_lyrics_sync/README.md): Worker AI chuyên dụng (Python) tự động bóc tách lời từ audio (Gemini Flash / Faster-Whisper) và căn nhịp âm học chuẩn phòng thu từng từ (Wav2Vec2 CTC ONNX INT8).

---

## 📋 Yêu Cầu Hệ Thống (Prerequisites)

Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đã cài đặt:
- **Node.js**: v18+ (khuyên dùng Node 20 LTS)
- **Python**: 3.10+ (kèm `ffmpeg` nếu chạy module `musicflow_lyrics_sync`)
- **Flutter SDK**: v3.19+ (kèm Android SDK hoặc Xcode nếu chạy app di động)
- **MongoDB**: Đã cài đặt cục bộ (cổng `27017`) hoặc chuỗi kết nối **MongoDB Atlas**
- **Docker & Docker Compose**: Để chạy nhanh toàn bộ hệ sinh thái mà không cần cài lẻ tẻ từng môi trường

---

## ⚡ Hướng Dẫn Cài Đặt Từng Phân Hệ

Xem hướng dẫn chi tiết tại README của từng thư mục:

| Thư mục | Mô tả & Hướng dẫn | Lệnh khởi chạy nhanh |
| :--- | :--- | :--- |
| [`musicflow_backend/`](./musicflow_backend/README.md) | API Server Node.js/Express | `npm run dev` (cổng 5001) |
| [`musicflow_web/`](./musicflow_web/README.md) | Web React 19 + MUI | `npm run dev` (cổng 5173) |
| [`musicflow_lyrics_sync/`](./musicflow_lyrics_sync/README.md) | AI Lyrics & LRC Worker Python | `python main.py` |
| [`musicflow_app/`](./musicflow_app/README.md) | App di động Flutter | `flutter run` |

---

## 🐳 Khởi Chạy Nhanh Toàn Bộ Bằng Docker

Nếu máy bạn đã cài đặt Docker và Docker Compose, bạn có thể khởi chạy toàn bộ dịch vụ (Backend, Web, Database và Lyrics Sync Worker) chỉ bằng một lệnh duy nhất từ thư mục gốc của dự án:

### 1. Khởi chạy chế độ Phát triển (Development - Hot reload)
1. Cấu hình file `musicflow_backend/.env.dev` (tham khảo `.env.example`).
2. Khởi chạy:
   ```bash
   docker compose --profile dev up --build
   ```
3. Truy cập các cổng:
   - 🌐 **Web Studio / Client**: `http://localhost:5173`
   - 📡 **Backend API**: `http://localhost:5001`
   - 🗄️ **MongoDB**: `mongodb://localhost:27017/musicflow_db`
   - 🎙️ **Lyrics Sync Worker**: Tự động kết nối MongoDB và lắng nghe job ngầm.

### 2. Khởi chạy chế độ Production (Docker detached)
```bash
docker compose --profile prod up --build -d
```
- Web: `http://localhost:8080`
- Backend API: `http://localhost:5000`

### 3. Dừng hệ thống Docker
```bash
docker compose down
```

---

## 🚀 Hướng Dẫn Triển Khai Đám Mây (Production Deployment)

| Dịch vụ | Nền tảng khuyến nghị | Thư mục cấu hình | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Database** | MongoDB Atlas (M0 Free) | Đám mây | Whitelist IP `0.0.0.0/0`, URL-encode mật khẩu nếu có `@` |
| **Backend** | Render Web Service | `musicflow_backend` | Start command: `npm start`, điền biến môi trường từ `.env.prod` |
| **Web** | Vercel | `musicflow_web` | Build: `npm run build`, Output: `dist`, có sẵn rewrite SPA trong `vercel.json` |
| **Lyrics Sync**| Modal.com / Cloud Run / Render | `musicflow_lyrics_sync` | Xem chi tiết trong [deploy_lyrics_sync_render.md](./docs/deploy_lyrics_sync_render.md) |
| **Mobile App** | Google Play / App Store | `musicflow_app` | Build APK: `flutter build apk --release --dart-define=APP_ENV=prod` |

---

## 🛠️ Một Số Lỗi Thường Gặp Khi Cài Đặt Máy Mới

1. **Lỗi `origin_mismatch` (Google Login)**: Thêm domain của frontend (`http://localhost:5173` hoặc domain production) vào mục *Authorized JavaScript origins* trên Google Cloud Console.
2. **Lỗi CORS (`Not allowed by CORS`)**: Khai báo đúng origin của frontend vào biến `CORS_ORIGINS` trong `.env` backend (phân tách bằng dấu phẩy, không chứa khoảng trắng).
3. **Lỗi kết nối MongoDB Atlas (`querySrv ENOTFOUND`)**: Kiểm tra mật khẩu trong chuỗi kết nối URI, nếu có ký tự đặc biệt như `@` cần encode thành `%40`.
4. **Lỗi mạng trên điện thoại thật khi chạy Flutter (`SocketException`)**: Đảm bảo điện thoại và máy tính kết nối chung mạng Wi-Fi và truyền cờ `--dart-define=API_BASE_URL=http://<IP-LAN-MAY-TINH>:5001`.

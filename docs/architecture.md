# Kiến trúc Hệ Thống — MusicFlow

MusicFlow là hệ sinh thái ứng dụng âm nhạc đa nền tảng toàn diện, bao gồm ứng dụng di động Flutter, ứng dụng web React 19, dịch vụ backend Node.js / Express 5, và worker xử lý trí tuệ nhân tạo căn nhịp lời bài hát bằng Python / PyTorch.

---

## 1. Sơ đồ Kiến trúc Tổng thể

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT APPLICATIONS                              │
│                                                                                 │
│   ┌───────────────────────────────┐           ┌─────────────────────────────┐   │
│   │      Flutter Mobile App       │           │        React Web App        │   │
│   │     (Android / iOS / Web)     │           │   (Client / Artist / Admin) │   │
│   └───────────────┬───────────────┘           └──────────────┬──────────────┘   │
└───────────────────┼──────────────────────────────────────────┼──────────────────┘
                    │                                          │
                    │         HTTPS / REST API JSON            │
                    ▼                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        NODE.JS / EXPRESS 5 BACKEND                              │
│                                (/api/*)                                         │
│                                                                                 │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌──────────────────┐  │
│  │  Auth & User  │  │ Songs & Audio │  │ Playlists &   │  │ Premium & VNPay  │  │
│  │   Services    │  │  Stream 206   │  │  Favorites    │  │   Subscriptions  │  │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └────────┬─────────┘  │
│          │                  │                  │                   │            │
│  ┌───────┴──────────────────┴──────────────────┴───────────────────┴─────────┐  │
│  │              AI Orchestrator & Multi-Provider Router                      │  │
│  │  ├─ Global AI Assistant  ├─ AI DJ Engine  ├─ Auto-Tagging & Content Mod  │  │
│  └─────────────────────────────────┬─────────────────────────────────────────┘  │
└────────────────────────────────────┼────────────────────────────────────────────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          ▼                          ▼                          ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│  MongoDB Atlas   │       │  Cloudinary CDN  │       │ Multi-AI Engine  │
│ 24 Collections   │       │ Audio & Hình ảnh │       │ Gemini + Mistral │
└─────────┬────────┘       └──────────────────┘       └──────────────────┘
          │ (Queue / Jobs)
          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│             AI LYRICS ALIGNMENT WORKER (musicflow_lyrics_sync)                  │
│                     (Python 3.11 / PyTorch CPU / Whisper)                       │
│                                                                                 │
│  - Lắng nghe collection `lyricsalignmentjobs` qua MongoDB polling loop          │
│  - Tách giọng hát, chuyển văn bản thành nhịp thời gian chi tiết [mm:ss.xx]      │
│  - Ghi thẳng kết quả hoàn thiện vào `SongLyrics` cho Client Karaoke             │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Công nghệ Cốt lõi của Hệ thống

| Tầng chức năng | Công nghệ | Chi tiết phiên bản & vai trò |
|----------------|-----------|------------------------------|
| **Mobile App** | Flutter / Dart | SDK ^3.9.2, `just_audio`, `audio_service`, `hive` |
| **Web App** | React 19 + Vite | Material UI v7, React Router DOM v7, Axios |
| **Backend** | Node.js + Express | Express 5.2, Mongoose 9.1, JWT, express-rate-limit |
| **Lyrics Worker** | Python + Docker | PyTorch CPU wheel, OpenAI Whisper, SoundFile |
| **Cơ sở dữ liệu** | MongoDB Atlas | 24 Mongoose schemas, hỗ trợ compound indexes |
| **Lưu trữ CDN** | Cloudinary | Phân phối file âm thanh (video resource) và ảnh bìa |
| **Trí tuệ nhân tạo** | Google Gemini + Mistral | `gemini-2.5-flash`, `mistral-small-latest` |
| **Cổng thanh toán**| VNPay + Sandbox | Hỗ trợ thanh toán mã QR, thẻ nội địa và giả lập |

---

## 3. Các Luồng Dữ liệu Trọng yếu

### A. Phát nhạc & Cấp vé chất lượng cao (Playback Ticket)
```
Client (Flutter / Web)
  └─ Yêu cầu vé nghe: GET /api/songs/:id/ticket
       ├─ Kiểm tra user.isPremium
       │    ├─ Có Premium → Cấp URL nguồn gốc Lossless HQ (320kbps)
       │    └─ Tài khoản thường → Cấp URL âm thanh tiêu chuẩn (128kbps)
       └─ Client kết nối phát trực tiếp từ CDN Cloudinary
            └─ Sau khi nghe đủ thời lượng → Ghi nhận Qualified Play (POST /api/songs/:id/play)
```

### B. Nâng cấp Gói cước Premium & Kích hoạt Tự động
```
Người dùng chọn gói (GO, PLUS, PREMIUM)
  └─ POST /api/subscriptions/checkout { planId, paymentMethod: "vnpay" }
       └─ Backend khởi tạo Transaction (status: "pending") + Link VNPay
            └─ Người dùng thanh toán trên cổng VNPay
                 └─ VNPay gọi Webhook IPN: GET /api/subscriptions/vnpay-ipn
                      ├─ Kiểm tra chữ ký bảo mật Hash Secret
                      ├─ Cập nhật Transaction: "success"
                      ├─ Tạo Subscription: status "active", hạn dùng +30 ngày
                      └─ Cập nhật User: isPremium = true, gửi Notification chúc mừng
```

### C. Quy trình Tự động Căn nhịp Lời bài hát Karaoke bằng AI
```
Nghệ sĩ bấm "Tự động căn nhịp bằng AI" trên Artist Web Portal
  └─ POST /api/artist/songs/:id/lyrics/alignment
       └─ Backend tạo bản ghi `LyricsAlignmentJob` (status: "pending")
            │
            ▼
Lyrics Sync Worker (Docker / Render 24/7)
  ├─ Nhận job mới từ collection MongoDB
  ├─ Tải file âm thanh từ Cloudinary về buffer bộ nhớ
  ├─ Chạy mô hình Whisper căn mốc thời gian từng từ ngữ [mm:ss.xx]
  └─ Cập nhật kết quả vào `LyricsAlignmentJob` (status: "succeeded")
       └─ Lưu dữ liệu đồng bộ vào `SongLyrics`
            └─ Nghệ sĩ duyệt và bấm Publish → Client hiển thị ngay trên Karaoke View
```

### D. Trợ lý Thông minh & Điều phối Đa mô hình AI
```
Người dùng gửi tin nhắn: "Hôm nay tôi mệt mỏi quá, gợi ý vài bài hát thư giãn nhé"
  └─ AI Orchestrator phân tích cú pháp:
       ├─ Phát hiện cảm xúc cá nhân ("mệt mỏi quá") → Điều hướng sang Mistral Enricher
       │    └─ Mistral trích xuất: Intent=Relax, Mood=Chill, Genre=Acoustic/Lofi
       └─ Kết hợp ngữ cảnh gửi tới Gemini Flash:
            ├─ Gemini soạn câu trả lời đồng cảm ấm áp
            └─ Tạo danh sách bài hát phù hợp từ MongoDB
                 └─ Trả về tin nhắn kèm Action Button để người dùng phát nhạc ngay
```

# CẨM NANG PHẢN XẠ BẢO VỆ ĐỒ ÁN TỐT NGHIỆP: MUSICFLOW

> **Hệ sinh thái Âm nhạc Đa nền tảng tích hợp AI & Căn nhịp Lời bài hát**  
> _Định dạng cô đọng — Dùng để tra cứu nhanh trong 5–10 giây khi vấn đáp trước Hội đồng._

---

## MỤC LỤC TRA CỨU NHANH (BẤM ĐỂ NHẢY TỚI MỤC)

1. [Tổng quan đề tài (30s Pitch)](#1-tổng-quan-đề-tài)
2. [Kiến trúc 4 thành phần & Luồng dữ liệu](#2-kiến-trúc-hệ-thống)
3. [Tóm tắt 12 Modules chức năng cốt lõi](#3-các-chức-năng-chính)
4. [Bản đồ Hệ sinh thái AI (9 dịch vụ)](#4-phần-ai)
5. [Pipeline Căn nhịp Lời bài hát (Wav2Vec2 ONNX INT8)](#5-lyrics-alignment--kỹ-thuật-nổi-bật)
6. [Cơ sở dữ liệu (24 Models & Quan hệ)](#6-database)
7. [Bảo mật & Độ tin cậy (Auth, VNPay, Rate Limit)](#7-security-và-reliability)
8. [Hiệu năng & Triển khai (Render, Caching, 206 Stream)](#8-performance-và-deployment)
9. [Kết quả kiểm thử thực tế](#9-kết-quả-và-kiểm-thử)
10. [Bảng 6 Quyết định Kỹ thuật then chốt](#10-các-quyết-định-kỹ-thuật-quan-trọng)
11. [Bộ câu hỏi Giảng viên hay bắt bẻ (Kèm cách trả lời chốt hạ)](#11-các-điểm-hội-đồng-có-thể-đào-sâu)
12. [35 Câu hỏi Vấn đáp mô phỏng (Phân loại cấp độ)](#12-bộ-câu-hỏi-mô-phỏng-bảo-vệ)
13. [Cheat Sheet 1 trang: 10 điều nhớ nằm lòng & Kịch bản 3 phút](#13-cheat-sheet-trước-ngày-bảo-vệ)

---

# 1. TỔNG QUAN ĐỀ TÀI

- **Tên đề tài:** Hệ sinh thái Ứng dụng Âm nhạc Đa nền tảng MusicFlow tích hợp Trí tuệ Nhân tạo và Căn nhịp Lời bài hát Tự động.
- **Bài toán giải quyết:**
  1. _Người nghe:_ Cá nhân hóa nghe nhạc theo tâm trạng/câu chuyện; tìm nhạc bằng lời vu vơ (lyrics snippet); nghe nhạc đa nền tảng không gián đoạn.
  2. _Nghệ sĩ độc lập:_ Tự động hóa tạo nhịp Karaoke từng từ (Word-by-word) bằng AI thay vì tốn hàng giờ căn thủ công.
  3. _Hạ tầng:_ Tối ưu AI chạy trên CPU giá rẻ (512MB RAM) mà không cần GPU đắt đỏ.
- **4 Thành phần hệ thống:**
  - **Web:** React 19 + MUI v7 (Client, Artist, Admin) trên Vercel.
  - **Mobile:** Flutter (Android/iOS) phát nhạc nền + Hive offline.
  - **Backend:** Node.js Express 5 + MongoDB Atlas trên Render.
  - **Worker AI:** Python / PyTorch / ONNX Runtime căn nhịp lyrics trên Render.

---

# 2. KIẾN TRÚC HỆ THỐNG

### Sơ đồ luồng dữ liệu tóm tắt

```
[Flutter App]  &  [React 19 Web]
       │                 │
       └────────┬────────┘ (HTTPS / REST JSON)
                ▼
      [Node.js Express 5 API] ──(CDN Stream)──► [Cloudinary] (Audio 128/320k, Ảnh)
         │           │
         │           ├─► [AI Router] ──► Gemini Flash (Chat, DJ) + Mistral (Tâm trạng)
         │           └─► [VNPay Gateway] (HMAC-SHA512 Checkout & IPN)
         ▼
  [MongoDB Atlas] ◄───(Polling Queue `lyricsalignmentjobs`)
         ▲
         │
[Python AI Worker] (Wav2Vec2 ONNX INT8 + Trellis DP + Viterbi ➔ Sinh LRC SyncedLines)
```

- **Xác thực:** JWT Access token (2h, Authorization Header) + Refresh token (30 ngày, băm SHA-256 lưu DB, cookie `httpOnly`).
- **Phát nhạc:** HTTP 206 Partial Content (Range requests) qua Cloudinary CDN.
- **Worker Job:** Giao tiếp qua MongoDB collection `lyricsalignmentjobs` (Polling loop 3s, Heartbeat 15s).

---

# 3. CÁC CHỨC NĂNG CHÍNH

### Tra cứu nhanh 12 Module chức năng

| Module                     | Vấn đề & Cách hoạt động cốt lõi                                                                                 | Công nghệ / Model                                 | File code mở khi demo                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------ |
| **1. Auth**                | Đăng nhập Email/Pass + Google OAuth. Cấp cặp Access/Refresh token. Hash mật khẩu bcryptjs.                      | `jsonwebtoken`, `google-auth-library`, `bcryptjs` | `src/middleware/auth.middleware.js`                          |
| **2. Playback Ticket**     | Phân tầng chất lượng: User Free nhận stream 128kbps; Premium nhận link HQ Lossless 320kbps. HTTP 206 tua bài.   | Express Range stream, Cloudinary CDN              | `src/controllers/song.controller.js` (`issuePlaybackTicket`) |
| **3. Playlists & Library** | Tách bạch: `Playlist` (user tự tạo) & `PlaylistSong` (Admin biên tập). Thư viện: Like, Fav, Uploads.            | MongoDB `Playlist`, `PlaylistSong`                | `src/controllers/playlist.controller.js`                     |
| **4. Artist Studio**       | Nghệ sĩ upload bài hát, xem Analytics (người nghe hàng tháng `monthlyListeners`, biểu đồ chuỗi thời gian).      | `music-metadata`, `SongPlayEvent` aggregation     | `src/controllers/artist-analytics.controller.js`             |
| **5. Lyrics & Karaoke**    | Không gian kép: Bản nháp (`draft`) và Bản xuất bản (`published`). Hiển thị cuộn chữ từng từ [mm:ss.xx].         | `SongLyrics` model, `lrc_parser` (Flutter)        | `src/pages/artist/ArtistLyricsDialog.jsx`                    |
| **6. AI DJ (Mood)**        | Nhận prompt tâm trạng (text/voice), nhận diện 9 moods, map Topic/Artist, rank theo view ➔ tạo `MoodPlaylist`.   | Gemini API, speech-to-text                        | `src/controllers/ai.controller.js`                           |
| **7. AI Assistant**        | Chat đa lượt, tìm kiếm bài hát, giải thích ý nghĩa bài (`get_song_story`), tạo nút hành động (`confirmAction`). | Gemini Flash, Context Memory                      | `src/services/assistant.service.js`                          |
| **8. Lyrics Search**       | Tìm bài hát khi chỉ nhớ 1 câu vu vơ (độ trùng khớp từ vựng $\ge 70\%$) ➔ Tự phát nhạc ngay (`PLAY_SONG`).       | Fuzzy keyword match, Unicode NFC                  | `src/services/assistant.service.js` (`isLyricsSearchQuery`)  |
| **9. Adaptive RecSys**     | Gợi ý thích ứng 3 tầng: 70% dài hạn (30 ngày) + 20% gần đây (7 ngày) + 10% khám phá mới + Trừ điểm bài bị Skip. | Weighted Scoring, Time-decay                      | `src/services/adaptiveRecommendation.service.js`             |
| **10. AI Moderation**      | Quét lời bài hát và gửi mẫu Audio nhị phân (Range bytes) tới Gemini Multimodal: `SAFE`, `REVIEW`, `BLOCK`.      | Gemini Text & Multimodal Audio                    | `src/services/aiModeration.service.js`                       |
| **11. Premium & VNPay**    | 3 gói (GO 19k, PLUS 49k, PREMIUM 89k). Tạo URL VNPay, kiểm tra mã băm HMAC-SHA512 tại IPN Webhook.              | VNPay Sandbox, Cron Expiry Job                    | `src/controllers/subscription.controller.js`                 |
| **12. Offline Cache**      | Mobile tải nhạc lưu vào bộ nhớ máy, lưu metadata trong Hive NoSQL. Thuật toán LRU dọn dẹp khi chạm 1GB/500 bài. | `hive_flutter`, `path_provider`                   | `lib/data/services/offline_song_service.dart`                |

---

# 4. PHẦN AI

### Điểm mấu chốt của Hệ sinh thái AI

1. **AI Orchestrator (`aiOrchestrator.service.js`):**
   - _Bypass (Fast-path ~1.5s):_ Câu lệnh trực tiếp ("bật nhạc pop", "tìm bài Sơn Tùng") ➔ Gửi thẳng Gemini.
   - _Enrich (Làm giàu ngữ cảnh):_ Câu chuyện cảm xúc ("hôm nay chia tay buồn quá") ➔ Qua Mistral Small trích xuất `[Intent | Mood | Genre]` rồi mới đưa vào Gemini.
   - _Fallback:_ Mistral lỗi/timeout ➔ Tự động dùng prompt gốc gửi Gemini, không bao giờ báo lỗi ra giao diện.
2. **Gemini Router (`geminiRouter.service.js`):**
   - Quản lý hạn mức RPD theo múi giờ Los Angeles (giờ reset của Google).
   - Phân cấp model: Premium dùng `gemini-3.5-flash-lite`/`3.7-flash`; Free dùng `gemini-2.5-flash`.
   - Chuỗi fallback khi gặp lỗi 429: `gemini-2.5-flash` $\rightarrow$ `gemini-2.0-flash` $\rightarrow$ `gemini-1.5-flash-latest`.
3. **Song Intelligence (`songIntelligence.service.js`):**
   - Background job tự động chạy khi có bài hát mới: trích xuất thể loại gợi ý, moodTags, tóm tắt câu chuyện (`storySummary`), trích dẫn chữa lành (`healingQuotes`).
4. **AI Moderation (`aiModeration.service.js`):**
   - 2 tầng: Tầng 1 duyệt Text (lời bài hát); Tầng 2 tải mẫu audio đại diện (tối đa 15MB qua Range Header) gửi Base64 vào Gemini Multimodal để nghe âm thanh thô.

---

# 5. LYRICS ALIGNMENT / KỸ THUẬT NỔI BẬT

> **Câu trả lời 10 giây khi bị hỏi:**  
> _"Hệ thống sử dụng mô hình âm học **Wav2Vec2 CTC Tiếng Việt** lượng tử hóa **ONNX INT8**, kết hợp quy hoạch động **Trellis Log-Space** và **Viterbi Backtracking**, tinh chỉnh bằng **Librosa Onset Snapping** để bắt đúng điểm cất giọng của ca sĩ."_

### Bảng tóm tắt Pipeline căn nhịp (Worker Python)

| Bước  | Tên bước               | Kỹ thuật / Công thức                                                                                                                           | Mục đích thực tế                                                                                                                  |
| ----- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **1** | Audio Conditioning     | Sample rate 16kHz Mono, High-pass filter 80Hz, RMS Normalization                                                                               | Lọc tiếng ù rè tần số thấp, đồng nhất âm lượng đầu vào.                                                                           |
| **2** | Acoustic Emission      | Mô hình `nguyenvulebinh/wav2vec2-base-vietnamese-250h` (ONNX INT8)                                                                             | Xuất ma trận Log-Softmax $[T \text{ khung} \times V \text{ từ vựng}]$. Cắt chunk 14s (overlap 2s) để RAM luôn $\le 320\text{MB}$. |
| **3** | Trellis DP (Log-Space) | Mở rộng trạng thái CTC: $S = 2N + 1$ (xen kẽ ký tự `blank`) <br> $\text{Trellis}[t,s] = \max(\text{Stay, Move, Skip}) + \text{Emission}[t, s]$ | Quy hoạch động tìm đường đi âm học có xác suất cao nhất. Tính trên log để chống tràn số dưới (underflow).                         |
| **4** | Viterbi Backtracking   | Truy ngược từ khung $T-1$ về đầu, loại bỏ trạng thái blank                                                                                     | Trích xuất mốc `[start, end]` của từng từ và độ tin cậy (`confidence`).                                                           |
| **5** | Onset Snapping         | `librosa.onset.onset_detect` (Spectral Flux / Energy Attack)                                                                                   | Khớp với độ chính xác cao thời điểm ca sĩ bật hơi mở miệng hát.                                                                   |
| **6** | Postprocessing         | Tail extension theo ngưỡng dB; Tạo JSON `syncedLines` & format LRC                                                                             | Kéo dài âm tiết cuối dòng, xuất kết quả vào MongoDB để Web/App hiển thị.                                                          |

- **Tại sao không dùng Whisper?** Whisper là mô hình sinh text (ASR) dễ bị ảo giác khi nhạc nền to. Em không chọn Whisper vì bài toán của em là forced alignment: văn bản lời bài hát đã có sẵn. Wav2Vec2 CTC cung cấp xác suất theo từng frame, phù hợp trực tiếp với việc tìm đường alignment bằng Trellis/Viterbi.

- **Tối ưu RAM:** Bản gốc FP32 (380MB) ➔ Lượng tử hóa **ONNX INT8 (95MB)** ➔ Chạy mượt mà trên Render Free CPU 512MB RAM!

---

# 6. DATABASE

**24 Models (Mongoose MongoDB) — Ghi nhớ theo 5 cụm chính:**

1. **User & Quyền:** `User` (lưu cờ `isPremium`, hạn dùng `premiumExpiry`, sở thích `aiMemory`), `Artist` (slug không dấu, `monthlyListeners`), `RefreshToken` (chỉ lưu hash SHA-256).
2. **Âm nhạc cốt lõi:** `Song` (audioUrl, duration, playCount, embedded `aiAnalysis` & `moderation`), `Topic` (thể loại), `Playlist` (user), `PlaylistSong` (Admin biên tập).
3. **Lời bài hát & Worker:** `SongLyrics` (tách 2 trường: nháp `syncedLines` và xuất bản `publishedSyncedLines`), `LyricsAlignmentJob` (hàng đợi xử lý: `status`, `progressPercent`, chuỗi băm `fingerprint` chống trùng lặp).
4. **Thương mại & Giao dịch:** `Plan` (GO, PLUS, PREMIUM), `Subscription` (chu kỳ thuê bao), `Transaction` (mã giao dịch `transactionRef`, response cổng VNPay).
5. **Tương tác & Dữ liệu lớn (Append-only):** `SongPlayEvent` (`playedAt`, cooldown 30s chống cày view), `SongLike` & `Favorite` (Compound index `(userId, songId)`), `Comment` (hỗ trợ phân cấp cha/con qua `parentCommentId`), `Notification`.

---

# 7. SECURITY VÀ RELIABILITY

- **Bảo mật JWT kép:** Access token ngắn (2h) chống đánh cắp lâu dài; Refresh token (30 ngày) chỉ lưu chuỗi băm SHA-256 trong DB và gửi qua cookie `httpOnly`, `secure`, `sameSite: "none"`.
- **Bảo mật VNPay Checksum:** Webhook IPN tự động tính toán lại mã băm HMAC-SHA512 từ toàn bộ tham số gửi về với bí mật `VNPAY_HASH_SECRET`. Sai lệch 1 ký tự lập tức trả mã lỗi 97 (Từ chối).
- **Rate Limit chống Spam:** 50 req/15 phút cho cụm Auth/Login; 200 req/1 phút cho toàn bộ API chung (qua `express-rate-limit` + trust proxy).
- **Idempotency (Tính bất biến của Job):** Tạo mã băm `fingerprint` từ file audio + hash lời bài hát. Nếu nghệ sĩ bấm "Căn nhịp" nhiều lần, trả ngay kết quả cũ chứ không chạy lại mô hình.

---

# 8. PERFORMANCE VÀ DEPLOYMENT

- **Streaming HTTP 206:** Tua nhạc (seek) tức thì thông qua Range Request (`bytes=start-end`), không bắt client tải cả file MP3.
- **In-memory Caching:**
  - Danh sách model Gemini: Cache RAM 1 giờ (tránh gọi Google AI Studio liên tục).
  - Hồ sơ cá nhân hóa người dùng: Cache RAM 5 phút (giảm tải truy vấn MongoDB).
- **Hạ tầng triển khai thực tế:**
  - Backend (Render Web Service) + Web (Vercel SPA rewrite `vercel.json`).
  - Worker AI (Render Docker): Mở sẵn HTTP Health Check port 10000 trong `main.py` để giữ trạng thái Live trên gói Free 0đ.
  - Database (MongoDB Atlas AWS Singapore) + CDN (Cloudinary lưu audio dạng `video` resource).

---

# 9. KẾT QUẢ VÀ KIỂM THỬ

_(Chỉ ghi những gì có thật trong mã nguồn — không bịa số liệu)_

- **Bộ test tích hợp AI Worker (`test_phase3_integration_suite.py`):**
  - Vượt qua 10 bài test tự động: Khởi động service, Health endpoint, căn nhịp audio mẫu 60s (độ lệch $\Delta \le 0.5s$).
  - Giữ nguyên 100% dấu tiếng Việt trong `VietnameseTextNormalizer` (không bị xóa thành ASCII).
  - Kiểm tra rò rỉ RAM (Memory Leak Check): Chạy liên tiếp 3 request, sau khi `gc.collect()`, dung lượng RAM RSS duy trì ổn định $\le 320\text{MB}$.
- **Linting & Build:**
  - Web: ESLint v9 đạt chuẩn (`npm run lint`), build production Vite thành công (`dist/`).
  - App Mobile: Đạt chuẩn quy tắc `flutter_lints ^5.0.0`, vượt qua test khói `widget_test.dart`.

---

# 10. CÁC QUYẾT ĐỊNH KỸ THUẬT QUAN TRỌNG

| Quyết định                        | Vì sao chọn                                                                    | Phương án khác cân nhắc                     | Đánh đổi (Trade-off)                                                     |
| --------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------------ |
| **Wav2Vec2 CTC ONNX INT8**        | Bắt nhịp có độ chính xác cao theo lời có sẵn; RAM chỉ 95MB chạy được CPU.      | Whisper ASR; Google Speech API tính phí     | Không tự nhận dạng nếu không có text lời; phải viết script lượng tử hóa. |
| **Hybrid Gemini + Mistral**       | Tối ưu độ trễ (1.5s câu lệnh trực tiếp) và thấu cảm câu chuyện phức tạp.       | Chỉ dùng 1 model Gemini; Dùng GPT-4o đắt đỏ | Phải quản lý 2 bộ API Keys và xử lý fallback dự phòng khi 1 bên lỗi.     |
| **ChangeNotifier & Context API**  | Nhẹ nhàng, dựng sẵn trong Flutter/React, đủ đáp ứng phát nhạc toàn cục.        | Bloc, Riverpod, Redux                       | Cần kiểm soát phạm vi lắng nghe để tránh rebuild toàn màn hình.          |
| **Hive NoSQL Offline (Mobile)**   | Tốc độ đọc ghi nhị phân cực nhanh, thuần Dart, không cần native bridge.        | SQLite (`sqflite`), SharedPreferences       | Không hỗ trợ câu lệnh JOIN quan hệ, phải lọc dữ liệu bằng code Dart.     |
| **Tách Draft / Published Lyrics** | Nghệ sĩ tự do thử nghiệm và sửa nhịp mà không làm hỏng karaoke của người nghe. | Dùng 1 bản ghi đè trực tiếp; tách 2 bảng    | Kích thước document `SongLyrics` lớn hơn; cần cờ phiên bản `version`.    |
| **Reset Quota theo Múi giờ LA**   | Trùng khớp 100% thời điểm Google AI Studio reset quota miễn phí.               | Reset giờ Việt Nam (UTC+7)                  | Phải viết hàm tính toán múi giờ có xét đến quy ước giờ mùa hè (DST).     |

---

# 11. CÁC ĐIỂM HỘI ĐỒNG CÓ THỂ ĐÀO SÂU

### 1. "Tại sao không chạy AI căn nhịp trực tiếp trong Node.js mà phải viết Worker Python riêng?"

- **Cách trả lời nhanh:** Node.js là Single-threaded Event Loop. Việc tính toán ma trận âm thanh và mạng nơ-ron tiêu tốn 100% CPU, nếu chạy trong Node.js sẽ làm nghẽn toàn bộ server, khiến mọi request khác bị treo. Tách Worker Python chạy ngầm qua hàng đợi MongoDB giúp cô lập tài nguyên và dễ mở rộng.
- **Bằng chứng file:** `musicflow_backend/src/models/lyrics-alignment-job.model.js` và `musicflow_lyrics_sync/main.py`.

### 2. "Tại sao không dùng Whisper cho việc căn nhịp?"

- **Cách trả lời nhanh:** Whisper là mô hình ASR tự sinh từ vựng, dễ bị ảo giác (hallucination) khi có nhạc nền to. MusicFlow giải bài toán _Forced Alignment_ (đã có lời chuẩn của nghệ sĩ), dùng mô hình âm học Wav2Vec2 CTC kết hợp Trellis Viterbi sẽ ép đường đi qua đúng các từ đã biết, cho độ chính xác mốc thời gian cao hơn nhiều.
- **Bằng chứng file:** `musicflow_lyrics_sync/pipeline/aligner.py`.

### 3. "Nếu kẻ gian sửa số tiền VNPay rồi gọi vào Webhook IPN thì sao?"

- **Cách trả lời nhanh:** Không thể hack được. Backend tính toán lại mã băm HMAC-SHA512 từ toàn bộ tham số nhận được kết hợp khóa bí mật `VNPAY_HASH_SECRET`. Bất kỳ sự thay đổi nào về số tiền hoặc mã đơn hàng sẽ làm sai lệch mã băm, backend lập tức từ chối và trả mã lỗi 97.
- **Bằng chứng file:** `musicflow_backend/src/controllers/subscription.controller.js` (`vnpayIpn`).

### 4. "Bảng `SongPlayEvent` tăng hàng trăm ngàn dòng mỗi ngày thì giải quyết thế nào?"

- **Cách trả lời nhanh:** Em đã bỏ `timestamps: true` mặc định để tiết kiệm ổ đĩa và đánh compound index `(songId, playedAt)`. Hướng mở rộng thực tế là tổng hợp số liệu theo ngày bằng Cron Job, sau đó gắn TTL Index (Time-To-Live) để MongoDB tự động xóa log chi tiết sau 90 ngày.
- **Bằng chứng file:** `musicflow_backend/src/models/song-play-event.model.js` và `monthlyListeners.job.js`.

### 5. "Làm sao app Flutter phát nhạc được khi khóa màn hình điện thoại?"

- **Cách trả lời nhanh:** Sử dụng `audio_service` khởi tạo Android Foreground Service đi kèm thanh Notification cố định (`androidNotificationOngoing: true`) để hệ điều hành không đóng băng app; trên iOS cấu hình `AVAudioSessionCategoryPlayback`.
- **Bằng chứng file:** `musicflow_app/lib/core/audio/audio_handler.dart`.

---

# 12. BỘ CÂU HỎI MÔ PHỎNG BẢO VỆ

### Nhóm Dễ & Trung bình (Kiểm tra nắm bắt dự án)

1. **MusicFlow gồm những portal nào?** $\rightarrow$ 3 portal: Client (`/client/*`), Artist (`/artist/*`), Admin (`/`).
2. **Access Token lưu ở đâu, Refresh Token lưu ở đâu?** $\rightarrow$ Access Token lưu Header (Web: localStorage, Mobile: Secure Storage); Refresh Token băm SHA-256 lưu DB và gửi qua cookie `httpOnly`.
3. **Phân biệt `Playlist` và `PlaylistSong`?** $\rightarrow$ `Playlist` do người dùng tự tạo; `PlaylistSong` là playlist tuyển tập trang chủ do Admin biên tập.
4. **Playback Ticket giải quyết việc gì?** $\rightarrow$ Kiểm tra cờ `isPremium`, phân giải URL stream 128kbps (Free) hoặc Lossless HQ 320kbps (Premium).
5. **Nghệ sĩ định danh bằng gì trên URL?** $\rightarrow$ Định danh bằng trường `slug` tiếng Việt không dấu tự sinh trong `artist.model.js`.
6. **Làm sao Web React đổi trang mà không mất nhạc?** $\rightarrow$ Thẻ audio nằm trong `ClientPlayerProvider` ở cấp cao nhất bọc quanh Router trong `App.jsx`.
7. **Mobile lưu nhạc offline bằng thư viện nào?** $\rightarrow$ Dùng `Hive NoSQL` lưu metadata và lưu file MP3 vào bộ nhớ máy, dọn dẹp theo thuật toán LRU.
8. **Mô hình kiểm duyệt bài hát hoạt động ra sao?** $\rightarrow$ Quét text lời bài hát; với nhạc không lời thì tải mẫu audio Range bytes gửi Base64 vào Gemini Multimodal phân loại `SAFE`, `REVIEW`, `BLOCK`.
9. **Các gói cước Premium gồm những gói nào?** $\rightarrow$ Gói GO (19.000đ/30 ngày), Gói PLUS (49.000đ/90 ngày), Gói PREMIUM (89.000đ/180 ngày).
10. **Làm sao app di động nhận diện giọng nói cho AI DJ?** $\rightarrow$ Dùng thư viện `speech_to_text` gọi engine nhận dạng tiếng Việt (`vi_VN`) tích hợp sẵn của Android/iOS.

### Nhóm Khó & Phản biện (Architecture & AI)

11. **"Tại sao em không dùng Redux/Zustand?"** $\rightarrow$ Ứng dụng chỉ có state phát nhạc là cần chia sẻ toàn cục, còn lại là state cục bộ từng trang. Dùng React Context và `ChangeNotifier` nguyên bản là đủ, tránh làm nặng ứng dụng.
12. **"Nếu VNPay sập thì người dùng có mua được gói không?"** $\rightarrow$ Hệ thống có tích hợp phương thức `paymentMethod: "mock"` để thử nghiệm; ngoài đời nếu cổng lỗi giao dịch giữ `pending` để người dùng thử lại sau.
13. **"Thuật toán gợi ý âm nhạc xử lý người dùng mới (Cold-Start) như thế nào?"** $\rightarrow$ Nhận diện cờ `isColdStart: true` trong `personalization.service.js`, tự động gợi ý danh sách bài hát thịnh hành có lượt nghe/thích cao nhất.
14. **"Tại sao ma trận Trellis lại có số trạng thái là $2N + 1$?"** $\rightarrow$ Vì trong chuẩn CTC xen kẽ các ký tự `blank` trước, giữa và sau $N$ token chữ để đại diện cho khoảng lặng và outro bài hát: $N + (N + 1) = 2N + 1$.
15. **"Nếu scale lên 100.000 user thì hệ thống nghẽn ở đâu đầu tiên?"** $\rightarrow$ Nghẽn ở băng thông và Connection Pool MongoDB. Giải pháp: Thêm tầng đệm Redis Cache cho bài hát hot và ký link Cloudinary Signed URL để CDN chịu tải stream.
16. **"AI có thực sự cần thiết hay chỉ làm màu?"** $\rightarrow$ Không phải code truyền thống hoàn toàn không làm được, nhưng các bài toán như hiểu ý định ngôn ngữ tự nhiên, phân tích cảm xúc, semantic search và acoustic alignment sẽ khó xây dựng bằng rule-based thuần túy. AI giúp giảm lượng rule thủ công và tăng khả năng xử lý các trường hợp biến thiên.
17. **"Làm sao đảm bảo tính bất biến (Idempotency) khi nghệ sĩ bấm nút căn nhịp nhiều lần?"** $\rightarrow$ Nhờ chuỗi băm `fingerprint` trong `LyricsAlignmentJob`; nếu trùng fingerprint thì trả ngay kết quả cũ, không chạy lại AI.
18. **"Tại sao lại dùng bcryptjs mà không dùng MD5?"** $\rightarrow$ MD5 băm quá nhanh dễ bị tấn công vét cạn từ điển; bcryptjs băm chậm có Salt ngẫu nhiên và Work Factor chống Brute-force.
19. **"Nếu bài hát tiếng Anh đưa vào mô hình Wav2Vec2 tiếng Việt thì sao?"** $\rightarrow$ Phiên bản hiện tại của em được giới hạn cho tiếng Việt vì acoustic model được fine-tune trên dữ liệu tiếng Việt. Tuy nhiên pipeline alignment được thiết kế tách biệt với acoustic model. Vì vậy khi mở rộng sang tiếng Anh, có thể thay bằng một English speech model phù hợp mà không cần thay đổi toàn bộ Trellis/Viterbi alignment pipeline. facebook/wav2vec2-base-960h là một ví dụ Wav2Vec2 được fine-tune cho tiếng Anh. Nhưng em sẽ cần benchmark trên singing voice trước khi kết luận nó phù hợp với bài hát.
20. **"Cơ chế tự phục hồi (Circuit Breaker) của AI hoạt động thế nào?"** $\rightarrow$ Mistral lỗi ➔ Fallback prompt gốc sang Gemini; Gemini model cạn quota 429 ➔ Chuyển model tiếp theo trong chuỗi fallback; Tất cả lỗi ➔ Heuristic Tagging.

---

# 13. CHEAT SHEET TRƯỚC NGÀY BẢO VỆ

### 10 Điều Bắt Buộc Phải Nhớ Nằm Lòng

1. **Kiến trúc:** 4 thành phần (React 19 Web, Flutter Mobile, Node Express Backend, Python AI Worker).
2. **AI Căn nhịp:** Chạy bằng **Wav2Vec2 CTC tiếng Việt + ONNX INT8 + Trellis DP + Viterbi** (Không phải Whisper).
3. **AI Đám mây:** Gemini Flash làm xử lý chính, Mistral Small làm Enricher bóc tách cảm xúc.
4. **Bảo mật:** Access Token (2h trong Header), Refresh Token (30 ngày hash SHA-256 lưu DB + cookie httpOnly).
5. **Phân tầng chất lượng:** 128kbps (Free) và 320kbps Lossless HQ (Premium) qua vé `Playback Ticket`.
6. **Thanh toán:** Cổng VNPay Sandbox kiểm tra tính toàn vẹn bằng chữ ký băm HMAC-SHA512 tại IPN Webhook.
7. **Offline Mobile:** Lưu trữ bằng Hive NoSQL, giới hạn 1GB/500 bài, dọn dẹp bộ nhớ theo cơ chế LRU.
8. **Quy mô Database:** 24 Collections (Mongoose Models).
9. **Tối ưu RAM:** Lượng tử hóa ONNX INT8 (95MB) + Cắt chunk 14s giúp Worker chạy dưới 320MB RAM trên CPU.
10. **Tác phong:** Trả lời ngắn gọn, thẳng vào bản chất kỹ thuật, chỉ rõ file mã nguồn thực tế khi được hỏi.

### 10 Thuật Ngữ Kỹ Thuật Trọng Tâm

1. **Forced Alignment:** Căn khớp mốc thời gian của từng từ khi đã có sẵn văn bản lời bài hát.
2. **CTC (Connectionist Temporal Classification):** Kiến trúc gán nhãn âm học cho chuỗi không cần vị trí thời gian cố định.
3. **Trellis DP:** Quy hoạch động tính toán ma trận xác suất tích lũy trên miền logarit.
4. **Viterbi Backtracking:** Giải thuật truy ngược tìm đường đi có xác suất tối ưu nhất.
5. **INT8 Quantization:** Kỹ thuật làm tròn trọng số nơ-ron sang số nguyên 8-bit để giảm 75% RAM.
6. **HTTP 206 Partial Content:** Giao thức truyền phát âm thanh từng phần hỗ trợ tua nhạc nhanh.
7. **Playback Ticket:** Vé tạm thời phân giải luồng stream chất lượng cao theo hạng tài khoản.
8. **LRU Eviction:** Thuật toán dọn dẹp bộ nhớ ưu tiên xóa bài hát có thời điểm nghe xa nhất.
9. **HMAC-SHA512:** Thuật toán mã hóa băm khóa bí mật kiểm tra tính toàn vẹn dữ liệu thanh toán.
10. **Idempotency:** Đảm bảo gửi trùng request không làm thay đổi kết quả hay chạy lại tác vụ nặng.

---

### KỊCH BẢN THUYẾT TRÌNH 3 PHÚT (NÓI RÕ RÀNG, TỰ TIN)

> _"Kính thưa Thầy/Cô trong Hội đồng, em xin trình bày tóm tắt đồ án: **MusicFlow — Hệ sinh thái âm nhạc đa nền tảng tích hợp AI**._
>
> _Đồ án của em tập trung giải quyết 3 vấn đề cốt lõi:_  
> _1. Trải nghiệm nghe nhạc cá nhân hóa đa nền tảng xuyên suốt giữa Web và Di động._  
> _2. Tự động hóa hoàn toàn quy trình căn nhịp Karaoke từng từ cho nghệ sĩ độc lập bằng AI._  
> _3. Tối ưu hóa mô hình AI để vận hành ổn định trên hạ tầng CPU giá rẻ._
>
> _Hệ thống gồm 4 thành phần:_  
> _- **Mobile App (Flutter):** Hỗ trợ phát nhạc nền qua Foreground Service, hát karaoke cuộn chữ thời gian thực, tìm kiếm bằng giọng nói và lưu trữ nhạc ngoại tuyến với Hive NoSQL._  
> _- **Web App (React 19 + MUI v7):** Phân chia 3 cổng riêng biệt cho Người nghe, Nghệ sĩ và Quản trị viên._  
> _- **Backend (Node.js Express 5 & MongoDB 24 collections):** Bảo mật JWT kép, cấp vé nghe nhạc Lossless 320kbps theo gói Premium và tích hợp thanh toán VNPay kiểm tra chữ ký số IPN._  
> _- **AI Alignment Worker (Python):** Điểm sáng kỹ thuật lớn nhất của dự án. Em đã tối ưu mô hình âm học Wav2Vec2 tiếng Việt sang dạng lượng tử hóa **ONNX INT8**, kết hợp quy hoạch động **Trellis Log-Space** và **Viterbi Backtracking**. Nhờ đó, hệ thống căn nhịp chính xác từng từ của bài hát ngay trên CPU 512MB RAM miễn phí của Render mà không cần thuê GPU đắt đỏ._
>
> _Sau đây, em xin phép được demo trực tiếp các tính năng trên hệ thống. Em xin cảm ơn Thầy/Cô!"_

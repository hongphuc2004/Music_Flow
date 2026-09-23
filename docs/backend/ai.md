# Hệ Sinh Thái AI & Dịch Vụ Thông Minh — Backend

MusicFlow sở hữu kiến trúc AI đa mô hình kết hợp (**Google Gemini API** và **Mistral AI**), tối ưu hóa giữa tốc độ phản hồi (latency), chiều sâu thấu cảm cảm xúc (emotional enrichment), và khả năng tự động hóa kiểm duyệt nội dung, căn nhịp lời bài hát.

---

## 1. Tổng quan Kiến trúc AI Suite

```
                       [Người dùng / Ứng dụng]
                                  │
                                  ▼
                     [AI Orchestrator Router]
                      (src/services/aiOrchestrator.service.js)
                                  │
          ┌───────────────────────┴────────────────────────┐
          │ (Explicit Music / Chat)                        │ (Emotional Context / Story)
          ▼                                                ▼
     [Direct Gemini]                             [Mistral AI Enricher]
    (1.5s Fast Path)                         (Trích xuất Intent/Mood/Genre)
          │                                                │
          └───────────────────────┬────────────────────────┘
                                  ▼
                       [Gemini Multi-Model Router]
                      - gemini-2.5-flash
                      - gemini-2.0-flash
                      - gemini-1.5-flash-latest
                                  │
          ┌───────────────────────┼────────────────────────┐
          ▼                       ▼                        ▼
     [AI DJ Engine]      [Global Assistant]      [AI Auto-Tagging & Mod]
  (Tạo Mood Playlist)    (Trợ lý đa nhiệm,      (Kiểm duyệt nội dung,
                          Tool Calls & Quota)     story & healing quotes)
```

---

## 2. Các Dịch Vụ AI Cốt Lõi

### A. AI Orchestrator (`aiOrchestrator.service.js`)
- **Tối ưu độ trễ (Latency Balancing):**
  - Câu lệnh âm nhạc tường minh (e.g. *"nhạc pop 2024"*, *"playlist chạy bộ"*), câu lệnh chào hỏi hoặc tạo ảnh: **Bypass** thẳng tới Gemini (1.5s).
  - Câu chuyện cá nhân, ngữ cảnh cảm xúc ẩn (e.g. *"hôm nay sếp mắng tôi buồn quá"*, *"mình vừa chia tay crush"*): Điều hướng qua **Mistral Small** để làm giàu ngữ cảnh (`[AI Context: Intent | Mood | Genre | Activity]`).
- **Khả năng phục hồi sự cố (Graceful Fallback):** Nếu Mistral gặp lỗi (timeout, rate limit 429), Orchestrator tự động fallback về prompt gốc, tuyệt đối không làm gián đoạn trải nghiệm của người dùng.

### B. AI DJ — Mood Playlist Generation (`ai.controller.js`)
- **Đầu vào:** Prompt tâm trạng tự nhiên từ người dùng (text hoặc voice qua speech-to-text).
- **Phân tích:** Nhận diện 9 tâm trạng nền tảng: `sad`, `happy`, `chill`, `focus`, `energetic`, `romantic`, `sleep`, `party`, `angry`.
- **Matchmaking Engine:**
  1. Quét tìm nghệ sĩ xuất hiện trong prompt (`Artist.find`).
  2. Map mood sang danh sách `Topic` phù hợp.
  3. Lọc bài hát công khai, ưu tiên playCount/likeCount cao.
  4. Trả về text tâm sự ấm áp của AI và lưu snapshot bài hát vào `MoodPlaylist`.

### C. Trợ Lý Thông Minh Toàn Năng (`assistant.service.js`)
- **Phạm vi hoạt động:** Tích hợp trên cả Web và Mobile (`AiAssistantScreen` và `AiFloatingAssistantOrb`).
- **Multi-turn Context:** Duy trì mạch hội thoại qua `AssistantConversation` và `AssistantMessage`.
- **Hệ thống Quota cá nhân hóa (`aiQuota.service.js`):**
  - Giới hạn lượt chat mỗi ngày theo cấp tài khoản (Gói Free, Gói GO, Gói PLUS, Gói PREMIUM).
  - Tự động nạp lại lượt (reset) vào 00:00 hàng ngày và gửi thông báo `Notification`.
- **Xác nhận hành động (Action Confirmation):**
  - Khi AI đề xuất thực thi hành động can thiệp dữ liệu (ví dụ: tạo playlist mới, thêm bài hát vào yêu thích), AI trả về cấu trúc Intent Action.
  - Người dùng bấm nút **Xác nhận** trên giao diện → client gọi `POST /api/ai/assistant/actions/:actionId/confirm` để hoàn tất.

### D. AI Auto-Tagging & Song Intelligence (`aiAutoTagging.service.js`, `songIntelligence.service.js`)
- **Tự động hóa khi tải lên:** Khi nghệ sĩ hoặc người dùng tải lên bài hát kèm lời:
  - Trích xuất thể loại gợi ý (`suggestedGenres`), tâm trạng (`moodTags`), mức năng lượng (`energyLevel`).
  - Soạn thảo tóm tắt câu chuyện bài hát (`storySummary`) và các câu trích dẫn chữa lành (`healingQuotes`).
- **Tác vụ nền:** `songIntelligence.job.js` quét các bài hát chưa có phân tích để xử lý tuần tự mà không gây nghẽn CPU.

### E. AI Content Moderation (`aiModeration.service.js`)
- Kiểm duyệt tự động lời bài hát và tiêu đề trước khi công khai.
- Đánh giá chỉ số rủi ro: `SAFE` (an toàn), `REVIEW` (cần admin duyệt), `BLOCK` (vi phạm nghiêm trọng ngôn từ kích động, bạo lực).

### F. AI Lyrics Alignment Router (`aiLyricsAlignerRouter.service.js`)
- Cầu nối điều phối giữa Node.js backend và dịch vụ xử lý âm thanh `musicflow_lyrics_sync` (Python Whisper).
- Tạo bản ghi `LyricsAlignmentJob` với fingerprint chống trùng lặp, theo dõi tiến độ heartbeat và đồng bộ kết quả căn nhịp `[mm:ss.xx]` trực tiếp vào `SongLyrics`.

---

## 3. Danh sách Model Gemini Fallback Chain

```js
const MODELS_TO_TRY = [
  process.env.GEMINI_MODEL,    // Biến môi trường ưu tiên (mặc định gemini-2.5-flash)
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash-latest"
];
```

Mọi yêu cầu đều được bọc trong vòng thử nghiệm tuần tự qua danh sách model, đảm bảo dịch vụ luôn duy trì tính sẵn sàng cao ngay cả khi Google áp dụng giới hạn quota trên một model cụ thể.

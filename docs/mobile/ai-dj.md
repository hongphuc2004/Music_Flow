# Trải Nghiệm AI Trên Di Động — musicflow_app

Ứng dụng di động MusicFlow tích hợp 2 hình thức tương tác AI thông minh:
1. **AI DJ (Mood & Voice Playlist Generator):** Tạo nhanh danh sách phát tức thời bằng giọng nói hoặc tâm trạng.
2. **Global AI Assistant (Trợ lý Toàn năng):** Đồng hành qua màn hình chuyên dụng và quả cầu nổi `AiFloatingAssistantOrb`.

---

## 1. Voice AI DJ Bottom Sheet (`VoiceAiDjSheet`)

### Cơ chế hoạt động
- **Kích hoạt:** Nhấn nút biểu tượng Micro AI phát sáng trên trang chủ hoặc thanh công cụ.
- **Xử lý âm thanh:** Tận dụng thư viện `speech_to_text` của Flutter để nhận dạng giọng nói tiếng Việt theo thời gian thực.
- **Gửi yêu cầu:** Chuyển văn bản thu được về backend `POST /api/ai/playlist`.
- **Phát nhạc tự động:** Ngay khi nhận được kết quả danh sách bài hát từ AI DJ, bottom sheet tự động nạp danh sách vào `GlobalAudioState` và bắt đầu phát nhạc ngay lập tức.

---

## 2. Global AI Assistant (`AiAssistantScreen`)

### Các tính năng cốt lõi
- **Hội thoại đa lượt (Multi-turn Context):** Lưu trữ toàn bộ lịch sử trò chuyện trong `AssistantConversation`, cho phép trao đổi liền mạch.
- **Hạn mức Quota trực quan:** Thẻ trạng thái hiển thị rõ số lượt trò chuyện còn lại trong ngày của người dùng, tự động làm mới hàng ngày hoặc mở rộng khi người dùng nâng cấp gói cước Premium.
- **Thực thi Hành động tương tác (Action Buttons):**
  - Khi người dùng hỏi: *"Hãy gợi ý danh sách nhạc cho chuyến đi biển cuối tuần"*, AI không chỉ liệt kê danh sách bài hát mà còn tạo một **Hành động đề xuất (Suggested Action)**.
  - Người dùng chạm vào nút **"Xác nhận tạo Playlist"** hoặc **"Phát toàn bộ"**, ứng dụng sẽ gọi API `confirmAction` để tự động khởi tạo danh sách phát trong tài khoản của người dùng.

---

## 3. Quả Cầu Nổi Đa Năng (`AiFloatingAssistantOrb`)

- **Vị trí linh hoạt:** Hiển thị dưới dạng một biểu tượng phát sáng lơ lửng trên màn hình, người dùng có thể tự do kéo thả vị trí sang mép trái hoặc mép phải màn hình.
- **Truy cập không gián đoạn:** Chạm vào quả cầu để mở cửa sổ trò chuyện nhanh với AI tại bất kỳ màn hình nào trong ứng dụng mà không làm dừng bài hát đang phát.

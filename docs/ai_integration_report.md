# BÁO CÁO KỸ THUẬT: CÁCH TÍCH HỢP & VẬN HÀNH HỆ THỐNG AI TRONG MUSICFLOW
Quản trị tài nguyên (RPM/RPD/Fallback) + Định hình hành vi bằng file quy tắc (.md) + Điều khiển máy phát nhạc tự động bằng Function Calling."*

---

## 📌 TỔNG QUAN: 3 TRỤ CỘT KỸ THUẬT CHÍNH CỦA HỆ THỐNG

Toàn bộ hệ thống AI trong MusicFlow được kiến trúc xoay quanh 3 tầng công việc:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. TẦNG HẠ TẦNG & CHỐNG SẬP (API Key, RPM, TPM, RPD & Fallback)        │
│    Kết nối Google AI Studio ➔ Giám sát hạn ngạch ➔ Tự đổi model dự phòng│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ 2. TẦNG RÈN GIŨA QUY TẮC BẰNG FILE .MD (Prompt Engineering & Guardrail)│
│    Định hình tính cách DJ ➔ Cấm bịa đặt ➔ Hiểu tiếng lóng & ngữ cảnh   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ 3. TẦNG HÀNH ĐỘNG (Function Calling & Audio Player Controller)         │
│    AI kích hoạt Tool ➔ Lục Database thật ➔ Tự bấm Play nhạc trên máy   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 1. TẦNG HẠ TẦNG: KẾT NỐI API & BỘ ĐỊNH TUYẾN CHỐNG SẬP (RPM, TPM, RPD, FALLBACK)

### 🔹 Cách kết nối
- Hệ thống kết nối trực tiếp với nền tảng **Google AI Studio** thông qua `GEMINI_API_KEY`.
- Không gọi trực tiếp một model duy nhất, mà đưa qua một bộ quản lý tập trung: **`geminiRouter.service.js`**.

### 🔹 Kiểm soát hạn ngạch 
Google áp dụng các giới hạn tài nguyên
- **RPM (Requests Per Minute):** Giới hạn số lượt gọi trong 1 phút để tránh nghẽn tức thời.
- **TPM (Tokens Per Minute):** Giới hạn token xử lý trong 1 phút.
- **RPD (Requests Per Day):** Giới hạn số lượt tối đa trong 24 giờ của từng model 
- **Bộ đếm cục bộ (Local RPD Tracker):** Hệ thống tự động theo dõi số lượt đã dùng của từng model và tự động reset hạn mức vào đúng nửa đêm theo múi giờ Google (America/Los_Angeles).

### 🔹 Cơ chế Fallback linh hoạt theo Gói tài khoản (In-Tier Failover)
Các model được phân chia độc lập theo từng cấp bậc tài khoản, không dùng chung đụng:
- **Gói Premium:** `gemini-3.5-flash-lite`, `gemini-3.8-flash`, `gemini-3.1-flash-lite`.
- **Gói Plus:** `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3-flash-preview`.
- **Gói Basic:** `gemini-2.5-flash`, `gemini-3.5-flash`.

> **Khi gặp lỗi Rate Limit (HTTP 429) hoặc sập mạng (503):**  
> Bộ định tuyến không báo lỗi ra màn hình người dùng, mà **tự động gạt sang model dự phòng kế tiếp bên trong gói đó** trong tích tắc. 

---

## 2. TẦNG RÈN GIŨA: DẠY DỖ QUY TẮC CHO AI BẰNG CÁC FILE `.MD`

Hệ thống áp dụng kỹ thuật **Prompt Engineering & System Guardrails** thông qua các file định dạng Markdown (`.md`) nằm trong thư mục `src/ai/`:

### 🔹 File `src/ai/prompts/system.md` (Bản nội quy trung tâm)
- **Định hình vai trò (Persona):** AI luôn cư xử như một Trợ lý DJ âm nhạc thông minh, trẻ trung và thấu cảm cảm xúc người nghe.
- **Rào chắn chống bịa đặt (Anti-Hallucination):** Khi người dùng muốn nghe nhạc, AI bắt buộc phải gọi công cụ tìm kiếm trong kho nhạc. Nếu không tìm thấy, trả lời chưa có, không được bịa link hay bài hát bậy bạ.
- **Chuẩn hóa đầu ra:** AI luôn trả về cấu trúc dữ liệu hành động để hệ thống phía sau dễ dàng bóc tách.

### 🔹 File `src/ai/rules/mood.json` & `intent.json` (Từ điển cảm xúc & ý định)
- Nạp sẵn bản đồ phân loại tâm trạng (vui, buồn, chill, tập trung, lãng mạn, ngủ, tiệc tùng).
- Dạy AI hiểu được ý định ẩn ý: Người dùng than thở *"hôm nay chia tay buồn quá"* ➔ Hệ thống tự động hiểu mood là `sad` để gợi ý bài hát xoa dịu.

### 🔹 Xử lý tiếng lóng, Teen Code & Bộ nhớ ngữ cảnh
- **Dịch tiếng lóng tự động:** Người dùng gõ teen code như `mún` ➔ hệ thống dịch thành `muốn`, gõ `chinise` ➔ tự ánh xạ về chủ đề `Nhạc Hoa (C-Pop)`.
- **Ghi nhớ ngữ cảnh (Context Memory):** Khi người dùng nói *"Tìm nhạc Đen Vâu"*, sau đó nói tiếp *"Phát bài đầu tiên đi"* hoặc *"Mở nó lên"*, AI được nạp lịch sử chat gần nhất để hiểu đại từ **"nó"** chính là bài hát của Đen Vâu vừa tìm được.

---

## 3. TẦNG HÀNH ĐỘNG THẬT: FUNCTION CALLING & ĐIỀU KHIỂN AUDIO PLAYER

### 🔹 Kỹ thuật Gọi hàm (Function Calling)
AI không trực tiếp chui vào cơ sở dữ liệu. Thay vào đó, nó được cung cấp các bản mô tả công cụ (Tool Schemas) như:
- `search_music(genre, artist, query, limit)`
- `play_song(songId, title)`
- `create_mood_playlist(mood, count)`

Khi người dùng yêu cầu, AI sẽ phát ra một lệnh gọi hàm có cấu trúc rõ ràng. Backend đón nhận lệnh này, chạy xuống cơ sở dữ liệu để tìm đúng bài hát đang có trên hệ thống.

### 🔹 Đóng gói Lệnh điều khiển Client (`clientActions`)
Sau khi lấy được bài hát thật trong cơ sở dữ liệu, file `assistant.service.js` sẽ đóng gói phản hồi thành một gói tin đặc biệt:
```json
{
  "assistantText": "Gợi ý cho bạn bài hát '晴 (Nắng)' cực hay nhé! 🎵",
  "clientActions": [
    {
      "type": "PLAY_SONG",
      "payload": {
        "songId": "6a0728c87edda8362c93701a",
        "title": "晴",
        "audioUrl": "https://res.cloudinary.com/.../audio.mp3"
      }
    }
  ]
}
```

### 🔹 Tự động bấm Play trên máy người dùng
- Trên **React Web** (qua `ClientPlayerProvider`) và trên **Flutter Mobile** (qua `audio_service`):
- Khi ứng dụng nhận được gói `clientActions`, trình phát nhạc sẽ **tự động nạp bài hát vào bộ nhớ và kích hoạt phát nhạc ngay trên loa**.
- Người dùng chỉ việc ra lệnh bằng giọng nói hoặc tin nhắn, bài hát tự cất lên mà không cần tự tay bấm bất kỳ nút nào.

---

## 🎬 TỔNG KẾT BẰNG 1 VÍ DỤ THỰC TẾ (1.5 GIÂY)

Khi người dùng nói: 👉 **"mún nghe nhạc trung thì nghe bài nào"**

1. **Kiểm tra & Cấp phát:** Hệ thống kiểm tra RPD còn lượt, chọn model `gemini-2.5-flash`.
2. **Tuân thủ quy tắc (.md):** AI đọc nội quy trong file `.md`, biết không được tự bịa bài hát Trung Quốc bên ngoài, nên gọi tool `search_music({ genre: "chinise" })`.
3. **Lục Database:** Hệ thống dịch `mún` ➔ `muốn`, `chinise` ➔ `Nhạc Hoa`, tìm thấy bài *"晴 (Nắng)"* trong MongoDB.
4. **Phát nhạc tự động:** Backend trả về câu thoại kèm lệnh `PLAY_SONG`. Ứng dụng trên điện thoại/máy tính tự động bấm Play bài hát!
5. **Chống sập:** Nếu model đang gọi bị chạm trần Rate Limit (429), bộ định tuyến tự động chuyển sang model kế tiếp trong gói ngay lập tức mà bài hát vẫn phát bình thường.

---

## 🎯 LỜI KẾT KHI TRÌNH BÀY

> *"Như vậy, hệ thống AI của MusicFlow được cấu thành từ 3 phần không thể tách rời:  
> 1. **Hạ tầng AI Studio được kiểm soát chặt chẽ bởi RPM, TPM, RPD và bộ Fallback tự động chống sập.**  
> 2. **Hành vi, tính cách và rào chắn cấm bịa đặt được quy định chặt chẽ bằng các file `.md`.**  
> 3. **Và quan trọng nhất, dùng Function Calling để AI lục Database thật và tự động bấm nút phát nhạc trên máy của người dùng.**  
> Đó là lý do đây là một sản phẩm phần mềm hoàn chỉnh tự tay thiết kế, chứ không đơn thuần chỉ là đi lấy một API có sẵn về gọi chữ ra màn hình."*

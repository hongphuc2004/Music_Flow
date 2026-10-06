# 🎙️ MusicFlow Lyrics Sync — AI Neural Lyrics & Karaoke Worker

Worker xử lý nền chuyên dụng (Background AI Worker) của hệ sinh thái **MusicFlow**, đảm nhận 2 nhiệm vụ cốt lõi:
1. **Bóc tách lời bài hát tự động (Audio Transcription)**: Sử dụng **Gemini 2.5 Flash Audio API** kết hợp cơ chế dự phòng **Faster-Whisper**.
2. **Căn mốc thời gian chuẩn phòng thu (Acoustic Forced Alignment)**: Căn chỉnh mốc thời gian chính xác từng câu và từng từ thành định dạng **LRC Karaoke** bằng mô hình **Wav2Vec2 CTC** (`nguyenvulebinh/wav2vec2-base-vietnamese-250h`) đã được lượng tử hóa sang **ONNX INT8** siêu tốc trên CPU.

---

## 🏗️ Kiến Trúc Hoạt Động (Architecture)

```
[Audio MP3 / WAV từ Cloudinary]
             ↓
[1. Chuẩn hóa âm thanh 16kHz Mono]
             ↓
[2. Bóc tách ca từ (Transcription)]:
    ├── Ưu tiên: Google Gemini 2.5 Flash (nhận diện ngữ nghĩa tiếng Việt chuẩn xác)
    └── Fallback: Faster-Whisper (khi mất kết nối hoặc hết quota API)
             ↓
[3. Căn nhịp âm học (Forced Alignment)]:
    └── Wav2Vec2 CTC (ONNX INT8) + Log-Space Trellis DP + Viterbi Backtracking
             ↓
[4. Tinh chỉnh độ ngân & điểm mở miệng (Onset Snapping & Energy Extension)]
             ↓
[Tạo tệp đồng bộ LRC & ghi nhận vào MongoDB Atlas]
```

---

## 📋 Yêu Cầu Môi Trường (Prerequisites)

- **Python**: 3.10 hoặc 3.11.
- **FFmpeg**: Công cụ giải mã âm thanh (bắt buộc phải cài trên máy và có trong biến `PATH`).
- **libsndfile**: Thư viện đọc/ghi audio (thường đi kèm package Python `soundfile`).
- **MongoDB**: Truy cập vào cơ sở dữ liệu `musicflow_db`.

---

## ⚙️ Hướng Dẫn Cài Đặt & Chạy Cục Bộ (Local Python Setup)

### 1. Di chuyển vào thư mục
```bash
cd musicflow_lyrics_sync
```

### 2. Cài đặt FFmpeg (Nếu máy chưa có)
- **Windows:** Sử dụng `winget install Gyan.FFmpeg` hoặc `choco install ffmpeg`.
- **macOS:** `brew install ffmpeg`
- **Linux (Ubuntu/Debian):** `sudo apt update && sudo apt install -y ffmpeg libsndfile1`

### 3. Tạo môi trường ảo Python (Virtual Environment)
```bash
# Tạo virtualenv:
python -m venv venv

# Kích hoạt trên Windows:
.\venv\Scripts\activate

# Kích hoạt trên macOS / Linux:
source venv/bin/activate
```

### 4. Cài đặt các gói thư viện
Cài đặt bản PyTorch CPU trước để tiết kiệm dung lượng (giảm từ 5GB xuống ~800MB):
```bash
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
```

### 5. Thiết lập biến môi trường
Tạo file `.env` trong thư mục `musicflow_lyrics_sync/`:
```env
# Chuỗi kết nối MongoDB (cùng database với Backend)
MONGO_URI=mongodb://127.0.0.1:27017/musicflow_db
DATABASE_NAME=musicflow_db

# Google Gemini API (dùng cho bóc tách lời bài hát)
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash

# Cấu hình thiết bị xử lý (cpu hoặc cuda nếu có GPU NVIDIA)
WORKER_DEVICE=cpu
ALLOW_CPU_FALLBACK=true

# Cấu hình Whisper dự phòng
WHISPER_MODEL_SIZE=base
WHISPER_COMPUTE_TYPE=int8
```

### 6. Khởi chạy Worker
```bash
python main.py
```
Worker sẽ kết nối vào MongoDB và liên tục lắng nghe collection `lyricsalignmentjobs`. Khi nghệ sĩ bấm nút nhận diện lời hoặc tạo nhịp trên web, worker sẽ lập tức tiếp nhận và xử lý.

---

## 🐳 Khởi Chạy Nhanh Bằng Docker

Dự án đã có sẵn Dockerfile tối ưu hóa tài nguyên:
```bash
# Từ thư mục gốc Music_Flow:
docker compose --profile dev up --build lyrics_sync_dev
```

---

## ☁️ Các Phương Án Triển Khai Lên Đám Mây (Cloud Deployment)

1. **Modal.com Serverless GPU/CPU (`modal_app.py`):**
   - Triển khai serverless siêu tốc với 30$ credit miễn phí hàng tháng từ Modal.
   ```bash
   modal deploy modal_app.py
   ```
2. **Google Cloud Run (`server_cloudrun.py`):**
   - Đóng gói container chạy API HTTP endpoint `/align` scale-to-zero tiết kiệm chi phí.
3. **Render / VPS Docker (`docs/deploy_lyrics_sync_render.md`):**
   - Triển khai container chạy nền 24/7 kết nối trực tiếp vào MongoDB Atlas.

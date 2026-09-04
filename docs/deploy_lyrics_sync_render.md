# Hướng Dẫn Deploy MusicFlow Lyrics Sync Lên Render (Production)

Tài liệu này hướng dẫn cách đưa dịch vụ **MusicFlow Lyrics Sync** (`musicflow_lyrics_sync`) chạy 24/7 trên **Render** kết nối cùng MongoDB Atlas với Backend, không cần chạy thủ công lệnh `py main.py` ở máy cá nhân nữa.

---

## 1. Cơ Chế Hoạt Động Trên Render

* Service được đóng gói bằng **Docker** (`musicflow_lyrics_sync/Dockerfile`), đã tối ưu hóa cho CPU (PyTorch CPU wheel, chỉ ~800MB thay vì 5GB CUDA).
* Worker chạy một vòng lặp liên tục:
  1. Kết nối vào **MongoDB Atlas** (chung với backend).
  2. Lắng nghe collection `lyricsalignmentjobs`.
  3. Khi có ca sĩ bấm "Tự động tạo nhịp bằng AI" trên web, Worker tự động nhận job, căn nhịp và ghi kết quả vào MongoDB.
* **Tích hợp sẵn Health Check HTTP Server:** Nếu triển khai dưới dạng **Web Service (Gói Miễn Phí của Render)**, service tự động mở cổng để Render kiểm tra trạng thái sống (alive), giúp bạn chạy **hoàn toàn miễn phí 0đ**!

---

## 2. Các Bước Triển Khai Trên Render

### Cách 1: Triển khai dạng Web Service (MIỄN PHÍ - Free Tier 0đ)

Render cung cấp gói Web Service miễn phí (Free Tier). Chúng ta đã tích hợp sẵn một HTTP Health Check server ngầm trong `main.py` để Render duy trì trạng thái `Live`.

1. Đăng nhập vào [Dashboard Render](https://dashboard.render.com).
2. Bấm nút **New +** ở góc phải trên ➔ chọn **Web Service**.
3. Kết nối với GitHub Repository của bạn: `Music_Flow`.
4. Điền các thông số cấu hình:
   * **Name:** `musicflow_lyrics_sync` (hoặc `musicflow-lyrics-sync`)
   * **Region:** Singapore hoặc Oregon (cùng region với Backend `Music_Flow`)
   * **Root Directory:** `musicflow_lyrics_sync` *(bắt buộc)*
   * **Runtime / Environment:** `Docker`
   * **Instance Type:** `Free` (0$/tháng)
5. Kéo xuống mục **Environment Variables** (Biến môi trường) và thêm:

| Tên biến (Key) | Giá trị (Value) | Giải thích |
| :--- | :--- | :--- |
| `MONGO_URI` | `mongodb+srv://<user>:<password>@cluster0.xxx.mongodb.net/musicflow_db?retryWrites=true&w=majority` | Chuỗi kết nối MongoDB Atlas (sao chép giống hệt backend) |
| `WORKER_DEVICE` | `cpu` | Chạy chế độ CPU tối ưu |
| `ALLOW_CPU_FALLBACK` | `true` | Luôn cho phép fallback CPU |
| `PIPELINE_VERSION` | `3.0.0` | Phiên bản pipeline |

6. Bấm **Create Web Service**.
   * Render sẽ tự động build Docker image (mất khoảng 1 - 2 phút).
   * Khi build xong, bạn sẽ thấy log:
     ```
     [Worker] Health check HTTP server started on port 10000
     [Worker] Initialized AI Alignment Worker (ID: worker-xxxx)
     [Worker] Connected to MongoDB: musicflow_db
     [Worker] Worker polling loop started. Waiting for jobs...
     ```

---

### Cách 2: Triển khai dạng Background Worker (Gói Starter - 7$/tháng)

Nếu tài khoản Render của bạn có gói Starter trả phí, Background Worker là loại dịch vụ chuyên dụng không cần mở cổng HTTP:

1. Trên Render Dashboard, bấm **New +** ➔ chọn **Background Worker**.
2. Chọn repo `Music_Flow`.
3. Cấu hình:
   * **Name:** `musicflow_lyrics_sync`
   * **Root Directory:** `musicflow_lyrics_sync`
   * **Runtime:** `Docker`
   * **Environment Variables:** Điền `MONGO_URI`, `WORKER_DEVICE=cpu`, `ALLOW_CPU_FALLBACK=true` giống như trên.
4. Bấm **Create Background Worker**.

---

## 3. Cách Kiểm Tra Sau Khi Deploy

1. Mở trang web Production của bạn trên Vercel: `https://<ten-mien-web>.vercel.app/artist/songs`.
2. Chọn một bài hát ➔ Bấm icon **Lời bài hát** ➔ Nhập lời hoặc upload file txt.
3. Bấm **✨ Tự động tạo nhịp bằng AI**.
4. Quan sát log trên Render:
   ```
   [Worker] Claimed pending job: job-xxxx
   [Worker] Running Vietnamese Wav2Vec2 CTC acoustic alignment...
   [Worker] Successfully aligned lines in 4200ms
   [Worker] Job job-xxxx SUCCEEDED in 8.5s!
   ```
5. Trên giao diện Web Vercel, tiến độ sẽ tự động nhảy lên 100% và hiển thị mốc thời gian hoàn tất!

---

## 4. Chạy Bằng Docker Compose (Trên VPS riêng hoặc Local)

Nếu bạn có VPS riêng hoặc muốn chạy tự động trên máy mà không cần gõ `py main.py`:
```bash
# Môi trường Development:
docker compose --profile dev up --build

# Môi trường Production:
docker compose --profile prod up --build -d
```
Service `lyrics_sync` sẽ tự động khởi động cùng lúc với MongoDB và Backend.

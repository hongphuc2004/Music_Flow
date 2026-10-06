# 🚀 MusicFlow Backend — RESTful API Node.js / Express

Máy chủ API trung tâm của hệ sinh thái **MusicFlow**, cung cấp toàn bộ dịch vụ dữ liệu, xác thực đa tầng, lưu trữ đám mây, trí tuệ nhân tạo (AI Assistant, AI DJ, Vector Embedding Search) và điều phối tiến trình căn nhịp lời bài hát.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

- **Runtime:** Node.js 18+ (khuyên dùng Node 20 LTS)
- **Framework:** Express v5
- **Database:** MongoDB + Mongoose ODM
- **Xác thực (Auth):** JWT (Access token 1h + Refresh token) & Google OAuth 2.0 (`google-auth-library`)
- **Lưu trữ tệp đa phương tiện:** Cloudinary (Audio streaming & Image thumbnail) + Multer
- **Trí tuệ nhân tạo (AI):** 
  - Google Gemini API (`@google/generative-ai`): AI DJ gợi ý bài hát theo tâm trạng, kiểm duyệt nội dung, Gemini Embedding tìm kiếm ngữ nghĩa.
  - Mistral AI: Mô hình dự phòng (Fallback AI).
- **Email:** Nodemailer (Gửi mã xác thực OTP qua Gmail SMTP)

---

## 📋 Yêu Cầu Môi Trường (Prerequisites)

- **Node.js**: v18.0.0 hoặc mới hơn.
- **MongoDB**: Đã cài đặt MongoDB cục bộ (`mongodb://127.0.0.1:27017`) hoặc chuỗi kết nối **MongoDB Atlas**.
- **Tài khoản Cloudinary**: Để lưu trữ tệp nhạc MP3 và ảnh đại diện.
- **Google AI Studio API Key**: Để sử dụng các tính năng Gemini AI.

---

## ⚙️ Hướng Dẫn Cài Đặt & Khởi Chạy (Local Setup)

### 1. Di chuyển vào thư mục backend
```bash
cd musicflow_backend
```

### 2. Thiết lập biến môi trường (.env)
Dự án hỗ trợ đọc file cấu hình môi trường tương ứng:
- Môi trường phát triển: `.env.dev` hoặc `.env`
- Môi trường production: `.env.prod`

Tạo file môi trường từ mẫu:
```bash
# Windows PowerShell:
copy .env.example .env.dev

# Linux / macOS:
cp .env.example .env.dev
```

### 3. Cấu hình các biến trong file `.env.dev`
Mở file `.env.dev` và điền các giá trị thực tế:

```env
# Cổng máy chủ API
PORT=5001
NODE_ENV=development
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
REFRESH_COOKIE_NAME=mf_refresh_token

# Kết nối cơ sở dữ liệu MongoDB
MONGO_URI=mongodb://127.0.0.1:27017/musicflow_db

# Khóa bí mật JWT
JWT_SECRET=your_super_secret_jwt_key_here
PLAYBACK_TICKET_SECRET=your_playback_ticket_secret_here

# Lưu trữ tệp Cloudinary (https://cloudinary.com)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Google OAuth Web Client ID (dùng xác thực Google Sign-In)
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com

# Trí tuệ nhân tạo Gemini (https://aistudio.google.com)
GEMINI_API_KEY=your_google_gemini_api_key

# Cấu hình gửi Mail OTP quên mật khẩu (Tùy chọn)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
EMAIL_FROM="MusicFlow" <no-reply@musicflow.com>
```

### 4. Cài đặt các gói thư viện
```bash
npm install
```

### 5. Khởi chạy máy chủ API
```bash
# Chạy ở chế độ phát triển (nodemon tự động tải lại khi sửa code):
npm run dev

# Chạy ở chế độ production thông thường:
npm start
```

Khi khởi chạy thành công, terminal sẽ thông báo:
```text
[Server] MusicFlow API is running on port 5001
[Database] MongoDB connected successfully: musicflow_db
```

---

## 📡 Danh Mục API Chính (API Endpoints Overview)

Tất cả các route được gắn tiền tố `/api/*`:

| Nhóm API | Tiền tố Route | Chức năng chính |
| :--- | :--- | :--- |
| **Auth** | `/api/auth` | Đăng ký, đăng nhập, Google OAuth, Refresh token, Đổi/Quên mật khẩu OTP |
| **Songs** | `/api/songs` | Lấy danh sách bài hát, chi tiết bài hát, stream nhạc, tăng lượt nghe |
| **Artist Studio**| `/api/artist` | Upload bài hát, sửa metadata, bóc tách và căn nhịp lời AI, thống kê |
| **AI Assistant** | `/api/ai` | AI DJ gợi ý playlist theo tâm trạng, trò chuyện âm nhạc, gợi ý bài hát |
| **Playlists** | `/api/playlists`| Quản lý playlist cá nhân, thêm/xóa bài hát vào playlist |
| **Topics** | `/api/topics` | Danh mục thể loại, chủ đề âm nhạc |
| **Users** | `/api/users` | Quản lý thông tin tài khoản, danh sách bài hát yêu thích |

---

## 🗄️ Các Script Di Trú & Công Cụ (Database Scripts)

Dự án cung cấp sẵn một số script hữu ích trong `src/scripts/`:

```bash
# Chạy thử nghiệm kiểm tra phân loại vai trò bài hát (dry-run):
npm run migrate:song-source:dry

# Áp dụng cập nhật phân loại nguồn bài hát vào cơ sở dữ liệu:
npm run migrate:song-source:apply
```

---

## 🐳 Chạy Bằng Docker
Nếu sử dụng Docker Compose tại thư mục gốc của repo:
```bash
docker compose --profile dev up --build backend_dev
```
Backend sẽ được đóng gói và kết nối trực tiếp với MongoDB container trong cùng mạng nội bộ Docker.

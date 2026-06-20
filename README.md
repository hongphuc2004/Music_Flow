# 🎵 MusicFlow — Hướng dẫn Cài đặt & Khởi chạy nhanh

MusicFlow là một hệ sinh thái ứng dụng quản lý, phát nhạc và chia sẻ âm nhạc đa nền tảng, bao gồm:
- **musicflow_backend/**: Backend Node.js/Express phục vụ API, xác thực, quản lý người dùng, upload nhạc (Cloudinary) và AI gợi ý nhạc (Gemini API).
- **musicflow_web/**: Giao diện web React 19 + Vite + MUI dành cho Admin, Artist và Client/User.
- **musicflow_app/**: Ứng dụng di động Flutter (Android & iOS) dành cho Client/User nghe nhạc trực tuyến, hỗ trợ background play và hát karaoke theo lyric.

Dưới đây là hướng dẫn chi tiết từng bước để cài đặt và chạy dự án từ khi clone về máy mới.

---

## 📋 Yêu cầu hệ thống (Prerequisites)
Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đã cài đặt:
- **Node.js** v18+
- **Flutter SDK** v3.19+ (kèm Android SDK / Xcode)
- **MongoDB** (Local instance chạy cổng `27017` hoặc sử dụng tài khoản **MongoDB Atlas**)
- **Docker & Docker Compose** (Không bắt buộc, dùng để chạy nhanh container)

---

## ⚙️ Các bước cài đặt chi tiết

### 1. Thiết lập Backend (`musicflow_backend/`)
1. Di chuyển vào thư mục backend:
   ```bash
   cd musicflow_backend
   ```
2. Tạo file môi trường:
   Sao chép file `.env.example` thành `.env.dev` (để chạy dev cục bộ) và `.env.prod` (khi chạy production):
   ```bash
   cp .env.example .env.dev
   ```
3. Mở file `.env.dev` bằng VS Code hoặc text editor bất kỳ và cấu hình các biến chính:
   - `MONGO_URI`: Chuỗi kết nối MongoDB (Ví dụ: `mongodb://127.0.0.1:27017/musicflow_db`)
   - `JWT_SECRET`: Một chuỗi ký tự ngẫu nhiên bất kỳ (Ví dụ: `my_super_secret_key_123`)
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: Tạo tài khoản Cloudinary miễn phí và lấy thông tin cấu hình điền vào (dùng để upload nhạc và ảnh).
   - `GEMINI_API_KEY`: API Key từ Google AI Studio (để kích hoạt AI DJ gợi ý nhạc theo tâm trạng).
   - `GOOGLE_CLIENT_ID`: Web Client ID từ Google Cloud Console (nếu muốn dùng Google Sign-In).
4. Cài đặt các thư viện phụ thuộc:
   ```bash
   npm install
   ```
5. Khởi chạy server ở chế độ Development (nodemon hot-reload):
   ```bash
   npm run dev
   ```
   *Mặc định backend sẽ chạy ở cổng **5001** (API Endpoint: `http://localhost:5001`).*

---

### 2. Thiết lập Web Frontend (`musicflow_web/`)
1. Di chuyển vào thư mục web:
   ```bash
   cd ../musicflow_web
   ```
2. Tạo file môi trường:
   Sao chép file `.env.example` thành `.env`:
   ```bash
   cp .env.example .env
   ```
3. Kiểm tra các biến trong file `.env`:
   - `VITE_API_URL`: Cổng API Backend (mặc định: `http://localhost:5001/api`).
   - `VITE_GOOGLE_CLIENT_ID`: Cấu hình Google Client ID trùng khớp với backend.
4. Cài đặt các thư viện phụ thuộc:
   ```bash
   npm install
   ```
5. Khởi chạy ứng dụng Web:
   ```bash
   npm run dev
   ```
   *Trình duyệt sẽ tự động mở hoặc bạn có thể truy cập qua: `http://localhost:5173`.*

---

### 3. Thiết lập App Flutter (`musicflow_app/`)
1. Di chuyển vào thư mục app:
   ```bash
   cd ../musicflow_app
   ```
2. Tải các package Flutter cần thiết:
   ```bash
   flutter pub get
   ```
3. Chạy ứng dụng di động:
   - **Chạy trên máy ảo (Android Emulator / iOS Simulator):**
     ```bash
     flutter run
     ```
     *(Tự động phát hiện môi trường: Android Emulator trỏ về `10.0.2.2:5001`, iOS Simulator và Web trỏ về `localhost:5001`).*
   - **Chạy trên thiết bị thật (Physical Device) hoặc muốn chỉ định API cụ thể:**
     Bạn cần truyền IP mạng nội bộ (LAN IP) của máy tính đang chạy backend:
     ```bash
     flutter run --dart-define=API_BASE_URL=http://<ip-lan-may-tinh>:5001
     ```

---

## 🐳 Khởi chạy nhanh bằng Docker
Nếu máy bạn có cài đặt Docker và Docker Compose, bạn có thể chạy đồng thời Backend, Web Frontend và Database MongoDB chỉ bằng một dòng lệnh từ thư mục gốc của dự án:

### Khởi chạy chế độ Phát triển (Development - Hot reload)
1. Cấu hình file `musicflow_backend/.env.dev` tương tự bước 1 ở trên.
2. Tại thư mục gốc chạy:
   ```bash
   docker compose --profile dev up --build
   ```
3. URL truy cập:
   - Web: `http://localhost:5173`
   - Backend API: `http://localhost:5001`
   - MongoDB: `mongodb://localhost:27017`

### Khởi chạy chế độ Production
1. Cấu hình file `musicflow_backend/.env.prod`.
2. Tại thư mục gốc chạy:
   ```bash
   docker compose --profile prod up --build -d
   ```
3. URL truy cập:
   - Web: `http://localhost:8080`
   - Backend API: `http://localhost:5000`

Để dừng dịch vụ Docker:
```bash
docker compose down
```

---

## 🚀 Hướng dẫn Deploy nhanh

### 1. Cơ sở dữ liệu (MongoDB Atlas)
- Đăng ký tài khoản MongoDB Atlas, tạo cluster M0 miễn phí.
- Thêm IP `0.0.0.0/0` trong Network Access (hoặc IP cụ thể của Render/Vercel).
- Lấy chuỗi kết nối (Connection String) điền vào `MONGO_URI` (Lưu ý: Nếu mật khẩu chứa ký tự đặc biệt như `@`, hãy mã hóa thành `%40`).

### 2. Backend (Render)
- Tạo mới một `Web Service` từ repo của bạn.
- Cấu hình:
  - **Root Directory**: `musicflow_backend`
  - **Build Command**: `npm install`
  - **Start Command**: `npm start`
- Khai báo đầy đủ các biến môi trường trong file `.env.prod` lên phần Environment Variables của Render.

### 3. Frontend Web (Vercel)
- Tạo mới project trên Vercel liên kết với repo.
- Cấu hình:
  - **Root Directory**: `musicflow_web`
  - **Build Command**: `npm run build`
  - **Output Directory**: `dist`
- Khai báo biến môi trường:
  - `VITE_API_URL`: `https://<ten-mien-render-cua-ban>.onrender.com/api`
  - `VITE_GOOGLE_CLIENT_ID`: Google Client ID tương ứng.

---

## 🛠️ Một số lỗi thường gặp khi cài đặt
1. **Lỗi `origin_mismatch` (Google Login)**: Kiểm tra cấu hình `Authorized JavaScript origins` trên Google Cloud Console đã thêm đúng domain web đang chạy chưa (ví dụ: `http://localhost:5173` hoặc domain production).
2. **Lỗi CORS (`Not allowed by CORS`)**: Kiểm tra giá trị `CORS_ORIGINS` trong `.env` backend đã khai báo đúng domain của frontend chưa, các domain phân tách bằng dấu phẩy không chứa khoảng trắng dư thừa.
3. **Lỗi kết nối MongoDB Atlas (`querySrv ENOTFOUND`)**: Hãy chắc chắn mật khẩu trong chuỗi kết nối của bạn đã được mã hóa URL-encode.
4. **Lỗi Router 404 trên Web sau khi Deploy**: Đảm bảo tệp `musicflow_web/vercel.json` có mặt ở thư mục gốc của project web để rewrite toàn bộ các route SPA về `index.html`.


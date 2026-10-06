# 🌐 MusicFlow Web — Giao Diện Web React 19 + MUI

Giao diện Web đa cổng (Multi-portal) của hệ sinh thái **MusicFlow**, được xây dựng trên nền tảng **React 19**, **Vite** và **Material UI (MUI v7)**.

Hệ thống bao gồm 3 phân hệ cổng (portals):
- 👑 **Admin Portal (`/`)**: Quản trị tài khoản, kiểm duyệt bài hát, quản lý chủ đề/thể loại, playlist hệ thống và cấu hình.
- 🎙️ **Artist Portal (`/artist/*`)**: Studio dành cho nghệ sĩ: upload bài hát, quản lý lời nhạc & đồng bộ LRC karaoke bằng AI, xem thống kê lượt nghe.
- 🎧 **Client/User Portal (`/client/*`)**: Trình phát nhạc trực tuyến cá nhân hóa, bảng xếp hạng, thư viện nhạc yêu thích, AI DJ gợi ý theo tâm trạng.

---

## 📋 Yêu Cầu Môi Trường (Prerequisites)

- **Node.js**: v18.0.0 trở lên (khuyên dùng Node 20+ LTS).
- **npm** (v9+) hoặc **yarn** / **pnpm**.
- Backend MusicFlow đã khởi chạy (mặc định tại `http://localhost:5001`).

---

## ⚙️ Hướng Dẫn Cài Đặt & Chạy Cục Bộ (Local Development)

### 1. Di chuyển vào thư mục web
```bash
cd musicflow_web
```

### 2. Thiết lập biến môi trường (.env)
Sao chép file mẫu `.env.example` thành file `.env`:

```bash
# Trên Windows PowerShell / Command Prompt:
copy .env.example .env

# Trên macOS / Linux:
cp .env.example .env
```

Mở file `.env` và kiểm tra các cấu hình:
```env
# URL trỏ tới API Backend MusicFlow
VITE_API_URL=http://localhost:5001/api

# Target proxy (cho phát triển cục bộ nếu cần)
VITE_PROXY_TARGET=http://localhost:5001

# Google OAuth Web Client ID (dùng cho tính năng Đăng nhập Google)
VITE_GOOGLE_CLIENT_ID=your_google_oauth_web_client_id.apps.googleusercontent.com
```

### 3. Cài đặt các thư viện phụ thuộc
```bash
npm install
```

### 4. Khởi chạy máy chủ phát triển (Dev Server)
```bash
npm run dev
```
Trình duyệt sẽ sẵn sàng tại địa chỉ: **`http://localhost:5173`**.

---

## 🧭 Cấu Trúc Các Phân Hệ & Điều Hướng (Routing)

| Cổng (Portal) | Đường dẫn chính | Quyền truy cập (Role) | Chức năng nổi bật |
| :--- | :--- | :--- | :--- |
| **Client** | `/client/home` | Người dùng (`user`) | Khám phá nhạc, bảng xếp hạng, phát nhạc toàn cục, AI DJ chat |
| **Artist** | `/artist/dashboard` | Nghệ sĩ (`artist`) | Quản lý tác phẩm, studio đồng bộ lời karaoke AI, phân tích số liệu |
| **Admin** | `/` | Quản trị (`admin`) | Quản lý người dùng, bài hát, kiểm duyệt nội dung, danh mục thể loại |
| **Auth** | `/accountlogin` | Công khai | Đăng nhập tài khoản, Google Sign-In, quên mật khẩu |

---

## 🛠️ Các Lệnh Thao Tác (Scripts)

| Lệnh | Mục đích |
| :--- | :--- |
| `npm run dev` | Chạy dev server với tính năng Hot Module Replacement (Vite HMR). |
| `npm run build` | Đóng gói mã nguồn tối ưu cho môi trường Production (thư mục `dist/`). |
| `npm run preview` | Khởi chạy máy chủ thử nghiệm cục bộ trên bản build `dist/`. |
| `npm run lint` | Chạy ESLint kiểm tra lỗi cú pháp và quy chuẩn mã nguồn. |

---

## 🚀 Đóng Gói & Triển Khai (Production Deployment)

### 1. Build Production
```bash
npm run build
```
Kết quả đóng gói sẽ nằm trong thư mục `musicflow_web/dist`.

### 2. Triển khai lên Vercel
- **Root Directory:** `musicflow_web`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Environment Variables trên Vercel:**
  - `VITE_API_URL`: URL Backend production (ví dụ: `https://<ten-mien-render>.onrender.com/api`)
  - `VITE_GOOGLE_CLIENT_ID`: Google OAuth Web Client ID

> **Lưu ý Single Page App (SPA):** File `vercel.json` đã được định cấu hình sẵn quy tắc rewrite toàn bộ route về `/index.html` để tránh lỗi 404 khi tải lại trang.

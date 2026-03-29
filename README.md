# MusicFlow

MusicFlow là một hệ sinh thái ứng dụng quản lý, phát nhạc và chia sẻ âm nhạc đa nền tảng, bao gồm:

- **musicflow_app/**: Ứng dụng di động Flutter (Android, iOS, Web, Desktop) cho người dùng nghe nhạc, quản lý playlist, tìm kiếm và phát nhạc trực tuyến.
- **musicflow_backend/**: Backend Node.js/Express phục vụ API, xác thực, quản lý người dùng, upload nhạc, xử lý dữ liệu và kết nối cơ sở dữ liệu.
- **musicflow_web/**: Giao diện web hiện đại (React + Vite) cho phép truy cập, nghe nhạc, quản lý tài khoản và playlist trực tiếp trên trình duyệt.

## Tính năng chính
- Đăng ký/đăng nhập, xác thực người dùng
- Nghe nhạc trực tuyến, quản lý playlist cá nhân
- Tìm kiếm bài hát, nghệ sĩ, album
- Upload nhạc, chia sẻ nhạc
- Giao diện đẹp, thân thiện trên nhiều nền tảng

## Cấu trúc thư mục
- `musicflow_app/`: Mã nguồn ứng dụng Flutter
- `musicflow_backend/`: Mã nguồn backend Node.js
- `musicflow_web/`: Mã nguồn giao diện web React

## Hướng dẫn cài đặt nhanh
### 1. Backend
```bash
cd musicflow_backend
npm install
npm start
```

### 2. App Flutter
```bash
cd musicflow_app
flutter pub get
flutter run
```

### 3. Web
```bash
cd musicflow_web
npm install
npm run dev
```

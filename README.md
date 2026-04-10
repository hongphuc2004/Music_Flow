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

## Run with Docker
### 1. Optional env setup
You can create a root `.env` file (next to `docker-compose.yml`) to override defaults:

```bash
MONGO_URI=mongodb://mongo:27017/musicflow
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 2. Start production profile
```bash
docker compose --profile prod up --build -d
```

### 3. Start development profile (hot-reload)
```bash
docker compose --profile dev up --build
```

Dev URLs:
- Web (Vite HMR): `http://localhost:5173`
- Backend API (nodemon): `http://localhost:5000`

### 4. Access services (production profile)
- Web app: `http://localhost:8080`
- Backend API: `http://localhost:5000`
- MongoDB: `mongodb://localhost:27017`

### 5. Stop services
```bash
docker compose down
```

If you run Flutter app on a physical device, keep API host as your machine LAN IP with port `5000`.

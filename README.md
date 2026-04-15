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

## Deploy 
- Frontend React: Vercel
- Backend Node.js: Render
- Database: MongoDB Atlas (M0 free)

### 1. Deploy Backend len Render
1. Tao Web Service moi tren Render, ket noi repository nay.
2. Root Directory: `musicflow_backend`
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Them Environment Variables:

```bash
PORT=5000
NODE_ENV=production
MONGO_URI=<mongodb-atlas-connection-string>
JWT_SECRET=<random-long-secret>
CORS_ORIGINS=https://<your-vercel-domain>
REFRESH_COOKIE_NAME=mf_refresh_token
CLOUDINARY_CLOUD_NAME=<cloudinary-cloud-name>
CLOUDINARY_API_KEY=<cloudinary-api-key>
CLOUDINARY_API_SECRET=<cloudinary-api-secret>
GOOGLE_CLIENT_ID=<google-oauth-web-client-id>
```

6. Sau khi deploy xong, luu lai URL backend, vi du:
`https://musicflow-backend.onrender.com`

### 2. Deploy Web len Vercel
1. Import project vao Vercel.
2. Root Directory: `musicflow_web`
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Them environment variable:

```bash
VITE_API_URL=https://musicflow-backend.onrender.com/api
VITE_GOOGLE_CLIENT_ID=<google-oauth-web-client-id>
```

### 3. Cap nhat CORS sau khi co domain Vercel
Tai Render, sua lai `CORS_ORIGINS` theo domain that cua Vercel:

```bash
CORS_ORIGINS=https://<your-project>.vercel.app
```

Neu can cho nhieu domain (preview + production):

```bash
CORS_ORIGINS=https://<prod-domain>.vercel.app,https://<preview-domain>.vercel.app
```

### 4. Test nhanh sau deploy
1. Dang ky / dang nhap web.
2. Goi cac API can auth (profile, playlist, favorites).
3. Dang xuat va dang nhap lai.


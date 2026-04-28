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
### Folder split: local vs production
When you keep two copies of this repo, use each folder for one environment:

- `musicflow/`: local development.
- `musicflow_prod/`: production build/run.

Docker Compose now lets Docker scope container and volume names by the folder/project name, so the two folders do not reuse the same `musicflow_*` containers. Host ports are configurable with a root `.env` file if you need both folders running on the same machine.

Recommended commands:

```bash
# In musicflow/
docker compose --profile dev up --build

# In musicflow_prod/
docker compose --profile prod up --build -d
```

Optional root `.env` overrides:

```bash
# Use these only when a port is already taken.
MUSICFLOW_MONGO_PORT=27018
MUSICFLOW_BACKEND_DEV_PORT=5002
MUSICFLOW_WEB_DEV_PORT=5174
MUSICFLOW_BACKEND_PROD_PORT=5000
MUSICFLOW_WEB_PROD_PORT=8080
```

For Flutter, choose backend per run/build:

```bash
flutter run --dart-define=API_BASE_URL=http://<your-lan-ip>:5001
flutter build apk --dart-define=API_BASE_URL=https://<your-prod-domain>
```

### 1. Backend env setup
Backend variables are loaded from environment-specific files:

- `musicflow_backend/.env.dev` for `--profile dev`
- `musicflow_backend/.env.prod` for `--profile prod`

Keep values like these in the matching file:

```bash
MONGO_URI=mongodb://mongo:27017/musicflow
JWT_SECRET=your_jwt_secret
NODE_ENV=development
CORS_ORIGINS=http://localhost:5173,http://localhost:8080
REFRESH_COOKIE_NAME=mf_refresh_token
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_FOLDER=musicflow
CLOUDINARY_DEFAULT_SONG_IMAGE_URL=https://res.cloudinary.com/<cloud-name>/image/upload/musicflow/images/<public-id>.jpg
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
GOOGLE_CLIENT_ID=your_google_oauth_web_client_id.apps.googleusercontent.com
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
- Backend API (nodemon): `http://localhost:5001`
- MongoDB: `mongodb://localhost:27017`

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
- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas (M0)

### 1. MongoDB Atlas 
1. Tạo cluster M0.
2. Tạo database user.
3. Network Access:
	- Với đồ án/demo: cho phép `0.0.0.0/0` để Render kết nối ổn định.
4. Lấy connection string dạng:

```bash
mongodb+srv://<user>:<password-encoded>@<cluster-host>/musicflow_db?retryWrites=true&w=majority&appName=Cluster0
```

Lưu ý: nếu password có `@` thì encode thành `%40`.

### 2. Backend trên Render
1. Tạo `Web Service` từ repo này.
2. `Runtime`: `Node`.
3. `Root Directory`: `musicflow_backend`.
4. `Build Command`: `npm install`.
5. `Start Command`: `npm start`.
6. Khai báo biến môi trường:

```bash
NODE_ENV=production
MONGO_URI=<atlas-connection-string>
JWT_SECRET=<random-long-secret>
CORS_ORIGINS=https://<vercel-prod-domain>,https:/<vercel-preview-domain>
REFRESH_COOKIE_NAME=mf_refresh_token
CLOUDINARY_CLOUD_NAME=<cloudinary-cloud-name>
CLOUDINARY_API_KEY=<cloudinary-api-key>
CLOUDINARY_API_SECRET=<cloudinary-api-secret>
GOOGLE_CLIENT_ID=<google-oauth-web-client-id>
```

7. Deploy và kiểm tra log có:
- `MongoDB connected`
- `Server running on port ...`

### 3. Frontend trên Vercel
1. Import project vào Vercel.
2. `Root Directory`: `musicflow_web`.
3. `Build Command`: `npm run build`.
4. `Output Directory`: `dist`.
5. Biến môi trường:

```bash
VITE_API_URL=https://<your-render-domain>.onrender.com/api
VITE_GOOGLE_CLIENT_ID=<google-oauth-web-client-id>
```

6. Deploy.

### 4. Google OAuth
Trong Google Cloud Console -> OAuth Client:
1. Thêm tất cả domain web đang dùng vào `Authorized JavaScript origins`.
2. Ví dụ:

```bash
https://<vercel-prod-domain>
https://<vercel-preview-domain>
http://localhost:5173
```

### 5. Cấu hình route SPA trên Vercel
Project đã có `musicflow_web/vercel.json` để rewrite route về `index.html`.
Nhờ đó các URL như `/accountlogin`, `/client/home` không bị 404.

### 6. Lỗi hay gặp
1. `origin_mismatch` (Google): thiếu domain trong JavaScript origins.
2. `Not allowed by CORS`: thiếu domain trong `CORS_ORIGINS` hoặc sai 1 ký tự.
3. `No Access-Control-Allow-Origin`: backend chưa redeploy sau khi đổi env.
4. `querySrv ENOTFOUND _mongodb._tcp...`: sai `MONGO_URI` (thường do password chưa encode).
5. `/accountlogin 404` trên Vercel: thiếu rewrite SPA (đã fix bằng `vercel.json`).

### 7. Checklist sau deploy
1. Đăng nhập email/password.
2. Đăng nhập Google.
3. Gọi API cần auth (profile, playlist, favorites).
4. Logout và login lại.

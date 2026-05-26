# Memory — MusicFlow

> Thông tin bổ sung không có trong rules/tech/ hay CLAUDE.md.

---

## Môi trường

| Môi trường | Backend port | Web port | MongoDB |
|-----------|-------------|---------|---------|
| Dev | 5001 | 5173 | localhost:27017 |
| Prod | 5000 | 8080 | MongoDB Atlas |

**Docker Compose:**
```bash
docker compose --profile dev up --build   # dev
docker compose --profile prod up --build -d  # prod
```

---

## Deploy

| Service | Platform | Config |
|---------|---------|--------|
| Backend | Render | Root: `musicflow_backend`, Start: `npm start` |
| Web | Vercel | Root: `musicflow_web`, Build: `npm run build`, Out: `dist` |
| Database | MongoDB Atlas | M0 cluster |

**Vercel env:**
```
VITE_API_URL=https://<render-domain>.onrender.com/api
VITE_GOOGLE_CLIENT_ID=<google-oauth-client-id>
```

**Render env:**
```
NODE_ENV=production
MONGO_URI=mongodb+srv://...
JWT_SECRET=...
CORS_ORIGINS=https://<vercel-domain>
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
GOOGLE_CLIENT_ID=...
GEMINI_API_KEY=...
```

---

## AI DJ — Gemini Integration

- Model: `gemini-2.5-flash` → fallback `gemini-2.0-flash` → `gemini-1.5-flash-latest`
- Mood map: sad, happy, chill, focus, energetic, romantic, sleep, party, angry
- Max playlist: 20 bài
- Logic: phân tích mood → match topic → rank song theo playCount/likeCount
- Lưu lịch sử: `MoodConversation`, `MoodMessage`, `MoodPlaylist`

---

## Lỗi thường gặp khi deploy

| Lỗi | Nguyên nhân | Fix |
|-----|------------|-----|
| `origin_mismatch` Google | Thiếu domain trong JS origins | Thêm vào Google Cloud Console |
| `Not allowed by CORS` | Thiếu domain trong `CORS_ORIGINS` | Thêm vào Render env |
| `/accountlogin 404` | SPA route chưa có rewrite | `musicflow_web/vercel.json` đã fix |
| `querySrv ENOTFOUND` | Sai `MONGO_URI` | Check password có `@` → encode thành `%40` |

---

## Cloudinary Folder Structure

```
musicflow/
├── songs/     ← audio files
├── images/    ← song thumbnails
└── avatars/   ← user/artist avatars
```

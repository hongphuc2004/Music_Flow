# API Reference — musicflow_backend

Base URL: `http://localhost:5001` (dev) | `https://music-flow-30us.onrender.com` (prod)

> **Auth header:** `Authorization: Bearer <accessToken>`

---

## Auth — `/api/auth`

Rate limit: 50 requests / 15 phút

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | `/register` | — | Đăng ký tài khoản mới (email + password) |
| POST | `/login` | — | Đăng nhập email/password → access + refresh token |
| POST | `/google` | — | Đăng nhập/đăng ký bằng Google OAuth |
| POST | `/refresh` | — | Lấy access token mới từ refresh token (cookie) |
| POST | `/logout` | — | Xóa refresh token khỏi DB |
| GET | `/profile` | ✓ | Lấy thông tin user đang đăng nhập |

**Request: `POST /register`**
```json
{ "name": "Nghi", "email": "nghi@example.com", "password": "123456" }
```

**Request: `POST /login`**
```json
{ "email": "nghi@example.com", "password": "123456" }
```

**Response mẫu:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGci...",
    "user": { "id": "...", "name": "Nghi", "email": "...", "role": "user" }
  }
}
```

---

## Songs — `/api/songs`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | `/` | — | Danh sách tất cả bài hát public (cache 30s) |
| GET | `/recommended` | — | 12 bài hát random |
| GET | `/search` | — | Tìm kiếm theo title/artist/topic/letter |
| GET | `/by-artist` | — | Bài hát theo nghệ sĩ (paginated) |
| GET | `/flowchart` | — | Dữ liệu trending theo giờ |
| GET | `/:id/lyrics` | — | Lấy lyrics LRC của bài |
| GET | `/:id/stream` | — | Stream audio (HTTP 206 Partial Content) |
| POST | `/:songId/download` | ✓ | Ghi nhận download, trả về URL |
| GET | `/my-uploads` | ✓ | Bài hát đã upload |
| GET | `/download-history` | ✓ | Lịch sử download |
| POST | `/download-history/sync` | ✓ | Đồng bộ danh sách download |
| POST | `/` | ✓ | Upload bài hát mới (multipart: audio, image) |
| PUT | `/:id` | ✓ | Cập nhật metadata/file |
| PATCH | `/:id/toggle-public` | ✓ | Đổi trạng thái public/private |
| DELETE | `/:id` | ✓ | Xóa bài hát (chỉ owner) |

**Query params `GET /search`:**
```
?q=tên_bài        → tìm title
?artist=tên       → tìm theo nghệ sĩ
?topicId=id       → lọc theo topic
?letter=A         → theo chữ cái đầu
?page=1&limit=20
```

---

## Playlists — `/api/playlists`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | `/system` | — | System playlists do admin tạo (max 12) |
| GET | `/system/:id` | — | Chi tiết 1 system playlist |
| GET | `/` | ✓ | Playlist của user đang đăng nhập |
| GET | `/:id` | ✓ | Chi tiết playlist (có access control) |
| POST | `/` | ✓ | Tạo playlist mới |
| PUT | `/:id` | ✓ | Cập nhật tên/mô tả/ảnh |
| DELETE | `/:id` | ✓ | Xóa playlist (chỉ owner) |
| POST | `/:id/songs` | ✓ | Thêm bài vào playlist |
| DELETE | `/:id/songs/:songId` | ✓ | Xóa bài khỏi playlist |
| PUT | `/:id/reorder` | ✓ | Sắp xếp lại thứ tự bài |

---

## Favorites — `/api/favorites`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | `/` | ✓ | Danh sách bài hát yêu thích |
| POST | `/add/:songId` | ✓ | Thêm vào yêu thích |
| DELETE | `/remove/:songId` | ✓ | Xóa khỏi yêu thích |
| POST | `/toggle/:songId` | ✓ | Toggle (add/remove tự động) |
| GET | `/check/:songId` | ✓ | Kiểm tra đã thích chưa |

---

## Song Likes — `/api/song-likes`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | `/status/:songId` | ✓ | Lấy số like + trạng thái đã like chưa |
| POST | `/toggle/:songId` | ✓ | Toggle like (tăng/giảm likeCount trên Song) |

---

## Comments — `/api/comments`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | `/song/:songId` | — | Lấy comment của bài (pagination, sort) |
| POST | `/` | ✓ | Tạo comment (có `parentCommentId` → reply) |
| PUT | `/:commentId` | ✓ | Sửa comment (chỉ author) |
| DELETE | `/:commentId` | ✓ | Xóa comment + replies (chỉ author) |
| PUT | `/:commentId/reactions` | ✓ | Thêm reaction (like) |
| DELETE | `/:commentId/reactions` | ✓ | Xóa reaction |

**Body `POST /`:**
```json
{
  "songId": "...",
  "content": "Bài hay quá!",
  "parentCommentId": null
}
```

---

## Topics — `/api/topics`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | `/` | — | Tất cả topics/genres |
| GET | `/:topicId/songs` | — | Bài hát theo topic |
| POST | `/` | — | Tạo topic mới |
| PUT | `/:id` | — | Cập nhật topic |
| DELETE | `/:id` | — | Xóa topic |

---

## Artist — `/api/artist`

Rate limit: 50 req/15min trên đăng nhập/đăng ký

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | `/register` | — | Đăng ký tài khoản artist |
| POST | `/login` | — | Đăng nhập artist |
| POST | `/google` | — | Google login cho artist |
| GET | `/me` | ✓ | Profile artist đang đăng nhập |
| GET | `/profile` | — | Profile public (query: `?id=` hoặc `?name=`) |
| PUT | `/profile` | ✓ | Cập nhật bio/avatar |
| GET | `/:id/follow-status` | ✓ | Đang follow nghệ sĩ này chưa |
| POST | `/:id/follow` | ✓ | Toggle follow/unfollow |

---

## AI DJ — `/api/ai`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | `/playlist` | ✓ | Tạo playlist theo mood (Gemini) |
| GET | `/mood/history` | ✓ | Lịch sử conversations + playlists |
| GET | `/mood/conversations/:id` | ✓ | Chi tiết 1 conversation |
| DELETE | `/mood/conversations/:id` | ✓ | Xóa conversation |

**Body `POST /playlist`:**
```json
{
  "prompt": "tôi đang buồn, cho tôi nghe nhạc chill",
  "conversationId": "optional_existing_id"
}
```

**Response `POST /playlist`:**
```json
{
  "success": true,
  "data": {
    "conversationId": "...",
    "messages": [
      { "role": "user", "content": "tôi đang buồn..." },
      { "role": "assistant", "content": "Tôi hiểu bạn...", "playlistId": "..." }
    ],
    "playlist": {
      "id": "...",
      "title": "Chill Vibes",
      "matchStatus": "matched",
      "songs": [ ... ]
    }
  }
}
```

---

## Admin — `/api/admin`

Tất cả routes yêu cầu auth + role `admin`.

| Group | Endpoints |
|-------|-----------|
| Auth | `POST /auth/login` |
| Dashboard | `GET /stats/dashboard` |
| Users | `GET/DELETE /users`, `GET/DELETE /users/:id`, `PATCH /users/:id/role` |
| Accounts | `GET/POST /accounts`, `PUT/DELETE /accounts/:id` |
| Songs | `GET/POST /songs`, `GET/PUT/DELETE /songs/:id`, `PATCH /songs/:id/visibility` |
| Playlists | `GET/POST /playlists`, `GET/PUT/DELETE /playlists/:id` |
| Topics | `GET/POST /topics`, `PUT/DELETE /topics/:id`, `GET /topics/:id/songs` |

---

## Upload — `/api/upload`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | `/audio` | — | Upload audio file thô → URL Cloudinary |

---

## Users — `/api/users`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | `/me` | ✓ | Thông tin user hiện tại |
| PUT | `/update` | ✓ | Cập nhật name/avatar |

---

## Response format chuẩn

```json
// Thành công
{ "success": true, "data": { ... } }
{ "success": true, "data": [...], "total": 100, "page": 1, "limit": 20 }
{ "success": true, "message": "Deleted successfully" }

// Lỗi
{ "success": false, "message": "Not found" }             // 404
{ "success": false, "message": "No token provided" }     // 401
{ "success": false, "message": error.message }           // 500
```

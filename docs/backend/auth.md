# Authentication Flow — Backend

## Tổng quan

Backend dùng 2 cơ chế xác thực song song:
1. **Email/Password** — bcryptjs hash + JWT
2. **Google OAuth** — `google-auth-library` verify token từ client

---

## JWT Token Structure

```
Access Token:   2 giờ   → gửi trong Authorization header
Refresh Token:  30 ngày → lưu trong httpOnly cookie
```

**JWT payload:**
```json
{
  "id": "<userId>",
  "role": "user | artist | admin"
}
```

**Refresh token storage:**
- Client gửi refresh token trong cookie tên `mf_refresh_token`
- Backend lưu `SHA256(token)` vào collection `RefreshToken`
- Khi refresh: tìm hash trong DB, kiểm tra `expiresAt`, tạo access token mới

---

## Luồng đăng nhập Email/Password

```
POST /api/auth/login
  { email, password }
       │
       ▼
User.findOne({ email })  ← MongoDB
       │
       ▼
bcrypt.compare(password, user.password)
       │
    OK │
       ▼
jwt.sign({ id, role }, JWT_SECRET, { expiresIn: "2h" })
       │
       ▼
Tạo refreshToken → SHA256 → lưu RefreshToken collection
       │
       ▼
Response: { accessToken } + Set-Cookie: mf_refresh_token
```

---

## Luồng đăng nhập Google

```
Client (Flutter/Web)
  └─ Google Sign-In SDK → idToken (hoặc accessToken)
       │
       ▼
POST /api/auth/google  { token }
       │
       ▼
googleAuth.verifyGoogleToken(token)
  ├─ Thử verifyIdToken (google-auth-library OAuth2Client)
  └─ Fallback: GET https://www.googleapis.com/oauth2/v3/userinfo
       │
       ▼
Kiểm tra email đã tồn tại chưa?
  ├─ Có → update googleId nếu chưa có
  └─ Không → tạo User mới (provider: "google", no password)
       │
       ▼
Tạo JWT + RefreshToken → response giống email login
```

---

## Auth Middleware

```js
// src/middleware/auth.middleware.js

exports.verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) → 401 "No token provided"

  jwt.verify(token, JWT_SECRET)
    .decoded → req.userId, req.userRole
    .error   → 401 "Invalid or expired token"
};

exports.verifyAdmin = (req, res, next) => {
  if (req.userRole !== "admin") → 403 "Admin only"
};
```

**Note:** `req.userId` được extract từ `decoded.userId || decoded.id || decoded._id` để tương thích với cả token cũ và mới.

---

## Token Refresh Flow

```
POST /api/auth/refresh
  Cookie: mf_refresh_token=<token>
       │
       ▼
SHA256(token) → tìm trong RefreshToken collection
       │
  Tìm thấy + chưa hết hạn
       │
       ▼
jwt.sign({ id: token.userId }) → accessToken mới
       │
       ▼
Response: { accessToken }
```

---

## Logout

```
POST /api/auth/logout
  Cookie: mf_refresh_token=<token>
       │
       ▼
SHA256(token) → xóa document trong RefreshToken collection
       │
       ▼
Clear cookie mf_refresh_token
Response: { success: true }
```

---

## Cookie config

```js
// Production
{
  httpOnly: true,
  secure: true,          // HTTPS only
  sameSite: "none",      // cross-site (app → API)
  maxAge: 30 * 24 * 60 * 60 * 1000  // 30 ngày
}

// Development
{
  httpOnly: true,
  secure: false,
  sameSite: "lax"
}
```

---

## Artist Auth

Artist có flow riêng tại `/api/artist/register` và `/api/artist/login`, dùng cùng cơ chế JWT nhưng:
- Role luôn là `"artist"`
- Model là `Artist` thay vì `User`
- Có hỗ trợ Google Sign-In riêng cho artist portal

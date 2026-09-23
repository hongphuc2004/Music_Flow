# API Reference — musicflow_backend

Base URL: `http://localhost:5001` (dev) | `https://music-flow-30us.onrender.com` (prod)

> **Auth header:** `Authorization: Bearer <accessToken>`

---

## Mục lục

1. [Auth — `/api/auth`](#1-auth--apiauth)
2. [Songs — `/api/songs`](#2-songs--apisongs)
3. [Playlists — `/api/playlists`](#3-playlists--apiplaylists)
4. [Favorites — `/api/favorites`](#4-favorites--apifavorites)
5. [Song Likes — `/api/song-likes`](#5-song-likes--apisong-likes)
6. [Comments — `/api/comments`](#6-comments--apicomments)
7. [Topics — `/api/topics`](#7-topics--apitopics)
8. [Artist Portal — `/api/artist`](#8-artist-portal--apiartist)
9. [AI DJ — `/api/ai`](#9-ai-dj--apiai)
10. [Global AI Assistant — `/api/ai/assistant`](#10-global-ai-assistant--apiaiassistant)
11. [Plans — `/api/plans`](#11-plans--apiplans)
12. [Subscriptions & Checkout — `/api/subscriptions`](#12-subscriptions--checkout--apisubscriptions)
13. [Admin Premium Management — `/api/admin/premium`](#13-admin-premium-management--apiadminpremium)
14. [Notifications — `/api/notifications`](#14-notifications--apinotifications)
15. [Users — `/api/users`](#15-users--apiusers)
16. [Admin — `/api/admin`](#16-admin--apiadmin)
17. [Upload CDN — `/api/upload`](#17-upload-cdn--apiupload)
18. [OpenGraph Social Share Crawler — `/share/*`](#18-opengraph-social-share-crawler--share)

---

## 1. Auth — `/api/auth`

Rate limit: 50 requests / 15 phút.

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | `/register` | — | Đăng ký tài khoản (name, email, password) |
| POST | `/login` | — | Đăng nhập email/password → access + refresh token |
| POST | `/google` | — | Đăng nhập/đăng ký bằng Google OAuth ID token |
| POST | `/refresh` | — | Cấp access token mới từ `mf_refresh_token` cookie |
| POST | `/logout` | — | Hủy refresh token trong DB và xóa cookie |
| GET | `/profile` | ✓ | Lấy thông tin user đăng nhập hiện tại |

---

## 2. Songs — `/api/songs`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | `/` | — | Danh sách bài hát public (hỗ trợ phân trang, cache) |
| GET | `/recommended` | — | Danh sách bài hát đề xuất ngẫu nhiên |
| GET | `/search` | — | Tìm kiếm đa năng theo title, artist, topic, letter |
| GET | `/by-artist` | — | Lấy bài hát theo tên nghệ sĩ |
| GET | `/by-slug/:artistSlug/:songSlug` | — | Lấy chi tiết bài hát theo đường dẫn slug thân thiện |
| GET | `/:id` | — | Chi tiết bài hát theo ID |
| GET | `/flowchart` | — | Dữ liệu bảng xếp hạng nghe theo giờ thời gian thực |
| GET | `/rankings` | — | Bảng xếp hạng tuần/tháng/top lượt nghe |
| GET | `/:id/lyrics` | — | Lấy lời bài hát đã publish (Plain hoặc Synced LRC) |
| GET | `/:id/similar` | — | Song Radio: Gợi ý các bài hát tương đồng thể loại/mood |
| GET | `/:id/ticket` | Tuỳ chọn | Cấp vé nghe nhạc (Lossless HQ 320kbps cho Premium, 128kbps cho free) |
| GET | `/:id/stream` | — | Stream audio trực tiếp (hỗ trợ 206 Partial Content) |
| POST | `/:id/play` | — | Ghi nhận 1 lượt nghe hợp lệ (Qualified play, cooldown 30s per IP) |
| PATCH | `/:id/play-events/:eventId` | — | Cập nhật feedback thời lượng nghe (Stage 2 Lifecycle) |
| POST | `/:id/share-event` | — | Ghi nhận tương tác chia sẻ mạng xã hội |
| POST | `/:songId/download` | ✓ | Ghi nhận lượt tải về và cấp link download an toàn |
| GET | `/my-uploads` | ✓ | Danh sách bài hát do chính user upload |
| GET | `/download-history` | ✓ | Lịch sử các bài hát đã tải về máy |
| DELETE | `/download-history/:songId` | ✓ | Xóa bài hát khỏi lịch sử download |
| POST | `/download-history/sync` | ✓ | Đồng bộ danh sách bài hát tải ngoại tuyến từ thiết bị |
| POST | `/` | ✓ | Upload bài hát mới (multipart: `audio`, `image`) |
| PUT | `/:id` | ✓ | Cập nhật thông tin/file bài hát (chỉ chủ sở hữu/artist) |
| POST | `/suggest-tags` | ✓ | AI gợi ý thể loại, tâm trạng, chủ đề trước khi đăng |
| POST | `/:id/auto-tag` | ✓ | Kích hoạt AI phân tích & tự động gắn tag cho bài hát |
| PATCH | `/:id/toggle-public` | ✓ | Đổi trạng thái hiển thị công khai/riêng tư |
| DELETE | `/:id` | ✓ | Xóa bài hát (chỉ chủ sở hữu hoặc admin) |

---

## 3. Playlists — `/api/playlists`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | `/system` | — | Danh sách playlist tuyển chọn do Admin biên tập |
| GET | `/system/:id` | — | Chi tiết 1 system playlist |
| GET | `/` | ✓ | Danh sách playlist của người dùng hiện tại |
| GET | `/:id` | ✓ | Chi tiết playlist cá nhân |
| POST | `/` | ✓ | Tạo playlist mới |
| PUT | `/:id` | ✓ | Cập nhật tên, mô tả, ảnh bìa playlist |
| DELETE | `/:id` | ✓ | Xóa playlist |
| POST | `/:id/songs` | ✓ | Thêm bài hát vào playlist (`{ songId }`) |
| DELETE | `/:id/songs/:songId` | ✓ | Xóa bài hát khỏi playlist |
| PUT | `/:id/reorder` | ✓ | Sắp xếp lại thứ tự bài hát trong playlist |

---

## 4. Favorites — `/api/favorites`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | `/` | ✓ | Lấy danh sách bài hát yêu thích |
| POST | `/add/:songId` | ✓ | Thêm bài hát vào danh sách yêu thích |
| DELETE | `/remove/:songId` | ✓ | Bỏ yêu thích bài hát |
| POST | `/toggle/:songId` | ✓ | Chuyển đổi trạng thái yêu thích tự động |
| GET | `/check/:songId` | ✓ | Kiểm tra bài hát đã nằm trong yêu thích chưa |

---

## 5. Song Likes — `/api/song-likes`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | `/status/:songId` | ✓ | Lấy tổng số like & trạng thái đã like của người dùng |
| POST | `/toggle/:songId` | ✓ | Toggle Like (tăng/giảm likeCount bài hát) |

---

## 6. Comments — `/api/comments`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | `/song/:songId` | — | Danh sách bình luận bài hát (hỗ trợ phân trang, nested replies) |
| POST | `/` | ✓ | Đăng bình luận mới (`{ songId, content, parentCommentId }`) |
| PUT | `/:commentId` | ✓ | Chỉnh sửa nội dung bình luận |
| DELETE | `/:commentId` | ✓ | Xóa bình luận và các replies đi kèm |
| PUT | `/:commentId/reactions` | ✓ | Thả tim bình luận |
| DELETE | `/:commentId/reactions` | ✓ | Hủy thả tim bình luận |

---

## 7. Topics — `/api/topics`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | `/` | — | Lấy toàn bộ danh sách thể loại / chủ đề |
| GET | `/:topicId/songs` | — | Danh sách bài hát thuộc topic |
| POST | `/` | ✓ | Thêm chủ đề mới (admin) |
| PUT | `/:id` | ✓ | Cập nhật chủ đề |
| DELETE | `/:id` | ✓ | Xóa chủ đề |

---

## 8. Artist Portal — `/api/artist`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | `/register` | — | Đăng ký tài khoản nghệ sĩ |
| POST | `/login` | — | Đăng nhập cổng nghệ sĩ |
| POST | `/google` | — | Đăng nhập nghệ sĩ bằng Google |
| GET | `/me` | ✓ | Thông tin nghệ sĩ đang đăng nhập |
| GET | `/profile` | — | Xem trang cá nhân nghệ sĩ (query: `?id=` hoặc `?name=`) |
| PUT | `/profile` | ✓ | Cập nhật thông tin tiểu sử, ảnh đại diện |
| GET | `/:id/follow-status` | ✓ | Kiểm tra user hiện tại đã follow nghệ sĩ chưa |
| POST | `/:id/follow` | ✓ | Theo dõi / Hủy theo dõi nghệ sĩ |
| POST | `/follow-statuses` | ✓ | Kiểm tra hàng loạt trạng thái follow |
| GET | `/analytics/summary` | ✓ | Báo cáo tổng quan (lượt nghe, người nghe hàng tháng, bài hát hàng đầu) |
| GET | `/analytics/timeseries` | ✓ | Biểu đồ chuỗi thời gian lượt stream theo ngày/tuần |
| GET | `/analytics/top-songs` | ✓ | Top bài hát có lượng stream cao nhất |
| GET | `/analytics/discovery-sources`| ✓ | Nguồn tiếp cận người nghe (tìm kiếm, radio, playlist) |
| GET | `/songs/:id/lyrics` | ✓ | Lấy dữ liệu lời bài hát (cả bản draft & published) |
| PUT | `/songs/:id/lyrics/draft` | ✓ | Lưu bản thảo lời bài hát |
| POST | `/songs/:id/lyrics/publish` | ✓ | Xuất bản lời bài hát ra client |
| POST | `/songs/:id/lyrics/unpublish` | ✓ | Gỡ xuất bản lời bài hát |
| POST | `/songs/:id/lyrics/alignment` | ✓ | Yêu cầu AI Aligner tự động khớp nhịp karaoke |
| POST | `/songs/:id/lyrics/alignment/cancel` | ✓ | Hủy tiến trình AI căn nhịp |
| GET | `/songs/:id/lyrics/alignment/status` | ✓ | Kiểm tra tiến độ job căn nhịp |

---

## 9. AI DJ — `/api/ai`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | `/playlist` | ✓ | Tạo playlist theo tâm trạng prompt bằng Gemini |
| GET | `/mood/history` | ✓ | Lịch sử các phiên tạo playlist tâm trạng |
| GET | `/mood/conversations/:id` | ✓ | Chi tiết cuộc trò chuyện và danh sách bài hát sinh ra |
| DELETE | `/mood/conversations/:id` | ✓ | Xóa phiên tạo playlist theo tâm trạng |

---

## 10. Global AI Assistant — `/api/ai/assistant`

Hệ thống Trợ lý thông minh toàn năng đa phiên chat, kiểm soát hạn mức quota và xác nhận hành động tự động.

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | `/messages` | ✓ | Gửi tin nhắn tới trợ lý AI (`{ message, conversationId, role }`) |
| GET | `/quota` | ✓ | Xem hạn mức sử dụng AI trong ngày của tài khoản |
| GET | `/conversations` | ✓ | Danh sách các đoạn hội thoại trợ lý |
| GET | `/conversations/:id` | ✓ | Lịch sử chi tiết tin nhắn của một đoạn hội thoại |
| DELETE | `/conversations/:id` | ✓ | Xóa đoạn hội thoại trợ lý |
| POST | `/actions/:actionId/confirm` | ✓ | Xác nhận thực thi hành động do AI đề xuất (tạo playlist, thêm bài...) |

---

## 11. Plans — `/api/plans`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | `/` | — | Lấy danh sách các gói cước Premium đang kích hoạt (Gói GO, PLUS, PREMIUM) |

---

## 12. Subscriptions & Checkout — `/api/subscriptions`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | `/checkout` | ✓ | Khởi tạo giao dịch thanh toán (`{ planId, paymentMethod: "mock" | "vnpay" }`) |
| POST | `/mock-confirm` | ✓ | Xác nhận thanh toán thành công trong môi trường Sandbox |
| GET | `/vnpay-return` | — | Endpoint callback người dùng quay lại từ cổng VNPay |
| GET | `/vnpay-ipn` | — | Webhook IPN xử lý ngầm trạng thái giao dịch từ VNPay |
| GET | `/transactions/:ref/status` | ✓ | Kiểm tra kết quả xử lý của một mã giao dịch |
| GET | `/current` | ✓ | Thông tin gói Premium hiện tại của người dùng |

---

## 13. Admin Premium Management — `/api/admin/premium`

Tất cả các route yêu cầu xác thực Admin.

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | `/stats` | Admin | Báo cáo doanh thu, tổng số đăng ký active, tỷ lệ chuyển đổi |
| GET | `/plans` | Admin | Danh sách tất cả các gói cước |
| POST | `/plans` | Admin | Tạo gói cước mới (`{ name, price, durationInDays, description }`) |
| PUT | `/plans/:id` | Admin | Chỉnh sửa thông tin / ẩn hiện gói cước |
| DELETE | `/plans/:id` | Admin | Xóa gói cước |
| GET | `/transactions` | Admin | Danh sách toàn bộ lịch sử giao dịch thanh toán |
| GET | `/subscriptions` | Admin | Danh sách toàn bộ thuê bao người dùng |

---

## 14. Notifications — `/api/notifications`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | `/` | ✓ | Lấy danh sách thông báo của người dùng (phân trang, sắp xếp mới nhất) |
| PUT | `/:id/read` | ✓ | Đánh dấu 1 thông báo là đã đọc |
| PUT | `/read-all` | ✓ | Đánh dấu toàn bộ thông báo là đã đọc |

---

## 15. Users — `/api/users`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | `/me` | ✓ | Lấy thông tin cá nhân & gói Premium (tự động cập nhật nếu hết hạn) |
| PUT | `/update` | ✓ | Cập nhật họ tên, email, ảnh đại diện avatar |

---

## 16. Admin — `/api/admin`

| Nhóm chức năng | Endpoints |
|----------------|-----------|
| Xác thực | `POST /auth/login` |
| Thống kê | `GET /stats/dashboard` |
| Người dùng | `GET /users`, `GET /users/:id`, `PATCH /users/:id/role`, `DELETE /users/:id` |
| Quản lý tài khoản | `GET /accounts`, `POST /accounts`, `PUT /accounts/:id`, `DELETE /accounts/:id` |
| Bài hát | `GET /songs`, `POST /songs`, `GET /songs/:id`, `PUT /songs/:id`, `DELETE /songs/:id`, `PATCH /songs/:id/visibility` |
| Danh sách phát | `GET /playlists`, `POST /playlists`, `GET /playlists/:id`, `PUT /playlists/:id`, `DELETE /playlists/:id` |
| Thể loại | `GET /topics`, `POST /topics`, `PUT /topics/:id`, `DELETE /topics/:id` |

---

## 17. Upload CDN — `/api/upload`

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| POST | `/audio` | — | Upload file âm thanh thô lên Cloudinary CDN (`video` resource type) |

---

## 18. OpenGraph Social Share Crawler — `/share/*`

Phục vụ hiển thị Preview Card giàu nội dung khi chia sẻ link lên Facebook, Zalo, Twitter/X, Telegram.

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|-------|
| GET | `/share/:artistSlug/:songSlug` | — | Render thẻ OpenGraph meta HTML theo slug nghệ sĩ và bài hát |
| GET | `/share/songs/:id` | — | Render thẻ OpenGraph meta HTML theo ID bài hát (Backward compatibility) |

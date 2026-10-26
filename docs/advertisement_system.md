# 📢 MusicFlow Advertisement System (Hệ Thống Quảng Cáo Đa Nền Tảng)

> Hệ thống phân phối quảng cáo âm thanh (Audio Ads xen kẽ) và biểu ngữ (Banner Ads hiển thị) đa nền tảng (**Web**, **Flutter Mobile**, **Node.js Backend**, **Admin Portal**), thiết kế theo mô hình Freemium tiêu chuẩn của **Zing MP3** và **Spotify**.

---

## 🎯 1. Mục Tiêu & Triết Lý Thiết Kế

1. **Backend là Nguồn Chân Lý Duy Nhất (Single Source of Truth)**:
   * Client (Web hay App) **không tự ý quyết định** khi nào phát quảng cáo hay loại quảng cáo nào được phát.
   * Client chỉ ghi nhận số bài hát đã nghe (`songsPlayedCount`) và gửi lên Backend. Backend giải mã JWT token, xác định gói tài khoản người dùng (`User Tier`), kiểm tra ngưỡng nghe và trả về quyết định `hasAd: true/false` cùng dữ liệu quảng cáo tương ứng.
2. **Quyền Lợi Theo Gói Tài Khoản Chuẩn Freemium**:
   * **Gói FREE (Basic)**: 
     * Cứ sau **5 bài hát** → phát **1 Audio Ad** (bắt buộc nghe hết, không được phép bỏ qua).
     * Hiển thị **Banner Ads** tại trang Home và Discover.
   * **Gói PLUS (20.000đ/tháng) & PREMIUM (50.000đ/tháng)**:
     * **Miễn 100% quảng cáo** (cả Audio Ad xen kẽ lẫn Banner Ads).
3. **Trải Nghiệm Nghe Nhạc Liền Mạch & Fallback An Toàn 100%**:
   * Khi gặp bất kỳ sự cố nào (mất mạng, server timeout, file audio Cloudinary bị lỗi 404, token hết hạn), hệ thống **tự động fallback ngay lập tức** tiếp tục phát bài hát tiếp theo. Quảng cáo không bao giờ được phép chặn luồng nghe nhạc của người dùng.
4. **Quản Trị Chiến Dịch Thời Gian Thực (Admin Portal)**:
   * Quản trị viên quản lý, bật/tắt, tải file mp3/ảnh và theo dõi số liệu tracking thực tế (Lượt hiển thị Impression, Lượt Click, Tỷ lệ CTR).

---

## 🏗️ 2. Kiến Trúc & Luồng Dữ Liệu (Architecture & Flow)

```
[Flutter Mobile App]                [React 19 Web App]
        │                                   │
        ├─── 1. Báo cáo songsPlayedCount ───┤
        │    (Preload ở 85% bài hát)        │ (Kiểm tra khi hết bài)
        ▼                                   ▼
┌─────────────────────────────────────────────────────────┐
│               Node.js Backend (/api/ads)                │
│                                                         │
│  1. Trích xuất Authorization: Bearer <token>            │
│  2. Xác định Tier: User.findById() → getUserTier()      │
│  3. Kiểm tra quyền miễn trừ: tier in ['plus', 'premium']│
│  4. Kiểm tra ngưỡng: tier == 'go' (8) / basic (5)       │
│  5. Truy vấn chiến dịch: Advertisement.find({isActive}) │
│  6. Trả về quyết định { hasAd, ad, canSkip, tier }      │
└─────────────────────────────────────────────────────────┘
        │                                   │
        ├─── 2. Nhận Ad payload & phát ─────┤
        │    (Audio Interruption Player)    │ (Tạm dừng audio chính, phát Ad)
        │                                   │
        ├─── 3. POST /api/ads/:id/impression (Ghi nhận lượt nghe/xem)
        └─── 4. POST /api/ads/:id/click      (Ghi nhận khi user bấm CTA)
```

---

## 📻 3. Hai Loại Hình Quảng Cáo (Ad Formats)

### 3.1. Audio Ad Interruption (Quảng Cáo Âm Thanh Xen Kẽ)
* **Thời điểm kích hoạt**:
  * **Trên Web**: Khi bài hát hiện tại phát xong (`handleEnded`), `ClientPlayerProvider` kiểm tra ngưỡng nghe. Nếu backend yêu cầu phát ad, bài hát tiếp theo sẽ được đưa vào hàng đợi chờ (`nextPendingSongRef`), audio chính tạm dừng, audio ad phát trên thẻ `<audio ref={adAudioRef}>` riêng biệt, kèm thanh đếm ngược toàn màn hình `ClientAdInterruptionOverlay`. Khi ad kết thúc hoặc user bấm bỏ qua, bài tiếp theo tự động phát.
  * **Trên Mobile (Flutter)**: Khi tiến độ bài hát đạt **85%**, `AdManager` tự động **preload trước** file audio của quảng cáo vào buffer của `_adPlayer` độc lập. Khi bài hát kết thúc hoặc user nhấn Next khi đủ 5 bài, Ad Interruption kích hoạt ngay lập tức mà không có độ trễ mạng (Zero Latency).
* **Đặc tính kỹ thuật**:
  * Đếm ngược thời gian (`duration` giây).
  * Quyền bỏ qua (`canSkip` và `skipAfterSeconds`).
  * Tự động hoàn tất và dọn dẹp bộ đếm sau khi ad phát xong.

### 3.2. Banner Ad (Thẻ Quảng Cáo Hiển Thị)
* **Vị trí hiển thị**: Xuất hiện xen kẽ giữa các khối nội dung trên màn hình Home và Discover ([ClientAdBannerCard.jsx](file:///d:/environment/Music_Flow/musicflow_web/src/components/common/ClientAdBannerCard.jsx) trên Web, [ad_banner_widget.dart](file:///d:/environment/Music_Flow/musicflow_app/lib/presentation/widgets/ad_banner_widget.dart) trên Mobile).
* **Đặc tính kỹ thuật**:
  * Chỉ tải và hiển thị đối với tài khoản `basic` (Free).
  * Backend lọc `applicableTiers: "basic"` và `isActive: true`.
  * **Chống trùng lặp Tracking Impression**: Dùng `useRef(new Set())` để đảm bảo mỗi banner ID chỉ gửi 1 request `POST /api/ads/:id/impression` dù component có re-render nhiều lần.
  * **Xử lý Click**: Gửi `POST /api/ads/:id/click`, hỗ trợ cả link chuyển hướng nội bộ (`/client/premium`) và link trang ngoài (`https://...`).
  * **Fallback mượt mà**: Nếu chưa có chiến dịch banner nào được Admin cấu hình, hệ thống tự động hiển thị House Ad mặc định giới thiệu nâng cấp Gói PLUS.

---

## 📊 4. Database Model (`Advertisement`)

Tệp schema: `musicflow_backend/src/models/ad.model.js`

| Thuộc tính | Kiểu dữ liệu | Mặc định | Ý nghĩa |
| :--- | :--- | :--- | :--- |
| `title` | `String` (required) | — | Tiêu đề chiến dịch quảng cáo |
| `description` | `String` | `""` | Thông điệp / mô tả chi tiết chiến dịch |
| `type` | `String` (enum) | `"audio"` | Phân loại: `"audio"` (âm thanh) hoặc `"banner"` (hiển thị) |
| `audioUrl` | `String` | `""` | Đường dẫn file MP3/WAV của quảng cáo (Cloudinary CDN) |
| `imageUrl` | `String` | `""` | Ảnh bìa/banner của chiến dịch |
| `targetUrl` | `String` | `""` | Đường dẫn khi người dùng bấm CTA (VD: `/client/premium` hoặc link ngoài) |
| `duration` | `Number` | `15` | Thời lượng ước tính của quảng cáo âm thanh (giây) |
| `canSkip` | `Boolean` | `false` | Có cho phép bỏ qua quảng cáo hay không |
| `skipAfterSeconds` | `Number` | `5` | Số giây phải nghe trước khi nút Bỏ qua xuất hiện |
| `applicableTiers` | `[String]` | `["basic", "go"]` | Danh sách gói áp dụng: `["basic", "go", "plus", "premium"]` |
| `isActive` | `Boolean` | `true` | Trạng thái kích hoạt (Admin có thể bật/tắt nhanh) |
| `priority` | `Number` | `1` | Thứ tự ưu tiên (số càng cao càng ưu tiên xuất hiện trước) |
| `impressionCount` | `Number` | `0` | Tổng số lượt hiển thị / nghe quảng cáo thực tế |
| `clickCount` | `Number` | `0` | Tổng số lượt người dùng click vào quảng cáo |
| `timestamps` | `Boolean` | `true` | Tự động tạo `createdAt` và `updatedAt` |

---

## 🔌 5. Chi Tiết API Endpoints

### 5.1. Dành Cho Khách Hàng (Client APIs) — `/api/ads/*`

#### 1. Kiểm tra phát quảng cáo âm thanh tiếp theo
* **Route**: `POST /api/ads/check-next`
* **Headers**: `Authorization: Bearer <accessToken>` (tùy chọn; không có token mặc định là `basic`)
* **Body**:
  ```json
  { "songsPlayedCount": 5 }
  ```
* **Response (Có Ad)**:
  ```json
  {
    "success": true,
    "hasAd": true,
    "tier": "basic",
    "songsPlayedCount": 5,
    "threshold": 5,
    "ad": {
      "id": "67...abc",
      "title": "Đừng để âm nhạc bị ngắt quãng!",
      "description": "Nâng cấp Gói PLUS chỉ 20.000đ/tháng...",
      "type": "audio",
      "audioUrl": "https://res.cloudinary.com/.../audio.mp3",
      "imageUrl": "https://res.cloudinary.com/.../thumb.jpg",
      "targetUrl": "/client/premium",
      "duration": 12,
      "canSkip": false,
      "skipAfterSeconds": 5
    }
  }
  ```
* **Response (Miễn Ad)**:
  ```json
  {
    "success": true,
    "hasAd": false,
    "tier": "plus",
    "reason": "ad_free_tier"
  }
  ```

#### 2. Lấy danh sách Banner quảng cáo
* **Route**: `GET /api/ads/banners`
* **Headers**: `Authorization: Bearer <accessToken>` (tùy chọn)
* **Response**: Trả về danh sách banner đang hoạt động dành cho tài khoản `basic`. (Tài khoản trả phí trả về `data: []`).

#### 3. Ghi nhận Impression
* **Route**: `POST /api/ads/:id/impression`
* **Response**: `{ "success": true }` (tự động tăng `impressionCount` thêm 1).

#### 4. Ghi nhận Click
* **Route**: `POST /api/ads/:id/click`
* **Response**: `{ "success": true }` (tự động tăng `clickCount` thêm 1).

---

### 5.2. Dành Cho Quản Trị Viên (Admin APIs) — `/api/admin/ads/*`

> **Yêu cầu bảo mật:** Bắt buộc có JWT Token và tài khoản mang quyền `admin` (`authMiddleware` + `requireAdmin`).

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/api/admin/ads/stats/overview` | Lấy số liệu tracking thực tế: Tổng chiến dịch, Active, Impressions, Clicks, CTR (%). |
| `GET` | `/api/admin/ads` | Danh sách chiến dịch có phân trang (`page`, `limit`), tìm kiếm (`search`), lọc loại (`type`), lọc trạng thái (`status`). |
| `GET` | `/api/admin/ads/:id` | Lấy chi tiết một chiến dịch quảng cáo. |
| `POST` | `/api/admin/ads` | Tạo chiến dịch mới (hỗ trợ nhập link Cloudinary hoặc tải trực tiếp). |
| `PUT` | `/api/admin/ads/:id` | Sửa cấu hình chiến dịch (bảo toàn nguyên vẹn số liệu thống kê cũ). |
| `PATCH`| `/api/admin/ads/:id/toggle` | Bật / tắt nhanh trạng thái hoạt động (`isActive`). |
| `DELETE`| `/api/admin/ads/:id` | Xóa chiến dịch quảng cáo khỏi cơ sở dữ liệu. |

---

## 💻 6. Danh Sách Tệp Triển Khai Trong Mã Nguồn

```
Music_Flow/
├── musicflow_backend/
│   ├── src/models/ad.model.js                  ← Mongoose schema Advertisement
│   ├── src/controllers/ad.controller.js        ← Client Ads logic (check-next, banners, impression, click)
│   ├── src/controllers/admin-ad.controller.js  ← Admin CRUD & Real Tracking metrics
│   ├── src/routes/ad.route.js                  ← Router /api/ads
│   ├── src/routes/admin-ad.route.js            ← Router /api/admin/ads
│   └── src/routes/upload.route.js              ← Upload CDN /api/upload/audio & /api/upload/image
│
├── musicflow_web/
│   ├── src/services/admin/admin.service.js     ← adminAdsApi (Axios wrapper)
│   ├── src/services/client/client.service.js   ← clientAdsApi (Axios wrapper)
│   ├── src/pages/admin/Advertisements.jsx      ← Trang Quản Trị Chiến Dịch Quảng Cáo
│   ├── src/components/common/ClientAdBannerCard.jsx ← Thẻ Banner động kèm tracking impression/click
│   └── src/components/Layout/client/
│       ├── ClientPlayerProvider.jsx            ← Bộ điều khiển Audio Ad Interruption & Thẻ <audio> riêng
│       └── ClientAdInterruptionOverlay.jsx     ← Giao diện Overlay đếm ngược phát ad
│
└── musicflow_app/ (Flutter)
    ├── lib/core/audio/ad_manager.dart          ← Quản lý vòng đời Ad: Preload 85%, Interruption, Skip, Countdown
    ├── lib/core/audio/ad_playback_state.dart   ← Immutable state AdStatus (idle, preloading, ready, playing...)
    ├── lib/core/audio/global_audio_state.dart  ← Tích hợp ngưỡng phát ad vào chu kỳ đổi bài hát
    ├── lib/data/services/ad_service.dart       ← API Client gọi /api/ads/* qua http package
    ├── lib/presentation/widgets/
    │   ├── ad_banner_widget.dart               ← Widget hiển thị Banner động trên mobile
    │   └── ad_interruption_overlay.dart        ← Overlay toàn màn hình phát Audio Ad trên mobile
```

---

## 🛠️ 7. Hướng Dẫn Vận Hành Cho Quản Trị Viên (Admin Guide)

1. Đăng nhập vào trang quản trị: `http://localhost:5173/admin/dashboard` bằng tài khoản Admin.
2. Trên thanh menu bên trái, chọn mục **"Quảng Cáo"** (`/admin/advertisements`).
3. **Theo dõi hiệu quả chiến dịch**:
   * Xem 4 thẻ số liệu trên cùng: Số chiến dịch đang chạy, Lượt hiển thị (Impressions), Lượt Click, và Tỷ lệ chuyển đổi CTR.
4. **Tạo chiến dịch mới**:
   * Nhấn nút **"+ Tạo Chiến Dịch"**.
   * Chọn định dạng: **Audio Ad** (Quảng cáo âm thanh xen kẽ) hoặc **Banner Ad** (Biểu ngữ hiển thị).
   * Tải trực tiếp file MP3 hoặc ảnh bìa lên hệ thống (hệ thống tự động đồng bộ lên Cloudinary).
   * Nhập link đích (`targetUrl`) để điều hướng người dùng khi click.
   * Cấu hình quyền bỏ qua (`canSkip`) và số giây tối thiểu phải nghe.
   * Chọn các gói người dùng áp dụng (Ví dụ: chỉ áp dụng cho tài khoản `Free (Basic)`).
5. **Bật / Tắt chiến dịch**:
   * Sử dụng công tắc **Switch** ngay trên từng hàng của bảng để kích hoạt hoặc tạm dừng chiến dịch ngay lập tức mà không cần xóa dữ liệu.

# Web Frontend — musicflow_web

Ứng dụng web MusicFlow được xây dựng với **React 19**, **Vite** và bộ giao diện **Material UI (MUI v7)**, hỗ trợ giao diện phong cách Dark/Glassmorphism cao cấp với 3 cổng phân quyền độc lập: **Khách hàng (Client)**, **Nghệ sĩ (Artist)** và **Quản trị viên (Admin)**.

---

## 1. Công nghệ Sử dụng

| Thành phần | Lựa chọn | Ghi chú |
|------------|----------|---------|
| Framework | React 19 + Vite | Hot Module Replacement cực nhanh |
| Giao diện (UI) | Material UI (MUI v7) | Theme chủ đạo: Primary `#6c63ff`, Secondary `#00bcd4` |
| Điều hướng | React Router DOM v7 | Phân nhánh bảo vệ tuyến đường theo Role |
| HTTP Client | Axios | Cấu hình tập trung tại `src/services/api.js` |
| Quản lý Trạng thái | React Context & Hooks | `ClientPlayerProvider` quản lý audio toàn ứng dụng |
| Lưu trữ phiên | `localStorage` | Lưu trữ `role`, `accessToken`, `refreshToken` |

---

## 2. Cấu trúc Thư mục

```
musicflow_web/
├── index.html
├── vite.config.js
├── vercel.json                        ← Cấu hình URL Rewrite cho Single Page Application
└── src/
    ├── main.jsx                       ← Điểm khởi đầu của ứng dụng React
    ├── App.jsx                        ← ThemeProvider, Router, Tuyến đường bảo vệ (ProtectedRoute)
    ├── services/
    │   └── api.js                     ← Axios instance kèm Interceptor tự động gắn token
    ├── components/
    │   ├── common/                    ← Modal chia sẻ, dialog thông báo chung
    │   └── Layout/
    │       ├── admin/                 ← Layout, Header, Sidebar cho Admin
    │       ├── artist/                ← Layout, Header, Sidebar cho Nghệ sĩ
    │       └── client/
    │           ├── ClientLayout.jsx   ← Layout chính của người dùng nghe nhạc
    │           ├── ClientHeader.jsx   ← Thanh tìm kiếm, thông báo, menu người dùng
    │           ├── ClientSidebar.jsx  ← Menu danh mục trang chủ, khám phá, thư viện
    │           ├── NowPlayingBar.jsx  ← Thanh điều khiển phát nhạc chân trang
    │           ├── ClientQueueDrawer.jsx ← Ngăn kéo danh sách chờ phát
    │           └── ClientPlayerProvider.jsx ← Trình quản lý Audio Player toàn cục
    └── pages/
        ├── AccountLogin.jsx           ← Đăng nhập chung (User / Artist)
        ├── admin/                     ← Các trang của Quản trị viên
        │   ├── AdminLogin.jsx
        │   ├── Dashboard.jsx
        │   ├── Accounts.jsx
        │   ├── Songs.jsx
        │   ├── Playlists.jsx
        │   ├── Topics.jsx
        │   ├── Premium.jsx            ← Quản lý gói cước Plan, Giao dịch & Thuê bao
        │   └── Settings.jsx
        ├── artist/                    ← Cổng thông tin & công cụ cho Nghệ sĩ
        │   ├── ArtistLogin.jsx
        │   ├── ArtistRegister.jsx
        │   ├── ArtistDashboard.jsx
        │   ├── ArtistSong.jsx
        │   ├── ArtistLyricsDialog.jsx ← Trình soạn thảo & căn nhịp lời bài hát AI
        │   ├── ArtistAnalytics.jsx    ← Báo cáo lượt stream, xu hướng người nghe
        │   └── ArtistProfile.jsx
        └── client/                    ← Cổng nghe nhạc dành cho Người dùng
            ├── ClientHome.jsx         ← Trang chủ nghe nhạc
            ├── ClientDiscover.jsx     ← Khám phá âm nhạc
            ├── ClientGenres.jsx       ← Duyệt theo thể loại
            ├── ClientRankings.jsx     ← Bảng xếp hạng thịnh hành
            ├── ClientLibrary.jsx      ← Thư viện cá nhân
            ├── ClientCollection.jsx   ← Tuyển tập âm nhạc
            ├── ClientSongDetail.jsx   ← Chi tiết bài hát, bình luận, lời bài hát
            ├── ClientArtist.jsx       ← Trang hồ sơ nghệ sĩ công khai
            ├── ClientAiMood.jsx       ← Trải nghiệm tạo danh sách phát AI DJ
            ├── ClientPremium.jsx      ← Trang mua gói cước Premium
            ├── ClientPaymentReturn.jsx← Kết quả thanh toán VNPay
            └── ClientProfile.jsx      ← Hồ sơ cá nhân & hạn dùng gói cước
```

---

## 3. Hệ thống 3 Portals & Phân Quyền Tuyến Đường

Ứng dụng phân chia người dùng thành 3 vai trò rõ ràng lưu tại `localStorage.getItem("role")`:

```
/              → Admin Portal  (Yêu cầu Role: "admin")
/artist/*      → Artist Portal (Yêu cầu Role: "artist")
/client/*      → Client Portal (Yêu cầu Role: "user")
```

### A. Cổng Khách hàng (Client Portal)
- **`ClientHome.jsx`:** Hiển thị bài hát mới, tuyển tập gợi ý, nghệ sĩ hàng đầu và biểu đồ nghe nhạc.
- **`ClientRankings.jsx`:** Bảng xếp hạng âm nhạc thời gian thực.
- **`ClientSongDetail.jsx`:** Trình diễn lời bài hát karaoke toàn màn hình, thảo luận bình luận lồng nhau và chia sẻ bài hát qua liên kết mạng xã hội (OpenGraph).
- **`ClientAiMood.jsx`:** Trò chuyện với AI DJ để sinh danh sách bài hát phù hợp với cảm xúc trong ngày.
- **`ClientPremium.jsx`:** Mua gói Premium qua cổng VNPay hoặc thanh toán thử nghiệm (Sandbox), nhận quyền lợi âm thanh Lossless và không giới hạn tải nhạc.

### B. Cổng Nghệ sĩ (Artist Portal)
- **`ArtistDashboard.jsx`:** Bảng điều khiển theo dõi số bài hát, lượt nghe và người theo dõi.
- **`ArtistSong.jsx`:** Tải lên bài hát mới với kiểm tra metadata tự động, chuyển trạng thái hiển thị công khai/riêng tư.
- **`ArtistLyricsDialog.jsx`:** Công cụ độc quyền cho phép nghệ sĩ nhập lời bài hát thô, bấm nút **"Căn nhịp tự động bằng AI"** để gửi yêu cầu tới AI Lyrics Alignment Worker, hoặc tự căn chỉnh từng mốc thời gian karaoke chính xác.
- **`ArtistAnalytics.jsx`:** Biểu đồ chuỗi thời gian lượt stream theo ngày và phân tích nguồn tiếp cận của người nghe.

### C. Cổng Quản trị viên (Admin Portal)
- **`Dashboard.jsx`:** Thống kê tổng số người dùng, nghệ sĩ, bài hát và doanh thu.
- **`Accounts.jsx`:** Phân quyền, chỉnh sửa hoặc khóa tài khoản vi phạm.
- **`Songs.jsx`:** Duyệt bài hát, gỡ bỏ nội dung vi phạm tiêu chuẩn cộng đồng.
- **`Premium.jsx`:** Thiết lập giá và quyền lợi các gói cước (Gói GO, PLUS, PREMIUM), quản lý danh sách thuê bao đang hoạt động và theo dõi lịch sử giao dịch thanh toán.

---

## 4. Trình Phát Nhạc Toàn Cục (`ClientPlayerProvider`)

- Tích hợp thẻ `<audio>` ngầm và quản lý trạng thái phát liên tục khi chuyển trang.
- Hỗ trợ đầy đủ các tính năng: Phát ngẫu nhiên (Shuffle), Lặp lại 1 bài / Lặp lại toàn bộ (Repeat), Danh sách phát kế tiếp (Next Up Queue).
- Kết nối trực tiếp với API cấp vé nghe nhạc (`/api/songs/:id/ticket`) để tự động chuyển sang stream âm thanh Lossless chất lượng cao 320kbps khi phát hiện tài khoản là Premium.

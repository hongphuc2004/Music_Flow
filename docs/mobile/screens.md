# Màn hình & Điều Hướng — musicflow_app

Tài liệu chi tiết về cây điều hướng (Navigation Tree), các màn hình chính và các thành phần giao diện tương tác (Sheets/Dialogs) của ứng dụng di động MusicFlow.

---

## 1. Sơ đồ Điều hướng Tổng thể

```
SplashScreen (/)
  ├─ [Chưa đăng nhập] ──→ LoginScreen
  │                          └─ → RegisterScreen
  └─ [Đã đăng nhập]   ──→ MainScreen (Floating Capsule Navigation Bar)
                             │
                             ├─ Tab 0: HomeScreen
                             │     ├─ → PlayerScreen (Full Player Modal)
                             │     ├─ → ArtistScreen
                             │     ├─ → HomePlaylistDetailScreen
                             │     └─ → PremiumScreen
                             │
                             ├─ Tab 1: FlowchartScreen (Trending theo giờ)
                             │     └─ → PlayerScreen
                             │
                             ├─ Tab 2: SearchScreen
                             │     ├─ → PlayerScreen
                             │     └─ → ArtistScreen
                             │
                             ├─ Tab 3: AiAssistantScreen (Trợ lý AI toàn năng)
                             │     ├─ → Quick Mood Playlist Generator
                             │     ├─ → Action Confirmation (Tạo playlist, lưu bài)
                             │     └─ → PlayerScreen
                             │
                             └─ Tab 4: LibraryScreen (Thư viện người dùng)
                                   ├─ → FavoritesScreen
                                   ├─ → PlaylistsScreen ──→ PlaylistDetailScreen
                                   ├─ → HistoryScreen
                                   ├─ → DownloadedSongsScreen (Nghe Offline)
                                   ├─ → YourUploadsScreen (Tải nhạc lên)
                                   └─ → SettingsScreen
                                         ├─ → EditProfileScreen
                                         └─ → PremiumScreen

* Thành phần toàn cục luôn sẵn sàng:
  - MiniPlayer: Thanh phát nhạc thu nhỏ đính trên thanh điều hướng.
  - AiFloatingAssistantOrb: Quả cầu AI kích hoạt nhanh trợ lý từ mọi màn hình.
  - VoiceAiDjSheet: Hộp thoại AI DJ nhận diện giọng nói tức thì.
  - SongShareSheet: Hộp thoại chia sẻ liên kết mạng xã hội & mã QR.
```

---

## 2. Chi tiết Các Màn hình Chính

### A. SplashScreen & Auth
- **File:** `presentation/screens/splash/splash_screen.dart`
  - Đọc `accessToken` từ `flutter_secure_storage`.
  - Khởi tạo cấu hình mạng và thông số âm thanh.
  - Nếu hợp lệ → Điều hướng vào `MainScreen`; nếu chưa hoặc hết hạn → Vào `LoginScreen`.
- **File:** `presentation/screens/login/login_screen.dart`
  - Đăng nhập qua Email/Password hoặc Google OAuth bằng 1 chạm (`google_sign_in`).
  - Hỗ trợ lưu thông tin đăng nhập tự động.

### B. MainScreen & Floating Navigation
- **File:** `main.dart` & `presentation/widgets/music_flow_floating_nav_bar.dart`
  - Sử dụng cơ chế Lazy Load + Caching tab để duy trì trạng thái scroll và không tải lại dữ liệu không cần thiết.
  - Thanh điều hướng nổi (Floating Capsule) bo góc tròn với hiệu ứng đổ bóng mờ hiện đại.

### C. HomeScreen (Tab 0)
- **File:** `presentation/screens/home/home_screen.dart`
  - **Banner Chào:** Lời chào cá nhân hóa theo thời điểm trong ngày (Sáng, Chiều, Tối).
  - **Banner Nâng cấp:** Dẫn trực tiếp tới `PremiumScreen`.
  - **Dòng chảy âm nhạc:** Danh sách bài hát mới phát hành, tuyển tập thịnh hành, danh sách phát hệ thống, và các nghệ sĩ được quan tâm nhiều nhất.
  - Tích hợp nút kích hoạt nhanh `VoiceAiDjSheet`.

### D. FlowchartScreen (Tab 1)
- **File:** `presentation/screens/chart/flowchart_screen.dart`
  - Hiển thị bảng xếp hạng ca khúc thịnh hành được tính toán theo thời gian thực (Real-time Stream Events).
  - Biểu đồ đường biểu diễn sự thay đổi thứ hạng theo từng khung giờ trong ngày.
  - Nút "Phát tất cả" tự động đưa toàn bộ Top bài hát vào danh sách chờ (Playback Queue).

### E. SearchScreen (Tab 2)
- **File:** `presentation/screens/search/search_screen.dart`
  - Tìm kiếm tức thì theo từ khóa tên bài hát, tên nghệ sĩ hoặc lời bài hát.
  - Khám phá theo danh mục thể loại (Topics/Genres) với ảnh bìa gradient bắt mắt.

### F. AiAssistantScreen (Tab 3)
- **File:** `presentation/screens/ai_assistant/ai_assistant_screen.dart`
  - Giao diện trò chuyện trực quan với Trợ lý MusicFlow AI.
  - **Hiển thị Hạn mức (Quota Card):** Thông báo số lượt tương tác còn lại trong ngày của người dùng (tự động mở rộng khi nâng cấp Premium).
  - **Thực thi Hành động Thông minh (Interactive Actions):** Khi AI gợi ý danh sách bài hát hoặc đề xuất tạo playlist, giao diện hiển thị thẻ xác nhận kèm nút bấm trực tiếp để phát ngay hoặc lưu vào thư viện.

### G. LibraryScreen (Tab 4)
- **File:** `presentation/screens/library/library_screen.dart`
  - Tập hợp tất cả tài nguyên cá nhân của người nghe:
    - **Bài hát yêu thích (`FavoritesScreen`):** Đồng bộ 2 chiều với backend.
    - **Danh sách phát (`PlaylistsScreen`):** Tạo mới, chỉnh sửa, sắp xếp lại thứ tự bài hát.
    - **Bài hát đã tải (`DownloadedSongsScreen`):** Chơi nhạc hoàn toàn không cần kết nối mạng từ cơ sở dữ liệu `Hive`.
    - **Nhạc đã tải lên (`YourUploadsScreen`):** Quản lý các bài hát cá nhân do chính người dùng đăng tải.
    - **Lịch sử nghe (`HistoryScreen`):** Danh sách các bài hát vừa thưởng thức gần đây.

### H. PlayerScreen (Trình phát Fullscreen)
- **File:** `presentation/screens/player/player_screen.dart`
  - Đĩa than hoặc ảnh bìa nghệ thuật xoay tròn nhẹ nhàng theo nhịp phát.
  - **Synced Lyrics Karaoke View:** Lời bài hát cuộn tự động theo thời gian thực `[mm:ss.xx]`, làm nổi bật từng từ đang phát.
  - **Lựa chọn Chất lượng mượt mà:** Chuyển đổi giữa 128kbps và Lossless HQ 320kbps (dành cho thuê bao Premium).
  - Nút mở nhanh `SongCommentsSheet` và `SongShareSheet`.

### I. PremiumScreen (Nâng cấp Gói cước)
- **File:** `presentation/screens/premium/premium_screen.dart`
  - Giới thiệu các đặc quyền của tài khoản trả phí: Âm thanh chất lượng cao 320kbps, không giới hạn tải ngoại tuyến, mở rộng lượt tương tác AI DJ/Assistant, tăng dung lượng lưu trữ bài hát cá nhân.
  - Hiển thị 3 gói cước linh hoạt: **Gói GO (19.000đ)**, **Gói PLUS (49.000đ)**, **Gói PREMIUM (89.000đ)**.
  - Tích hợp cổng thanh toán Sandbox / VNPay trực quan.

---

## 3. Các Thành phần Tương tác Nổi bật (Sheets & Overlays)

1. **`AiFloatingAssistantOrb`:** Quả cầu trợ lý nổi lơ lửng, hỗ trợ kéo thả tự do trên màn hình, chạm vào để mở nhanh cửa sổ trò chuyện với AI mà không làm gián đoạn bài hát đang nghe.
2. **`VoiceAiDjSheet`:** Hộp thoại nhận diện giọng nói trực tiếp qua micro, phân tích cảm xúc và phát ngay playlist phù hợp chỉ sau vài giây.
3. **`SongShareSheet`:** Chia sẻ bài hát qua mạng xã hội (Facebook, Zalo, X/Twitter, Telegram) kèm liên kết OpenGraph đẹp mắt hoặc tạo mã QR để bạn bè quét nghe ngay.
4. **`SongCommentsSheet`:** Bình luận tương tác theo thời gian thực, thả tim và trả lời bình luận của thính giả khác.

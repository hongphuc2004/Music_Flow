# Mobile App — musicflow_app

Ứng dụng di động MusicFlow được xây dựng bằng **Flutter (Dart)**, hỗ trợ đa nền tảng (Android, iOS, Web, Desktop), mang lại trải nghiệm nghe nhạc trực tuyến mượt mà, hỗ trợ phát nhạc nền, điều khiển màn hình khóa, hát karaoke lời đồng bộ, lưu trữ nhạc ngoại tuyến và tương tác với trợ lý AI.

---

## Cấu trúc thư mục `lib/`

```
musicflow_app/lib/
├── main.dart                                ← Entry point, khởi tạo dịch vụ, MainScreen với floating nav bar
├── core/
│   ├── audio/
│   │   ├── audio_handler.dart               ← Background AudioHandler cho audio_service
│   │   ├── audio_player_service.dart        ← Wrapper Singleton cho just_audio engine
│   │   └── global_audio_state.dart          ← Trạng thái phát nhạc toàn cục (ChangeNotifier)
│   ├── config/
│   │   └── api_config.dart                  ← Cấu hình API base URL (dart-define / fallback)
│   ├── services/
│   │   └── app_settings_service.dart        ← Cài đặt chất lượng âm thanh, bộ nhớ đệm ngoại tuyến
│   ├── theme/
│   │   ├── app_theme.dart                   ← Định nghĩa Theme sáng/tối (Dark/Light mode)
│   │   └── theme_service.dart               ← Quản lý chuyển đổi giao diện động
│   └── utils/
│       └── lrc_parser.dart                  ← Phân tích cú pháp lời bài hát LRC và nhịp từ
├── data/
│   ├── models/
│   │   ├── song_model.dart                  ← Dữ liệu bài hát, chất lượng âm thanh, lượt thích/nghe
│   │   ├── playlist_model.dart              ← Danh sách phát cá nhân và hệ thống
│   │   ├── artist_profile_model.dart        ← Thông tin nghệ sĩ, lượt nghe, bài hát nổi bật
│   │   ├── user_model.dart                  ← Hồ sơ người dùng, trạng thái Premium
│   │   ├── plan_model.dart                  ← Gói cước Premium (Gói GO, PLUS, PREMIUM)
│   │   ├── comment_model.dart               ← Bình luận, phản hồi lồng nhau, lượt thả tim
│   │   ├── topic_model.dart                 ← Thể loại và chủ đề âm nhạc
│   │   └── lrc_line_model.dart              ← Dòng lời bài hát và mốc thời gian karaoke
│   └── services/
│       ├── auth_service.dart                ← Đăng nhập/ký email, Google OAuth, lưu trữ secure token
│       ├── song_api_service.dart            ← Lấy danh sách, streaming, xếp hạng, play event, share
│       ├── playlist_api_service.dart        ← CRUD danh sách phát
│       ├── artist_api_service.dart          ← Trang cá nhân nghệ sĩ, theo dõi nghệ sĩ
│       ├── favorite_service.dart            ← Quản lý thư viện bài hát yêu thích
│       ├── like_service.dart                ← Thả tim bài hát
│       ├── comment_service.dart             ← Đăng tải và tương tác bình luận
│       ├── topic_api_service.dart           ← Danh mục thể loại
│       ├── lyrics_api_service.dart          ← Tải lời bài hát đồng bộ
│       ├── offline_song_service.dart        ← Quản lý nhạc đã tải về máy qua Hive NoSQL
│       ├── play_history_service.dart        ← Lịch sử bài hát vừa nghe
│       ├── assistant_api_service.dart       ← Tương tác Trợ lý AI toàn năng, quota, xác nhận action
│       └── subscription_api_service.dart    ← Xem gói cước, tạo yêu cầu thanh toán Premium
└── presentation/
    ├── screens/
    │   ├── splash/                          ← Màn hình chào, kiểm tra phiên đăng nhập
    │   ├── login/                           ← Đăng nhập / Đăng ký tài khoản, Google Sign-In
    │   ├── home/                            ← Trang chủ, bài hát mới, đề xuất, nghệ sĩ nổi bật
    │   ├── chart/                           ← Bảng xếp hạng Flowchart thời gian thực theo giờ
    │   ├── search/                          ← Tìm kiếm bài hát, nghệ sĩ, thể loại
    │   ├── ai_assistant/                    ← Màn hình Trợ lý AI toàn năng (Tab 3)
    │   ├── ai_dj/                           ← Giao diện AI DJ tạo playlist theo tâm trạng
    │   ├── library/                         ← Thư viện cá nhân, Yêu thích, Đã tải, Uploads
    │   ├── player/                          ← Trình phát nhạc toàn màn hình (Full Player), Karaoke LRC
    │   ├── artist/                          ← Trang chi tiết nghệ sĩ
    │   ├── premium/                         ← Trang nâng cấp gói cước dịch vụ Premium
    │   └── settings/                        ← Cài đặt tài khoản, theme, audio quality, bộ nhớ
    └── widgets/
        ├── mini_player.dart                 ← Thanh phát nhạc thu nhỏ gắn liền đáy màn hình
        ├── mini_player_wrapper.dart         ← Wrapper hiển thị mini player tự động trên các view
        ├── music_flow_floating_nav_bar.dart ← Thanh điều hướng nổi dạng viên nang hiện đại
        ├── music_flow_backdrop.dart         ← Hiệu ứng nền động theo bài hát đang phát
        ├── ai_floating_assistant_orb.dart   ← Quả cầu AI phát sáng kích hoạt nhanh trợ lý
        ├── voice_ai_dj_sheet.dart           ← Bottom sheet nhận diện giọng nói cho AI DJ
        ├── song_share_sheet.dart            ← Bottom sheet chia sẻ bài hát đa nền tảng
        ├── song_comments_sheet.dart         ← Bottom sheet xem và gửi bình luận
        ├── song_options_menu.dart           ← Menu tùy chọn bài hát (thêm vào playlist, tải về...)
        ├── synced_lyrics_view.dart          ← Giao diện karaoke cuộn tự động theo nhịp
        └── player_bottom_action_bar.dart    ← Thanh nút điều khiển nâng cao ở màn hình phát
```

---

## Các gói Dependencies cốt lõi (`pubspec.yaml`)

### Âm thanh & Phát nhạc
- `just_audio`: Engine phát nhạc chất lượng cao, hỗ trợ buffer stream trực tiếp.
- `audio_service`: Đưa tiến trình phát nhạc ra nền hệ thống và hiển thị điều khiển trên Lock Screen / Notification bar.
- `audio_session`: Quản lý tranh chấp audio focus với các ứng dụng khác trên Android/iOS.

### Lưu trữ & Mạng
- `http`: Giao tiếp RESTful API với backend.
- `flutter_secure_storage`: Lưu trữ access token và refresh token dưới dạng mã hóa phần cứng.
- `shared_preferences`: Lưu trữ cài đặt người dùng (Theme mode, chất lượng âm thanh 128kbps/320kbps).
- `hive` & `hive_flutter`: Cơ sở dữ liệu NoSQL cục bộ tốc độ cao lưu trữ danh sách bài hát ngoại tuyến.

### Xác thực & Phương tiện
- `google_sign_in`: Đăng nhập bằng tài khoản Google.
- `speech_to_text`: Chuyển đổi giọng nói thành văn bản cho tính năng Voice AI DJ.
- `file_picker` & `path_provider`: Hỗ trợ chọn tệp bài hát tải lên và quản lý thư mục tệp tin.
- `image_picker`: Chọn ảnh tải lên làm ảnh đại diện hoặc ảnh bìa.

---

## Hướng dẫn Khởi chạy

```bash
cd musicflow_app

# Chạy trên Android Emulator (kết nối tới localhost backend qua 10.0.2.2)
flutter run

# Chạy trên thiết bị thật (truyền địa chỉ IP máy tính trong mạng LAN)
flutter run --dart-define=API_BASE_URL=http://192.168.1.xxx:5001

# Đóng gói APK kết nối backend Production
flutter build apk --release --dart-define=API_BASE_URL=https://music-flow-30us.onrender.com
```

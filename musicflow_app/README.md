# 📱 MusicFlow Mobile — Ứng Dụng Flutter Đa Nền Tảng

Ứng dụng di động (Android, iOS, Web & Desktop) của hệ sinh thái **MusicFlow**, được xây dựng bằng **Flutter (Dart)** với trải nghiệm nghe nhạc hiện đại, phát nhạc chạy ngầm (background audio), hiển thị lời bài hát đồng bộ karaoke thời gian thực và tích hợp AI DJ thông minh.

---

## ✨ Tính Năng Nổi Bật

- 🎧 **Trình phát nhạc cao cấp**: Phát nhạc nền, điều khiển qua thanh thông báo và màn hình khóa (`audio_service` + `just_audio`).
- 🎤 **Lời bài hát Karaoke đồng bộ**: Tự động bám nhịp từng từ và từng dòng theo chuẩn file `.lrc`.
- 💾 **Nghe nhạc ngoại tuyến (Offline)**: Tải và lưu trữ bài hát cục bộ thông qua cơ sở dữ liệu siêu tốc `Hive`.
- 🤖 **Trợ lý AI DJ**: Trò chuyện bằng văn bản hoặc giọng nói để tạo playlist nhạc theo tâm trạng cá nhân.
- 🔐 **Xác thực an toàn**: Đăng nhập tài khoản, Google Sign-In và lưu trữ token an toàn với `flutter_secure_storage`.

---

## 📋 Yêu Cầu Môi Trường (Prerequisites)

- **Flutter SDK**: v3.19.0 trở lên (khuyên dùng Flutter 3.24+).
- **Dart SDK**: Đi kèm với Flutter.
- **Android Development**:
  - Android Studio & Android SDK (API level 34+).
  - Java Development Kit (JDK 17 khuyến nghị).
- **iOS Development** (Chỉ dành cho macOS):
  - Xcode 15+ & Command Line Tools.
  - CocoaPods: `sudo gem install cocoapods`.

---

## ⚙️ Hướng Dẫn Cài Đặt & Khởi Chạy (Local Setup)

### 1. Di chuyển vào thư mục app
```bash
cd musicflow_app
```

### 2. Tải toàn bộ các package phụ thuộc
```bash
flutter pub get
```

### 3. Cấu hình địa chỉ API Backend
Ứng dụng nhận địa chỉ backend thông qua biến cờ `--dart-define=API_BASE_URL=...`:

| Môi trường chạy | Lệnh khởi chạy | Ghi chú |
| :--- | :--- | :--- |
| **Android Emulator** | `flutter run` | Mặc định tự kết nối về `http://10.0.2.2:5001` (localhost máy chủ). |
| **iOS Simulator** | `flutter run` | Mặc định tự kết nối về `http://localhost:5001`. |
| **Điện thoại Android thật (Physical Device)** | `flutter run --dart-define=API_BASE_URL=http://<IP-LAN-MAY-TINH>:5001` | Điện thoại và máy tính phải **cùng kết nối chung 1 mạng Wi-Fi**. |
| **Production Backend** | `flutter run --dart-define=APP_ENV=prod` | Tự động trỏ về domain Render Production cấu hình trong `api_config.dart`. |

> **Cách lấy IP LAN máy tính:**
> - Trên Windows: Chạy lệnh `ipconfig` trong terminal, tìm dòng `IPv4 Address` (ví dụ: `192.168.1.53`).
> - Khi đó truyền: `--dart-define=API_BASE_URL=http://192.168.1.53:5001`

---

## 🏗️ Cấu Trúc Dự Án (Project Structure)

```
lib/
├── main.dart                      # Điểm khởi chạy ứng dụng & cấu hình AudioService
├── core/
│   ├── audio/                     # AudioHandler, JustAudio wrapper, Global audio state
│   ├── config/                    # Cấu hình API endpoint theo môi trường (api_config.dart)
│   └── utils/                     # Tiện ích phân tích file lời LRC (lrc_parser.dart)
├── data/
│   ├── models/                    # Data models: Song, Artist, Playlist, User
│   └── services/                  # Gọi API Backend qua HTTP & Hive offline cache
└── presentation/
    ├── screens/                   # Các màn hình: Home, Player, Search, Library, AI DJ, Artist
    └── widgets/                   # Component tái sử dụng: MiniPlayer, SyncedLyricsView,...
```

---

## 📦 Đóng Gói Ứng Dụng (Build Release)

### 1. Build file APK Android
```bash
# Sử dụng môi trường Production:
flutter build apk --release --dart-define=APP_ENV=prod

# Hoặc truyền URL trực tiếp:
flutter build apk --release --dart-define=API_BASE_URL=https://your-backend-domain.onrender.com
```
File cài đặt sau khi build thành công: `build/app/outputs/flutter-apk/app-release.apk`.

### 2. Build Android App Bundle (Cho Google Play Store)
```bash
flutter build appbundle --release --dart-define=APP_ENV=prod
```

### 3. Build iOS (Yêu cầu macOS & Xcode)
```bash
flutter build ipa --release --dart-define=APP_ENV=prod
```

---

## 💡 Lưu Ý Quan Trọng Khi Chạy Thử Nghiệm

1. **Lỗi mạng trên thiết bị thật (`SocketException` / `Connection refused`):**
   - Đảm bảo điện thoại và máy tính cùng kết nối chung một mạng Wi-Fi.
   - Tắt tạm thời Firewall trên máy tính hoặc cho phép cổng `5001` nhận kết nối mạng Private.
   - Thử mở trình duyệt trên điện thoại và truy cập `http://<IP-LAN>:5001/api/songs` để kiểm tra kết nối trước khi chạy app.
2. **Google Sign-In trên thiết bị thật:**
   - Cần lấy mã **SHA-1** của keystore trên máy (`keytool -list -v -keystore ~/.android/debug.keystore`) và thêm vào Google Cloud Console.

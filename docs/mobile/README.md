# Mobile App — musicflow_app

Flutter application cho Android/iOS/Web/Desktop.

---

## Cấu trúc thư mục

```
musicflow_app/
├── pubspec.yaml
├── android/
│   └── app/build.gradle
├── ios/
└── lib/
    ├── main.dart                        ← Entry point + navigation chính
    ├── core/
    │   ├── audio/
    │   │   ├── audio_handler.dart       ← Background audio service
    │   │   ├── audio_player_service.dart← Singleton just_audio wrapper
    │   │   └── global_audio_state.dart  ← Global state (ChangeNotifier)
    │   ├── config/
    │   │   └── api_config.dart          ← API URLs + endpoint helpers
    │   └── utils/
    │       └── lrc_parser.dart          ← LRC lyrics parser
    ├── data/
    │   ├── models/
    │   │   ├── song_model.dart
    │   │   ├── playlist_model.dart
    │   │   ├── artist_profile_model.dart
    │   │   ├── user_model.dart
    │   │   ├── comment_model.dart
    │   │   ├── topic_model.dart
    │   │   └── lrc_line_model.dart
    │   └── services/
    │       ├── auth_service.dart
    │       ├── song_api_service.dart
    │       ├── playlist_api_service.dart
    │       ├── artist_api_service.dart
    │       ├── favorite_service.dart
    │       ├── like_service.dart
    │       ├── comment_service.dart
    │       ├── topic_api_service.dart
    │       ├── lyrics_api_service.dart
    │       ├── offline_song_service.dart
    │       ├── play_history_service.dart
    │       └── [ai service — inline in screen]
    └── presentation/
        ├── screens/
        │   ├── splash/
        │   ├── login/
        │   ├── home/
        │   ├── search/
        │   ├── player/
        │   ├── library/
        │   ├── artist/
        │   ├── chart/
        │   ├── ai_dj/
        │   └── settings/
        └── widgets/
            ├── mini_player.dart
            ├── mini_player_wrapper.dart
            ├── synced_lyrics_view.dart
            ├── song_options_menu.dart
            ├── song_comments_sheet.dart
            └── player_bottom_action_bar.dart
```

---

## Dependencies (pubspec.yaml)

### Audio
| Package | Version | Mục đích |
|---------|---------|---------|
| `just_audio` | ^0.10.5 | Audio playback engine |
| `audio_service` | ^0.18.18 | Background play + lock screen controls |
| `audio_session` | ^0.2.2 | iOS/Android audio session management |

### Networking & Storage
| Package | Version | Mục đích |
|---------|---------|---------|
| `http` | ^1.2.0 | HTTP requests |
| `shared_preferences` | ^2.2.2 | Key-value local storage |
| `flutter_secure_storage` | ^9.2.4 | Encrypted token storage |
| `hive` | ^2.2.3 | NoSQL local DB (offline songs) |
| `hive_flutter` | ^1.1.0 | Hive Flutter adapter |

### Auth
| Package | Version | Mục đích |
|---------|---------|---------|
| `google_sign_in` | ^6.2.1 | Google OAuth |

### File & Media
| Package | Version | Mục đích |
|---------|---------|---------|
| `file_picker` | ^8.0.0 | Chọn file nhạc để upload |
| `image_picker` | ^1.1.2 | Chọn ảnh avatar |
| `path_provider` | ^2.1.4 | Đường dẫn thư mục local |
| `path` | ^1.9.1 | Xử lý path string |

### Voice & AI
| Package | Version | Mục đích |
|---------|---------|---------|
| `speech_to_text` | ^7.0.0 | Voice search cho AI DJ |

### UI
| Package | Version | Mục đích |
|---------|---------|---------|
| `lottie` | ^3.1.0 | Animation JSON (loading, splash) |

---

## Build & Run

```bash
# Chạy trên Android emulator (API trỏ http://10.0.2.2:5001)
flutter run

# Chạy trên physical device với IP local
flutter run --dart-define=API_BASE_URL=http://192.168.1.x:5001

# Build APK production
flutter build apk --dart-define=API_BASE_URL=https://music-flow-30us.onrender.com

# Build release
flutter build apk --release --dart-define=API_BASE_URL=https://...
```

---

## API URL Configuration

```dart
// lib/core/config/api_config.dart
class ApiConfig {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:5001',  // Android emulator default
  );
}
```

Không hardcode URL trong code — luôn truyền qua `--dart-define`.

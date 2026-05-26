# Tech — Mobile (Flutter)

## Stack

| Quyết định | Lựa chọn | Ghi chú |
|-----------|---------|---------|
| Framework | Flutter (Dart) | SDK ^3.9.2 |
| Audio | `just_audio` + `audio_service` + `audio_session` | Background play, lock screen controls |
| HTTP | `http` package | Không dùng Dio |
| Auth | `flutter_secure_storage` (token) + `google_sign_in` | |
| Local cache | `Hive` + `hive_flutter` | Offline songs |
| AI | `speech_to_text` | Voice input cho AI DJ |
| File | `file_picker` + `path_provider` | Upload nhạc |
| Image | `image_picker` | Avatar |
| Storage (offline) | `shared_preferences` | Settings nhẹ |

---

## Cấu trúc `lib/`

```
lib/
├── main.dart
├── core/
│   ├── audio/
│   │   ├── audio_handler.dart       ← AudioHandler cho audio_service
│   │   ├── audio_player_service.dart ← just_audio wrapper
│   │   └── global_audio_state.dart  ← State toàn app
│   ├── config/
│   │   └── api_config.dart          ← API base URL (dart-define)
│   └── utils/
│       └── lrc_parser.dart          ← Parse LRC lyrics
│
├── data/
│   ├── models/                      ← Data classes (song, playlist, artist...)
│   └── services/                    ← API calls qua http package
│       ├── song_api_service.dart
│       ├── auth_service.dart
│       ├── playlist_api_service.dart
│       ├── artist_api_service.dart
│       └── offline_song_service.dart ← Hive offline
│
└── presentation/
    ├── screens/
    │   ├── home/           ← HomeScreen + sections
    │   ├── player/         ← PlayerScreen (full player)
    │   ├── search/         ← SearchScreen
    │   ├── library/        ← LibraryScreen, PlaylistsScreen, FavoritesScreen, HistoryScreen
    │   ├── artist/         ← ArtistScreen
    │   ├── ai_dj/          ← AI DJ Screen (Gemini chat)
    │   ├── chart/          ← FlowchartScreen (bảng xếp hạng)
    │   ├── login/          ← LoginScreen, RegisterScreen
    │   ├── settings/       ← SettingsScreen, EditProfileScreen
    │   └── splash/         ← SplashScreen
    └── widgets/
        ├── mini_player.dart           ← Player mini bar
        ├── mini_player_wrapper.dart
        ├── song_options_menu.dart
        ├── song_comments_sheet.dart
        ├── player_bottom_action_bar.dart
        └── synced_lyrics_view.dart    ← LRC karaoke view
```

---

## API Config

URL backend truyền qua `--dart-define`:

```dart
// lib/core/config/api_config.dart
class ApiConfig {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:5001',  // Android emulator → localhost
  );
}
```

```bash
# Run với custom URL
flutter run --dart-define=API_BASE_URL=http://192.168.1.x:5001

# Build APK production
flutter build apk --dart-define=API_BASE_URL=https://<render-domain>.onrender.com
```

---

## Naming Conventions

| Type | Pattern | Ví dụ |
|------|---------|-------|
| Screen | `{name}_screen.dart` | `home_screen.dart` |
| Widget | `{name}.dart` | `mini_player.dart` |
| Model | `{name}_model.dart` | `song_model.dart` |
| Service | `{name}_service.dart` | `song_api_service.dart` |
| Section widget | `{screen}_{section}_section.dart` | `home_artist_section.dart` |

---

## Audio Architecture

```
audio_service (background)
    └── AudioHandler (audio_handler.dart)
            └── just_audio AudioPlayer
                    └── audio_session (iOS/Android session management)

global_audio_state.dart ← ChangeNotifier/ValueNotifier for UI
```

- `AudioHandler` handles media controls (play/pause/skip) từ lock screen / notification
- `global_audio_state.dart` expose current song, position, queue cho UI
- `MiniPlayerWrapper` wrap mọi screen để mini player luôn hiển thị

---

## Nguyên tắc

- Không eject/modify native code nếu không cần thiết
- Token lưu bằng `flutter_secure_storage` — không dùng `SharedPreferences` cho token
- HTTP qua `http` package — không thêm Dio
- Offline cache dùng `Hive` — không dùng SQLite cho scope hiện tại
- Background audio qua `audio_service` — không tự implement Android service
- Không thêm package mới nếu stack hiện tại đủ dùng

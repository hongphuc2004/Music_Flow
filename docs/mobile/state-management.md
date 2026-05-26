# State Management — musicflow_app

## Tổng quan

App không dùng thư viện state management phức tạp (Provider/Riverpod/Bloc). Thay vào đó:

| Loại state | Cơ chế | Scope |
|-----------|--------|-------|
| Audio playback | `GlobalAudioState` (ChangeNotifier) | Global |
| Auth state | `AuthService.currentUserNotifier` (ValueNotifier) | Global |
| UI state | `StatefulWidget` + `setState` | Per-screen |
| Offline metadata | `Hive` Box | Persistent local |
| Play/search history | `SharedPreferences` | Persistent local |
| Token storage | `flutter_secure_storage` | Persistent secure |

---

## GlobalAudioState

**File:** `core/audio/global_audio_state.dart`

Là ChangeNotifier singleton duy nhất — toàn bộ app lắng nghe state phát nhạc từ đây.

```dart
class GlobalAudioState extends ChangeNotifier {
  // Singleton
  static final GlobalAudioState _instance = GlobalAudioState._internal();
  factory GlobalAudioState() => _instance;

  // State
  Song? currentSong;
  List<Song> queue = [];
  int currentIndex = 0;
  bool isPlaying = false;
  bool isLoading = false;
  Duration position = Duration.zero;
  Duration duration = Duration.zero;
  RepeatMode repeatMode = RepeatMode.off;
  bool isShuffled = false;
  List<int> shuffledIndices = [];
}
```

**Cách dùng trong widget:**
```dart
// Rebuild khi bất kỳ state nào thay đổi
ListenableBuilder(
  listenable: GlobalAudioState(),
  builder: (context, child) {
    final state = GlobalAudioState();
    return Text(state.currentSong?.title ?? 'Nothing playing');
  },
)

// Chỉ rebuild khi cần
ValueListenableBuilder<Song?>(
  valueListenable: GlobalAudioState().currentSongNotifier,
  builder: (context, song, child) { ... },
)
```

---

## AuthService.currentUserNotifier

```dart
// Trong AuthService
static final ValueNotifier<User?> currentUserNotifier = ValueNotifier(null);

// Sau khi login thành công
currentUserNotifier.value = user;

// Trong widget
ValueListenableBuilder<User?>(
  valueListenable: AuthService.currentUserNotifier,
  builder: (context, user, child) {
    if (user == null) return LoginPrompt();
    return UserProfile(user: user);
  },
)
```

---

## SharedPreferences

Dùng cho dữ liệu nhẹ, không nhạy cảm:

```dart
// Play history (50 bài gần nhất)
class PlayHistoryService {
  static const _key = 'play_history';

  Future<void> addToHistory(Song song) async {
    final prefs = await SharedPreferences.getInstance();
    final List<String> history = prefs.getStringList(_key) ?? [];

    // Xóa nếu đã có trong list (để move lên đầu)
    history.removeWhere((json) {
      return Song.fromJson(jsonDecode(json)).id == song.id;
    });

    // Thêm vào đầu
    history.insert(0, jsonEncode(song.toJson()));

    // Giữ tối đa 50
    if (history.length > 50) history.removeLast();

    await prefs.setStringList(_key, history);
  }

  Future<List<Song>> getHistory() async {
    final prefs = await SharedPreferences.getInstance();
    return (prefs.getStringList(_key) ?? [])
      .map((json) => Song.fromJson(jsonDecode(json)))
      .toList();
  }
}
```

```dart
// Search history (10 queries gần nhất)
// Lưu trong SearchScreen
static const _searchKey = 'search_history';

Future<void> _saveSearchQuery(String query) async {
  final prefs = await SharedPreferences.getInstance();
  final history = prefs.getStringList(_searchKey) ?? [];
  history.removeWhere((q) => q == query);
  history.insert(0, query);
  if (history.length > 10) history.removeLast();
  await prefs.setStringList(_searchKey, history);
}
```

---

## Hive (Offline Songs)

```dart
// Khởi tạo trong main.dart
await Hive.initFlutter();
Hive.registerAdapter(OfflineSongMetadataAdapter());
await Hive.openBox<OfflineSongMetadata>('offline_songs');

// Đọc
final box = Hive.box<OfflineSongMetadata>('offline_songs');
final metadata = box.get(songId);  // null nếu không có

// Ghi
await box.put(songId, OfflineSongMetadata(...));

// Xóa
await box.delete(songId);

// Watch (reactive)
box.watch(key: songId).listen((event) {
  // event.deleted hoặc event.value
});
```

---

## flutter_secure_storage

```dart
const _storage = FlutterSecureStorage();

// Ghi
await _storage.write(key: 'accessToken', value: token);

// Đọc
final token = await _storage.read(key: 'accessToken');  // null nếu không có

// Xóa
await _storage.delete(key: 'accessToken');

// Xóa tất cả (khi logout)
await _storage.deleteAll();
```

**Bảo mật:**
- Android: AES encryption với Android Keystore
- iOS: Keychain

---

## StatefulWidget pattern (per-screen)

Mọi screen đều dùng `StatefulWidget` với `setState` cho UI state riêng:

```dart
class _HomeScreenState extends State<HomeScreen> {
  List<Song> _recommendedSongs = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      final songs = await SongApiService.getRecommended();
      setState(() {
        _recommendedSongs = songs;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return CircularProgressIndicator();
    if (_error != null) return ErrorWidget(_error!, retry: _loadData);
    return SongList(songs: _recommendedSongs);
  }
}
```

---

## Tại sao không dùng Riverpod/Bloc?

- Đây là solo project, scope không đủ lớn để justify thêm dependency
- `ChangeNotifier` + `ValueNotifier` đủ dùng cho 2 global state (audio + auth)
- Phần còn lại là UI state cục bộ → `setState` đơn giản hơn

# Kiến trúc App — musicflow_app

## Layer architecture

```
┌─────────────────────────────────────────────┐
│            Presentation Layer               │
│  Screens / Widgets / UI Components          │
│  (lib/presentation/)                        │
└──────────────┬──────────────────────────────┘
               │ calls
┌──────────────▼──────────────────────────────┐
│              Data Layer                     │
│  Services (API calls + local storage)       │
│  Models (data classes)                      │
│  (lib/data/)                                │
└──────────────┬──────────────────────────────┘
               │ uses
┌──────────────▼──────────────────────────────┐
│               Core Layer                    │
│  Audio engine, Config, Utils                │
│  (lib/core/)                                │
└─────────────────────────────────────────────┘
```

---

## Dependency Graph

```
main.dart
  ├─ SplashScreen
  │     └─ AuthService (kiểm tra token)
  │           ├─ LoggedIn → MainScreen
  │           └─ NotLoggedIn → LoginScreen
  │
  └─ MainScreen (BottomNavigationBar 5 tabs)
        ├─ Tab 0: HomeScreen
        │     ├─ SongApiService.getRecommended()
        │     ├─ SongApiService.getSystemPlaylists()
        │     ├─ ArtistApiService.getArtistProfile()
        │     └─ → PlayerScreen (modal)
        │
        ├─ Tab 1: FlowchartScreen
        │     └─ SongApiService.getFlowchart()
        │
        ├─ Tab 2: SearchScreen
        │     ├─ TopicApiService.getTopics()
        │     ├─ SongApiService.search()
        │     └─ SpeechToText (voice)
        │
        ├─ Tab 3: AiDjScreen
        │     └─ POST /api/ai/playlist
        │
        └─ Tab 4: LibraryScreen
              ├─ FavoritesScreen
              ├─ PlaylistsScreen → PlaylistDetailScreen
              ├─ HistoryScreen
              ├─ DownloadedSongsScreen
              └─ YourUploadsScreen
```

---

## State Management

| State | Cơ chế | Scope |
|-------|--------|-------|
| Audio playback | `GlobalAudioState` (ChangeNotifier) | Global — toàn app |
| Auth state | `AuthService.currentUserNotifier` (ValueNotifier) | Global |
| UI local state | `StatefulWidget` + `setState` | Per-screen |
| Hive | Box objects | Offline songs metadata |
| SharedPreferences | key-value | Play history, search history |

### GlobalAudioState — trung tâm

```
GlobalAudioState (ChangeNotifier)
  ├─ currentSong: Song?
  ├─ queue: List<Song>
  ├─ currentIndex: int
  ├─ isPlaying: bool
  ├─ position: Duration
  ├─ duration: Duration
  ├─ repeatMode: RepeatMode (off/all/one)
  ├─ isShuffled: bool
  └─ isOffline: bool

  Methods:
  ├─ playSong(song, queue)    → kiểm tra offline → stream/local
  ├─ playNext()               → advance queue (shuffle-aware)
  ├─ playPrevious()
  ├─ toggleRepeat()
  ├─ toggleShuffle()
  └─ seek(Duration)
```

Widgets dùng `ListenableBuilder` hoặc `Consumer` để rebuild khi state thay đổi.

---

## Navigation

Flutter dùng Navigator 1.0 với named routes và modal routes.

```
SplashScreen (initialRoute: '/')
  │
  ├─ /login → LoginScreen
  │     └─ /register → RegisterScreen
  │
  └─ /main → MainScreen (authenticated)
        └─ /player → PlayerScreen (fullscreen modal)
              └─ Navigator.push(MaterialPageRoute)
```

**Cách mở PlayerScreen:**
```dart
Navigator.push(
  context,
  MaterialPageRoute(builder: (_) => PlayerScreen()),
);
```

PlayerScreen không có AppBar, chiếm toàn màn hình với animation trượt từ dưới lên.

---

## MiniPlayer Wrapper

Mọi màn hình trong `MainScreen` được wrap bởi `MiniPlayerWrapper`:

```
MainScreen
  └─ Scaffold
       └─ body: Stack
            ├─ IndexedStack (5 tabs — lazy loaded, không dispose)
            └─ Positioned(bottom: 0)
                 └─ MiniPlayerWrapper
                      └─ Consumer<GlobalAudioState>
                           └─ MiniPlayer (hiển thị khi có currentSong)
```

MiniPlayer luôn float phía trên bottom navigation bar.

---

## Audio Architecture Chi tiết

```
just_audio (AudioPlayer)
    │
    │  wraps
    ▼
AudioPlayerService (Singleton)
    │
    │  background integration
    ▼
MusicFlowAudioHandler (extends BaseAudioHandler)
    │  audio_service package
    │  → Notification controls (prev/play/pause/next)
    │  → Lock screen metadata
    │
    │  state broadcast
    ▼
GlobalAudioState (ChangeNotifier)
    │
    │  notifyListeners()
    ▼
UI (MiniPlayer, PlayerScreen, NowPlayingBar)
```

---

## Error Handling Pattern

```dart
// Trong mọi service
try {
  final response = await http.get(uri, headers: headers)
    .timeout(Duration(seconds: 15));

  if (response.statusCode == 401) {
    await AuthService.tryRefreshToken();
    // retry request
  }

  if (response.statusCode != 200) {
    throw Exception(jsonDecode(response.body)['message']);
  }

  return Model.fromJson(jsonDecode(response.body)['data']);
} on TimeoutException {
  throw NetworkException('Request timeout');
} catch (e) {
  rethrow;
}
```

Retry logic: 3 lần, exponential backoff (500ms * attempt).

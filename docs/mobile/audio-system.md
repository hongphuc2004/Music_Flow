# Audio System — musicflow_app

## Tổng quan

Hệ thống audio gồm 3 lớp:

```
┌────────────────────────────────────────┐
│         UI Layer                       │
│  PlayerScreen / MiniPlayer             │
│  MiniPlayerWrapper                     │
└─────────────┬──────────────────────────┘
              │ listen to
┌─────────────▼──────────────────────────┐
│      GlobalAudioState                  │
│      (ChangeNotifier — lib/core/audio/ │
│       global_audio_state.dart)         │
└─────────────┬──────────────────────────┘
              │ controls
┌─────────────▼──────────────────────────┐
│      AudioPlayerService                │
│      (Singleton — audio_player_service │
│       .dart)                           │
│                                        │
│      MusicFlowAudioHandler             │
│      (BaseAudioHandler — audio_handler │
│       .dart)                           │
└─────────────┬──────────────────────────┘
              │
┌─────────────▼──────────────────────────┐
│      just_audio AudioPlayer            │
│      + audio_service (background)      │
│      + audio_session (iOS/Android)     │
└────────────────────────────────────────┘
```

---

## AudioPlayerService (`audio_player_service.dart`)

**Pattern:** Singleton — chỉ 1 instance trong toàn bộ app.

```dart
class AudioPlayerService {
  static final AudioPlayerService _instance = AudioPlayerService._internal();
  factory AudioPlayerService() => _instance;

  late AudioPlayer _player;      // just_audio
  late AudioHandler _handler;    // audio_service
}
```

**Khởi tạo:**
```dart
// Trong main.dart
await AudioService.init(
  builder: () => MusicFlowAudioHandler(),
  config: AudioServiceConfig(
    androidNotificationChannelId: 'com.musicflow.channel',
    androidNotificationChannelName: 'MusicFlow',
    androidNotificationOngoing: true,
    androidStopForegroundOnPause: true,
  ),
);
```

**Các method chính:**
```dart
play(String url, MediaItem mediaItem)  // load URL + bắt đầu phát
pause() / resume()
seek(Duration position)
stop()
setVolume(double volume)               // 0.0 → 1.0
```

---

## MusicFlowAudioHandler (`audio_handler.dart`)

Extends `BaseAudioHandler` từ `audio_service`. Chịu trách nhiệm:
- Handle media button events (tai nghe, lock screen)
- Cập nhật metadata cho notification

```dart
class MusicFlowAudioHandler extends BaseAudioHandler {

  @override
  Future<void> play() async { ... }

  @override
  Future<void> pause() async { ... }

  @override
  Future<void> stop() async { ... }

  @override
  Future<void> seek(Duration position) async { ... }

  @override
  Future<void> skipToNext() async {
    GlobalAudioState().playNext();
  }

  @override
  Future<void> skipToPrevious() async {
    GlobalAudioState().playPrevious();
  }
}
```

**Notification trên Android:**
- Hiển thị: tên bài, nghệ sĩ, ảnh bìa
- Nút điều khiển: Previous | Play/Pause | Next
- `androidNotificationOngoing: true` → không swipe away khi đang phát

---

## GlobalAudioState (`global_audio_state.dart`)

**Pattern:** ChangeNotifier Singleton — đây là "source of truth" cho toàn bộ UI.

### State fields

```dart
Song? currentSong           // bài đang phát
List<Song> queue            // danh sách queue
int currentIndex            // vị trí trong queue
bool isPlaying
bool isLoading              // đang load URL
Duration position           // vị trí phát hiện tại
Duration duration           // tổng thời lượng
RepeatMode repeatMode       // off / all / one
bool isShuffled
List<int> shuffledIndices   // thứ tự shuffle
bool isOffline              // đang phát offline
```

### Phát nhạc

```dart
Future<void> playSong(Song song, {List<Song>? queue, int? index}) async {
  // 1. Set queue
  this.queue = queue ?? [song];
  currentIndex = index ?? 0;
  currentSong = song;

  // 2. Kiểm tra offline
  final localPath = await OfflineSongService().getLocalPath(song.id);
  final String url = localPath != null
    ? 'file://$localPath'
    : ApiConfig.songStreamUrl(song.id);  // GET /api/songs/:id/stream

  // 3. Build MediaItem cho notification
  final mediaItem = MediaItem(
    id: url,
    title: song.title,
    artist: song.artists.join(', '),
    artUri: Uri.parse(song.imageUrl),
    duration: song.duration,
  );

  // 4. Load + play
  await _handler.playMediaItem(mediaItem);

  // 5. Track play history
  PlayHistoryService().addToHistory(song);

  notifyListeners();
}
```

### Auto-next

```dart
// Lắng nghe completion event từ AudioPlayer
_player.playerStateStream.listen((state) {
  if (state.processingState == ProcessingState.completed) {
    _onSongComplete();
  }
});

void _onSongComplete() {
  switch (repeatMode) {
    case RepeatMode.one:  playSong(currentSong!);  break;
    case RepeatMode.all:  playNext();               break;
    case RepeatMode.off:
      if (currentIndex < queue.length - 1) playNext();
      else { isPlaying = false; notifyListeners(); }
  }
}
```

### Shuffle

```dart
void toggleShuffle() {
  isShuffled = !isShuffled;
  if (isShuffled) {
    shuffledIndices = List.generate(queue.length, (i) => i)..shuffle();
    // Đặt bài hiện tại lên đầu shuffle list
    shuffledIndices.remove(currentIndex);
    shuffledIndices.insert(0, currentIndex);
  }
  notifyListeners();
}
```

---

## Luồng phát nhạc hoàn chỉnh

```
User tap bài hát
       │
       ▼
GlobalAudioState.playSong(song, queue: songList)
       │
       ├─ Check OfflineSongService.getLocalPath(song.id)
       │     ├─ Có file local → url = "file:///path/to/song.mp3"
       │     └─ Không có → url = "https://api.../api/songs/:id/stream"
       │
       ▼
AudioPlayerService.play(url, mediaItem)
       │
       ▼
just_audio: AudioPlayer.setUrl(url)
       │     ← HTTP Range request nếu là stream
       │     ← File read nếu là local
       ▼
just_audio: AudioPlayer.play()
       │
       ├─ Cập nhật playbackState cho audio_service
       │     └─ Android notification cập nhật
       │
       └─ playerStateStream emit → GlobalAudioState lắng nghe
             └─ notifyListeners() → UI rebuild
```

---

## Position Tracking

```dart
// Throttled update mỗi 500ms để tránh rebuild quá nhiều
_player.positionStream
  .throttleTime(Duration(milliseconds: 500))
  .listen((pos) {
    position = pos;
    notifyListeners();
  });
```

---

## Seek

```dart
// PlayerScreen: drag progress bar
GlobalAudioState().seek(Duration(seconds: newPosition));
  └─ AudioPlayerService._player.seek(position)
  └─ Cập nhật MediaItem duration cho notification
```

---

## Audio Session (iOS/Android)

```dart
// Cấu hình audio session khi khởi tạo
final session = await AudioSession.instance;
await session.configure(AudioSessionConfiguration.music());
```

- iOS: đăng ký `AVAudioSession` category `.playback` → phát khi khóa màn hình
- Android: `AUDIO_FOCUS_GAIN` → pause khi nhận cuộc gọi, resume sau khi kết thúc

---

## Offline Fallback

Nếu URL stream thất bại (network lỗi) sau khi đã có file local:
```dart
_player.playbackEventStream.listen((event) {
  // nếu lỗi và có local file → retry với file:// URI
});
```

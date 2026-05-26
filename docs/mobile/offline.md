# Offline Downloads — musicflow_app

File: `data/services/offline_song_service.dart` (325 dòng)

---

## Tổng quan

Người dùng có thể tải bài hát về thiết bị để nghe offline. Hệ thống quản lý:
- Tải file từ Cloudinary
- Lưu metadata vào Hive
- LRU eviction khi vượt giới hạn
- Đồng bộ danh sách downloaded với server

---

## Giới hạn

| Tham số | Giá trị |
|---------|---------|
| Dung lượng tối đa | 1 GB |
| Số bài tối đa | 500 bài |
| Eviction policy | LRU (xóa bài ít dùng nhất) |

---

## Storage

### Hive Box: `offline_songs`

```dart
// Mỗi entry trong Hive
class OfflineSongMetadata extends HiveObject {
  String songId;
  String title;
  String artist;
  String imageUrl;
  String localPath;     // file:///path/to/file.mp3
  double duration;      // giây
  int fileSize;         // bytes
  DateTime downloadedAt;
  DateTime lastAccessedAt;  // LRU: cập nhật mỗi khi phát
}
```

### Thư mục lưu file

```
Android: /data/user/0/<package>/files/MusicFlowDownloaded/
iOS:     <Documents>/MusicFlowDownloaded/

Tên file: {songId}_{sanitizedTitle}_{sanitizedArtist}.mp3
Ví dụ: 64f3a2b1_Bài_Hát_Hay_Ca_Sĩ_Nổi_Tiếng.mp3
```

---

## Download Flow

```dart
Future<void> downloadSong(Song song) async {
  // 1. Kiểm tra đã download chưa
  if (await isDownloaded(song.id)) return;

  // 2. Kiểm tra quota
  await _enforceQuotaIfNeeded();

  // 3. Request permission từ server + lấy audio URL
  final response = await http.post(
    '/api/songs/${song.id}/download',
    headers: authHeaders,
  );
  final audioUrl = response.data['audioUrl'];

  // 4. Download file
  final fileName = '${song.id}_${_sanitize(song.title)}_...mp3';
  final localPath = '${await _getDownloadDir()}/$fileName';

  final httpResponse = await http.get(Uri.parse(audioUrl));
  await File(localPath).writeAsBytes(httpResponse.bodyBytes);

  // 5. Lưu metadata vào Hive
  final box = Hive.box<OfflineSongMetadata>('offline_songs');
  await box.put(song.id, OfflineSongMetadata(
    songId: song.id,
    title: song.title,
    artist: song.artists.join(', '),
    imageUrl: song.imageUrl,
    localPath: localPath,
    duration: song.duration?.inSeconds.toDouble() ?? 0,
    fileSize: httpResponse.bodyBytes.length,
    downloadedAt: DateTime.now(),
    lastAccessedAt: DateTime.now(),
  ));
}
```

---

## LRU Eviction

Khi sắp vượt giới hạn, xóa bài **ít được phát nhất gần đây**:

```dart
Future<void> _enforceQuotaIfNeeded() async {
  final box = Hive.box<OfflineSongMetadata>('offline_songs');
  final totalSize = box.values.fold(0, (sum, m) => sum + m.fileSize);
  final count = box.length;

  // Kiểm tra vượt giới hạn
  if (totalSize < 1024 * 1024 * 1024 && count < 500) return;

  // Sắp xếp theo lastAccessedAt tăng dần (ít dùng nhất → đầu)
  final sorted = box.values.toList()
    ..sort((a, b) => a.lastAccessedAt.compareTo(b.lastAccessedAt));

  // Xóa bài ít dùng nhất cho đến khi đủ quota
  for (final metadata in sorted) {
    await _deleteLocal(metadata);
    if (box.length < 490 && await _getTotalSize() < 900 * 1024 * 1024) break;
  }
}
```

---

## Phát offline

```dart
// Trong GlobalAudioState.playSong()
Future<String> _resolveAudioUrl(Song song) async {
  final metadata = OfflineSongService().getMetadata(song.id);

  if (metadata != null) {
    // Cập nhật lastAccessedAt (LRU tracking)
    metadata.lastAccessedAt = DateTime.now();
    await metadata.save();

    return 'file://${metadata.localPath}';
  }

  // Fallback: stream từ server
  return ApiConfig.songStreamUrl(song.id);
}
```

---

## Download Status trong UI

```dart
// PlayerBottomActionBar hoặc SongOptionsMenu
StreamBuilder<DownloadState>(
  stream: OfflineSongService().watchDownloadState(song.id),
  builder: (context, snapshot) {
    final state = snapshot.data ?? DownloadState.notDownloaded;
    switch (state) {
      case DownloadState.notDownloaded:
        return IconButton(
          icon: Icon(Icons.download_outlined),
          onPressed: () => OfflineSongService().downloadSong(song),
        );
      case DownloadState.downloading:
        return CircularProgressIndicator(strokeWidth: 2);
      case DownloadState.downloaded:
        return IconButton(
          icon: Icon(Icons.download_done, color: Colors.green),
          onPressed: () => _showDeleteDialog(song),
        );
    }
  },
)
```

---

## Download Sync với Server

Mục đích: server biết user đã download bài nào (analytics + cross-device).

```dart
// Chạy khi app khởi động hoặc sau download mới
Future<void> syncDownloadsWithServer() async {
  final downloadedIds = OfflineSongService()
    .getAllMetadata()
    .map((m) => m.songId)
    .toList();

  await http.post(
    '/api/songs/download-history/sync',
    headers: authHeaders,
    body: jsonEncode({'songIds': downloadedIds}),
  );
}
```

---

## Xóa bài đã download

```dart
Future<void> deleteSong(String songId) async {
  final box = Hive.box<OfflineSongMetadata>('offline_songs');
  final metadata = box.get(songId);

  if (metadata != null) {
    // Xóa file vật lý
    final file = File(metadata.localPath);
    if (await file.exists()) {
      await file.delete();
    }

    // Xóa metadata khỏi Hive
    await box.delete(songId);
  }
}
```

---

## API liên quan (backend)

| Endpoint | Mục đích |
|----------|---------|
| `POST /api/songs/:id/download` | Ghi nhận download event, trả về audioUrl |
| `GET /api/songs/download-history` | Lấy danh sách songId đã download |
| `POST /api/songs/download-history/sync` | Đồng bộ danh sách từ client lên server |

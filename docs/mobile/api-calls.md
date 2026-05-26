# API Integration — musicflow_app

## Services Layer

Tất cả HTTP calls được đóng gói trong `data/services/`. Không gọi `http.*` trực tiếp trong widget/screen.

```
data/services/
├─ auth_service.dart           ← Auth, token management
├─ song_api_service.dart       ← Songs (697 dòng — lớn nhất)
├─ playlist_api_service.dart   ← Playlist CRUD (417 dòng)
├─ artist_api_service.dart     ← Artist profile + follow
├─ favorite_service.dart       ← Favorites
├─ like_service.dart           ← Song likes
├─ comment_service.dart        ← Comments + reactions (324 dòng)
├─ topic_api_service.dart      ← Topics/genres
├─ lyrics_api_service.dart     ← LRC lyrics
├─ offline_song_service.dart   ← Download management (325 dòng)
└─ play_history_service.dart   ← Local play history
```

---

## Base HTTP Config

```dart
// lib/core/config/api_config.dart
class ApiConfig {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:5001',
  );

  // Helpers
  static String songStreamUrl(String id) => '$baseUrl/api/songs/$id/stream';
  static String songLyricsUrl(String id) => '$baseUrl/api/songs/$id/lyrics';
}
```

**Headers chuẩn với auth:**
```dart
Future<Map<String, String>> _authHeaders() async {
  final token = await AuthService.getAccessToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer $token',
  };
}
```

---

## SongApiService

```dart
class SongApiService {
  // Lấy tất cả bài public
  static Future<List<Song>> getSongs() async
    → GET /api/songs

  // 12 bài random
  static Future<List<Song>> getRecommended() async
    → GET /api/songs/recommended

  // Tìm kiếm
  static Future<Map<String, dynamic>> search(String query) async
    → GET /api/songs/search?q={query}
    → Returns { songs: [], artists: [] }

  // Trending flowchart
  static Future<Map<String, dynamic>> getFlowchart() async
    → GET /api/songs/flowchart

  // Bài theo nghệ sĩ
  static Future<List<Song>> getSongsByArtist(String artistId, {int page = 1}) async
    → GET /api/songs/by-artist?artistId={id}&page={page}&limit=20

  // Bài tôi đã upload
  static Future<List<Song>> getMyUploads() async
    → GET /api/songs/my-uploads  [auth]

  // Toggle public
  static Future<void> togglePublic(String songId) async
    → PATCH /api/songs/{id}/toggle-public  [auth]

  // Upload bài mới
  static Future<Song> uploadSong({
    required String title,
    required File audioFile,
    File? imageFile,
    required List<String> artistIds,
    List<String>? topicIds,
    String? lyrics,
  }) async
    → POST /api/songs (multipart/form-data)  [auth]

  // Xóa bài
  static Future<void> deleteSong(String songId) async
    → DELETE /api/songs/{id}  [auth]
}
```

---

## PlaylistApiService

```dart
class PlaylistApiService {
  // System playlists (admin-created)
  static Future<List<Playlist>> getSystemPlaylists() async
    → GET /api/playlists/system

  // Playlist của user
  static Future<List<Playlist>> getUserPlaylists() async
    → GET /api/playlists  [auth]

  // Chi tiết playlist
  static Future<Playlist> getPlaylistById(String id) async
    → GET /api/playlists/{id}  [auth]

  // Tạo mới
  static Future<Playlist> createPlaylist(String name, {String? description}) async
    → POST /api/playlists  [auth]

  // Thêm bài
  static Future<void> addSong(String playlistId, String songId) async
    → POST /api/playlists/{id}/songs  [auth]

  // Xóa bài
  static Future<void> removeSong(String playlistId, String songId) async
    → DELETE /api/playlists/{id}/songs/{songId}  [auth]

  // Xóa playlist
  static Future<void> deletePlaylist(String playlistId) async
    → DELETE /api/playlists/{id}  [auth]

  // Sắp xếp lại
  static Future<void> reorderSongs(String playlistId, List<String> songIds) async
    → PUT /api/playlists/{id}/reorder  [auth]
}
```

---

## FavoriteService

```dart
class FavoriteService {
  static Future<List<Song>> getFavorites() async
    → GET /api/favorites  [auth]

  static Future<bool> toggleFavorite(String songId) async
    → POST /api/favorites/toggle/{songId}  [auth]
    → Returns: isFavorited (bool)

  static Future<bool> isFavorited(String songId) async
    → GET /api/favorites/check/{songId}  [auth]
}
```

---

## LikeService

```dart
class LikeService {
  static Future<Map<String, dynamic>> getLikeStatus(String songId) async
    → GET /api/song-likes/status/{songId}  [auth]
    → Returns: { isLiked: bool, likeCount: int }

  static Future<void> toggleLike(String songId) async
    → POST /api/song-likes/toggle/{songId}  [auth]
}
```

---

## CommentService

```dart
class CommentService {
  // Lấy comments (paginated)
  static Future<Map<String, dynamic>> getComments(
    String songId, {int page = 1, String sort = 'newest'}
  ) async
    → GET /api/comments/song/{songId}?page={page}&sort={sort}

  // Gửi comment
  static Future<Comment> createComment(
    String songId, String content, {String? parentCommentId}
  ) async
    → POST /api/comments  [auth]

  // Sửa comment
  static Future<void> editComment(String commentId, String content) async
    → PUT /api/comments/{id}  [auth]

  // Xóa comment
  static Future<void> deleteComment(String commentId) async
    → DELETE /api/comments/{id}  [auth]

  // React
  static Future<void> addReaction(String commentId) async
    → PUT /api/comments/{id}/reactions  [auth]

  static Future<void> removeReaction(String commentId) async
    → DELETE /api/comments/{id}/reactions  [auth]
}
```

---

## ArtistApiService

```dart
class ArtistApiService {
  // Profile nghệ sĩ (by name hoặc id)
  static Future<ArtistProfile> getProfile({String? name, String? id}) async
    → GET /api/artist/profile?name={name}  hoặc  ?id={id}

  // Trạng thái follow
  static Future<bool> getFollowStatus(String artistId) async
    → GET /api/artist/{id}/follow-status  [auth]

  // Toggle follow
  static Future<bool> toggleFollow(String artistId) async
    → POST /api/artist/{id}/follow  [auth]
    → Returns: isFollowing (bool)
}
```

---

## TopicApiService

```dart
class TopicApiService {
  static Future<List<Topic>> getTopics() async
    → GET /api/topics

  static Future<List<Song>> getSongsByTopic(String topicId) async
    → GET /api/topics/{topicId}/songs
}
```

---

## LyricsApiService

```dart
class LyricsApiService {
  static Future<List<LrcLine>> getLyrics(String songId) async {
    final response = await http.get(
      Uri.parse(ApiConfig.songLyricsUrl(songId))
    );

    final rawLyrics = jsonDecode(response.body)['data']['lyrics'] as String?;
    if (rawLyrics == null || rawLyrics.isEmpty) return [];

    return LrcParser.parse(rawLyrics);
  }
}
```

---

## Error Handling Pattern

```dart
// Pattern dùng trong tất cả services
Future<List<Song>> getSongs() async {
  try {
    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/songs'),
    ).timeout(Duration(seconds: 15));

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return (data['data'] as List).map((j) => Song.fromJson(j)).toList();
    }

    if (response.statusCode == 401) {
      final refreshed = await AuthService.tryRefreshToken();
      if (refreshed) return getSongs(); // retry
      throw UnauthorizedException();
    }

    throw ApiException(jsonDecode(response.body)['message'] ?? 'Unknown error');

  } on TimeoutException {
    throw NetworkException('Request timed out');
  } on SocketException {
    throw NetworkException('No internet connection');
  }
}
```

**Retry logic:**
```dart
// 3 attempts với exponential backoff
for (int attempt = 1; attempt <= 3; attempt++) {
  try {
    return await _makeRequest();
  } catch (e) {
    if (attempt == 3) rethrow;
    await Future.delayed(Duration(milliseconds: 500 * attempt));
  }
}
```

---

## Song Model — JSON Parsing

Song model có parsing linh hoạt vì backend trả về nhiều format khác nhau:

```dart
// song_model.dart
factory Song.fromJson(Map<String, dynamic> json) {
  // artists: có thể là [String], [{"name": ...}], hoặc [{_id, name}]
  List<String> parseArtists(dynamic raw) {
    if (raw == null) return [];
    if (raw is List) {
      return raw.map((a) {
        if (a is String) return a;
        if (a is Map) return a['name']?.toString() ?? '';
        return '';
      }).where((s) => s.isNotEmpty).toList();
    }
    return [];
  }

  // playCount: có thể là playCount, listenCount, streamCount, viewCount
  int parsePlayCount(Map json) {
    return json['playCount'] ?? json['listenCount'] ??
           json['streamCount'] ?? json['viewCount'] ?? 0;
  }

  return Song(
    id: json['_id'] ?? json['id'] ?? '',
    title: json['title'] ?? '',
    artists: parseArtists(json['artists']),
    audioUrl: json['audioUrl'] ?? '',
    imageUrl: json['imageUrl'] ?? '',
    duration: _parseDuration(json['duration']),
    playCount: parsePlayCount(json),
    likeCount: json['likeCount'] ?? 0,
    isPublic: json['isPublic'] ?? false,
    source: json['source'] ?? 'admin',
    allowDownload: json['allowDownload'] ?? true,
  );
}
```

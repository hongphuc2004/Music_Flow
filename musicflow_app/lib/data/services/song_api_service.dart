import 'dart:convert';
import 'dart:async';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:musicflow_app/core/config/api_config.dart';
import '../models/song_model.dart';
import 'auth_service.dart';

class SearchArtist {
  final String id;
  final String name;
  final String avatar;

  const SearchArtist({
    required this.id,
    required this.name,
    required this.avatar,
  });

  factory SearchArtist.fromJson(Map<String, dynamic> json) {
    return SearchArtist(
      id: json['_id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      avatar: json['avatar']?.toString() ?? '',
    );
  }
}

class SearchResult {
  final List<Song> songs;
  final List<SearchArtist> artists;

  const SearchResult({
    required this.songs,
    required this.artists,
  });
}

class SongApiService {
    /// Lay headers voi token
    static Future<Map<String, String>> _getAuthHeaders() async {
      final token = await AuthService.getToken();
      return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      };
    }
  static const String baseUrl = ApiConfig.songsEndpoint;
  static const Duration timeout = Duration(seconds: 15); // Timeout 15 giay
  static const int maxRetries = 3; // So lan retry toi da

  /// Fetch voi retry va timeout
  static Future<http.Response> _getWithRetry(Uri uri) async {
    int attempts = 0;
    
    while (attempts < maxRetries) {
      try {
        attempts++;
        final response = await http.get(uri).timeout(timeout);
        return response;
        
      } on TimeoutException {
        if (attempts >= maxRetries) {
          throw NetworkException('Kết nối quá chậm. Vui lòng kiểm tra mạng.');
        }
      } on SocketException {
        if (attempts >= maxRetries) {
          throw NetworkException('Không có kết nối mạng.');
        }
      } catch (e) {
        if (attempts >= maxRetries) {
          throw NetworkException('Lỗi kết nối: $e');
        }
      }
      
      // Ch? tru?c khi retry (exponential backoff)
      await Future.delayed(Duration(milliseconds: 500 * attempts));
    }
    
    throw NetworkException('Không thể kết nối sau $maxRetries lần thử.');
  }

  static Future<List<Song>> fetchSongs() async {
    final response = await _getWithRetry(Uri.parse(baseUrl));

    if (response.statusCode == 200) {
      final List data = json.decode(response.body);
      return data.map((e) => Song.fromJson(e)).toList();
    } else {
      throw NetworkException("Server l?i (${response.statusCode})");
    }
  }

  /// Lay danh sach bai hat goi y (random)
  static Future<List<Song>> fetchRecommendedSongs({int limit = 12}) async {
    final uri = Uri.parse("$baseUrl/recommended?limit=$limit");
    final response = await _getWithRetry(uri);

    if (response.statusCode == 200) {
      final List data = json.decode(response.body);
      return data.map((e) => Song.fromJson(e)).toList();
    } else {
      throw NetworkException("Lấy gợi ý thất bại");
    }
  }

  /// L?y d? li?u Flowchart theo gi? (real data t? backend)
  static Future<FlowchartDataResult> fetchFlowchartData({
    int hours = 12,
    int limit = 50,
    String mode = 'flow',
  }) async {
    final queryParams = <String, String>{
      'hours': '$hours',
      'limit': '$limit',
      'mode': mode,
    };

    final uri = Uri.parse('$baseUrl/flowchart').replace(queryParameters: queryParams);
    final response = await _getWithRetry(uri);

    if (response.statusCode != 200) {
      throw NetworkException('Khong the tai du lieu Flowchart (${response.statusCode})');
    }

    final data = json.decode(response.body) as Map<String, dynamic>;
    List<String> timeSlots;
    final timestampSlots = (data['timeSlotTimestamps'] as List<dynamic>? ?? const [])
        .map((e) => e.toString())
        .where((e) => e.isNotEmpty)
        .toList();

    if (timestampSlots.isNotEmpty) {
      timeSlots = timestampSlots.map(_toLocalHourLabel).toList();
    } else {
      timeSlots = (data['timeSlots'] as List<dynamic>? ?? const [])
          .map((e) => e.toString())
          .toList();
    }

    final topSongs = (data['topSongs'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(Song.fromJson)
        .toList();

    final chartSeriesBySongId = <String, List<double>>{};
    final rawSeries = (data['chartSeries'] as List<dynamic>? ?? const []);
    for (final raw in rawSeries) {
      if (raw is! Map<String, dynamic>) {
        continue;
      }

      final songId = raw['songId']?.toString();
      if (songId == null || songId.isEmpty) {
        continue;
      }

      final points = (raw['points'] as List<dynamic>? ?? const [])
          .map((e) => (e as num?)?.toDouble() ?? 0.0)
          .toList();
      chartSeriesBySongId[songId] = points;
    }

    final songMetricsBySongId = <String, FlowchartSongMetrics>{};
    final rawMetrics = (data['songMetrics'] as List<dynamic>? ?? const []);
    for (final raw in rawMetrics) {
      if (raw is! Map<String, dynamic>) {
        continue;
      }

      final songId = raw['songId']?.toString();
      if (songId == null || songId.isEmpty) {
        continue;
      }

      songMetricsBySongId[songId] = FlowchartSongMetrics(
        last24h: (raw['last24h'] as num?)?.toInt() ?? 0,
        previous24h: (raw['previous24h'] as num?)?.toInt() ?? 0,
        risingScore: (raw['risingScore'] as num?)?.toInt() ?? 0,
      );
    }

    return FlowchartDataResult(
      hours: (data['hours'] as num?)?.toInt() ?? hours,
      rankingMode: data['rankingMode']?.toString() ?? mode,
      timeSlots: timeSlots,
      topSongs: topSongs,
      chartSeriesBySongId: chartSeriesBySongId,
      songMetricsBySongId: songMetricsBySongId,
    );
  }

  static String _toLocalHourLabel(String rawIso) {
    try {
      final local = DateTime.parse(rawIso).toLocal();
      return local.hour.toString().padLeft(2, '0');
    } catch (_) {
      return rawIso;
    }
  }

  /// Tim kiem bai hat theo query (ten bai hat hoac ca si)
  static Future<List<Song>> searchSongs({
    String? query,
    String? artist,
    String? letter,
  }) async {
    final queryParams = <String, String>{};
    
    if (query != null && query.isNotEmpty) {
      queryParams['query'] = query;
    }
    if (artist != null && artist.isNotEmpty) {
      queryParams['artist'] = artist;
    }
    if (letter != null && letter.isNotEmpty) {
      queryParams['letter'] = letter;
    }

    final uri = Uri.parse("$baseUrl/search").replace(queryParameters: queryParams);
    final response = await _getWithRetry(uri);

    if (response.statusCode == 200) {
      final List data = json.decode(response.body);
      return data.map((e) => Song.fromJson(e)).toList();
    } else {
      throw NetworkException("Tìm kiếm thất bại");
    }
  }

  static Future<SearchResult> searchAll({
    String? query,
    String? artist,
    String? letter,
  }) async {
    final queryParams = <String, String>{
      'includeArtists': 'true',
    };

    if (query != null && query.isNotEmpty) {
      queryParams['query'] = query;
    }
    if (artist != null && artist.isNotEmpty) {
      queryParams['artist'] = artist;
    }
    if (letter != null && letter.isNotEmpty) {
      queryParams['letter'] = letter;
    }

    final uri = Uri.parse("$baseUrl/search").replace(queryParameters: queryParams);
    final response = await _getWithRetry(uri);

    if (response.statusCode != 200) {
      throw NetworkException("Tìm kiếm thất bại");
    }

    final dynamic decoded = json.decode(response.body);
    if (decoded is! Map<String, dynamic>) {
      return const SearchResult(songs: [], artists: []);
    }

    final songs = (decoded['songs'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(Song.fromJson)
        .toList();

    final artists = (decoded['artists'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(SearchArtist.fromJson)
        .toList();

    return SearchResult(songs: songs, artists: artists);
  }

  /// Upload bai hat moi (audio + image) - YEU CAU DANG NHAP
  static Future<UploadResult> uploadSong({
    required File audioFile,
    File? imageFile,
    String? title,
    String? artist,
    String? topicId,
    String? lyrics,
    bool isPublic = false,
    void Function(double)? onProgress,
  }) async {
    try {
      // L?y token
      final token = await AuthService.getToken();
      if (token == null) {
        return UploadResult(
          success: false,
          message: 'Vui lòng đăng nhập để upload',
        );
      }

      // Ki?m tra file t?n t?i
      if (!await audioFile.exists()) {
        return UploadResult(
          success: false,
          message: 'File audio không tồn tại',
        );
      }

      final uri = Uri.parse(baseUrl);
      final request = http.MultipartRequest('POST', uri);
      
      // Them auth header
      request.headers['Authorization'] = 'Bearer $token';

      // Them text fields
      final normalizedTitle = (title ?? '').trim();
      final normalizedArtist = (artist ?? '').trim();

      if (normalizedTitle.isNotEmpty) {
        request.fields['title'] = normalizedTitle;
      }
      if (normalizedArtist.isNotEmpty) {
        request.fields['artists'] = jsonEncode([normalizedArtist]);
      }
      request.fields['isPublic'] = isPublic.toString();
      if (topicId != null && topicId.isNotEmpty) {
        request.fields['topicIds'] = jsonEncode([topicId]);
      }
      if (lyrics != null && lyrics.isNotEmpty) {
        request.fields['lyrics'] = lyrics;
      }

      // Them file audio
      request.files.add(await http.MultipartFile.fromPath(
        'audio',
        audioFile.path,
      ));

      // Them file image neu co
      if (imageFile != null && await imageFile.exists()) {
        request.files.add(await http.MultipartFile.fromPath(
          'image',
          imageFile.path,
        ));
      }

      // G?i request
      final streamedResponse = await request.send().timeout(
        const Duration(minutes: 5),
      );

      final response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode == 201) {
        final data = json.decode(response.body);
        return UploadResult(
          success: true,
          message: data['message'] ?? 'Upload thành công!',
          song: Song.fromJson(data['song']),
        );
      } else {
        final errorData = json.decode(response.body);
        return UploadResult(
          success: false,
          message: errorData['message'] ?? 'Upload thất bại',
        );
      }
    } on TimeoutException {
      return UploadResult(
        success: false,
        message: 'Upload quá lâu. Vui lòng thử lại.',
      );
    } on SocketException {
      return UploadResult(
        success: false,
        message: 'Không có kết nối mạng.',
      );
    } catch (e) {
      return UploadResult(
        success: false,
        message: 'Lỗi upload: $e',
      );
    }
  }

  /// Lay danh sach bai hat user da upload
  static Future<MyUploadsResult> getMyUploads() async {
    try {
      final token = await AuthService.getToken();
      if (token == null) {
        return MyUploadsResult(
          success: false,
          message: 'Vui lòng đăng nhập',
        );
      }

      final response = await http.get(
        Uri.parse('$baseUrl/my-uploads'),
        headers: {'Authorization': 'Bearer $token'},
      ).timeout(timeout);

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final songs = (data['songs'] as List)
            .map((e) => Song.fromJson(e))
            .toList();
        return MyUploadsResult(
          success: true,
          songs: songs,
        );
      } else {
        return MyUploadsResult(
          success: false,
          message: 'Lấy danh sách thất bại',
        );
      }
    } catch (e) {
      return MyUploadsResult(
        success: false,
        message: 'Lỗi: $e',
      );
    }
  }

  /// Cap nhat thong tin bai hat
  static Future<UploadResult> updateSong({
    required String songId,
    String? title,
    String? artist,
    String? lyrics,
  }) async {
    try {
      final token = await AuthService.getToken();
      if (token == null) {
        return UploadResult(success: false, message: 'Vui lòng đăng nhập');
      }

      final body = <String, dynamic>{};
      if (title != null) body['title'] = title;
      if (artist != null) body['artists'] = [artist];
      if (lyrics != null) body['lyrics'] = lyrics;

      final response = await http.put(
        Uri.parse('$baseUrl/$songId'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: json.encode(body),
      ).timeout(timeout);

      final data = json.decode(response.body);

      if (response.statusCode == 200) {
        return UploadResult(
          success: true,
          message: data['message'] ?? 'Cập nhật thành công',
          song: Song.fromJson(data['song']),
        );
      } else {
        return UploadResult(
          success: false,
          message: data['message'] ?? 'Cập nhật thất bại',
        );
      }
    } catch (e) {
      return UploadResult(success: false, message: 'Lỗi: $e');
    }
  }

  /// Toggle public/private
  static Future<TogglePublicResult> togglePublic(String songId) async {
    try {
      final token = await AuthService.getToken();
      if (token == null) {
        return TogglePublicResult(success: false, message: 'Vui lòng đăng nhập');
      }
      http.Response response = await http.patch(
        Uri.parse('$baseUrl/$songId/toggle-public'),
        headers: await _getAuthHeaders(),
      ).timeout(timeout);
      if (response.statusCode == 401) {
        final refreshed = await AuthService.tryRefreshToken();
        if (refreshed) {
          response = await http.patch(
            Uri.parse('$baseUrl/$songId/toggle-public'),
            headers: await _getAuthHeaders(),
          ).timeout(timeout);
        }
      }
      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['success'] == true) {
        return TogglePublicResult(success: true, message: data['message'] ?? 'Thành công');
      } else {
        return TogglePublicResult(success: false, message: data['message'] ?? 'Thay đổi thất bại');
      }
    } catch (e) {
      return TogglePublicResult(success: false, message: 'Lỗi: $e');
    }
  }

  /// Xoa bai hat
  static Future<DeleteResult> deleteSong(String songId) async {
    try {
      final token = await AuthService.getToken();
      if (token == null) {
        return DeleteResult(success: false, message: 'Vui lòng đăng nhập');
      }

      final response = await http.delete(
        Uri.parse('$baseUrl/$songId'),
        headers: {'Authorization': 'Bearer $token'},
      ).timeout(timeout);

      final data = json.decode(response.body);

      return DeleteResult(
        success: response.statusCode == 200,
        message: data['message'] ?? (response.statusCode == 200 ? 'Đã xóa' : 'Xóa thất bại'),
      );
    } catch (e) {
      return DeleteResult(success: false, message: 'Lỗi: $e');
    }
  }

  /// Xin quyen tai bai hat tu backend
  static Future<DownloadSongApiResult> requestDownloadSong(String songId) async {
    try {
      final token = await AuthService.getToken();
      if (token == null) {
        return DownloadSongApiResult(
          success: false,
          message: 'Vui long dang nhap de tai bai hat',
        );
      }

      final response = await http.post(
        Uri.parse('$baseUrl/$songId/download'),
        headers: {'Authorization': 'Bearer $token'},
      ).timeout(timeout);

      final data = json.decode(response.body) as Map<String, dynamic>;

      if (response.statusCode == 200) {
        return DownloadSongApiResult(
          success: true,
          message: data['message'] ?? 'Co the tai bai hat',
          audioUrl: data['audioUrl'],
        );
      }

      return DownloadSongApiResult(
        success: false,
        message: data['message'] ?? 'Khong the tai bai hat',
      );
    } on TimeoutException {
      return DownloadSongApiResult(
        success: false,
        message: 'Het thoi gian cho khi xin quyen tai bai hat',
      );
    } on SocketException {
      return DownloadSongApiResult(
        success: false,
        message: 'Khong co ket noi mang',
      );
    } catch (e) {
      return DownloadSongApiResult(
        success: false,
        message: 'Loi request download: $e',
      );
    }
  }

  /// Dong bo danh sach bai da tai local len server de web/mobile cung thay
  static Future<bool> syncDownloadHistory(List<String> songIds) async {
    try {
      final token = await AuthService.getToken();
      if (token == null) return false;

      final normalized = songIds
          .map((id) => id.trim())
          .where((id) => id.isNotEmpty)
          .toSet()
          .toList();
      if (normalized.isEmpty) return true;

      final response = await http.post(
        Uri.parse('$baseUrl/download-history/sync'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'songIds': normalized}),
      ).timeout(timeout);

      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}

/// K?t qu? upload
class UploadResult {
  final bool success;
  final String message;
  final Song? song;

  UploadResult({
    required this.success,
    required this.message,
    this.song,
  });
}

/// Ket qua lay danh sach upload
class MyUploadsResult {
  final bool success;
  final String? message;
  final List<Song> songs;

  MyUploadsResult({
    required this.success,
    this.message,
    this.songs = const [],
  });
}

/// K?t qu? toggle public
class TogglePublicResult {
  final bool success;
  final String message;
  final bool? isPublic;

  TogglePublicResult({
    required this.success,
    required this.message,
    this.isPublic,
  });
}

/// Ket qua xoa
class DeleteResult {
  final bool success;
  final String message;

  DeleteResult({required this.success, required this.message});
}

/// Ket qua xin quyen tai bai hat tu backend
class DownloadSongApiResult {
  final bool success;
  final String message;
  final String? audioUrl;

  DownloadSongApiResult({
    required this.success,
    required this.message,
    this.audioUrl,
  });
}

/// K?t qu? l?y d? li?u Flowchart
class FlowchartDataResult {
  final int hours;
  final String rankingMode;
  final List<String> timeSlots;
  final List<Song> topSongs;
  final Map<String, List<double>> chartSeriesBySongId;
  final Map<String, FlowchartSongMetrics> songMetricsBySongId;

  FlowchartDataResult({
    required this.hours,
    required this.rankingMode,
    required this.timeSlots,
    required this.topSongs,
    required this.chartSeriesBySongId,
    required this.songMetricsBySongId,
  });
}

class FlowchartSongMetrics {
  final int last24h;
  final int previous24h;
  final int risingScore;

  FlowchartSongMetrics({
    required this.last24h,
    required this.previous24h,
    required this.risingScore,
  });
}

/// Custom exception cho network errors
class NetworkException implements Exception {
  final String message;
  NetworkException(this.message);
  
  @override
  String toString() => message;
}

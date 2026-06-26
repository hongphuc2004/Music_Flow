import 'dart:convert';
import 'dart:async';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:musicflow_app/core/config/api_config.dart';
import 'package:musicflow_app/core/config/api_client.dart';
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

  const SearchResult({required this.songs, required this.artists});
}

class SongApiService {
  static const String baseUrl = ApiConfig.songsEndpoint;

  static Future<List<Song>> fetchSongs() async {
    final response = await ApiClient.get(
      Uri.parse(baseUrl).replace(queryParameters: const {'page': '1', 'limit': '50'}),
    );

    if (response.statusCode == 200) {
      final List data = json.decode(response.body);
      return data.map((e) => Song.fromJson(e)).toList();
    } else {
      throw NetworkException("Server lỗi (${response.statusCode})");
    }
  }

  /// Lấy danh sách bài hát gợi ý (random)
  static Future<List<Song>> fetchRecommendedSongs({int limit = 12}) async {
    final uri = Uri.parse("$baseUrl/recommended?limit=$limit");
    final response = await ApiClient.get(uri);

    if (response.statusCode == 200) {
      final List data = json.decode(response.body);
      return data.map((e) => Song.fromJson(e)).toList();
    } else {
      throw NetworkException("Lấy gợi ý thất bại");
    }
  }

  /// Lấy dữ liệu Flowchart theo giờ (real data từ backend)
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

    final uri = Uri.parse(
      '$baseUrl/flowchart',
    ).replace(queryParameters: queryParams);
    final response = await ApiClient.get(uri);

    if (response.statusCode != 200) {
      throw NetworkException(
        'Không thể tải dữ liệu bảng xếp hạng (${response.statusCode})',
      );
    }

    final data = json.decode(response.body) as Map<String, dynamic>;
    List<String> timeSlots;
    final timestampSlots =
        (data['timeSlotTimestamps'] as List<dynamic>? ?? const [])
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

  /// Tìm kiếm bài hát theo query (tên bài hát hoặc ca sĩ)
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

    final uri = Uri.parse(
      "$baseUrl/search",
    ).replace(queryParameters: queryParams);
    final response = await ApiClient.get(uri);

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
    final queryParams = <String, String>{'includeArtists': 'true'};

    if (query != null && query.isNotEmpty) {
      queryParams['query'] = query;
    }
    if (artist != null && artist.isNotEmpty) {
      queryParams['artist'] = artist;
    }
    if (letter != null && letter.isNotEmpty) {
      queryParams['letter'] = letter;
    }

    final uri = Uri.parse(
      "$baseUrl/search",
    ).replace(queryParameters: queryParams);
    final response = await ApiClient.get(uri);

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

  /// Upload bài hát mới (audio + image) - YÊU CẦU ĐĂNG NHẬP
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
      final token = await AuthService.getToken();
      if (token == null) {
        return UploadResult(
          success: false,
          message: 'Vui lòng đăng nhập để upload',
        );
      }

      if (!await audioFile.exists()) {
        return UploadResult(
          success: false,
          message: 'File audio không tồn tại',
        );
      }

      final uri = Uri.parse(baseUrl);
      final request = http.MultipartRequest('POST', uri);
      request.headers['Authorization'] = 'Bearer $token';

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

      request.files.add(
        await http.MultipartFile.fromPath('audio', audioFile.path),
      );

      if (imageFile != null && await imageFile.exists()) {
        request.files.add(
          await http.MultipartFile.fromPath('image', imageFile.path),
        );
      }

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
      return UploadResult(success: false, message: 'Không có kết nối mạng.');
    } catch (e) {
      return UploadResult(success: false, message: 'Lỗi upload: $e');
    }
  }

  /// Lấy danh sách bài hát user đã upload
  static Future<MyUploadsResult> getMyUploads() async {
    try {
      final response = await ApiClient.get(
        Uri.parse('$baseUrl/my-uploads'),
        requireAuth: true,
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final songs = (data['songs'] as List)
            .map((e) => Song.fromJson(e))
            .toList();
        return MyUploadsResult(success: true, songs: songs);
      } else {
        return MyUploadsResult(
          success: false,
          message: 'Lấy danh sách thất bại',
        );
      }
    } catch (e) {
      return MyUploadsResult(success: false, message: 'Lỗi: $e');
    }
  }

  /// Cập nhật thông tin bài hát
  static Future<UploadResult> updateSong({
    required String songId,
    String? title,
    String? artist,
    String? lyrics,
  }) async {
    try {
      final body = <String, dynamic>{};
      if (title != null) body['title'] = title;
      if (artist != null) body['artists'] = [artist];
      if (lyrics != null) body['lyrics'] = lyrics;

      final response = await ApiClient.put(
        Uri.parse('$baseUrl/$songId'),
        body: body,
      );

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
      final response = await ApiClient.patch(
        Uri.parse('$baseUrl/$songId/toggle-public'),
      );
      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['success'] == true) {
        return TogglePublicResult(
          success: true,
          message: data['message'] ?? 'Thành công',
        );
      } else {
        return TogglePublicResult(
          success: false,
          message: data['message'] ?? 'Thay đổi thất bại',
        );
      }
    } catch (e) {
      return TogglePublicResult(success: false, message: 'Lỗi: $e');
    }
  }

  /// Xoa bài hát
  static Future<DeleteResult> deleteSong(String songId) async {
    try {
      final response = await ApiClient.delete(
        Uri.parse('$baseUrl/$songId'),
      );

      final data = json.decode(response.body);

      return DeleteResult(
        success: response.statusCode == 200,
        message:
            data['message'] ??
            (response.statusCode == 200 ? 'Đã xóa' : 'Xóa thất bại'),
      );
    } catch (e) {
      return DeleteResult(success: false, message: 'Lỗi: $e');
    }
  }

  /// Xin quyền tải bài hát từ backend
  static Future<DownloadSongApiResult> requestDownloadSong(
    String songId,
  ) async {
    try {
      final response = await ApiClient.post(
        Uri.parse('$baseUrl/$songId/download'),
      );

      final data = json.decode(response.body) as Map<String, dynamic>;

      if (response.statusCode == 200) {
        return DownloadSongApiResult(
          success: true,
          message: data['message'] ?? 'Có thể tải bài hát',
          audioUrl: data['audioUrl'],
        );
      }

      return DownloadSongApiResult(
        success: false,
        message: data['message'] ?? 'Không thể tải bài hát',
      );
    } on NetworkException catch (ne) {
      return DownloadSongApiResult(
        success: false,
        message: ne.message,
      );
    } catch (e) {
      return DownloadSongApiResult(
        success: false,
        message: 'Loi request download: $e',
      );
    }
  }

  /// Đồng bộ danh sách bài đã tải local lên server để web/mobile cùng thấy
  static Future<bool> syncDownloadHistory(List<String> songIds) async {
    try {
      final normalized = songIds
          .map((id) => id.trim())
          .where((id) => id.isNotEmpty)
          .toSet()
          .toList();
      if (normalized.isEmpty) return true;

      final response = await ApiClient.post(
        Uri.parse('$baseUrl/download-history/sync'),
        body: {'songIds': normalized},
      );

      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}

/// Kết quả upload
class UploadResult {
  final bool success;
  final String message;
  final Song? song;

  UploadResult({required this.success, required this.message, this.song});
}

/// Kết quả lấy danh sách upload
class MyUploadsResult {
  final bool success;
  final String? message;
  final List<Song> songs;

  MyUploadsResult({required this.success, this.message, this.songs = const []});
}

/// Kết quả toggle public
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

/// Kết quả xin quyền tải bài hát từ backend
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

/// Kết quả lấy dữ liệu Flowchart
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

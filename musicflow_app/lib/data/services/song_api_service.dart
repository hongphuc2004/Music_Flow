import 'dart:convert';
import 'dart:async';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../models/song_model.dart';
import 'auth_service.dart';

class SongApiService {
  static const String baseUrl = "http://192.168.1.26:5000/api/songs";
  static const Duration timeout = Duration(seconds: 15);  // Timeout 15 giây
  static const int maxRetries = 3;  // Số lần retry tối đa

  /// Fetch với retry và timeout
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
      
      // Chờ trước khi retry (exponential backoff)
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
      throw NetworkException("Server lỗi (${response.statusCode})");
    }
  }

  /// Lấy danh sách bài hát gợi ý (random)
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

    final uri = Uri.parse("$baseUrl/search").replace(queryParameters: queryParams);
    final response = await _getWithRetry(uri);

    if (response.statusCode == 200) {
      final List data = json.decode(response.body);
      return data.map((e) => Song.fromJson(e)).toList();
    } else {
      throw NetworkException("Tìm kiếm thất bại");
    }
  }

  /// Upload bài hát mới (audio + image) - YÊU CẦU ĐĂNG NHẬP
  static Future<UploadResult> uploadSong({
    required File audioFile,
    File? imageFile,
    required String title,
    required String artist,
    String? topicId,
    String? lyrics,
    bool isPublic = false,
    void Function(double)? onProgress,
  }) async {
    try {
      // Lấy token
      final token = await AuthService.getToken();
      if (token == null) {
        return UploadResult(
          success: false,
          message: 'Vui lòng đăng nhập để upload',
        );
      }

      // Kiểm tra file tồn tại
      if (!await audioFile.exists()) {
        return UploadResult(
          success: false,
          message: 'File audio không tồn tại',
        );
      }

      final uri = Uri.parse(baseUrl);
      final request = http.MultipartRequest('POST', uri);
      
      // Thêm auth header
      request.headers['Authorization'] = 'Bearer $token';

      // Thêm text fields
      request.fields['title'] = title;
      request.fields['artist'] = artist;
      request.fields['isPublic'] = isPublic.toString();
      if (topicId != null && topicId.isNotEmpty) {
        request.fields['topicId'] = topicId;
      }
      if (lyrics != null && lyrics.isNotEmpty) {
        request.fields['lyrics'] = lyrics;
      }

      // Thêm file audio
      request.files.add(await http.MultipartFile.fromPath(
        'audio',
        audioFile.path,
      ));

      // Thêm file image nếu có
      if (imageFile != null && await imageFile.exists()) {
        request.files.add(await http.MultipartFile.fromPath(
          'image',
          imageFile.path,
        ));
      }

      // Gửi request
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

  /// Lấy danh sách bài hát user đã upload
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

  /// Cập nhật thông tin bài hát
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
      if (artist != null) body['artist'] = artist;
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

      final response = await http.patch(
        Uri.parse('$baseUrl/$songId/toggle-public'),
        headers: {'Authorization': 'Bearer $token'},
      ).timeout(timeout);

      final data = json.decode(response.body);

      if (response.statusCode == 200) {
        return TogglePublicResult(
          success: true,
          message: data['message'],
          isPublic: data['isPublic'],
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

  /// Xóa bài hát
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
}

/// Kết quả upload
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

/// Kết quả lấy danh sách upload
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

/// Kết quả xóa
class DeleteResult {
  final bool success;
  final String message;

  DeleteResult({required this.success, required this.message});
}

/// Custom exception cho network errors
class NetworkException implements Exception {
  final String message;
  NetworkException(this.message);
  
  @override
  String toString() => message;
}

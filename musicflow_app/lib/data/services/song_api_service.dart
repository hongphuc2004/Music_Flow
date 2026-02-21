import 'dart:convert';
import 'dart:async';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../models/song_model.dart';

class SongApiService {
  static const String baseUrl = "http://192.168.1.148:5000/api";
  static const Duration timeout = Duration(seconds: 15);  // Timeout 15 giây
  static const int maxRetries = 3;  // Số lần retry tối đa

  /// Fetch với retry và timeout
  static Future<http.Response> _getWithRetry(Uri uri) async {
    int attempts = 0;
    
    while (attempts < maxRetries) {
      try {
        attempts++;
        print('📡 Fetching (attempt $attempts): $uri');
        
        final response = await http.get(uri).timeout(timeout);
        return response;
        
      } on TimeoutException {
        print('⏰ Timeout (attempt $attempts)');
        if (attempts >= maxRetries) {
          throw NetworkException('Kết nối quá chậm. Vui lòng kiểm tra mạng.');
        }
      } on SocketException {
        print('🔌 No connection (attempt $attempts)');
        if (attempts >= maxRetries) {
          throw NetworkException('Không có kết nối mạng.');
        }
      } catch (e) {
        print('❌ Error (attempt $attempts): $e');
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
    final response = await _getWithRetry(Uri.parse("$baseUrl/songs"));

    if (response.statusCode == 200) {
      final List data = json.decode(response.body);
      return data.map((e) => Song.fromJson(e)).toList();
    } else {
      throw NetworkException("Server lỗi (${response.statusCode})");
    }
  }

  /// Lấy danh sách bài hát gợi ý (random)
  static Future<List<Song>> fetchRecommendedSongs({int limit = 12}) async {
    final uri = Uri.parse("$baseUrl/songs/recommended?limit=$limit");
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

    final uri = Uri.parse("$baseUrl/songs/search").replace(queryParameters: queryParams);
    final response = await _getWithRetry(uri);

    if (response.statusCode == 200) {
      final List data = json.decode(response.body);
      return data.map((e) => Song.fromJson(e)).toList();
    } else {
      throw NetworkException("Tìm kiếm thất bại");
    }
  }
}

/// Custom exception cho network errors
class NetworkException implements Exception {
  final String message;
  NetworkException(this.message);
  
  @override
  String toString() => message;
}

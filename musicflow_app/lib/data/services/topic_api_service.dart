import 'dart:convert';
import 'dart:async';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../models/topic_model.dart';
import '../models/song_model.dart';

class TopicApiService {
  static const String baseUrl = "http://192.168.1.26:5000/api/topics";
  static const Duration timeout = Duration(seconds: 15);
  static const int maxRetries = 3;

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
          throw TopicException('Kết nối quá chậm. Vui lòng kiểm tra mạng.');
        }
      } on SocketException {
        if (attempts >= maxRetries) {
          throw TopicException('Không có kết nối mạng.');
        }
      } catch (e) {
        if (attempts >= maxRetries) {
          throw TopicException('Lỗi kết nối: $e');
        }
      }
      
      // Chờ trước khi retry (exponential backoff)
      await Future.delayed(Duration(milliseconds: 500 * attempts));
    }
    
    throw TopicException('Không thể kết nối sau $maxRetries lần thử.');
  }

  /// Lấy danh sách tất cả topics
  static Future<List<Topic>> fetchTopics() async {
    final response = await _getWithRetry(Uri.parse(baseUrl));

    if (response.statusCode == 200) {
      final List data = json.decode(response.body);
      return data.map((e) => Topic.fromJson(e)).toList();
    } else {
      throw TopicException("Không thể tải danh sách chủ đề");
    }
  }

  /// Lấy danh sách bài hát theo topic ID
  static Future<List<Song>> fetchSongsByTopic(String topicId) async {
    final response = await _getWithRetry(Uri.parse("$baseUrl/$topicId/songs"));

    if (response.statusCode == 200) {
      final List data = json.decode(response.body);
      return data.map((e) => Song.fromJson(e)).toList();
    } else {
      throw TopicException("Không thể tải bài hát theo chủ đề");
    }
  }
}

/// Custom exception cho Topic errors
class TopicException implements Exception {
  final String message;
  TopicException(this.message);
  
  @override
  String toString() => message;
}

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:musicflow_app/core/config/api_config.dart';

import '../models/song_model.dart';
import '../models/topic_model.dart';

class TopicApiService {
  static const String baseUrl = ApiConfig.topicsEndpoint;
  static const Duration timeout = Duration(seconds: 15);
  static const int maxRetries = 3;

  static dynamic _decodeBody(String body) {
    try {
      return json.decode(body);
    } catch (e) {
      throw TopicException('Dữ liệu chủ đề không hợp lệ: $e');
    }
  }

  static List<dynamic> _extractList(dynamic decoded, {String? key}) {
    if (decoded is List) return decoded;
    if (decoded is Map<String, dynamic> &&
        key != null &&
        decoded[key] is List) {
      return decoded[key] as List<dynamic>;
    }
    throw TopicException('Định dạng dữ liệu chủ đề không đúng');
  }

  static Future<http.Response> _getWithRetry(Uri uri) async {
    var attempts = 0;

    while (attempts < maxRetries) {
      try {
        attempts++;
        return await http.get(uri).timeout(timeout);
      } on TimeoutException {
        if (attempts >= maxRetries) {
          throw TopicException(' Kết nối quá chậm. Vui lòng kiểm tra mạng.');
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

      await Future.delayed(Duration(milliseconds: 500 * attempts));
    }

    throw TopicException('Không thể kết nối sau $maxRetries lần thử.');
  }

  static Future<List<Topic>> fetchTopics() async {
    final response = await _getWithRetry(Uri.parse(baseUrl));

    if (response.statusCode != 200) {
      throw TopicException('Không thể tải danh sách chủ đề');
    }

    final List<dynamic> data = _extractList(
      _decodeBody(response.body),
      key: 'topics',
    );
    return data.whereType<Map<String, dynamic>>().map(Topic.fromJson).toList();
  }

  static Future<List<Song>> fetchSongsByTopic(String topicId) async {
    final response = await _getWithRetry(
      Uri.parse(
        '$baseUrl/$topicId/songs',
      ).replace(queryParameters: const {'page': '1', 'limit': '50'}),
    );

    if (response.statusCode != 200) {
      throw TopicException('Không thể tải bài hát theo chủ đề');
    }

    final List<dynamic> data = _extractList(
      _decodeBody(response.body),
      key: 'songs',
    );
    return data.whereType<Map<String, dynamic>>().map(Song.fromJson).toList();
  }
}

class TopicException implements Exception {
  final String message;

  TopicException(this.message);

  @override
  String toString() => message;
}

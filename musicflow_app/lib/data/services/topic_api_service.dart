import 'dart:convert';
import 'package:musicflow_app/core/config/api_config.dart';
import 'package:musicflow_app/core/config/api_client.dart';
import '../models/song_model.dart';
import '../models/topic_model.dart';

class TopicApiService {
  static const String baseUrl = ApiConfig.topicsEndpoint;

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

  static Future<List<Topic>> fetchTopics() async {
    try {
      final response = await ApiClient.get(Uri.parse(baseUrl));

      if (response.statusCode != 200) {
        throw TopicException('Không thể tải danh sách chủ đề');
      }

      final List<dynamic> data = _extractList(
        _decodeBody(response.body),
        key: 'topics',
      );
      return data.whereType<Map<String, dynamic>>().map(Topic.fromJson).toList();
    } on NetworkException catch (ne) {
      throw TopicException(ne.message);
    }
  }

  static Future<List<Song>> fetchSongsByTopic(String topicId) async {
    try {
      final response = await ApiClient.get(
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
    } on NetworkException catch (ne) {
      throw TopicException(ne.message);
    }
  }
}

class TopicException implements Exception {
  final String message;

  TopicException(this.message);

  @override
  String toString() => message;
}

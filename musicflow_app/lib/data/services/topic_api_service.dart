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
      throw TopicException('Du lieu chu de khong hop le: $e');
    }
  }

  static List<dynamic> _extractList(dynamic decoded, {String? key}) {
    if (decoded is List) return decoded;
    if (decoded is Map<String, dynamic> && key != null && decoded[key] is List) {
      return decoded[key] as List<dynamic>;
    }
    throw TopicException('Dinh dang du lieu chu de khong dung');
  }

  static Future<http.Response> _getWithRetry(Uri uri) async {
    var attempts = 0;

    while (attempts < maxRetries) {
      try {
        attempts++;
        return await http.get(uri).timeout(timeout);
      } on TimeoutException {
        if (attempts >= maxRetries) {
          throw TopicException('Ket noi qua cham. Vui long kiem tra mang.');
        }
      } on SocketException {
        if (attempts >= maxRetries) {
          throw TopicException('Khong co ket noi mang.');
        }
      } catch (e) {
        if (attempts >= maxRetries) {
          throw TopicException('Loi ket noi: $e');
        }
      }

      await Future.delayed(Duration(milliseconds: 500 * attempts));
    }

    throw TopicException('Khong the ket noi sau $maxRetries lan thu.');
  }

  static Future<List<Topic>> fetchTopics() async {
    final response = await _getWithRetry(Uri.parse(baseUrl));

    if (response.statusCode != 200) {
      throw TopicException('Khong the tai danh sach chu de');
    }

    final List<dynamic> data = _extractList(
      _decodeBody(response.body),
      key: 'topics',
    );
    return data
        .whereType<Map<String, dynamic>>()
        .map(Topic.fromJson)
        .toList();
  }

  static Future<List<Song>> fetchSongsByTopic(String topicId) async {
    final response = await _getWithRetry(Uri.parse('$baseUrl/$topicId/songs'));

    if (response.statusCode != 200) {
      throw TopicException('Khong the tai bai hat theo chu de');
    }

    final List<dynamic> data = _extractList(
      _decodeBody(response.body),
      key: 'songs',
    );
    return data
        .whereType<Map<String, dynamic>>()
        .map(Song.fromJson)
        .toList();
  }
}

class TopicException implements Exception {
  final String message;

  TopicException(this.message);

  @override
  String toString() => message;
}

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:musicflow_app/core/config/api_config.dart';

class LyricsApiService {
  static const String _baseUrl = ApiConfig.songsEndpoint;
  static const Duration _timeout = Duration(seconds: 15);
  static const int _maxRetries = 3;

  static Future<http.Response> _getWithRetry(Uri uri) async {
    int attempts = 0;

    while (attempts < _maxRetries) {
      try {
        attempts++;
        return await http.get(uri).timeout(_timeout);
      } on TimeoutException {
        if (attempts >= _maxRetries) {
          throw LyricsException('Ket noi qua cham. Vui long kiem tra mang.');
        }
      } on SocketException {
        if (attempts >= _maxRetries) {
          throw LyricsException('Khong co ket noi mang.');
        }
      } catch (e) {
        if (attempts >= _maxRetries) {
          throw LyricsException('Loi ket noi: $e');
        }
      }

      await Future.delayed(Duration(milliseconds: 500 * attempts));
    }

    throw LyricsException('Khong the ket noi sau $_maxRetries lan thu.');
  }

  static Future<LyricsResult> fetchLrcLyrics({
    required String songId,
    String fallbackLyrics = '',
  }) async {
    try {
      final response = await _getWithRetry(Uri.parse('$_baseUrl/$songId/lyrics'));

      if (response.statusCode == 200) {
        final data = json.decode(response.body) as Map<String, dynamic>;
        final lyrics = (data['lyrics'] as String?) ?? '';
        return LyricsResult(success: true, lyrics: lyrics);
      }

      if (fallbackLyrics.isNotEmpty) {
        return LyricsResult(success: true, lyrics: fallbackLyrics);
      }

      return LyricsResult(
        success: false,
        message: 'Khong the tai lyrics (${response.statusCode})',
      );
    } catch (e) {
      if (fallbackLyrics.isNotEmpty) {
        return LyricsResult(success: true, lyrics: fallbackLyrics);
      }

      return LyricsResult(
        success: false,
        message: e.toString(),
      );
    }
  }
}

class LyricsResult {
  final bool success;
  final String lyrics;
  final String? message;

  LyricsResult({
    required this.success,
    this.lyrics = '',
    this.message,
  });
}

class LyricsException implements Exception {
  final String message;

  LyricsException(this.message);

  @override
  String toString() => message;
}

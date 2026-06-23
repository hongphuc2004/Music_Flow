import 'dart:convert';
import 'package:musicflow_app/core/config/api_config.dart';
import 'package:musicflow_app/core/config/api_client.dart';

class LyricsApiService {
  static const String _baseUrl = ApiConfig.songsEndpoint;

  static Future<LyricsResult> fetchLrcLyrics({
    required String songId,
    String fallbackLyrics = '',
  }) async {
    try {
      final response = await ApiClient.get(
        Uri.parse('$_baseUrl/$songId/lyrics'),
      );

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
        message: 'Không thể tải lyrics (${response.statusCode})',
      );
    } on NetworkException catch (ne) {
      if (fallbackLyrics.isNotEmpty) {
        return LyricsResult(success: true, lyrics: fallbackLyrics);
      }
      return LyricsResult(success: false, message: ne.message);
    } catch (e) {
      if (fallbackLyrics.isNotEmpty) {
        return LyricsResult(success: true, lyrics: fallbackLyrics);
      }
      return LyricsResult(success: false, message: e.toString());
    }
  }
}

class LyricsResult {
  final bool success;
  final String lyrics;
  final String? message;

  LyricsResult({required this.success, this.lyrics = '', this.message});
}

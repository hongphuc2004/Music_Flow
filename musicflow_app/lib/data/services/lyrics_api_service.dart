import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:musicflow_app/core/config/api_config.dart';
import 'package:musicflow_app/core/config/api_client.dart';
import 'package:musicflow_app/core/utils/lrc_parser.dart';
import 'package:musicflow_app/data/models/lrc_line_model.dart';

class LyricsApiService {
  static String get _baseUrl => ApiConfig.songsEndpoint;

  static Future<LyricsResult> fetchLrcLyrics({
    required String songId,
    String fallbackLyrics = '',
  }) async {
    try {
      final requestUri = Uri.parse('$_baseUrl/$songId/lyrics');
      debugPrint('[LyricsApiService] Fetching lyrics from: $requestUri');

      final response = await ApiClient.get(requestUri);

      if (response.statusCode == 200) {
        final rawData = json.decode(response.body) as Map<String, dynamic>;
        final data = rawData['data'] is Map<String, dynamic>
            ? rawData['data'] as Map<String, dynamic>
            : rawData;

        final rawLyrics = (data['lyrics'] as String?) ?? '';
        final isSyncedRaw = (data['isSynced'] as bool?) ?? false;
        final rawSyncedLines = data['syncedLines'];

        List<LrcLine> parsedLines = [];

        // 1. Prioritize structured syncedLines from backend
        if (rawSyncedLines is List && rawSyncedLines.isNotEmpty) {
          parsedLines = rawSyncedLines.map((item) {
            final map = item is Map ? Map<String, dynamic>.from(item) : <String, dynamic>{};
            final rawTime = map['startTime'] ?? map['time'] ?? 0;
            double seconds = 0.0;
            if (rawTime is num) {
              seconds = rawTime.toDouble();
            } else if (rawTime is String) {
              seconds = double.tryParse(rawTime) ?? 0.0;
            }
            final text = (map['text'] ?? '').toString();
            final ms = (seconds * 1000).round();
            return LrcLine(timestamp: Duration(milliseconds: ms), text: text);
          }).where((l) => l.text.isNotEmpty).toList();
        }

        // 2. If syncedLines was empty, parse from rawLyrics or publishedLrcData
        if (parsedLines.isEmpty) {
          final lrcCandidate = (data['publishedLrcData'] as String?) ?? rawLyrics;
          if (lrcCandidate.isNotEmpty) {
            parsedLines = LrcParser.parse(lrcCandidate);
          }
        }

        if (parsedLines.isEmpty && fallbackLyrics.isNotEmpty) {
          parsedLines = LrcParser.parse(fallbackLyrics);
        }

        final finalLyrics = rawLyrics.isNotEmpty ? rawLyrics : fallbackLyrics;

        return LyricsResult(
          success: true,
          lyrics: finalLyrics,
          isSynced: parsedLines.isNotEmpty || isSyncedRaw,
          syncedLines: parsedLines,
        );
      }

      // If status != 200 (e.g. 404), check fallbackLyrics
      if (fallbackLyrics.trim().isNotEmpty) {
        final parsed = LrcParser.parse(fallbackLyrics);
        return LyricsResult(
          success: true,
          lyrics: fallbackLyrics,
          isSynced: parsed.isNotEmpty,
          syncedLines: parsed,
        );
      }

      return LyricsResult(
        success: false,
        message: response.statusCode == 404
            ? 'Bài hát chưa có lời bài hát'
            : 'Không thể tải lyrics (${response.statusCode})',
      );
    } on NetworkException catch (_) {
      if (fallbackLyrics.trim().isNotEmpty) {
        final parsed = LrcParser.parse(fallbackLyrics);
        return LyricsResult(
          success: true,
          lyrics: fallbackLyrics,
          isSynced: parsed.isNotEmpty,
          syncedLines: parsed,
        );
      }
      return LyricsResult(success: false, message: 'Bài hát chưa có lời bài hát');
    } catch (e) {
      debugPrint('[LyricsApiService] Error fetching lyrics: $e');
      if (fallbackLyrics.trim().isNotEmpty) {
        final parsed = LrcParser.parse(fallbackLyrics);
        return LyricsResult(
          success: true,
          lyrics: fallbackLyrics,
          isSynced: parsed.isNotEmpty,
          syncedLines: parsed,
        );
      }
      return LyricsResult(success: false, message: 'Bài hát chưa có lời bài hát');
    }
  }
}

class LyricsResult {
  final bool success;
  final String lyrics;
  final bool isSynced;
  final List<LrcLine> syncedLines;
  final String? message;

  LyricsResult({
    required this.success,
    this.lyrics = '',
    this.isSynced = false,
    this.syncedLines = const [],
    this.message,
  });
}

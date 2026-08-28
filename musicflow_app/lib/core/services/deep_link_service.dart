import 'package:flutter/material.dart';
import 'package:musicflow_app/core/audio/global_audio_state.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/data/services/song_api_service.dart';
import 'package:musicflow_app/presentation/screens/player/player_screen.dart';

class DeepLinkService {
  static const _systemSegments = {
    'api',
    'auth',
    'admin',
    'artist',
    'client',
    'settings',
    'accounts',
    'topics',
    'playlists',
    'favorites',
    'share',
  };

  /// Extract song ID or SoundCloud-style slug from web share URLs or app custom links.
  static Map<String, String>? parseDeepLink(String urlOrPath) {
    if (urlOrPath.isEmpty) return null;
    final trimmed = urlOrPath.trim();

    // 1. Check ID-based link: /client/songs/:id or /songs/:id
    final idRegex = RegExp(r'(?:client\/)?songs\/([a-fA-F0-9]{24}|[a-zA-Z0-9_-]{10,40})');
    final idMatch = idRegex.firstMatch(trimmed);
    if (idMatch != null && idMatch.groupCount >= 1) {
      return {'type': 'id', 'id': idMatch.group(1)!};
    }

    // 2. Check SoundCloud-style link: /:artistSlug/:songSlug
    try {
      final uri = Uri.parse(trimmed.startsWith('http') || trimmed.startsWith('musicflow://')
          ? trimmed
          : 'https://musicflow.vn${trimmed.startsWith('/') ? '' : '/'}$trimmed');

      final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();
      if (segments.length == 2) {
        final artistSlug = segments[0];
        final songSlug = segments[1];

        if (!_systemSegments.contains(artistSlug.toLowerCase())) {
          return {
            'type': 'slug',
            'artistSlug': artistSlug,
            'songSlug': songSlug,
          };
        }
      }
    } catch (_) {
      // ignore parsing error
    }

    return null;
  }

  /// Backward-compatible extraction of song ID
  static String? extractSongId(String urlOrPath) {
    final parsed = parseDeepLink(urlOrPath);
    if (parsed != null && parsed['type'] == 'id') {
      return parsed['id'];
    }
    return null;
  }

  /// Handles incoming URL or path, fetches song, starts playback, and opens PlayerScreen.
  static Future<bool> handleDeepLink(BuildContext context, String urlOrPath) async {
    final parsed = parseDeepLink(urlOrPath);
    if (parsed == null) return false;

    try {
      Song? song;
      if (parsed['type'] == 'slug') {
        song = await SongApiService.fetchSongBySlug(
          parsed['artistSlug']!,
          parsed['songSlug']!,
        );
      } else if (parsed['type'] == 'id') {
        song = await SongApiService.fetchSongById(parsed['id']!);
      }

      if (song == null) return false;

      // Start playback in global audio state
      GlobalAudioState().playSong(song);

      if (context.mounted) {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => PlayerScreen(song: song!),

          ),
        );
      }
      return true;
    } catch (e) {
      debugPrint('DeepLinkService error: $e');
      return false;
    }
  }

  /// Backward-compatible handler by songId
  static Future<bool> handleSongDeepLink(BuildContext context, String songId) async {
    return handleDeepLink(context, '/client/songs/$songId');
  }
}

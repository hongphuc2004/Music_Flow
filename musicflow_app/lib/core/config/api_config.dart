import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../utils/slug_util.dart';

/// API config with smart dynamic environment detection:
/// - In Debug mode (kDebugMode / cắm USB): Tests local server (192.168.1.148:5001). If reachable -> use Local.
/// - If local server unreachable (unplugged USB / 4G / out of home) or Release mode -> automatically uses Render Production.
class ApiConfig {
  static const String baseUrlDev = "http://192.168.1.148:5001";
  static const String baseUrlProd = "https://music-flow-30us.onrender.com";

  static const String webBaseUrlDev = "http://localhost:5173";
  static const String webBaseUrlProd = "https://music-flow-bay.vercel.app";

  // Explicit env override if passed via --dart-define
  static const String _customApiBaseUrl = String.fromEnvironment("API_BASE_URL", defaultValue: "");
  static const String _customAppEnv = String.fromEnvironment("APP_ENV", defaultValue: "");

  static String _activeBaseUrl = baseUrlProd;
  static bool _hasInitialized = false;

  /// Khởi tạo và tự động phát hiện môi trường:
  /// Nếu local backend khả dụng -> dùng local. Nếu không -> tự động chuyển sang Render Production.
  static Future<void> init() async {
    if (_hasInitialized) return;

    if (_customApiBaseUrl.isNotEmpty) {
      _activeBaseUrl = _customApiBaseUrl;
      _hasInitialized = true;
      debugPrint('[ApiConfig] Using custom defined API_BASE_URL: $_activeBaseUrl');
      return;
    }

    if (_customAppEnv == "prod" || !kDebugMode) {
      _activeBaseUrl = baseUrlProd;
      _hasInitialized = true;
      debugPrint('[ApiConfig] Release/Prod mode -> using Production: $_activeBaseUrl');
      return;
    }

    // Đang ở Debug Mode: Thử ping nhanh máy chủ Local trong 1.5 giây
    try {
      final response = await http
          .get(Uri.parse('$baseUrlDev/api/songs?limit=1'))
          .timeout(const Duration(milliseconds: 1500));
      if (response.statusCode >= 200 && response.statusCode < 500) {
        _activeBaseUrl = baseUrlDev;
        debugPrint('[ApiConfig] Local dev server reachable -> using Local: $_activeBaseUrl');
      } else {
        _activeBaseUrl = baseUrlProd;
        debugPrint('[ApiConfig] Local dev server error (${response.statusCode}) -> fallback to Production: $_activeBaseUrl');
      }
    } catch (_) {
      _activeBaseUrl = baseUrlProd;
      debugPrint('[ApiConfig] Local dev server unreachable -> auto fallback to Production: $_activeBaseUrl');
    }

    _hasInitialized = true;
  }

  static String get baseUrl => _activeBaseUrl;
  static String get webBaseUrl => _activeBaseUrl == baseUrlDev ? webBaseUrlDev : webBaseUrlProd;

  // Dynamic API endpoints
  static String get songsEndpoint => "$baseUrl/api/songs";
  static String get authEndpoint => "$baseUrl/api/auth";
  static String get topicsEndpoint => "$baseUrl/api/topics";
  static String get playlistsEndpoint => "$baseUrl/api/playlists";
  static String get favoritesEndpoint => "$baseUrl/api/favorites";
  static String get songLikesEndpoint => "$baseUrl/api/song-likes";
  static String get commentsEndpoint => "$baseUrl/api/comments";
  static String get artistEndpoint => "$baseUrl/api/artist";
  static String get aiPlaylistEndpoint => "$baseUrl/api/ai/playlist";
  static String get aiMoodHistoryEndpoint => "$baseUrl/api/ai/mood/history";
  static String get aiMoodConversationEndpoint => "$baseUrl/api/ai/mood/conversations";
  static String get assistantEndpoint => "$baseUrl/api/ai/assistant";
  static String get assistantMessagesEndpoint => "$assistantEndpoint/messages";
  static String get assistantConversationsEndpoint => "$assistantEndpoint/conversations";
  static String aiMoodConversationByIdEndpoint(String conversationId) => "$aiMoodConversationEndpoint/$conversationId";
  static String get usersMeEndpoint => "$baseUrl/api/users/me";
  static String get usersUpdateEndpoint => "$baseUrl/api/users/update";
  static String get plansEndpoint => "$baseUrl/api/plans";
  static String get subscriptionsEndpoint => "$baseUrl/api/subscriptions";
  static String songStreamUrl(String songId) => "$songsEndpoint/$songId/stream";

  static String artistProfileUrlByName(String artistName) =>
      "$artistEndpoint/profile?name=${Uri.encodeComponent(artistName)}";

  static String songShareUrl(
    String songId, {
    String? title,
    String? artistName,
    String source = 'clipboard',
    String medium = 'share',
  }) {
    if (title != null && title.isNotEmpty) {
      final songSlug = slugify(title);
      final artistSlug = (artistName != null && artistName.isNotEmpty)
          ? slugify(artistName)
          : 'artist';
      return "$webBaseUrl/$artistSlug/$songSlug?utm_source=$source&utm_medium=$medium&utm_campaign=social_sharing";
    }
    return "$webBaseUrl/client/songs/$songId?utm_source=$source&utm_medium=$medium&utm_campaign=social_sharing";
  }
}

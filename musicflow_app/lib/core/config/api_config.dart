import '../utils/slug_util.dart';

/// API config for the whole app.
class ApiConfig {

  static const String baseUrlDev = "http://192.168.1.148:5001";
  static const String baseUrlProd = "https://music-flow-30us.onrender.com";

  static const String webBaseUrlDev = "http://localhost:5173";
  static const String webBaseUrlProd = "https://musicflow.vn";

  static const String appEnv = String.fromEnvironment(
    "APP_ENV",
    defaultValue: "dev",
  );

  static const String baseUrl = String.fromEnvironment(
    "API_BASE_URL",
    defaultValue: appEnv == "prod" ? baseUrlProd : baseUrlDev,
  );

  static const String webBaseUrl = String.fromEnvironment(
    "WEB_BASE_URL",
    defaultValue: appEnv == "prod" ? webBaseUrlProd : webBaseUrlDev,
  );


  // API endpoints
  static const String songsEndpoint = "$baseUrl/api/songs";
  static const String authEndpoint = "$baseUrl/api/auth";
  static const String topicsEndpoint = "$baseUrl/api/topics";
  static const String playlistsEndpoint = "$baseUrl/api/playlists";
  static const String favoritesEndpoint = "$baseUrl/api/favorites";
  static const String songLikesEndpoint = "$baseUrl/api/song-likes";
  static const String commentsEndpoint = "$baseUrl/api/comments";
  static const String artistEndpoint = "$baseUrl/api/artist";
  static const String aiPlaylistEndpoint = "$baseUrl/api/ai/playlist";
  static const String aiMoodHistoryEndpoint = "$baseUrl/api/ai/mood/history";
  static const String aiMoodConversationEndpoint =
      "$baseUrl/api/ai/mood/conversations";
  static const String assistantEndpoint = "$baseUrl/api/ai/assistant";
  static const String assistantMessagesEndpoint = "$assistantEndpoint/messages";
  static const String assistantConversationsEndpoint =
      "$assistantEndpoint/conversations";
  static String aiMoodConversationByIdEndpoint(String conversationId) =>
      "$aiMoodConversationEndpoint/$conversationId";
  static const String usersMeEndpoint = "$baseUrl/api/users/me";
  static const String usersUpdateEndpoint = "$baseUrl/api/users/update";
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



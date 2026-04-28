/// Cấu hình API chung cho toàn bộ app
class ApiConfig {
  // Base URL của backend - thay đổi khi deploy
  static const String baseUrl = String.fromEnvironment(
    "API_BASE_URL",
    defaultValue: "http://10.240.145.153:5001",
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
  static const String usersMeEndpoint = "$baseUrl/api/users/me";
  static const String usersUpdateEndpoint = "$baseUrl/api/users/update";

  static String songStreamUrl(String songId) => "$songsEndpoint/$songId/stream";
  static String artistProfileUrlByName(String artistName) =>
      "$artistEndpoint/profile?name=${Uri.encodeComponent(artistName)}";
}

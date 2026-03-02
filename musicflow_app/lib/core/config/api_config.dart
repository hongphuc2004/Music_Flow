/// Cấu hình API chung cho toàn bộ app
class ApiConfig {
  // Base URL của backend - thay đổi khi deploy
  static const String baseUrl = "http://10.30.180.153:5000";
  
  // API endpoints
  static const String songsEndpoint = "$baseUrl/api/songs";
  static const String authEndpoint = "$baseUrl/api/auth";
  static const String topicsEndpoint = "$baseUrl/api/topics";
  static const String playlistsEndpoint = "$baseUrl/api/playlists";
  static const String favoritesEndpoint = "$baseUrl/api/favorites";
  
  /// Lấy URL streaming cho một bài hát
  /// Sử dụng HTTP Range Requests để hỗ trợ seek/tua nhanh
  static String getStreamUrl(String songId) {
    return "$songsEndpoint/$songId/stream";
  }
}

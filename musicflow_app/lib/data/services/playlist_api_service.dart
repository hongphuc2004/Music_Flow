import 'dart:convert';
import 'dart:async';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../models/playlist_model.dart';
import 'auth_service.dart';

class PlaylistApiService {
  static const String baseUrl = "http://192.168.1.148:5000/api/playlists";
  static const Duration timeout = Duration(seconds: 15);

  /// Lấy headers với token xác thực
  static Future<Map<String, String>> _getAuthHeaders() async {
    final token = await AuthService.getToken();
    print('🔑 PlaylistApiService - Token: ${token != null ? "${token.substring(0, 20)}..." : "NULL"}');
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  // ================= GET ALL PLAYLISTS =================
  /// Lấy tất cả playlist của user hiện tại
  static Future<PlaylistResult> getPlaylists() async {
    try {
      final headers = await _getAuthHeaders();
      
      final response = await http.get(
        Uri.parse(baseUrl),
        headers: headers,
      ).timeout(timeout);

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        final List playlistsJson = data['playlists'] ?? [];
        final playlists = playlistsJson
            .map((json) => Playlist.fromJson(json))
            .toList();

        return PlaylistResult(
          success: true,
          playlists: playlists,
        );
      } else {
        return PlaylistResult(
          success: false,
          message: data['message'] ?? 'Lấy danh sách playlist thất bại',
        );
      }
    } on TimeoutException {
      return PlaylistResult(success: false, message: 'Kết nối quá chậm');
    } on SocketException {
      return PlaylistResult(success: false, message: 'Không có kết nối mạng');
    } catch (e) {
      return PlaylistResult(success: false, message: 'Lỗi: $e');
    }
  }

  // ================= GET SINGLE PLAYLIST =================
  /// Lấy chi tiết một playlist
  static Future<PlaylistResult> getPlaylist(String playlistId) async {
    try {
      final headers = await _getAuthHeaders();
      
      final response = await http.get(
        Uri.parse('$baseUrl/$playlistId'),
        headers: headers,
      ).timeout(timeout);

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        return PlaylistResult(
          success: true,
          playlist: Playlist.fromJson(data['playlist']),
        );
      } else {
        return PlaylistResult(
          success: false,
          message: data['message'] ?? 'Lấy playlist thất bại',
        );
      }
    } on TimeoutException {
      return PlaylistResult(success: false, message: 'Kết nối quá chậm');
    } on SocketException {
      return PlaylistResult(success: false, message: 'Không có kết nối mạng');
    } catch (e) {
      return PlaylistResult(success: false, message: 'Lỗi: $e');
    }
  }

  // ================= CREATE PLAYLIST =================
  /// Tạo playlist mới
  static Future<PlaylistResult> createPlaylist({
    required String name,
    String? description,
    bool isPublic = false,
    String? coverImage,
  }) async {
    try {
      final headers = await _getAuthHeaders();
      
      final response = await http.post(
        Uri.parse(baseUrl),
        headers: headers,
        body: jsonEncode({
          'name': name,
          'description': description ?? '',
          'isPublic': isPublic,
          'coverImage': coverImage ?? '',
        }),
      ).timeout(timeout);

      print('📦 Create playlist response: ${response.statusCode} - ${response.body}');
      
      final data = jsonDecode(response.body);

      if (response.statusCode == 201 && data['success'] == true) {
        return PlaylistResult(
          success: true,
          message: data['message'] ?? 'Tạo playlist thành công',
          playlist: Playlist.fromJson(data['playlist']),
        );
      } else {
        return PlaylistResult(
          success: false,
          message: data['message'] ?? 'Tạo playlist thất bại',
        );
      }
    } on TimeoutException {
      return PlaylistResult(success: false, message: 'Kết nối quá chậm');
    } on SocketException {
      return PlaylistResult(success: false, message: 'Không có kết nối mạng');
    } catch (e) {
      return PlaylistResult(success: false, message: 'Lỗi: $e');
    }
  }

  // ================= UPDATE PLAYLIST =================
  /// Cập nhật thông tin playlist
  static Future<PlaylistResult> updatePlaylist({
    required String playlistId,
    String? name,
    String? description,
    bool? isPublic,
    String? coverImage,
  }) async {
    try {
      final headers = await _getAuthHeaders();
      
      final body = <String, dynamic>{};
      if (name != null) body['name'] = name;
      if (description != null) body['description'] = description;
      if (isPublic != null) body['isPublic'] = isPublic;
      if (coverImage != null) body['coverImage'] = coverImage;

      final response = await http.put(
        Uri.parse('$baseUrl/$playlistId'),
        headers: headers,
        body: jsonEncode(body),
      ).timeout(timeout);

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        return PlaylistResult(
          success: true,
          message: data['message'] ?? 'Cập nhật playlist thành công',
          playlist: Playlist.fromJson(data['playlist']),
        );
      } else {
        return PlaylistResult(
          success: false,
          message: data['message'] ?? 'Cập nhật playlist thất bại',
        );
      }
    } on TimeoutException {
      return PlaylistResult(success: false, message: 'Kết nối quá chậm');
    } on SocketException {
      return PlaylistResult(success: false, message: 'Không có kết nối mạng');
    } catch (e) {
      return PlaylistResult(success: false, message: 'Lỗi: $e');
    }
  }

  // ================= DELETE PLAYLIST =================
  /// Xóa playlist
  static Future<PlaylistResult> deletePlaylist(String playlistId) async {
    try {
      final headers = await _getAuthHeaders();
      
      final response = await http.delete(
        Uri.parse('$baseUrl/$playlistId'),
        headers: headers,
      ).timeout(timeout);

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        return PlaylistResult(
          success: true,
          message: data['message'] ?? 'Xóa playlist thành công',
        );
      } else {
        return PlaylistResult(
          success: false,
          message: data['message'] ?? 'Xóa playlist thất bại',
        );
      }
    } on TimeoutException {
      return PlaylistResult(success: false, message: 'Kết nối quá chậm');
    } on SocketException {
      return PlaylistResult(success: false, message: 'Không có kết nối mạng');
    } catch (e) {
      return PlaylistResult(success: false, message: 'Lỗi: $e');
    }
  }

  // ================= ADD SONG TO PLAYLIST =================
  /// Thêm bài hát vào playlist
  static Future<PlaylistResult> addSongToPlaylist({
    required String playlistId,
    required String songId,
  }) async {
    try {
      final headers = await _getAuthHeaders();
      
      final response = await http.post(
        Uri.parse('$baseUrl/$playlistId/songs'),
        headers: headers,
        body: jsonEncode({'songId': songId}),
      ).timeout(timeout);

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        return PlaylistResult(
          success: true,
          message: data['message'] ?? 'Thêm bài hát thành công',
          playlist: Playlist.fromJson(data['playlist']),
        );
      } else {
        return PlaylistResult(
          success: false,
          message: data['message'] ?? 'Thêm bài hát thất bại',
        );
      }
    } on TimeoutException {
      return PlaylistResult(success: false, message: 'Kết nối quá chậm');
    } on SocketException {
      return PlaylistResult(success: false, message: 'Không có kết nối mạng');
    } catch (e) {
      return PlaylistResult(success: false, message: 'Lỗi: $e');
    }
  }

  // ================= REMOVE SONG FROM PLAYLIST =================
  /// Xóa bài hát khỏi playlist
  static Future<PlaylistResult> removeSongFromPlaylist({
    required String playlistId,
    required String songId,
  }) async {
    try {
      final headers = await _getAuthHeaders();
      
      final response = await http.delete(
        Uri.parse('$baseUrl/$playlistId/songs/$songId'),
        headers: headers,
      ).timeout(timeout);

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        return PlaylistResult(
          success: true,
          message: data['message'] ?? 'Xóa bài hát thành công',
          playlist: Playlist.fromJson(data['playlist']),
        );
      } else {
        return PlaylistResult(
          success: false,
          message: data['message'] ?? 'Xóa bài hát thất bại',
        );
      }
    } on TimeoutException {
      return PlaylistResult(success: false, message: 'Kết nối quá chậm');
    } on SocketException {
      return PlaylistResult(success: false, message: 'Không có kết nối mạng');
    } catch (e) {
      return PlaylistResult(success: false, message: 'Lỗi: $e');
    }
  }

  // ================= REORDER SONGS =================
  /// Sắp xếp lại thứ tự bài hát trong playlist
  static Future<PlaylistResult> reorderSongs({
    required String playlistId,
    required List<String> songIds,
  }) async {
    try {
      final headers = await _getAuthHeaders();
      
      final response = await http.put(
        Uri.parse('$baseUrl/$playlistId/reorder'),
        headers: headers,
        body: jsonEncode({'songIds': songIds}),
      ).timeout(timeout);

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        return PlaylistResult(
          success: true,
          message: data['message'] ?? 'Sắp xếp lại thành công',
          playlist: Playlist.fromJson(data['playlist']),
        );
      } else {
        return PlaylistResult(
          success: false,
          message: data['message'] ?? 'Sắp xếp lại thất bại',
        );
      }
    } on TimeoutException {
      return PlaylistResult(success: false, message: 'Kết nối quá chậm');
    } on SocketException {
      return PlaylistResult(success: false, message: 'Không có kết nối mạng');
    } catch (e) {
      return PlaylistResult(success: false, message: 'Lỗi: $e');
    }
  }
}

/// Kết quả trả về từ các API playlist
class PlaylistResult {
  final bool success;
  final String? message;
  final Playlist? playlist;
  final List<Playlist>? playlists;

  PlaylistResult({
    required this.success,
    this.message,
    this.playlist,
    this.playlists,
  });
}

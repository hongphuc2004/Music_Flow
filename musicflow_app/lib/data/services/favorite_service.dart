import 'dart:convert';
import 'dart:async';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../models/song_model.dart';
import 'auth_service.dart';

class FavoriteService {
  static const String baseUrl = "http://192.168.1.26:5000/api/favorites";
  static const Duration timeout = Duration(seconds: 15);

  /// Lấy headers với token
  static Future<Map<String, String>> _getAuthHeaders() async {
    final token = await AuthService.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
  }

  /// Lấy danh sách bài hát yêu thích
  static Future<FavoriteResult> getFavorites() async {
    try {
      final token = await AuthService.getToken();
      if (token == null) {
        return FavoriteResult(
          success: false,
          message: 'Vui lòng đăng nhập để xem danh sách yêu thích',
        );
      }

      final response = await http.get(
        Uri.parse(baseUrl),
        headers: await _getAuthHeaders(),
      ).timeout(timeout);

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        final List favorites = data['favorites'] ?? [];
        return FavoriteResult(
          success: true,
          favorites: favorites.map((e) => Song.fromJson(e)).toList(),
        );
      } else {
        return FavoriteResult(
          success: false,
          message: data['message'] ?? 'Lấy danh sách thất bại',
        );
      }
    } on TimeoutException {
      return FavoriteResult(success: false, message: 'Kết nối quá chậm');
    } on SocketException {
      return FavoriteResult(success: false, message: 'Không có kết nối mạng');
    } catch (e) {
      return FavoriteResult(success: false, message: 'Lỗi: $e');
    }
  }

  /// Thêm bài hát vào yêu thích
  static Future<FavoriteResult> addFavorite(String songId) async {
    try {
      final token = await AuthService.getToken();
      if (token == null) {
        return FavoriteResult(
          success: false,
          message: 'Vui lòng đăng nhập',
        );
      }

      final response = await http.post(
        Uri.parse('$baseUrl/add/$songId'),
        headers: await _getAuthHeaders(),
      ).timeout(timeout);

      final data = jsonDecode(response.body);

      return FavoriteResult(
        success: data['success'] == true,
        message: data['message'],
      );
    } on TimeoutException {
      return FavoriteResult(success: false, message: 'Kết nối quá chậm');
    } on SocketException {
      return FavoriteResult(success: false, message: 'Không có kết nối mạng');
    } catch (e) {
      return FavoriteResult(success: false, message: 'Lỗi: $e');
    }
  }

  /// Xóa bài hát khỏi yêu thích
  static Future<FavoriteResult> removeFavorite(String songId) async {
    try {
      final token = await AuthService.getToken();
      if (token == null) {
        return FavoriteResult(
          success: false,
          message: 'Vui lòng đăng nhập',
        );
      }

      final response = await http.delete(
        Uri.parse('$baseUrl/remove/$songId'),
        headers: await _getAuthHeaders(),
      ).timeout(timeout);

      final data = jsonDecode(response.body);

      return FavoriteResult(
        success: data['success'] == true,
        message: data['message'],
      );
    } on TimeoutException {
      return FavoriteResult(success: false, message: 'Kết nối quá chậm');
    } on SocketException {
      return FavoriteResult(success: false, message: 'Không có kết nối mạng');
    } catch (e) {
      return FavoriteResult(success: false, message: 'Lỗi: $e');
    }
  }

  /// Toggle trạng thái yêu thích
  static Future<FavoriteResult> toggleFavorite(String songId) async {
    try {
      final token = await AuthService.getToken();
      if (token == null) {
        return FavoriteResult(
          success: false,
          message: 'Vui lòng đăng nhập',
        );
      }

      final response = await http.post(
        Uri.parse('$baseUrl/toggle/$songId'),
        headers: await _getAuthHeaders(),
      ).timeout(timeout);

      final data = jsonDecode(response.body);

      return FavoriteResult(
        success: data['success'] == true,
        message: data['message'],
        isFavorite: data['isFavorite'],
      );
    } on TimeoutException {
      return FavoriteResult(success: false, message: 'Kết nối quá chậm');
    } on SocketException {
      return FavoriteResult(success: false, message: 'Không có kết nối mạng');
    } catch (e) {
      return FavoriteResult(success: false, message: 'Lỗi: $e');
    }
  }

  /// Kiểm tra bài hát có trong yêu thích không
  static Future<FavoriteResult> checkFavorite(String songId) async {
    try {
      final token = await AuthService.getToken();
      if (token == null) {
        return FavoriteResult(
          success: false,
          message: 'Vui lòng đăng nhập',
          isFavorite: false,
        );
      }

      final response = await http.get(
        Uri.parse('$baseUrl/check/$songId'),
        headers: await _getAuthHeaders(),
      ).timeout(timeout);

      final data = jsonDecode(response.body);

      return FavoriteResult(
        success: data['success'] == true,
        isFavorite: data['isFavorite'] ?? false,
      );
    } on TimeoutException {
      return FavoriteResult(success: false, message: 'Kết nối quá chậm');
    } on SocketException {
      return FavoriteResult(success: false, message: 'Không có kết nối mạng');
    } catch (e) {
      return FavoriteResult(success: false, message: 'Lỗi: $e');
    }
  }
}

/// Kết quả trả về từ FavoriteService
class FavoriteResult {
  final bool success;
  final String? message;
  final List<Song>? favorites;
  final bool? isFavorite;

  FavoriteResult({
    required this.success,
    this.message,
    this.favorites,
    this.isFavorite,
  });
}

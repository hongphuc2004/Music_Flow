import 'dart:convert';
import 'package:musicflow_app/core/config/api_config.dart';
import 'package:musicflow_app/core/config/api_client.dart';
import '../models/song_model.dart';
import 'auth_service.dart';

class FavoriteService {
  static const String baseUrl = ApiConfig.favoritesEndpoint;

  /// Lấy danh sách bài hát yêu thích
  static Future<FavoriteResult> getFavorites() async {
    try {
      final response = await ApiClient.get(
        Uri.parse(baseUrl),
        requireAuth: true,
      );

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
    } on NetworkException catch (ne) {
      return FavoriteResult(success: false, message: ne.message);
    } catch (e) {
      return FavoriteResult(success: false, message: 'Lỗi: $e');
    }
  }

  /// Thêm bài hát vào yêu thích
  static Future<FavoriteResult> addFavorite(String songId) async {
    try {
      http.Response response = await ApiClient.post(
        Uri.parse('$baseUrl/add/$songId'),
      );
      if (response.statusCode == 401) {
        final refreshed = await AuthService.tryRefreshToken();
        if (refreshed) {
          response = await ApiClient.post(
            Uri.parse('$baseUrl/add/$songId'),
          );
        }
      }
      final data = jsonDecode(response.body);
      return FavoriteResult(
        success: data['success'] == true,
        message: data['message'],
      );
    } on NetworkException catch (ne) {
      return FavoriteResult(success: false, message: ne.message);
    } catch (e) {
      return FavoriteResult(success: false, message: 'Lỗi: $e');
    }
  }

  /// Xóa bài hát khỏi yêu thích
  static Future<FavoriteResult> removeFavorite(String songId) async {
    try {
      http.Response response = await ApiClient.delete(
        Uri.parse('$baseUrl/remove/$songId'),
      );
      if (response.statusCode == 401) {
        final refreshed = await AuthService.tryRefreshToken();
        if (refreshed) {
          response = await ApiClient.delete(
            Uri.parse('$baseUrl/remove/$songId'),
          );
        }
      }
      final data = jsonDecode(response.body);
      return FavoriteResult(
        success: data['success'] == true,
        message: data['message'],
      );
    } on NetworkException catch (ne) {
      return FavoriteResult(success: false, message: ne.message);
    } catch (e) {
      return FavoriteResult(success: false, message: 'Lỗi: $e');
    }
  }

  /// Toggle trạng thái yêu thích
  static Future<FavoriteResult> toggleFavorite(String songId) async {
    try {
      http.Response response = await ApiClient.post(
        Uri.parse('$baseUrl/toggle/$songId'),
      );
      if (response.statusCode == 401) {
        final refreshed = await AuthService.tryRefreshToken();
        if (refreshed) {
          response = await ApiClient.post(
            Uri.parse('$baseUrl/toggle/$songId'),
          );
        }
      }
      final data = jsonDecode(response.body);
      return FavoriteResult(
        success: data['success'] == true,
        message: data['message'],
        isFavorite: data['isFavorite'],
      );
    } on NetworkException catch (ne) {
      return FavoriteResult(success: false, message: ne.message);
    } catch (e) {
      return FavoriteResult(success: false, message: 'Lỗi: $e');
    }
  }

  /// Kiểm tra bài hát có trong yêu thích không
  static Future<FavoriteResult> checkFavorite(String songId) async {
    try {
      final response = await ApiClient.get(
        Uri.parse('$baseUrl/check/$songId'),
        requireAuth: true,
      );

      final data = jsonDecode(response.body);

      return FavoriteResult(
        success: data['success'] == true,
        isFavorite: data['isFavorite'] ?? false,
      );
    } on NetworkException catch (ne) {
      return FavoriteResult(success: false, message: ne.message);
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

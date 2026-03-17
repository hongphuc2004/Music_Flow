import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import 'auth_service.dart';

class LikeService {
  static const String baseUrl = 'http://10.29.58.153:5000/api/song-likes';
  static const Duration timeout = Duration(seconds: 15);

  static Future<Map<String, String>> _getAuthHeaders() async {
    final token = await AuthService.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
  }

  static Future<LikeResult> getLikeStatus(String songId) async {
    try {
      final token = await AuthService.getToken();
      if (token == null) {
        return LikeResult(
          success: false,
          message: 'Vui long dang nhap',
          isLiked: false,
          likeCount: 0,
        );
      }

      final response = await http.get(
        Uri.parse('$baseUrl/status/$songId'),
        headers: await _getAuthHeaders(),
      ).timeout(timeout);

      final data = jsonDecode(response.body);
      return LikeResult(
        success: data['success'] == true,
        message: data['message'],
        isLiked: data['isLiked'] ?? false,
        likeCount: data['likeCount'] ?? 0,
      );
    } on TimeoutException {
      return LikeResult(success: false, message: 'Ket noi qua cham');
    } on SocketException {
      return LikeResult(success: false, message: 'Khong co ket noi mang');
    } catch (e) {
      return LikeResult(success: false, message: 'Loi: $e');
    }
  }

  static Future<LikeResult> toggleLike(String songId) async {
    try {
      final token = await AuthService.getToken();
      if (token == null) {
        return LikeResult(success: false, message: 'Vui long dang nhap');
      }

      final response = await http.post(
        Uri.parse('$baseUrl/toggle/$songId'),
        headers: await _getAuthHeaders(),
      ).timeout(timeout);

      final data = jsonDecode(response.body);
      return LikeResult(
        success: data['success'] == true,
        message: data['message'],
        isLiked: data['isLiked'] ?? false,
        likeCount: data['likeCount'] ?? 0,
      );
    } on TimeoutException {
      return LikeResult(success: false, message: 'Ket noi qua cham');
    } on SocketException {
      return LikeResult(success: false, message: 'Khong co ket noi mang');
    } catch (e) {
      return LikeResult(success: false, message: 'Loi: $e');
    }
  }
}

class LikeResult {
  final bool success;
  final String? message;
  final bool? isLiked;
  final int? likeCount;

  LikeResult({
    required this.success,
    this.message,
    this.isLiked,
    this.likeCount,
  });
}

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:musicflow_app/core/config/api_config.dart';
import 'package:musicflow_app/data/models/comment_model.dart';
import 'package:musicflow_app/data/services/auth_service.dart';

class CommentService {
  static const Duration timeout = Duration(seconds: 15);

  static Map<String, dynamic> _tryDecodeJson(String body) {
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
      return <String, dynamic>{};
    } catch (_) {
      return <String, dynamic>{};
    }
  }

  static String _extractErrorMessage(http.Response response, Map<String, dynamic> data) {
    if (response.statusCode == 401) {
      return 'Phien dang nhap het han, vui long dang nhap lai';
    }

    final detailedError = data['error']?.toString();
    if (detailedError != null && detailedError.isNotEmpty) {
      return detailedError;
    }

    final message = data['message']?.toString();
    if (message != null && message.isNotEmpty) {
      return message;
    }
    return 'Yeu cau that bai (HTTP ${response.statusCode})';
  }

  static Future<Map<String, String>> _getAuthHeaders() async {
    final token = await AuthService.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
  }

  static Future<CommentListResult> getSongComments(
    String songId, {
    int page = 1,
    int limit = 10,
    String sort = 'top',
  }) async {
    try {
      final uri = Uri.parse('${ApiConfig.commentsEndpoint}/song/$songId').replace(
        queryParameters: {
          'sort': sort,
          'page': '$page',
          'limit': '$limit',
        },
      );

      final response = await http
          .get(uri)
          .timeout(timeout);

        final data = _tryDecodeJson(response.body);
      if (response.statusCode == 200 && data['success'] == true) {
        final List<dynamic> rawComments = data['comments'] ?? const [];
        final comments = rawComments
            .whereType<Map<String, dynamic>>()
            .map(SongComment.fromJson)
            .toList();

        return CommentListResult(
          success: true,
          comments: comments,
          totalComments: (data['totalComments'] as num?)?.toInt() ?? comments.length,
          totalRootComments: (data['totalRootComments'] as num?)?.toInt() ?? comments.length,
          page: (data['page'] as num?)?.toInt() ?? page,
          limit: (data['limit'] as num?)?.toInt() ?? limit,
          hasMore: data['hasMore'] == true,
        );
      }

      return CommentListResult(
        success: false,
        message: _extractErrorMessage(response, data),
      );
    } on TimeoutException {
      return CommentListResult(success: false, message: 'Ket noi qua cham');
    } on SocketException {
      return CommentListResult(success: false, message: 'Khong co ket noi mang');
    } catch (e) {
      return CommentListResult(success: false, message: 'Loi: $e');
    }
  }

  static Future<CommentActionResult> createComment({
    required String songId,
    required String content,
    String? parentCommentId,
  }) async {
    try {
      final token = await AuthService.getToken();
      if (token == null || token.isEmpty) {
        return CommentActionResult(success: false, message: 'Vui long dang nhap de binh luan');
      }

      final body = <String, dynamic>{
        'songId': songId,
        'content': content,
      };

      if (parentCommentId != null && parentCommentId.isNotEmpty) {
        body['parentCommentId'] = parentCommentId;
      }

      final response = await http
          .post(
            Uri.parse(ApiConfig.commentsEndpoint),
            headers: await _getAuthHeaders(),
            body: jsonEncode(body),
          )
          .timeout(timeout);

      final data = _tryDecodeJson(response.body);
      if (response.statusCode == 401) {
        await AuthService.logout();
      }
      if ((response.statusCode == 200 || response.statusCode == 201) &&
          data['success'] == true) {
        return CommentActionResult(
          success: true,
          message: data['message']?.toString() ?? 'Binh luan thanh cong',
        );
      }

      return CommentActionResult(
        success: false,
        message: _extractErrorMessage(response, data),
      );
    } on TimeoutException {
      return CommentActionResult(success: false, message: 'Ket noi qua cham');
    } on SocketException {
      return CommentActionResult(success: false, message: 'Khong co ket noi mang');
    } catch (e) {
      return CommentActionResult(success: false, message: 'Loi: $e');
    }
  }

  static Future<CommentActionResult> updateComment({
    required String commentId,
    required String content,
  }) async {
    try {
      final token = await AuthService.getToken();
      if (token == null || token.isEmpty) {
        return CommentActionResult(success: false, message: 'Vui long dang nhap');
      }

      final response = await http
          .put(
            Uri.parse('${ApiConfig.commentsEndpoint}/$commentId'),
            headers: await _getAuthHeaders(),
            body: jsonEncode({'content': content}),
          )
          .timeout(timeout);

      final data = _tryDecodeJson(response.body);
      if (response.statusCode == 401) {
        await AuthService.logout();
      }
      return CommentActionResult(
        success: data['success'] == true,
        message: data['success'] == true
            ? (data['message']?.toString() ?? 'Cap nhat thanh cong')
            : _extractErrorMessage(response, data),
      );
    } on TimeoutException {
      return CommentActionResult(success: false, message: 'Ket noi qua cham');
    } on SocketException {
      return CommentActionResult(success: false, message: 'Khong co ket noi mang');
    } catch (e) {
      return CommentActionResult(success: false, message: 'Loi: $e');
    }
  }

  static Future<CommentActionResult> deleteComment(String commentId) async {
    try {
      final token = await AuthService.getToken();
      if (token == null || token.isEmpty) {
        return CommentActionResult(success: false, message: 'Vui long dang nhap');
      }

      final response = await http
          .delete(
            Uri.parse('${ApiConfig.commentsEndpoint}/$commentId'),
            headers: await _getAuthHeaders(),
          )
          .timeout(timeout);

      final data = _tryDecodeJson(response.body);
      if (response.statusCode == 401) {
        await AuthService.logout();
      }
      return CommentActionResult(
        success: data['success'] == true,
        message: data['success'] == true
            ? (data['message']?.toString() ?? 'Xoa thanh cong')
            : _extractErrorMessage(response, data),
      );
    } on TimeoutException {
      return CommentActionResult(success: false, message: 'Ket noi qua cham');
    } on SocketException {
      return CommentActionResult(success: false, message: 'Khong co ket noi mang');
    } catch (e) {
      return CommentActionResult(success: false, message: 'Loi: $e');
    }
  }

  static Future<CommentActionResult> reactToComment({
    required String commentId,
  }) async {
    try {
      final token = await AuthService.getToken();
      if (token == null || token.isEmpty) {
        return CommentActionResult(success: false, message: 'Vui long dang nhap');
      }

      final response = await http
          .put(
            Uri.parse('${ApiConfig.commentsEndpoint}/$commentId/reactions'),
            headers: await _getAuthHeaders(),
            body: jsonEncode({'type': 'like'}),
          )
          .timeout(timeout);

      final data = _tryDecodeJson(response.body);
      if (response.statusCode == 401) {
        await AuthService.logout();
      }
      return CommentActionResult(
        success: data['success'] == true,
        message: data['success'] == true
            ? (data['message']?.toString() ?? 'Cap nhat cam xuc thanh cong')
            : _extractErrorMessage(response, data),
      );
    } on TimeoutException {
      return CommentActionResult(success: false, message: 'Ket noi qua cham');
    } on SocketException {
      return CommentActionResult(success: false, message: 'Khong co ket noi mang');
    } catch (e) {
      return CommentActionResult(success: false, message: 'Loi: $e');
    }
  }

  static Future<CommentActionResult> removeReaction(String commentId) async {
    try {
      final token = await AuthService.getToken();
      if (token == null || token.isEmpty) {
        return CommentActionResult(success: false, message: 'Vui long dang nhap');
      }

      final response = await http
          .delete(
            Uri.parse('${ApiConfig.commentsEndpoint}/$commentId/reactions'),
            headers: await _getAuthHeaders(),
          )
          .timeout(timeout);

      final data = _tryDecodeJson(response.body);
      if (response.statusCode == 401) {
        await AuthService.logout();
      }
      return CommentActionResult(
        success: data['success'] == true,
        message: data['success'] == true
            ? (data['message']?.toString() ?? 'Da go cam xuc')
            : _extractErrorMessage(response, data),
      );
    } on TimeoutException {
      return CommentActionResult(success: false, message: 'Ket noi qua cham');
    } on SocketException {
      return CommentActionResult(success: false, message: 'Khong co ket noi mang');
    } catch (e) {
      return CommentActionResult(success: false, message: 'Loi: $e');
    }
  }
}

class CommentListResult {
  final bool success;
  final String? message;
  final List<SongComment> comments;
  final int totalComments;
  final int totalRootComments;
  final int page;
  final int limit;
  final bool hasMore;

  CommentListResult({
    required this.success,
    this.message,
    this.comments = const [],
    this.totalComments = 0,
    this.totalRootComments = 0,
    this.page = 1,
    this.limit = 10,
    this.hasMore = false,
  });
}

class CommentActionResult {
  final bool success;
  final String? message;

  CommentActionResult({
    required this.success,
    this.message,
  });
}
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../../core/config/api_config.dart';
import 'auth_service.dart';

class AppNotification {
  final String id;
  final String title;
  final String content;
  final String type;
  final bool isRead;
  final DateTime createdAt;

  const AppNotification({
    required this.id,
    required this.title,
    required this.content,
    required this.type,
    required this.isRead,
    required this.createdAt,
  });

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: json['_id'] ?? json['id'] ?? '',
      title: json['title'] ?? '',
      content: json['content'] ?? '',
      type: json['type'] ?? 'general',
      isRead: json['isRead'] == true,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}

class NotificationApiService {
  static final ValueNotifier<int> unreadCountNotifier = ValueNotifier<int>(0);

  /// Lấy số lượng thông báo chưa đọc ngầm
  static Future<int> fetchUnreadCount() async {
    final token = await AuthService.getToken();
    if (token == null || token.isEmpty) {
      unreadCountNotifier.value = 0;
      return 0;
    }

    try {
      final response = await http.get(
        Uri.parse(ApiConfig.notificationsEndpoint),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        if (body['success'] == true) {
          final count = (body['unreadCount'] as num?)?.toInt() ?? 0;
          unreadCountNotifier.value = count;
          return count;
        }
      }
    } catch (e) {
      debugPrint('[NotificationApiService] fetchUnreadCount error: $e');
    }

    return unreadCountNotifier.value;
  }

  /// Lấy danh sách 50 thông báo mới nhất
  static Future<List<AppNotification>> fetchNotifications() async {
    final token = await AuthService.getToken();
    if (token == null || token.isEmpty) {
      unreadCountNotifier.value = 0;
      return [];
    }

    try {
      final response = await http.get(
        Uri.parse(ApiConfig.notificationsEndpoint),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        if (body['success'] == true) {
          final count = (body['unreadCount'] as num?)?.toInt() ?? 0;
          unreadCountNotifier.value = count;

          final list = (body['data'] as List? ?? [])
              .map((item) => AppNotification.fromJson(item as Map<String, dynamic>))
              .toList();
          return list;
        }
      }
    } catch (e) {
      debugPrint('[NotificationApiService] fetchNotifications error: $e');
    }

    return [];
  }

  /// Đánh dấu một thông báo là đã đọc
  static Future<bool> markAsRead(String id) async {
    final token = await AuthService.getToken();
    if (token == null || token.isEmpty) return false;

    try {
      final response = await http.put(
        Uri.parse(ApiConfig.markNotificationReadEndpoint(id)),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      ).timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        if (unreadCountNotifier.value > 0) {
          unreadCountNotifier.value -= 1;
        }
        return true;
      }
    } catch (e) {
      debugPrint('[NotificationApiService] markAsRead error: $e');
    }
    return false;
  }

  /// Đánh dấu tất cả thông báo là đã đọc
  static Future<bool> markAllAsRead() async {
    final token = await AuthService.getToken();
    if (token == null || token.isEmpty) return false;

    try {
      final response = await http.put(
        Uri.parse(ApiConfig.markAllNotificationsReadEndpoint),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      ).timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        unreadCountNotifier.value = 0;
        return true;
      }
    } catch (e) {
      debugPrint('[NotificationApiService] markAllAsRead error: $e');
    }
    return false;
  }
}

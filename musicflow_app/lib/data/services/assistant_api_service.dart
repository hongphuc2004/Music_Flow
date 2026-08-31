import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:musicflow_app/core/config/api_config.dart';
import 'package:musicflow_app/core/config/api_client.dart';
import 'package:musicflow_app/data/models/song_model.dart';

class AssistantMessage {
  final String id;
  final String role; // 'user' hoặc 'assistant'
  final String content;
  final String? playlistId;
  final Map<String, dynamic> metadata;
  final DateTime createdAt;
  final List<Song> songs;

  AssistantMessage({
    required this.id,
    required this.role,
    required this.content,
    this.playlistId,
    this.metadata = const {},
    required this.createdAt,
    this.songs = const [],
  });

  bool get isAssistant => role == 'assistant' || role == 'model';

  factory AssistantMessage.fromJson(Map<String, dynamic> json) {
    final meta = json['metadata'] is Map ? Map<String, dynamic>.from(json['metadata']) : <String, dynamic>{};
    List<Song> parsedSongs = [];

    if (meta['songs'] is List) {
      parsedSongs = (meta['songs'] as List)
          .whereType<Map>()
          .map((s) => Song.fromJson(Map<String, dynamic>.from(s)))
          .toList();
    }

    final rawRole = json['role']?.toString() ?? 'assistant';
    final normalizedRole = (rawRole == 'model' || rawRole == 'assistant') ? 'assistant' : 'user';

    return AssistantMessage(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? 'msg-${DateTime.now().millisecondsSinceEpoch}',
      role: normalizedRole,
      content: json['content']?.toString() ?? '',
      playlistId: meta['playlistId']?.toString() ?? json['playlistId']?.toString(),
      metadata: meta,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
      songs: parsedSongs,
    );
  }
}

class AssistantConversation {
  final String id;
  final String title;
  final String scope;
  final DateTime updatedAt;

  AssistantConversation({
    required this.id,
    required this.title,
    this.scope = 'global',
    required this.updatedAt,
  });

  factory AssistantConversation.fromJson(Map<String, dynamic> json) {
    return AssistantConversation(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Hội thoại mới',
      scope: json['scope']?.toString() ?? 'global',
      updatedAt: json['updatedAt'] != null
          ? DateTime.tryParse(json['updatedAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}

class AssistantQuota {
  final int remaining;
  final int limit;
  final bool isUnlimited;
  final bool isPremium;
  final String planLabel;

  AssistantQuota({
    required this.remaining,
    required this.limit,
    required this.isUnlimited,
    required this.isPremium,
    required this.planLabel,
  });

  factory AssistantQuota.fromJson(Map<String, dynamic> json) {
    final data = json['data'] is Map ? json['data'] as Map : json;
    return AssistantQuota(
      remaining: (data['remaining'] as num?)?.toInt() ?? 10,
      limit: (data['limit'] as num?)?.toInt() ?? 10,
      isUnlimited: data['isUnlimited'] == true,
      isPremium: data['isPremium'] == true,
      planLabel: data['planLabel']?.toString() ?? (data['isPremium'] == true ? 'Premium' : 'Free'),
    );
  }
}

class AssistantSendResult {
  final bool success;
  final String message;
  final String? conversationId;
  final AssistantMessage? assistantMessage;
  final List<Song> songs;
  final Map<String, dynamic>? playlist;
  final List<dynamic> clientActions;
  final bool isQuotaExceeded;

  AssistantSendResult({
    required this.success,
    required this.message,
    this.conversationId,
    this.assistantMessage,
    this.songs = const [],
    this.playlist,
    this.clientActions = const [],
    this.isQuotaExceeded = false,
  });
}

class AssistantApiService {
  static const String baseUrl = ApiConfig.assistantEndpoint;

  /// Gửi tin nhắn đến AI Assistant
  static Future<AssistantSendResult> sendMessage({
    required String prompt,
    String? conversationId,
    String scope = 'global',
  }) async {
    try {
      final response = await ApiClient.post(
        Uri.parse('$baseUrl/messages'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'prompt': prompt,
          if (conversationId != null && conversationId.isNotEmpty) 'conversationId': conversationId,
          'scope': scope,
        }),
      );

      final data = json.decode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        final resData = data['data'] ?? {};
        final conv = resData['conversation'];
        final aiMsgText = resData['assistantMessage']?.toString() ?? '';
        final rawActions = resData['clientActions'] is List ? resData['clientActions'] as List : [];
        final rawPlaylist = resData['playlist'] is Map ? Map<String, dynamic>.from(resData['playlist']) : null;

        List<Song> parsedSongs = [];
        if (resData['songs'] is List) {
          parsedSongs = (resData['songs'] as List)
              .whereType<Map>()
              .map((s) => Song.fromJson(Map<String, dynamic>.from(s)))
              .toList();
        } else if (rawPlaylist != null && rawPlaylist['songs'] is List) {
          parsedSongs = (rawPlaylist['songs'] as List)
              .whereType<Map>()
              .map((s) => Song.fromJson(Map<String, dynamic>.from(s)))
              .toList();
        }

        final assistantMsg = AssistantMessage(
          id: 'ai-${DateTime.now().millisecondsSinceEpoch}',
          role: 'assistant',
          content: aiMsgText.isNotEmpty ? aiMsgText : (rawPlaylist != null ? 'Tôi đã tạo danh sách phát phù hợp cho bạn:' : 'Đã thực hiện xong yêu cầu của bạn.'),
          playlistId: rawPlaylist?['_id']?.toString(),
          metadata: {
            if (rawPlaylist != null) 'playlist': rawPlaylist,
            if (parsedSongs.isNotEmpty) 'songs': resData['songs'] ?? rawPlaylist?['songs'],
          },
          createdAt: DateTime.now(),
          songs: parsedSongs,
        );

        return AssistantSendResult(
          success: true,
          message: 'Thành công',
          conversationId: conv?['_id']?.toString() ?? conversationId,
          assistantMessage: assistantMsg,
          songs: parsedSongs,
          playlist: rawPlaylist,
          clientActions: rawActions,
        );
      } else {
        final errorMsg = data['message']?.toString() ?? 'Gửi tin nhắn thất bại';
        final isQuota = response.statusCode == 403 && (errorMsg.contains('hạn mức') || errorMsg.contains('quota'));
        return AssistantSendResult(
          success: false,
          message: errorMsg,
          isQuotaExceeded: isQuota,
        );
      }
    } catch (e) {
      debugPrint('[AssistantApiService] Error: $e');
      return AssistantSendResult(
        success: false,
        message: 'Lỗi kết nối máy chủ: $e',
      );
    }
  }

  /// Lấy thông tin hạn mức Quota còn lại trong ngày
  static Future<AssistantQuota?> getQuota() async {
    try {
      final response = await ApiClient.get(Uri.parse('$baseUrl/quota'));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['data'] != null) {
          return AssistantQuota.fromJson(Map<String, dynamic>.from(data['data']));
        }
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Lấy danh sách các cuộc hội thoại đã lưu
  static Future<List<AssistantConversation>> getConversations({String scope = 'global'}) async {
    try {
      final uri = Uri.parse('$baseUrl/conversations').replace(
        queryParameters: {'scope': scope},
      );
      final response = await ApiClient.get(uri);
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['data'] is List) {
          return (data['data'] as List)
              .map((c) => AssistantConversation.fromJson(c as Map<String, dynamic>))
              .toList();
        }
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  /// Lấy chi tiết cuộc hội thoại và lịch sử tin nhắn
  static Future<List<AssistantMessage>> getConversationMessages(String conversationId) async {
    try {
      final response = await ApiClient.get(Uri.parse('$baseUrl/conversations/$conversationId'));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['success'] == true && data['data'] != null) {
          final messages = data['data']['messages'];
          if (messages is List) {
            return messages
                .map((m) => AssistantMessage.fromJson(m as Map<String, dynamic>))
                .toList();
          }
        }
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  /// Xóa một cuộc hội thoại
  static Future<bool> deleteConversation(String conversationId) async {
    try {
      final response = await ApiClient.delete(Uri.parse('$baseUrl/conversations/$conversationId'));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return data['success'] == true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }
}

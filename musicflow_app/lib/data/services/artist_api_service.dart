import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:musicflow_app/core/config/api_config.dart';
import 'package:musicflow_app/data/models/artist_profile_model.dart';
import 'package:musicflow_app/data/services/auth_service.dart';

class ArtistApiService {
  static const Duration _timeout = Duration(seconds: 15);

  static Future<ArtistProfileResult> fetchArtistProfileByName(
    String artistName,
  ) async {
    try {
      final response = await http
          .get(Uri.parse(ApiConfig.artistProfileUrlByName(artistName)))
          .timeout(_timeout);

      final data = _decodeToMap(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        final artistJson = _asMap(data['artist']);
        if (artistJson == null) {
          return ArtistProfileResult(
            success: false,
            message: 'Du lieu artist khong hop le',
          );
        }

        return ArtistProfileResult(
          success: true,
          artist: ArtistProfile.fromJson(artistJson),
        );
      }

      return ArtistProfileResult(
        success: false,
        message: data['message']?.toString() ?? 'Khong the tai thong tin artist',
      );
    } catch (e) {
      return ArtistProfileResult(
        success: false,
        message: 'Loi tai artist: $e',
      );
    }
  }

  static Future<ArtistFollowStatusResult> getFollowStatus(String artistId) async {
    try {
      final token = await AuthService.getToken();
      if (token == null || token.isEmpty) {
        return ArtistFollowStatusResult(success: true, isFollowing: false);
      }

      final response = await http.get(
        Uri.parse('${ApiConfig.artistEndpoint}/$artistId/follow-status'),
        headers: {
          'Authorization': 'Bearer $token',
        },
      ).timeout(_timeout);

      final data = _decodeToMap(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        return ArtistFollowStatusResult(
          success: true,
          isFollowing: data['isFollowing'] == true,
        );
      }

      return ArtistFollowStatusResult(
        success: false,
        isFollowing: false,
        message: data['message']?.toString() ?? 'Khong the lay trang thai follow',
      );
    } catch (e) {
      return ArtistFollowStatusResult(
        success: false,
        isFollowing: false,
        message: 'Loi follow status: $e',
      );
    }
  }

  static Future<ToggleArtistFollowResult> toggleFollowArtist(
    String artistId,
  ) async {
    try {
      final token = await AuthService.getToken();
      if (token == null || token.isEmpty) {
        return ToggleArtistFollowResult(
          success: false,
          message: 'Vui long dang nhap de theo doi artist',
        );
      }

      final response = await http.post(
        Uri.parse('${ApiConfig.artistEndpoint}/$artistId/follow'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      ).timeout(_timeout);

      final data = _decodeToMap(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        final followersValue = data['followers'];
        return ToggleArtistFollowResult(
          success: true,
          isFollowing: data['isFollowing'] == true,
          followers: followersValue is num ? followersValue.toInt() : null,
          message: data['message']?.toString(),
        );
      }

      return ToggleArtistFollowResult(
        success: false,
        message: data['message']?.toString() ?? 'Khong the cap nhat follow artist',
      );
    } catch (e) {
      return ToggleArtistFollowResult(
        success: false,
        message: 'Loi follow artist: $e',
      );
    }
  }

  static Map<String, dynamic> _decodeToMap(String responseBody) {
    final decoded = jsonDecode(responseBody);
    return _asMap(decoded) ?? <String, dynamic>{};
  }

  static Map<String, dynamic>? _asMap(dynamic value) {
    if (value is Map<String, dynamic>) {
      return value;
    }
    if (value is Map) {
      return value.map(
        (key, mapValue) => MapEntry(key.toString(), mapValue),
      );
    }
    return null;
  }
}

class ArtistProfileResult {
  final bool success;
  final ArtistProfile? artist;
  final String? message;

  ArtistProfileResult({
    required this.success,
    this.artist,
    this.message,
  });
}

class ArtistFollowStatusResult {
  final bool success;
  final bool isFollowing;
  final String? message;

  ArtistFollowStatusResult({
    required this.success,
    required this.isFollowing,
    this.message,
  });
}

class ToggleArtistFollowResult {
  final bool success;
  final bool? isFollowing;
  final int? followers;
  final String? message;

  ToggleArtistFollowResult({
    required this.success,
    this.isFollowing,
    this.followers,
    this.message,
  });
}

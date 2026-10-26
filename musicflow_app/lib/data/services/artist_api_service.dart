import 'dart:convert';
import 'package:musicflow_app/core/config/api_config.dart';
import 'package:musicflow_app/core/config/api_client.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/data/models/artist_profile_model.dart';
import 'package:musicflow_app/data/services/auth_service.dart';

class ArtistApiService {
  // In-memory cache for profiles
  static final Map<String, ArtistProfileResult> _profileCache = {};

  /// Cache an avatar for an artist name
  static void cacheAvatar(String artistName, String avatarUrl) {
    if (artistName.isNotEmpty && avatarUrl.isNotEmpty) {
      Song.artistAvatars[artistName.trim().toLowerCase()] = avatarUrl;
    }
  }

  /// Get cached avatar for an artist name
  static String? getCachedAvatar(String artistName) {
    return Song.artistAvatars[artistName.trim().toLowerCase()];
  }

  /// Clear in-memory caches
  static void clearCaches() {
    _profileCache.clear();
    Song.artistAvatars.clear();
  }

  static Future<ArtistProfileResult> fetchArtistProfileByName(
    String artistName,
  ) async {
    final key = artistName.trim().toLowerCase();
    if (_profileCache.containsKey(key)) {
      return _profileCache[key]!;
    }

    try {
      final response = await ApiClient.get(
        Uri.parse(ApiConfig.artistProfileUrlByName(artistName)),
      );

      // Handle 404 Artist Not Found specifically to cache the failure (negative caching)
      if (response.statusCode == 404) {
        final profileResult = ArtistProfileResult(
          success: false,
          message: 'Nghệ sĩ không tồn tại',
        );
        _profileCache[key] = profileResult;
        return profileResult;
      }

      final data = _decodeToMap(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        final artistJson = _asMap(data['artist']);
        if (artistJson == null) {
          return ArtistProfileResult(
            success: false,
            message: 'Du lieu artist khong hop le',
          );
        }

        final profileResult = ArtistProfileResult(
          success: true,
          artist: ArtistProfile.fromJson(artistJson),
        );

        _profileCache[key] = profileResult;

        if (profileResult.artist?.avatarUrl.isNotEmpty ?? false) {
          cacheAvatar(artistName, profileResult.artist!.avatarUrl);
        }

        return profileResult;
      }

      // Also cache other logical failures if success is false
      final profileResult = ArtistProfileResult(
        success: false,
        message:
            data['message']?.toString() ?? 'Không thể tải thông tin nghệ sĩ',
      );
      if (response.statusCode == 400 || (data['success'] == false && data['message']?.toString().contains('not found') == true)) {
        _profileCache[key] = profileResult;
      }
      return profileResult;
    } catch (e) {
      return ArtistProfileResult(success: false, message: 'Loi tai artist: $e');
    }
  }

  static Future<ArtistFollowStatusResult> getFollowStatus(
    String artistId,
  ) async {
    try {
      final token = await AuthService.getToken();
      if (token == null || token.isEmpty) {
        return ArtistFollowStatusResult(success: true, isFollowing: false);
      }

      final response = await ApiClient.get(
        Uri.parse('${ApiConfig.artistEndpoint}/$artistId/follow-status'),
        requireAuth: true,
      );

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
        message:
            data['message']?.toString() ?? 'Không thể lấy trạng thái follow',
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
          message: 'Vui lòng đăng nhập để theo dõi nghệ sĩ',
        );
      }

      final response = await ApiClient.post(
        Uri.parse('${ApiConfig.artistEndpoint}/$artistId/follow'),
      );

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
        message:
            data['message']?.toString() ?? 'Không thể cập nhật follow nghệ sĩ',
      );
    } catch (e) {
      return ToggleArtistFollowResult(
        success: false,
        message: 'Loi follow artist: $e',
      );
    }
  }

  static Future<List<ArtistSuggestion>> fetchSuggestions({
    String? artistId,
    String? artistName,
    int limit = 4,
  }) async {
    try {
      final token = await AuthService.getToken();
      final headers = <String, String>{};
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }

      final url = ApiConfig.artistSuggestionsUrl(
        artistId: artistId,
        artistName: artistName,
        limit: limit,
      );

      final response = await ApiClient.get(Uri.parse(url), headers: headers);
      if (response.statusCode == 200) {
        final data = _decodeToMap(response.body);
        if (data['success'] == true && data['suggestions'] is List) {
          final list = (data['suggestions'] as List)
              .whereType<Map>()
              .map(
                (item) => ArtistSuggestion.fromJson(
                  Map<String, dynamic>.from(item),
                ),
              )
              .toList();
          for (final item in list) {
            if (item.avatarUrl.isNotEmpty) {
              cacheAvatar(item.name, item.avatarUrl);
            }
          }
          return list;
        }
      }
      return const [];
    } catch (e) {
      return const [];
    }
  }

  static Future<List<FollowingArtist>> fetchFollowingArtists({
    String search = '',
    int page = 1,
    int limit = 50,
  }) async {
    try {
      final token = await AuthService.getToken();
      if (token == null || token.isEmpty) return const [];

      final queryParams = <String>[
        'page=$page',
        'limit=$limit',
        if (search.isNotEmpty) 'search=${Uri.encodeComponent(search)}',
      ].join('&');

      final url = '${ApiConfig.artistEndpoint}/me/following?$queryParams';
      final response = await ApiClient.get(Uri.parse(url), requireAuth: true);

      if (response.statusCode == 200) {
        final data = _decodeToMap(response.body);
        if (data['success'] == true && data['data'] is List) {
          final list = (data['data'] as List)
              .whereType<Map>()
              .map((item) => FollowingArtist.fromJson(Map<String, dynamic>.from(item)))
              .toList();
          for (final item in list) {
            if (item.avatarUrl.isNotEmpty) {
              cacheAvatar(item.name, item.avatarUrl);
            }
          }
          return list;
        }
      }
      return const [];
    } catch (e) {
      return const [];
    }
  }

  static Future<List<ArtistFollower>> fetchArtistFollowers({
    String? artistId,
    String search = '',
    int page = 1,
    int limit = 50,
  }) async {
    try {
      final queryParams = <String>[
        'page=$page',
        'limit=$limit',
        if (search.isNotEmpty) 'search=${Uri.encodeComponent(search)}',
      ].join('&');

      final url = (artistId != null && artistId.isNotEmpty)
          ? '${ApiConfig.artistEndpoint}/$artistId/followers?$queryParams'
          : '${ApiConfig.artistEndpoint}/me/followers?$queryParams';

      final response = await ApiClient.get(Uri.parse(url), requireAuth: artistId == null);

      if (response.statusCode == 200) {
        final data = _decodeToMap(response.body);
        if (data['success'] == true && data['data'] is List) {
          return (data['data'] as List)
              .whereType<Map>()
              .map((item) => ArtistFollower.fromJson(Map<String, dynamic>.from(item)))
              .toList();
        }
      }
      return const [];
    } catch (e) {
      return const [];
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
      return value.map((key, mapValue) => MapEntry(key.toString(), mapValue));
    }
    return null;
  }
}

class FollowingArtist {
  final String id;
  final String name;
  final String slug;
  final String avatarUrl;
  final String bio;
  final bool isVerified;
  final bool isPro;
  final int followersCount;
  final int songsCount;
  bool isFollowing;

  FollowingArtist({
    required this.id,
    required this.name,
    this.slug = '',
    required this.avatarUrl,
    this.bio = '',
    this.isVerified = false,
    this.isPro = false,
    this.followersCount = 0,
    this.songsCount = 0,
    this.isFollowing = true,
  });

  factory FollowingArtist.fromJson(Map<String, dynamic> json) {
    return FollowingArtist(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      slug: json['slug']?.toString() ?? '',
      avatarUrl: json['avatar']?.toString() ?? json['avatarUrl']?.toString() ?? '',
      bio: json['bio']?.toString() ?? '',
      isVerified: json['isVerified'] == true,
      isPro: json['isPro'] == true,
      followersCount: (json['followersCount'] as num?)?.toInt() ?? 0,
      songsCount: (json['songsCount'] as num?)?.toInt() ?? 0,
      isFollowing: json['isFollowing'] != false,
    );
  }
}

class ArtistFollower {
  final String id;
  final String name;
  final String email;
  final String avatarUrl;
  final DateTime? createdAt;

  ArtistFollower({
    required this.id,
    required this.name,
    this.email = '',
    required this.avatarUrl,
    this.createdAt,
  });

  factory ArtistFollower.fromJson(Map<String, dynamic> json) {
    DateTime? parsedDate;
    if (json['createdAt'] != null) {
      try {
        parsedDate = DateTime.parse(json['createdAt'].toString());
      } catch (_) {}
    }
    return ArtistFollower(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      avatarUrl: json['avatar']?.toString() ?? json['avatarUrl']?.toString() ?? '',
      createdAt: parsedDate,
    );
  }
}

class ArtistSuggestion {
  final String id;
  final String name;
  final String avatarUrl;
  final bool isVerified;
  final int followersCount;
  final String role;
  bool isFollowing;

  ArtistSuggestion({
    required this.id,
    required this.name,
    required this.avatarUrl,
    this.isVerified = false,
    this.followersCount = 0,
    required this.role,
    this.isFollowing = false,
  });

  factory ArtistSuggestion.fromJson(Map<String, dynamic> json) {
    return ArtistSuggestion(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      avatarUrl: json['avatar']?.toString() ?? json['avatarUrl']?.toString() ?? '',
      isVerified: json['isVerified'] == true,
      followersCount: (json['followersCount'] as num?)?.toInt() ??
          (json['followers'] as num?)?.toInt() ??
          0,
      role: json['role']?.toString() ?? 'Nghệ sĩ đề xuất',
      isFollowing: json['isFollowing'] == true,
    );
  }
}

class ArtistProfileResult {
  final bool success;
  final ArtistProfile? artist;
  final String? message;

  ArtistProfileResult({required this.success, this.artist, this.message});
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

class Song {
  final String id;
  final String title;
  final List<String> artists;
  final String audioUrl;
  final String imageUrl;
  final String lyrics;
  final String? uploadedBy;
  final bool isPublic;
  final double? duration; // Duration in seconds from backend
  final int playCount;
  final int likeCount;
  final List<String> topicIds;
  final String audioFormat;
  final int? bitrate;
  final bool hasHighQualitySource;
  final int fileSize;

  // Global cache of artist metadata to avoid circular dependencies
  static final Map<String, String> artistAvatars = {};
  static final Map<String, bool> artistVerified = {};
  static final Map<String, int> artistFollowers = {};

  Song({
    required this.id,
    required this.title,
    required this.artists,
    required this.audioUrl,
    required this.imageUrl,
    required this.lyrics,
    this.uploadedBy,
    this.isPublic = false,
    this.duration,
    this.playCount = 0,
    this.likeCount = 0,
    this.topicIds = const [],
    this.audioFormat = 'mp3',
    this.bitrate,
    this.hasHighQualitySource = false,
    this.fileSize = 0,
  });

  /// Có phải là bài hát chất lượng cao (320kbps trở lên hoặc lossless)
  bool get isHighQuality =>
      (hasHighQualitySource == true) || (bitrate != null && bitrate! >= 320000);

  /// Nhãn hiển thị chất lượng thực tế từ DB
  String get qualityLabel {
    if (bitrate != null && bitrate! > 0) {
      final kbps = (bitrate! / 1000).round();
      return '${kbps}kbps';
    }
    if (hasHighQualitySource == true) return '320kbps HQ';
    return '128kbps';
  }

  /// Mô tả chi tiết chất lượng thật cho dialog thông tin
  String get qualityDetailedDescription {
    final fmt = audioFormat.isNotEmpty ? audioFormat.toUpperCase() : 'MP3';
    if (bitrate != null && bitrate! > 0) {
      final kbps = (bitrate! / 1000).round();
      if (kbps >= 320) {
        return '$kbps kbps ($fmt Chất lượng cao)';
      }
      return '$kbps kbps ($fmt Tiêu chuẩn)';
    }
    if (hasHighQualitySource == true) {
      return '320 kbps ($fmt Chất lượng cao)';
    }
    return '128 kbps ($fmt Tiêu chuẩn)';
  }

  /// Duration as Duration object for audio player
  Duration? get durationAsDuration => duration != null
      ? Duration(milliseconds: (duration! * 1000).toInt())
      : null;

  static List<String> _parseArtists(dynamic rawArtists, dynamic rawArtist) {
    final parsedArtists = <String>[];

    if (rawArtists is List) {
      for (final artist in rawArtists) {
        if (artist is String) {
          final value = artist.trim();
          if (value.isNotEmpty) parsedArtists.add(value);
        } else if (artist is Map) {
          final value =
              (artist['name'] ??
                      artist['artistName'] ??
                      artist['artist_name'] ??
                      artist['fullName'])
                  ?.toString()
                  .trim();
          if (value != null && value.isNotEmpty) {
            parsedArtists.add(value);
            final avatar = artist['avatar']?.toString() ??
                artist['avatarUrl']?.toString() ??
                '';
            if (avatar.isNotEmpty) {
              artistAvatars[value.toLowerCase()] = avatar;
            }
            final verified = artist['isVerified'] == true;
            final followers = (artist['followersCount'] as num?)?.toInt() ?? 0;
            artistVerified[value.toLowerCase()] = verified;
            artistFollowers[value.toLowerCase()] = followers;
          }
        }
      }
    } else if (rawArtists is String && rawArtists.trim().isNotEmpty) {
      parsedArtists.addAll(
        rawArtists.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty),
      );
    }

    if (parsedArtists.isEmpty &&
        rawArtist is String &&
        rawArtist.trim().isNotEmpty) {
      parsedArtists.addAll(
        rawArtist.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty),
      );
    }

    return parsedArtists;
  }

  factory Song.fromJson(Map<String, dynamic> json) {
    final artists = _parseArtists(json['artists'], json['artist']);
    final playCount =
        (json['playCount'] as num?)?.toInt() ??
        (json['listenCount'] as num?)?.toInt() ??
        (json['streamCount'] as num?)?.toInt() ??
        (json['viewCount'] as num?)?.toInt() ??
        (json['views'] as num?)?.toInt() ??
        0;

    List<String> topicIds = [];
    if (json['topicIds'] != null && json['topicIds'] is List) {
      for (var t in json['topicIds']) {
        if (t is String) {
          topicIds.add(t);
        } else if (t is Map && t['name'] != null) {
          topicIds.add(t['name'].toString());
        }
      }
    }

    final audioMeta = json['audioMetadata'] is Map ? json['audioMetadata'] as Map : null;
    final audioFormat = audioMeta?['format']?.toString() ?? 'mp3';
    final bitrate = (audioMeta?['bitrate'] as num?)?.toInt();
    final hasHighQualitySource =
        audioMeta?['hasHighQualitySource'] == true ||
        json['hasHighQualitySource'] == true;
    final fileSize = (json['fileSize'] as num?)?.toInt() ?? 0;

    return Song(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      title: (json['title'] ?? '').toString(),
      artists: artists,
      audioUrl: (json['audioUrl'] ?? '').toString(),
      imageUrl: (json['imageUrl'] ?? '').toString(),
      lyrics: (json['lyrics'] ?? '').toString(),
      uploadedBy: json['uploadedBy']?.toString(),
      isPublic: json['isPublic'] == true,
      duration: json['duration'] != null ? (json['duration'] as num).toDouble() : null,
      playCount: playCount,
      likeCount: (json['likeCount'] as num?)?.toInt() ?? 0,
      topicIds: topicIds,
      audioFormat: audioFormat,
      bitrate: bitrate,
      hasHighQualitySource: hasHighQualitySource,
      fileSize: fileSize,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'title': title,
      'artists': artists,
      'audioUrl': audioUrl,
      'imageUrl': imageUrl,
      'lyrics': lyrics,
      'uploadedBy': uploadedBy,
      'isPublic': isPublic,
      'duration': duration,
      'playCount': playCount,
      'likeCount': likeCount,
      'topicIds': topicIds,
      'audioMetadata': {
        'format': audioFormat,
        'bitrate': bitrate,
        'hasHighQualitySource': hasHighQualitySource,
      },
      'fileSize': fileSize,
    };
  }

  /// Copy with modified fields
  Song copyWith({
    String? title,
    List<String>? artists,
    String? lyrics,
    bool? isPublic,
    int? playCount,
    int? likeCount,
    List<String>? topicIds,
    String? audioFormat,
    int? bitrate,
    bool? hasHighQualitySource,
    int? fileSize,
  }) {
    return Song(
      id: id,
      title: title ?? this.title,
      artists: artists ?? this.artists,
      audioUrl: audioUrl,
      imageUrl: imageUrl,
      lyrics: lyrics ?? this.lyrics,
      uploadedBy: uploadedBy,
      isPublic: isPublic ?? this.isPublic,
      duration: duration,
      playCount: playCount ?? this.playCount,
      likeCount: likeCount ?? this.likeCount,
      topicIds: topicIds ?? this.topicIds,
      audioFormat: audioFormat ?? this.audioFormat,
      bitrate: bitrate ?? this.bitrate,
      hasHighQualitySource: hasHighQualitySource ?? this.hasHighQualitySource,
      fileSize: fileSize ?? this.fileSize,
    );
  }
}


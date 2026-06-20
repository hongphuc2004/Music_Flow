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
  });

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

    return Song(
      id: json['_id'],
      title: json['title'],
      artists: artists,
      audioUrl: json['audioUrl'],
      imageUrl: json['imageUrl'] ?? '',
      lyrics: json['lyrics'] ?? '',
      uploadedBy: json['uploadedBy'],
      isPublic: json['isPublic'] ?? false,
      duration: json['duration']?.toDouble(),
      playCount: playCount,
      likeCount: (json['likeCount'] as num?)?.toInt() ?? 0,
      topicIds: topicIds,
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
    );
  }
}

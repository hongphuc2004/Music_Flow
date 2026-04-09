import 'package:musicflow_app/data/models/song_model.dart';

class ArtistProfile {
  final String id;
  final String name;
  final String avatarUrl;
  final String coverUrl;
  final String bio;
  final int totalSongs;
  final int totalLikes;
  final int monthlyListeners;
  final int followers;
  final String latestReleaseLabel;
  final List<Song> songs;

  const ArtistProfile({
    required this.id,
    required this.name,
    required this.avatarUrl,
    required this.coverUrl,
    required this.bio,
    required this.totalSongs,
    required this.totalLikes,
    required this.monthlyListeners,
    required this.followers,
    required this.latestReleaseLabel,
    this.songs = const [],
  });

  ArtistProfile copyWith({
    String? id,
    String? name,
    String? avatarUrl,
    String? coverUrl,
    String? bio,
    int? totalSongs,
    int? totalLikes,
    int? monthlyListeners,
    int? followers,
    String? latestReleaseLabel,
    List<Song>? songs,
  }) {
    return ArtistProfile(
      id: id ?? this.id,
      name: name ?? this.name,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      coverUrl: coverUrl ?? this.coverUrl,
      bio: bio ?? this.bio,
      totalSongs: totalSongs ?? this.totalSongs,
      totalLikes: totalLikes ?? this.totalLikes,
      monthlyListeners: monthlyListeners ?? this.monthlyListeners,
      followers: followers ?? this.followers,
      latestReleaseLabel: latestReleaseLabel ?? this.latestReleaseLabel,
      songs: songs ?? this.songs,
    );
  }

  factory ArtistProfile.fromJson(Map<String, dynamic> json) {
    final songsJson = (json['songs'] as List?) ?? const [];
    return ArtistProfile(
      id: json['_id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      avatarUrl: json['avatar']?.toString() ?? '',
      coverUrl: json['coverUrl']?.toString() ?? json['avatar']?.toString() ?? '',
      bio: json['bio']?.toString() ?? '',
      totalSongs: (json['totalSongs'] as num?)?.toInt() ?? 0,
      totalLikes: (json['totalLikes'] as num?)?.toInt() ?? 0,
      monthlyListeners: (json['monthlyListeners'] as num?)?.toInt() ?? 0,
      followers: (json['followers'] as num?)?.toInt() ?? 0,
      latestReleaseLabel: json['latestReleaseLabel']?.toString() ?? 'Chua cap nhat',
      songs: songsJson
          .whereType<Map>()
          .map((song) => Song.fromJson(Map<String, dynamic>.from(song)))
          .toList(),
    );
  }
}

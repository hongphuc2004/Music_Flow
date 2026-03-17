class Song {
  final String id;
  final String title;
  final String artist;
  final String audioUrl;
  final String imageUrl;
  final String lyrics;
  final String? uploadedBy;
  final bool isPublic;
  final double? duration; // Duration in seconds from backend
  final int likeCount;

  Song({
    required this.id,
    required this.title,
    required this.artist,
    required this.audioUrl,
    required this.imageUrl,
    required this.lyrics,
    this.uploadedBy,
    this.isPublic = false,
    this.duration,
    this.likeCount = 0,
  });

  /// Duration as Duration object for audio player
  Duration? get durationAsDuration => duration != null 
      ? Duration(milliseconds: (duration! * 1000).toInt()) 
      : null;

  factory Song.fromJson(Map<String, dynamic> json) {
    return Song(
      id: json['_id'],
      title: json['title'],
      artist: json['artist'],
      audioUrl: json['audioUrl'],
      imageUrl: json['imageUrl'] ?? '',
      lyrics: json['lyrics'] ?? '',
      uploadedBy: json['uploadedBy'],
      isPublic: json['isPublic'] ?? false,
      duration: json['duration']?.toDouble(),
      likeCount: (json['likeCount'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'title': title,
      'artist': artist,
      'audioUrl': audioUrl,
      'imageUrl': imageUrl,
      'lyrics': lyrics,
      'uploadedBy': uploadedBy,
      'isPublic': isPublic,
      'duration': duration,
      'likeCount': likeCount,
    };
  }

  /// Copy with modified fields
  Song copyWith({
    String? title,
    String? artist,
    String? lyrics,
    bool? isPublic,
    int? likeCount,
  }) {
    return Song(
      id: id,
      title: title ?? this.title,
      artist: artist ?? this.artist,
      audioUrl: audioUrl,
      imageUrl: imageUrl,
      lyrics: lyrics ?? this.lyrics,
      uploadedBy: uploadedBy,
      isPublic: isPublic ?? this.isPublic,
      duration: duration,
      likeCount: likeCount ?? this.likeCount,
    );
  }
}

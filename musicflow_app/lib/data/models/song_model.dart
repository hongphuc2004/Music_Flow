
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
  final int likeCount;
  final List<String> topicIds;

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
    this.likeCount = 0,
    this.topicIds = const [],
  });

  /// Duration as Duration object for audio player
  Duration? get durationAsDuration => duration != null 
      ? Duration(milliseconds: (duration! * 1000).toInt()) 
      : null;


  factory Song.fromJson(Map<String, dynamic> json) {
    List<String> artists = [];
    if (json['artists'] != null && json['artists'] is List) {
      for (var a in json['artists']) {
        if (a is String) {
          artists.add(a);
        } else if (a is Map && a['name'] != null) {
          artists.add(a['name'].toString());
        }
      }
    }
    
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
      likeCount: likeCount ?? this.likeCount,
      topicIds: topicIds ?? this.topicIds,
    );
  }
}

class Song {
  final String id;
  final String title;
  final String artist;
  final String audioUrl;
  final String imageUrl;
  final String lyrics;

  Song({
    required this.id,
    required this.title,
    required this.artist,
    required this.audioUrl,
    required this.imageUrl,
    required this.lyrics,
  });

  factory Song.fromJson(Map<String, dynamic> json) {
    return Song(
      id: json['_id'],
      title: json['title'],
      artist: json['artist'],
      audioUrl: json['audioUrl'],
      imageUrl: json['imageUrl'] ?? '',
      lyrics: json['lyrics'] ?? '',
    );
  }
}

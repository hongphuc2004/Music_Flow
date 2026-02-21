import 'song_model.dart';

class Playlist {
  final String id;
  final String name;
  final String description;
  final String userId;
  final List<Song> songs;
  final String coverImage;
  final bool isPublic;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  Playlist({
    required this.id,
    required this.name,
    this.description = '',
    required this.userId,
    this.songs = const [],
    this.coverImage = '',
    this.isPublic = false,
    this.createdAt,
    this.updatedAt,
  });

  // Số lượng bài hát trong playlist
  int get songCount => songs.length;

  // Lấy ảnh bìa (nếu không có thì lấy ảnh từ bài hát đầu tiên)
  String get displayCoverImage {
    if (coverImage.isNotEmpty) return coverImage;
    if (songs.isNotEmpty) return songs.first.imageUrl;
    return '';
  }

  factory Playlist.fromJson(Map<String, dynamic> json) {
    // Parse songs - có thể là list of objects hoặc list of IDs
    List<Song> parsedSongs = [];
    if (json['songs'] != null) {
      for (var item in json['songs']) {
        if (item is Map<String, dynamic>) {
          parsedSongs.add(Song.fromJson(item));
        }
      }
    }

    return Playlist(
      id: json['_id'] ?? '',
      name: json['name'] ?? '',
      description: json['description'] ?? '',
      userId: json['userId'] is Map 
          ? json['userId']['_id'] ?? '' 
          : json['userId'] ?? '',
      songs: parsedSongs,
      coverImage: json['coverImage'] ?? '',
      isPublic: json['isPublic'] ?? false,
      createdAt: json['createdAt'] != null 
          ? DateTime.tryParse(json['createdAt']) 
          : null,
      updatedAt: json['updatedAt'] != null 
          ? DateTime.tryParse(json['updatedAt']) 
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'name': name,
      'description': description,
      'userId': userId,
      'songs': songs.map((s) => s.id).toList(),
      'coverImage': coverImage,
      'isPublic': isPublic,
    };
  }

  // Copy with để tạo bản sao với một số thay đổi
  Playlist copyWith({
    String? id,
    String? name,
    String? description,
    String? userId,
    List<Song>? songs,
    String? coverImage,
    bool? isPublic,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Playlist(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      userId: userId ?? this.userId,
      songs: songs ?? this.songs,
      coverImage: coverImage ?? this.coverImage,
      isPublic: isPublic ?? this.isPublic,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

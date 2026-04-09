class User {
  final String id;
  final String name;
  final String email;
  final String avatar;
  final List<String> favoriteSongs;
  final List<String> playlists;
  final List<String> followedArtists;

  User({
    required this.id,
    required this.name,
    required this.email,
    this.avatar = '',
    this.favoriteSongs = const [],
    this.playlists = const [],
    this.followedArtists = const [],
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['_id'] ?? '',
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      avatar: json['avatar'] ?? '',
      favoriteSongs: List<String>.from(json['favoriteSongs'] ?? []),
      playlists: List<String>.from(json['playlists'] ?? []),
      followedArtists: List<String>.from(json['followedArtists'] ?? []),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'name': name,
      'email': email,
      'avatar': avatar,
      'favoriteSongs': favoriteSongs,
      'playlists': playlists,
      'followedArtists': followedArtists,
    };
  }

  User copyWith({
    String? id,
    String? name,
    String? email,
    String? avatar,
    List<String>? favoriteSongs,
    List<String>? playlists,
    List<String>? followedArtists,
  }) {
    return User(
      id: id ?? this.id,
      name: name ?? this.name,
      email: email ?? this.email,
      avatar: avatar ?? this.avatar,
      favoriteSongs: favoriteSongs ?? this.favoriteSongs,
      playlists: playlists ?? this.playlists,
      followedArtists: followedArtists ?? this.followedArtists,
    );
  }
}

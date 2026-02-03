class User {
  final String id;
  final String name;
  final String email;
  final String avatar;
  final List<String> favoriteSongs;
  final List<String> playlists;

  User({
    required this.id,
    required this.name,
    required this.email,
    this.avatar = '',
    this.favoriteSongs = const [],
    this.playlists = const [],
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['_id'] ?? '',
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      avatar: json['avatar'] ?? '',
      favoriteSongs: List<String>.from(json['favoriteSongs'] ?? []),
      playlists: List<String>.from(json['playlists'] ?? []),
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
    };
  }
}

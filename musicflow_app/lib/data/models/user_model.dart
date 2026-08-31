class User {
  final String id;
  final String name;
  final String email;
  final String avatar;
  final List<String> favoriteSongs;
  final List<String> playlists;
  final List<String> followedArtists;
  final bool isPremium;
  final DateTime? premiumExpiry;
  final dynamic premiumPlan;

  User({
    required this.id,
    required this.name,
    required this.email,
    this.avatar = '',
    this.favoriteSongs = const [],
    this.playlists = const [],
    this.followedArtists = const [],
    this.isPremium = false,
    this.premiumExpiry,
    this.premiumPlan,
  });

  bool get hasActivePremium {
    if (!isPremium) return false;
    if (premiumExpiry == null) return true; // Lifetime or active flag
    return premiumExpiry!.isAfter(DateTime.now());
  }

  String get planBadge {
    if (!hasActivePremium) return 'BASIC';
    if (premiumPlan is Map) {
      final name = (premiumPlan['name'] ?? '').toString().toUpperCase();
      if (name.contains('PLUS')) return 'PLUS';
      if (name.contains('PREMIUM')) return 'PREMIUM';
      if (name.contains('GO')) return 'GO';
    }
    return 'PREMIUM';
  }

  factory User.fromJson(Map<String, dynamic> json) {
    DateTime? expiry;
    if (json['premiumExpiry'] != null) {
      expiry = DateTime.tryParse(json['premiumExpiry'].toString());
    }

    return User(
      id: json['_id'] ?? json['id'] ?? '',
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      avatar: json['avatar'] ?? '',
      favoriteSongs: List<String>.from(json['favoriteSongs'] ?? []),
      playlists: List<String>.from(json['playlists'] ?? []),
      followedArtists: List<String>.from(json['followedArtists'] ?? []),
      isPremium: json['isPremium'] == true,
      premiumExpiry: expiry,
      premiumPlan: json['premiumPlan'],
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
      'isPremium': isPremium,
      'premiumExpiry': premiumExpiry?.toIso8601String(),
      'premiumPlan': premiumPlan,
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
    bool? isPremium,
    DateTime? premiumExpiry,
    dynamic premiumPlan,
  }) {
    return User(
      id: id ?? this.id,
      name: name ?? this.name,
      email: email ?? this.email,
      avatar: avatar ?? this.avatar,
      favoriteSongs: favoriteSongs ?? this.favoriteSongs,
      playlists: playlists ?? this.playlists,
      followedArtists: followedArtists ?? this.followedArtists,
      isPremium: isPremium ?? this.isPremium,
      premiumExpiry: premiumExpiry ?? this.premiumExpiry,
      premiumPlan: premiumPlan ?? this.premiumPlan,
    );
  }
}

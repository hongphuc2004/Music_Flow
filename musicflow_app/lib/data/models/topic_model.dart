class Topic {
  final String id;
  final String name;
  final String description;
  final String avatar;

  Topic({
    required this.id,
    required this.name,
    required this.description,
    required this.avatar,
  });

  factory Topic.fromJson(Map<String, dynamic> json) {
    return Topic(
      id: json['_id'] ?? '',
      name: json['name'] ?? '',
      description: json['description'] ?? '',
      avatar: json['avatar'] ?? '',
    );
  }
}

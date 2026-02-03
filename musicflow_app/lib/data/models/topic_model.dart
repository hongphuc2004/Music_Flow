class Topic {
  final String id;
  final String name;
  final String description;
  final String imageUrl;
  final String color;

  Topic({
    required this.id,
    required this.name,
    required this.description,
    required this.imageUrl,
    required this.color,
  });

  factory Topic.fromJson(Map<String, dynamic> json) {
    return Topic(
      id: json['_id'] ?? '',
      name: json['name'] ?? '',
      description: json['description'] ?? '',
      imageUrl: json['imageUrl'] ?? '',
      color: json['color'] ?? '#1DB954',
    );
  }
}

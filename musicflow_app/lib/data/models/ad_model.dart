class AdModel {
  final String id;
  final String title;
  final String description;
  final String type; // "audio" | "banner"
  final String audioUrl;
  final String imageUrl;
  final String targetUrl;
  final int duration; // in seconds
  final bool canSkip;
  final int skipAfterSeconds;

  const AdModel({
    required this.id,
    required this.title,
    this.description = '',
    this.type = 'audio',
    this.audioUrl = '',
    this.imageUrl = '',
    this.targetUrl = '',
    this.duration = 15,
    this.canSkip = false,
    this.skipAfterSeconds = 5,
  });

  factory AdModel.fromJson(Map<String, dynamic> json) {
    return AdModel(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Quảng cáo MusicFlow',
      description: json['description']?.toString() ?? '',
      type: json['type']?.toString() ?? 'audio',
      audioUrl: json['audioUrl']?.toString() ?? '',
      imageUrl: json['imageUrl']?.toString() ?? '',
      targetUrl: json['targetUrl']?.toString() ?? '',
      duration: (json['duration'] as num?)?.toInt() ?? 15,
      canSkip: json['canSkip'] == true,
      skipAfterSeconds: (json['skipAfterSeconds'] as num?)?.toInt() ?? 5,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'type': type,
      'audioUrl': audioUrl,
      'imageUrl': imageUrl,
      'targetUrl': targetUrl,
      'duration': duration,
      'canSkip': canSkip,
      'skipAfterSeconds': skipAfterSeconds,
    };
  }
}

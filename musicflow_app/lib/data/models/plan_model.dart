class Plan {
  final String id;
  final String name;
  final int price;
  final int durationInDays;
  final List<String> description;
  final bool isActive;

  Plan({
    required this.id,
    required this.name,
    required this.price,
    required this.durationInDays,
    required this.description,
    this.isActive = true,
  });

  factory Plan.fromJson(Map<String, dynamic> json) {
    List<String> desc = [];
    if (json['description'] is List) {
      desc = (json['description'] as List)
          .map((e) => e.toString().trim())
          .where((e) => e.isNotEmpty)
          .toList();
    } else if (json['description'] is String) {
      desc = [json['description'].toString()];
    }

    return Plan(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      price: (json['price'] as num?)?.toInt() ?? 0,
      durationInDays: (json['durationInDays'] as num?)?.toInt() ?? 30,
      description: desc,
      isActive: json['isActive'] ?? true,
    );
  }

  String get formattedPrice {
    final str = price.toString();
    final buffer = StringBuffer();
    for (int i = 0; i < str.length; i++) {
      if (i > 0 && (str.length - i) % 3 == 0) {
        buffer.write('.');
      }
      buffer.write(str[i]);
    }
    return '${buffer.toString()}đ';
  }

  String get badge {
    final upper = name.toUpperCase();
    if (upper.contains('PLUS')) return 'PHỔ BIẾN NHẤT';
    if (upper.contains('PREMIUM')) return 'VIP ĐẲNG CẤP';
    if (upper.contains('GO')) return 'TIẾT KIỆM';
    return '';
  }

  List<String> get benefits {
    if (description.isNotEmpty) return description;
    final upper = name.toUpperCase();
    if (upper.contains('GO')) {
      return [
        'Hạn mức tải lên tối đa 250 MB',
        'Tải nhạc ngoại tuyến tối đa 300 MB',
        'Trò chuyện AI DJ 10 lần / ngày',
      ];
    }
    if (upper.contains('PLUS')) {
      return [
        'Hạn mức tải lên tối đa 500 MB',
        'Tải nhạc ngoại tuyến tối đa 700 MB',
        'Trò chuyện AI DJ 15 lần / ngày',
      ];
    }
    return [
      'Hạn mức tải lên tối đa 1 GB',
      'Tải nhạc ngoại tuyến tối đa 1 GB',
      'Trò chuyện AI DJ không giới hạn 24/7',
    ];
  }
}

class SongComment {
  final String id;
  final String songId;
  final String content;
  final String? parentCommentId;
  final int reactionCount;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final CommentUser user;
  final List<CommentReaction> reactions;
  final Map<String, int> reactionSummary;
  final List<SongComment> replies;

  SongComment({
    required this.id,
    required this.songId,
    required this.content,
    required this.parentCommentId,
    required this.reactionCount,
    required this.user,
    required this.reactions,
    required this.reactionSummary,
    required this.replies,
    this.createdAt,
    this.updatedAt,
  });

  factory SongComment.fromJson(Map<String, dynamic> json) {
    final List<dynamic> rawReplies = (json['replies'] as List<dynamic>?) ?? const [];
    final List<dynamic> rawReactions = (json['reactions'] as List<dynamic>?) ?? const [];
    final Map<String, dynamic> rawSummary =
      (json['reactionSummary'] as Map<String, dynamic>?) ?? const {};

    return SongComment(
      id: (json['_id'] ?? '').toString(),
      songId: (json['songId'] ?? '').toString(),
      content: (json['content'] ?? '').toString(),
      parentCommentId: json['parentCommentId']?.toString(),
      reactionCount: (json['reactionCount'] as num?)?.toInt() ?? 0,
      user: CommentUser.fromJson((json['user'] as Map<String, dynamic>?) ?? const {}),
      reactions: rawReactions
          .whereType<Map<String, dynamic>>()
          .map(CommentReaction.fromJson)
          .toList(),
      reactionSummary: {
        'like': (rawSummary['like'] as num?)?.toInt() ?? 0,
      },
      createdAt: DateTime.tryParse((json['createdAt'] ?? '').toString()),
      updatedAt: DateTime.tryParse((json['updatedAt'] ?? '').toString()),
      replies: rawReplies
          .whereType<Map<String, dynamic>>()
          .map(SongComment.fromJson)
          .toList(),
    );
  }
}

class CommentReaction {
  final String userId;
  final String type;

  CommentReaction({
    required this.userId,
    required this.type,
  });

  factory CommentReaction.fromJson(Map<String, dynamic> json) {
    return CommentReaction(
      userId: (json['userId'] ?? '').toString(),
      type: (json['type'] ?? '').toString(),
    );
  }
}

class CommentUser {
  final String id;
  final String name;
  final String avatar;

  CommentUser({
    required this.id,
    required this.name,
    required this.avatar,
  });

  factory CommentUser.fromJson(Map<String, dynamic> json) {
    return CommentUser(
      id: (json['_id'] ?? '').toString(),
      name: (json['name'] ?? 'Nguoi dung').toString(),
      avatar: (json['avatar'] ?? '').toString(),
    );
  }
}
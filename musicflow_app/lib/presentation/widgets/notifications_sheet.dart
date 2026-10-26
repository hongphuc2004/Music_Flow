import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/audio/global_audio_state.dart';
import '../../core/services/app_tab_service.dart';
import '../../core/utils/app_toast.dart';
import '../../data/services/notification_api_service.dart';
import '../../data/services/song_api_service.dart';
import '../screens/player/player_screen.dart';

/// Notification Panel styled after Lucian UX/UI Prompt #074
/// Features:
/// - Floating rounded card (border-radius: 24px) with top-right arrow beak
/// - Tab switcher: "Tất cả" (All) & "Chưa đọc" (Unread)
/// - "Đánh dấu đã đọc" (Mark all read) with sequential staggered animation
/// - Colorful gradient circular avatars with mini status badges (💬, ✅, 👋, 📊, 🎵, ❤️)
/// - Unread purple accent dots with smooth scale/fade exit on read
/// - Live count synchronization with NotificationApiService.unreadCountNotifier
class NotificationsSheet extends StatefulWidget {
  const NotificationsSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Notifications',
      barrierColor: Colors.black.withOpacity(0.55),
      transitionDuration: const Duration(milliseconds: 320),
      pageBuilder: (ctx, anim1, anim2) {
        return const NotificationsSheet();
      },
      transitionBuilder: (ctx, anim1, anim2, child) {
        final curveAnim = CurvedAnimation(
          parent: anim1,
          curve: Curves.easeOutBack,
          reverseCurve: Curves.easeInCubic,
        );
        return FadeTransition(
          opacity: anim1,
          child: ScaleTransition(
            alignment: const Alignment(0.55, -0.85),
            scale: Tween<double>(begin: 0.65, end: 1.0).animate(curveAnim),
            child: child,
          ),
        );
      },
    );
  }

  @override
  State<NotificationsSheet> createState() => _NotificationsSheetState();
}

class _NotificationItemData {
  final String id;
  final String sender;
  final String text;
  final String time;
  final List<Color> gradientColors;
  final String badgeEmoji;
  final bool isSystem;
  final String? avatarUrl;
  final AppNotification? rawNotification;
  bool isRead;

  _NotificationItemData({
    required this.id,
    required this.sender,
    required this.text,
    required this.time,
    required this.gradientColors,
    required this.badgeEmoji,
    required this.isRead,
    this.isSystem = false,
    this.avatarUrl,
    this.rawNotification,
  });
}

class _NotificationsSheetState extends State<NotificationsSheet> {
  bool _isLoading = true;
  int _selectedTab = 0; // 0: All, 1: Unread
  List<_NotificationItemData> _items = [];

  static const _gradientPresets = [
    [Color(0xFF3D8BFF), Color(0xFF22C3A6)], // Cyan - Green
    [Color(0xFF8B6CFF), Color(0xFF5B8CFF)], // Purple - Blue
    [Color(0xFF22C3A6), Color(0xFF0EA5E9)], // Teal - Sky
    [Color(0xFFFF7A93), Color(0xFFB04FD0)], // Pink - Magenta
    [Color(0xFFFFB547), Color(0xFFFF7A45)], // Amber - Orange
  ];

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  String _extractSafeInitial(String sender, [String fallback = 'M']) {
    if (sender.isEmpty) return fallback;
    for (final rune in sender.runes) {
      final char = String.fromCharCode(rune);
      if (RegExp(r'[\p{L}\p{N}]', unicode: true).hasMatch(char)) {
        return char.toUpperCase();
      }
    }
    return fallback;
  }

  Future<void> _loadNotifications() async {
    setState(() => _isLoading = true);

    final apiNotifications = await NotificationApiService.fetchNotifications();

    if (!mounted) return;

    if (apiNotifications.isNotEmpty) {
      _items = apiNotifications.asMap().entries.map((entry) {
        final index = entry.key;
        final n = entry.value;
        final grad = _gradientPresets[index % _gradientPresets.length];
        final meta = n.metadata;
        final type = n.type;
        final rawTitle = n.title;
        final rawContent = n.content.isNotEmpty ? n.content : rawTitle;

        final hasPersonalActor = meta['senderName'] != null ||
            meta['actorName'] != null ||
            meta['commenterName'] != null ||
            meta['followerName'] != null ||
            meta['artistName'] != null;

        final isSystem = const {
          'system',
          'general',
          'ai_quota_reset',
          'subscription',
          'artist_pro',
          'song_moderation_result',
          'admin_moderation_alert',
          'artist_milestone',
        }.contains(type) || (!hasPersonalActor && type != 'interaction' && type != 'artist_follow');

        String sender = 'MusicFlow';
        String? avatarUrl;
        String badgeEmoji = '🔔';

        if (isSystem) {
          if (type == 'ai_quota_reset') {
            sender = 'MusicFlow AI';
            badgeEmoji = '✨';
          } else if (type == 'subscription' || type == 'artist_pro') {
            final planName = meta['planName']?.toString();
            sender = planName != null ? 'MusicFlow $planName' : 'MusicFlow Premium';
            badgeEmoji = '👑';
          } else if (type == 'song_moderation_result') {
            sender = 'MusicFlow Kiểm duyệt';
            final status = meta['status']?.toString();
            if (status == 'SAFE' || rawTitle.contains('duyệt') || rawTitle.contains('an toàn')) {
              badgeEmoji = '✅';
            } else if (status == 'BLOCK' || rawTitle.contains('xóa') || rawTitle.contains('vi phạm')) {
              badgeEmoji = '⛔';
            } else {
              badgeEmoji = '🛡️';
            }
          } else if (type == 'admin_moderation_alert') {
            final status = meta['status']?.toString();
            sender = status == 'BLOCK' ? 'Cảnh báo vi phạm' : 'Hệ thống kiểm duyệt';
            badgeEmoji = status == 'BLOCK' ? '🚨' : '🛡️';
          } else if (type == 'artist_milestone') {
            sender = 'MusicFlow Cột mốc';
            badgeEmoji = '🎉';
          } else {
            sender = 'Hệ thống MusicFlow';
            badgeEmoji = '🔔';
          }
        } else if (type == 'artist_release') {
          sender = meta['artistName']?.toString() ?? 'Nghệ sĩ';
          avatarUrl = meta['songCover']?.toString() ?? meta['artistAvatar']?.toString();
          badgeEmoji = '🎵';
        } else if (type == 'artist_follow') {
          sender = meta['followerName']?.toString() ?? 'Thính giả mới';
          avatarUrl = meta['followerAvatar']?.toString();
          badgeEmoji = '👤';
        } else if (type == 'interaction') {
          sender = meta['senderName']?.toString() ??
              meta['actorName']?.toString() ??
              meta['commenterName']?.toString() ??
              'Người dùng';
          avatarUrl = meta['senderAvatar']?.toString() ??
              meta['actorAvatar']?.toString() ??
              meta['commenterAvatar']?.toString();
          final action = meta['action']?.toString();
          final isLike = action == 'like' ||
              rawContent.toLowerCase().contains('thích') ||
              rawContent.toLowerCase().contains('like');
          badgeEmoji = isLike ? '❤️' : '💬';
        } else {
          sender = meta['senderName']?.toString() ?? 'Người dùng';
          avatarUrl = meta['senderAvatar']?.toString();
          badgeEmoji = '💬';
        }

        String body = rawContent;
        if (body.startsWith(sender)) {
          body = body.substring(sender.length).trim();
        }

        return _NotificationItemData(
          id: n.id,
          sender: sender,
          text: body,
          time: _formatTime(n.createdAt),
          gradientColors: grad,
          badgeEmoji: badgeEmoji,
          isRead: n.isRead,
          isSystem: isSystem,
          avatarUrl: avatarUrl,
          rawNotification: n,
        );
      }).toList();
    } else {
      // Prompt #074 high-fidelity sample data fallback for MusicFlow
      _items = [
        _NotificationItemData(
          id: 'mock-1',
          sender: 'Jiho Park',
          text: 'đã trả lời bình luận của bạn: “Giai điệu bài hát này đỉnh thật!”',
          time: 'Vừa xong',
          gradientColors: const [Color(0xFF3D8BFF), Color(0xFF22C3A6)],
          badgeEmoji: '💬',
          isRead: false,
        ),
        _NotificationItemData(
          id: 'mock-2',
          sender: 'Doyun Han',
          text: 'đã nhắc đến bạn: “@MusicFlow bạn đã nghe bản remix mới chưa?”',
          time: 'Vừa xong',
          gradientColors: const [Color(0xFF8B6CFF), Color(0xFF5B8CFF)],
          badgeEmoji: '💬',
          isRead: false,
        ),
        _NotificationItemData(
          id: 'mock-3',
          sender: 'MusicFlow Kiểm duyệt',
          text: 'đã phê duyệt bản phát hành ca khúc “Spring Flow 2026”',
          time: '12 phút trước',
          gradientColors: const [Color(0xFF22C3A6), Color(0xFF0EA5E9)],
          badgeEmoji: '✅',
          isRead: false,
          isSystem: true,
        ),
        _NotificationItemData(
          id: 'mock-4',
          sender: 'Mina Jung',
          text: 'đã bắt đầu theo dõi trang nghệ sĩ của bạn',
          time: '1 giờ trước',
          gradientColors: const [Color(0xFFFF7A93), Color(0xFFB04FD0)],
          badgeEmoji: '👤',
          isRead: true,
        ),
        _NotificationItemData(
          id: 'mock-5',
          sender: 'MusicFlow AI',
          text: 'Hạn mức AI DJ của bạn đã được làm mới, bắt đầu nghe nhạc ngay!',
          time: 'Hôm qua',
          gradientColors: const [Color(0xFFFFB547), Color(0xFFFF7A45)],
          badgeEmoji: '✨',
          isRead: true,
          isSystem: true,
        ),
      ];
    }

    _syncUnreadCount();
    setState(() => _isLoading = false);
  }

  void _syncUnreadCount() {
    final unread = _items.where((i) => !i.isRead).length;
    NotificationApiService.unreadCountNotifier.value = unread;
  }

  String _formatTime(DateTime time) {
    final diff = DateTime.now().difference(time);
    if (diff.inMinutes < 1) return 'Vừa xong';
    if (diff.inMinutes < 60) return '${diff.inMinutes} phút trước';
    if (diff.inHours < 24) return '${diff.inHours} giờ trước';
    if (diff.inDays < 7) return '${diff.inDays} ngày trước';
    return '${time.day}/${time.month}/${time.year}';
  }

  void _markItemAsRead(int index) {
    final item = _items[index];
    if (item.isRead) return;

    setState(() {
      item.isRead = true;
    });

    if (!item.id.startsWith('mock-')) {
      NotificationApiService.markAsRead(item.id);
    }
    _syncUnreadCount();
  }

  Future<void> _markAllAsRead() async {
    final unreadIndices = <int>[];
    for (int i = 0; i < _items.length; i++) {
      if (!_items[i].isRead) unreadIndices.add(i);
    }

    if (unreadIndices.isEmpty) return;

    // Sequential staggered animation matching Prompt #074 (i * 100ms)
    for (int i = 0; i < unreadIndices.length; i++) {
      final idx = unreadIndices[i];
      Future.delayed(Duration(milliseconds: i * 90), () {
        if (!mounted) return;
        setState(() {
          _items[idx].isRead = true;
        });
        _syncUnreadCount();
      });
    }

    NotificationApiService.markAllAsRead();
    AppToast.showSuccess(context, 'Đã đánh dấu tất cả thông báo là đã đọc');
  }

  Future<void> _handleNotificationTap(_NotificationItemData item) async {
    _markItemAsRead(_items.indexOf(item));
    Navigator.of(context).pop(); // dismiss notification panel

    final raw = item.rawNotification;
    if (raw == null) return;

    final metadata = raw.metadata;
    final type = raw.type;
    final actionUrl = metadata['actionUrl']?.toString() ?? '';

    // 1. Interaction / Comment notification (like comment, reply to comment)
    String? songId = metadata['songId']?.toString();
    String? commentId = metadata['commentId']?.toString();

    // Extract songId or commentId from actionUrl if missing (e.g. /client/song/xxx?comment=yyy)
    if ((songId == null || songId.isEmpty) && actionUrl.isNotEmpty) {
      final songMatch = RegExp(r'(?:client\/)?songs?\/([a-fA-F0-9]{24}|[a-zA-Z0-9_-]{10,40})').firstMatch(actionUrl);
      if (songMatch != null && songMatch.groupCount >= 1) {
        songId = songMatch.group(1);
      }
    }

    if ((commentId == null || commentId.isEmpty) && actionUrl.isNotEmpty) {
      final commentMatch = RegExp(r'[?&]comment=([a-fA-F0-9]{24}|[a-zA-Z0-9_-]+)').firstMatch(actionUrl);
      if (commentMatch != null && commentMatch.groupCount >= 1) {
        commentId = commentMatch.group(1);
      }
    }

    if (songId != null && songId.isNotEmpty) {
      AppToast.showInfo(context, 'Đang mở bình luận bài hát...');
      try {
        final song = await SongApiService.fetchSongById(songId);
        if (song != null && mounted) {
          GlobalAudioState().playSong(song);
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => PlayerScreen(
                song: song,
                initialShowComments: true,
                targetCommentId: commentId,
              ),
            ),
          );
        }
      } catch (e) {
        debugPrint('Error navigating to song from notification: $e');
      }
      return;
    }

    // 2. AI DJ Quota reset
    if (type == 'ai_quota_reset' || actionUrl.contains('/client/ai-dj') || actionUrl.contains('/ai')) {
      AppTabService().switchTab(3); // Tab 3 is AI Assistant
      return;
    }

    // 3. New release from followed artist
    if (type == 'artist_release') {
      final songIdFromMeta = metadata['songId']?.toString();
      if (songIdFromMeta != null && songIdFromMeta.isNotEmpty) {
        try {
          final song = await SongApiService.fetchSongById(songIdFromMeta);
          if (song != null && mounted) {
            GlobalAudioState().playSong(song);
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => PlayerScreen(song: song),
              ),
            );
          }
        } catch (_) {}
      }
      return;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final unreadCount = _items.where((i) => !i.isRead).length;

    final filteredItems = _selectedTab == 0
        ? _items
        : _items.where((i) => !i.isRead).toList();

    return Material(
      color: Colors.transparent,
      child: Stack(
        children: [
          // Dismiss barrier on outside click
          Positioned.fill(
            child: GestureDetector(
              onTap: () => Navigator.of(context).pop(),
              behavior: HitTestBehavior.opaque,
              child: const SizedBox.expand(),
            ),
          ),

          // Floating Notification Panel (Prompt #074 .u074-pan)
          SafeArea(
            child: Align(
              alignment: Alignment.topRight,
              child: Padding(
                padding: const EdgeInsets.only(top: 60, right: 16, left: 16),
                child: SizedBox(
                  width: 350,
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      // Arrow beak pointing to bell button (.u074-pan::before)
                      Positioned(
                        right: 68,
                        top: -6,
                        child: Transform.rotate(
                          angle: 0.785398, // 45 deg
                          child: Container(
                            width: 14,
                            height: 14,
                            decoration: BoxDecoration(
                              color: isDark
                                  ? const Color(0xFF141724)
                                  : const Color(0xFFFFFFFF),
                              borderRadius: BorderRadius.circular(3),
                              border: Border(
                                top: BorderSide(
                                  color: isDark
                                      ? Colors.white.withOpacity(0.12)
                                      : Colors.black.withOpacity(0.08),
                                ),
                                left: BorderSide(
                                  color: isDark
                                      ? Colors.white.withOpacity(0.12)
                                      : Colors.black.withOpacity(0.08),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),

                      // Card Body (.u074-pan)
                      Container(
                        height: 480,
                        decoration: BoxDecoration(
                          color: isDark
                              ? const Color(0xFF141724)
                              : const Color(0xFFFFFFFF),
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(
                            color: isDark
                                ? Colors.white.withOpacity(0.10)
                                : Colors.black.withOpacity(0.08),
                            width: 1.0,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.45),
                              blurRadius: 40,
                              offset: const Offset(0, 20),
                            ),
                          ],
                        ),
                        child: Column(
                          children: [
                            // 1. Panel Header (.u074-ph) with Tabs & Mark all read
                            Padding(
                              padding: const EdgeInsets.fromLTRB(14, 14, 14, 8),
                              child: Row(
                                children: [
                                  // Tab 1: All (.u074-tab)
                                  _buildTabButton(
                                    label: 'Tất cả',
                                    isSelected: _selectedTab == 0,
                                    onTap: () => setState(() => _selectedTab = 0),
                                    isDark: isDark,
                                  ),
                                  const SizedBox(width: 6),

                                  // Tab 2: Mentions / Unread
                                  _buildTabButton(
                                    label: 'Chưa đọc',
                                    isSelected: _selectedTab == 1,
                                    badgeCount: unreadCount > 0 ? unreadCount : null,
                                    onTap: () => setState(() => _selectedTab = 1),
                                    isDark: isDark,
                                  ),

                                  const Spacer(),

                                  // Mark all read button (.u074-all)
                                  TextButton(
                                    onPressed:
                                        unreadCount > 0 ? _markAllAsRead : null,
                                    style: TextButton.styleFrom(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 8,
                                        vertical: 4,
                                      ),
                                      minimumSize: Size.zero,
                                      tapTargetSize:
                                          MaterialTapTargetSize.shrinkWrap,
                                    ),
                                    child: Text(
                                      'Đã đọc tất cả',
                                      style: TextStyle(
                                        color: unreadCount > 0
                                            ? const Color(0xFFB7A4FF)
                                            : (isDark
                                                ? Colors.white.withOpacity(0.3)
                                                : Colors.black.withOpacity(0.3)),
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),

                            const SizedBox(height: 2),

                            // 2. Notification List (.u074-list)
                            Expanded(
                              child: _isLoading
                                  ? const Center(
                                      child: CircularProgressIndicator(
                                        color: Color(0xFFB7A4FF),
                                        strokeWidth: 2.5,
                                      ),
                                    )
                                  : filteredItems.isEmpty
                                      ? _buildEmptyState(isDark)
                                      : ListView.builder(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 8,
                                            vertical: 4,
                                          ),
                                          itemCount: filteredItems.length,
                                          itemBuilder: (context, index) {
                                            final item = filteredItems[index];
                                            return _buildNotificationRow(
                                              item: item,
                                              onTap: () => _handleNotificationTap(item),
                                              isDark: isDark,
                                            );
                                          },
                                        ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabButton({
    required String label,
    required bool isSelected,
    int? badgeCount,
    required VoidCallback onTap,
    required bool isDark,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        height: 32,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          color: isSelected
              ? (isDark ? Colors.white : const Color(0xFF16151B))
              : Colors.transparent,
        ),
        child: Center(
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: isSelected
                      ? (isDark ? const Color(0xFF07080D) : Colors.white)
                      : (isDark
                          ? Colors.white.withOpacity(0.55)
                          : Colors.black.withOpacity(0.55)),
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.2,
                ),
              ),
              if (badgeCount != null) ...[
                const SizedBox(width: 5),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFF5A6E),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '$badgeCount',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNotificationRow({
    required _NotificationItemData item,
    required VoidCallback onTap,
    required bool isDark,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            padding: const EdgeInsets.fromLTRB(10, 11, 26, 11),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              color: Colors.transparent,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. Avatar with Vibrant Gradient / System Logo + Mini Badge (.u074-av & em)
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    if (item.isSystem)
                      Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: RadialGradient(
                            center: Alignment.topCenter,
                            radius: 1.2,
                            colors: isDark
                                ? const [Color(0x556C63FF), Color(0xF0141724)]
                                : const [Color(0x336C63FF), Color(0xFFFFFFFF)],
                          ),
                          border: Border.all(
                            color: const Color(0xFF6C63FF).withOpacity(isDark ? 0.45 : 0.35),
                            width: 1.2,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF6C63FF).withOpacity(0.2),
                              blurRadius: 8,
                              offset: const Offset(0, 3),
                            ),
                          ],
                        ),
                        child: Center(
                          child: Image.asset(
                            'assets/images/logo.png',
                            width: 22,
                            height: 22,
                            fit: BoxFit.contain,
                          ),
                        ),
                      )
                    else if (item.avatarUrl != null && item.avatarUrl!.isNotEmpty)
                      ClipOval(
                        child: Image.network(
                          item.avatarUrl!,
                          width: 38,
                          height: 38,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => Container(
                            width: 38,
                            height: 38,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: LinearGradient(
                                colors: item.gradientColors,
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                            ),
                            child: Center(
                              child: Text(
                                _extractSafeInitial(item.sender),
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ),
                        ),
                      )
                    else
                      Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: LinearGradient(
                            colors: item.gradientColors,
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                        ),
                        child: Center(
                          child: Text(
                            _extractSafeInitial(item.sender),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ),

                    // Mini badge at bottom-right (.u074-av em)
                    Positioned(
                      right: -3,
                      bottom: -3,
                      child: Container(
                        width: 18,
                        height: 18,
                        decoration: BoxDecoration(
                          color: isDark
                              ? const Color(0xFF141724)
                              : const Color(0xFFFFFFFF),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: isDark
                                ? Colors.white.withOpacity(0.12)
                                : Colors.black.withOpacity(0.08),
                            width: 1.0,
                          ),
                        ),
                        child: Center(
                          child: Text(
                            item.badgeEmoji,
                            style: const TextStyle(fontSize: 10, height: 1),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(width: 12),

                // 2. Notification text (.u074-tx)
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      RichText(
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        text: TextSpan(
                          children: [
                            TextSpan(
                              text: '${item.sender} ',
                              style: TextStyle(
                                color: item.isRead
                                    ? (isDark
                                        ? Colors.white.withOpacity(0.55)
                                        : Colors.black.withOpacity(0.55))
                                    : (isDark ? Colors.white : Colors.black87),
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                letterSpacing: -0.2,
                              ),
                            ),
                            TextSpan(
                              text: item.text,
                              style: TextStyle(
                                color: item.isRead
                                    ? (isDark
                                        ? Colors.white.withOpacity(0.40)
                                        : Colors.black.withOpacity(0.45))
                                    : (isDark
                                        ? Colors.white.withOpacity(0.78)
                                        : Colors.black.withOpacity(0.78)),
                                fontSize: 13,
                                height: 1.45,
                                letterSpacing: -0.1,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        item.time,
                        style: TextStyle(
                          color: isDark
                              ? Colors.white.withOpacity(0.42)
                              : Colors.black.withOpacity(0.42),
                          fontSize: 11.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),

                // 3. Unread Accent Dot (.u074-dot)
                AnimatedScale(
                  scale: item.isRead ? 0.0 : 1.0,
                  duration: const Duration(milliseconds: 320),
                  curve: Curves.easeOutBack,
                  child: AnimatedOpacity(
                    opacity: item.isRead ? 0.0 : 1.0,
                    duration: const Duration(milliseconds: 250),
                    child: Container(
                      width: 9,
                      height: 9,
                      margin: const EdgeInsets.only(top: 14, left: 6),
                      decoration: const BoxDecoration(
                        color: Color(0xFFB7A4FF),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Color(0xFFB7A4FF),
                            blurRadius: 6,
                            spreadRadius: 1,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState(bool isDark) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isDark
                    ? Colors.white.withOpacity(0.06)
                    : Colors.black.withOpacity(0.04),
              ),
              child: Icon(
                Icons.notifications_none_rounded,
                color: isDark ? Colors.white38 : Colors.black38,
                size: 26,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Không có thông báo mới',
              style: TextStyle(
                color: isDark ? Colors.white70 : Colors.black87,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Các hoạt động âm nhạc của bạn sẽ hiển thị tại đây.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: isDark ? Colors.white38 : Colors.black45,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

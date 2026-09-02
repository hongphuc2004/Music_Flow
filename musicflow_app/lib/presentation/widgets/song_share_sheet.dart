import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:musicflow_app/core/config/api_client.dart';
import 'package:musicflow_app/core/config/api_config.dart';
import 'package:musicflow_app/core/theme/app_theme.dart';
import 'package:musicflow_app/core/utils/app_toast.dart';
import 'package:musicflow_app/data/models/song_model.dart';

class SongShareSheet extends StatefulWidget {
  final Song song;

  const SongShareSheet({super.key, required this.song});

  static void show(BuildContext context, Song song) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => SongShareSheet(song: song),
    );
  }

  @override
  State<SongShareSheet> createState() => _SongShareSheetState();
}

class _SongShareSheetState extends State<SongShareSheet> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _copied = false;

  String get _artistName =>
      widget.song.artists.isNotEmpty ? widget.song.artists.first : 'Nghệ sĩ';

  String get _shareText =>
      '🎵 Nghe "${widget.song.title}" của $_artistName trên MusicFlow ngay!';

  String _getShareUrl(String platform, {String source = 'social'}) {
    return ApiConfig.songShareUrl(
      widget.song.id,
      title: widget.song.title,
      artistName: _artistName,
      source: source,
      medium: platform,
    );
  }

  String get _qrCodeUrl {
    final songUrl = _getShareUrl('qrcode', source: 'qrcode');
    return 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${Uri.encodeComponent(songUrl)}&color=000000&bgcolor=FFFFFF';
  }

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _trackShareEvent(String platform) async {
    try {
      await ApiClient.post(
        Uri.parse('${ApiConfig.songsEndpoint}/${widget.song.id}/share-event'),
        body: {
          'platform': platform,
          'source': 'mobile_app',
          'medium': 'share_modal',
        },
        requireAuth: false,
      );
    } catch (_) {}
  }

  Future<void> _copyToClipboard() async {
    final link = _getShareUrl('clipboard', source: 'clipboard');
    await Clipboard.setData(ClipboardData(text: link));
    _trackShareEvent('clipboard');

    if (!mounted) return;
    setState(() => _copied = true);

    AppToast.showSuccess(
      context,
      'Đã sao chép liên kết bài hát vào bộ nhớ tạm!',
    );

    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _copied = false);
    });
  }

  Future<void> _shareToSocial(String platform) async {
    final url = _getShareUrl(platform, source: 'social');
    final text = _shareText;
    final encUrl = Uri.encodeComponent(url);
    final encText = Uri.encodeComponent(text);

    if (platform == 'more' || platform == 'native') {
      _trackShareEvent('system_share');
      await Share.share(
        '$text\n$url',
        subject: widget.song.title,
      );
      return;
    }

    String targetUrl = '';

    switch (platform) {
      case 'messenger':
        targetUrl = 'fb-messenger://share?link=$encUrl';
        break;
      case 'facebook':
        targetUrl = 'https://www.facebook.com/sharer/sharer.php?u=$encUrl&quote=$encText';
        break;
      case 'zalo':
        targetUrl = 'https://sp.zalo.me/share?url=$encUrl';
        break;
      case 'telegram':
        targetUrl = 'https://t.me/share/url?url=$encUrl&text=$encText';
        break;
      case 'twitter':
        targetUrl = 'https://twitter.com/intent/tweet?url=$encUrl&text=$encText';
        break;
      case 'whatsapp':
        targetUrl = 'https://api.whatsapp.com/send?text=${Uri.encodeComponent('$text $url')}';
        break;
    }

    if (targetUrl.isNotEmpty) {
      _trackShareEvent(platform);
      final uri = Uri.parse(targetUrl);
      try {
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        } else {
          // Fallback to system share
          await Share.share('$text\n$url', subject: widget.song.title);
        }
      } catch (_) {
        await Share.share('$text\n$url', subject: widget.song.title);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 14,
        bottom: MediaQuery.of(context).padding.bottom + 16,
      ),
      decoration: const BoxDecoration(
        color: Color(0xFF130E26),
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 38,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF6C63FF), Color(0xFF00E5FF)],
                  ),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.share_rounded, color: Colors.white, size: 18),
              ),
              const SizedBox(width: 10),
              const Text(
                'Chia sẻ bài hát',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16),
              ),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.close_rounded, color: Colors.white60),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Song Preview Card
          _buildSongPreviewCard(),
          const SizedBox(height: 12),

          // Tabs Switcher
          Container(
            height: 36,
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.06),
              borderRadius: BorderRadius.circular(12),
            ),
            child: TabBar(
              controller: _tabController,
              indicator: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF6C63FF), Color(0xFF5A4FE0)],
                ),
                borderRadius: BorderRadius.circular(10),
              ),
              indicatorSize: TabBarIndicatorSize.tab,
              dividerColor: Colors.transparent,
              labelColor: Colors.white,
              unselectedLabelColor: Colors.white60,
              labelStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12.5),
              tabs: const [
                Tab(
                  iconMargin: EdgeInsets.zero,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.share_outlined, size: 15),
                      SizedBox(width: 6),
                      Text('Mạng xã hội & Link'),
                    ],
                  ),
                ),
                Tab(
                  iconMargin: EdgeInsets.zero,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.qr_code_rounded, size: 15),
                      SizedBox(width: 6),
                      Text('Mã QR Code'),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Tab Views
          SizedBox(
            height: 250,
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildSocialShareTab(),
                _buildQrCodeTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSongPreviewCard() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.04),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Image.network(
              widget.song.imageUrl,
              width: 50,
              height: 50,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                width: 50,
                height: 50,
                color: Colors.grey[800],
                child: const Icon(Icons.music_note, color: Colors.white54),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.song.title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 3),
                Text(
                  _artistName,
                  style: const TextStyle(color: Colors.white60, fontSize: 12),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFF00E5FF).withOpacity(0.15),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFF00E5FF).withOpacity(0.3)),
            ),
            child: const Row(
              children: [
                Icon(Icons.high_quality_rounded, size: 14, color: Color(0xFF00E5FF)),
                SizedBox(width: 4),
                Text(
                  'HQ',
                  style: TextStyle(color: Color(0xFF00E5FF), fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSocialShareTab() {
    final socialChannels = [
      {
        'id': 'messenger',
        'name': 'Messenger',
        'icon': Icons.bolt_rounded,
        'color': const Color(0xFF0084FF),
      },
      {
        'id': 'zalo',
        'name': 'Zalo',
        'icon': Icons.chat_bubble_rounded,
        'color': const Color(0xFF0068FF),
      },
      {
        'id': 'facebook',
        'name': 'Facebook',
        'icon': Icons.facebook,
        'color': const Color(0xFF1877F2),
      },
      {
        'id': 'telegram',
        'name': 'Telegram',
        'icon': Icons.send_rounded,
        'color': const Color(0xFF229ED9),
      },
      {
        'id': 'more',
        'name': 'Khác',
        'icon': Icons.share_rounded,
        'color': const Color(0xFF8B5CF6),
      },
    ];

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'CHIA SẺ LÊN MẠNG XÃ HỘI',
            style: TextStyle(color: Colors.white54, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.8),
          ),
          const SizedBox(height: 12),

          // Social icons grid
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: socialChannels.map((item) {
              final id = item['id'] as String;
              final name = item['name'] as String;
              final icon = item['icon'] as IconData;
              final color = item['color'] as Color;

              return InkWell(
                onTap: () => _shareToSocial(id),
                borderRadius: BorderRadius.circular(16),
                child: SizedBox(
                  width: 58,
                  child: Column(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: color.withOpacity(0.18),
                          shape: BoxShape.circle,
                          border: Border.all(color: color.withOpacity(0.4)),
                        ),
                        child: Icon(icon, color: color, size: 24),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        name,
                        style: const TextStyle(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.w600),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),

          const SizedBox(height: 20),
          const Divider(color: Colors.white12, height: 1),
          const SizedBox(height: 16),

          // Copy Link section
          const Text(
            'SAO CHÉP LIÊN KẾT',
            style: TextStyle(color: Colors.white54, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.8),
          ),
          const SizedBox(height: 10),

          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.04),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.white.withOpacity(0.1)),
            ),
            child: Row(
              children: [
                const Icon(Icons.link_rounded, color: Color(0xFF00E5FF), size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    _getShareUrl('clipboard', source: 'clipboard'),
                    style: const TextStyle(color: Colors.white70, fontSize: 12),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton.icon(
                  onPressed: _copyToClipboard,
                  icon: Icon(
                    _copied ? Icons.check_rounded : Icons.copy_rounded,
                    size: 14,
                    color: Colors.white,
                  ),
                  label: Text(
                    _copied ? 'Đã chép' : 'Sao chép',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _copied ? const Color(0xFF10B981) : const Color(0xFF6C63FF),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQrCodeTab() {
    return SingleChildScrollView(
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF181130),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF00E5FF).withOpacity(0.35)),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF00E5FF).withOpacity(0.12),
                  blurRadius: 16,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.network(
                      _qrCodeUrl,
                      width: 110,
                      height: 110,
                      fit: BoxFit.contain,
                      loadingBuilder: (_, child, progress) {
                        if (progress == null) return child;
                        return const SizedBox(
                          width: 110,
                          height: 110,
                          child: Center(
                            child: CircularProgressIndicator(color: Color(0xFF6C63FF), strokeWidth: 2),
                          ),
                        );
                      },
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.qr_code_scanner_rounded, color: Color(0xFF00E5FF), size: 16),
                          SizedBox(width: 6),
                          Text(
                            'Mã phát nhạc',
                            style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700),
                          ),
                        ],
                      ),
                      SizedBox(height: 6),
                      Text(
                        'Quét bằng camera điện thoại để nghe trực tiếp trên web hoặc app.',
                        style: TextStyle(color: Colors.white60, fontSize: 11.5, height: 1.3),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Copy link button under QR
          SizedBox(
            width: double.infinity,
            height: 40,
            child: ElevatedButton.icon(
              onPressed: _copyToClipboard,
              icon: const Icon(Icons.copy_rounded, size: 15, color: Colors.white),
              label: const Text(
                'Sao chép liên kết bài hát',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12.5),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF6C63FF),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

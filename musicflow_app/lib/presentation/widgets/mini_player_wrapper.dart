import 'package:flutter/material.dart';
import 'package:musicflow_app/core/audio/ad_manager.dart';
import 'package:musicflow_app/core/audio/ad_playback_state.dart';
import 'package:musicflow_app/core/audio/global_audio_state.dart';
import 'package:musicflow_app/core/services/app_tab_service.dart';
import 'package:musicflow_app/presentation/screens/premium/premium_screen.dart';
import 'package:musicflow_app/presentation/widgets/ad_interruption_overlay.dart';
import 'package:musicflow_app/presentation/widgets/mini_player.dart';
import 'package:musicflow_app/presentation/widgets/music_flow_floating_nav_bar.dart';

/// Widget wrapper để hiển thị MiniPlayer và FloatingNavBar cố định ở các màn hình con
/// Giúp người dùng nghe nhạc và điều hướng tiện lợi ở mọi màn hình trong ứng dụng
class MiniPlayerWrapper extends StatefulWidget {
  final Widget child;
  final bool showFloatingNavBar;

  const MiniPlayerWrapper({
    super.key,
    required this.child,
    this.showFloatingNavBar = true,
  });

  @override
  State<MiniPlayerWrapper> createState() => _MiniPlayerWrapperState();
}

class _MiniPlayerWrapperState extends State<MiniPlayerWrapper> {
  final GlobalAudioState _audioState = GlobalAudioState();
  final AppTabService _tabService = AppTabService();

  @override
  void initState() {
    super.initState();
    _audioState.addListener(_onStateChanged);
    _tabService.addListener(_onStateChanged);
  }

  @override
  void dispose() {
    _audioState.removeListener(_onStateChanged);
    _tabService.removeListener(_onStateChanged);
    super.dispose();
  }

  void _onStateChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasSong = _audioState.currentSong != null;
    final navBarHeight = widget.showFloatingNavBar ? 84.0 : 0.0;
    final miniPlayerHeight = hasSong ? 70.0 : 0.0;
    final totalBottomPadding = miniPlayerHeight + navBarHeight;

    return Stack(
      fit: StackFit.expand,
      children: [
        // Main content with padding at bottom so content is never covered
        Positioned.fill(
          child: Padding(
            padding: EdgeInsets.only(bottom: totalBottomPadding),
            child: widget.child,
          ),
        ),

        // Persistent Mini Player & Floating Nav Bar pinned at the bottom
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Mini Player or Mini Ad Bar
                ValueListenableBuilder<AdPlaybackState>(
                  valueListenable: AdManager.instance.playbackStateNotifier,
                  builder: (context, adState, _) {
                    if (adState.isAdPlaying && adState.currentAd != null) {
                      return _buildMiniAdBar(adState);
                    }
                    if (hasSong) {
                      return MiniPlayer(
                        isPlaying: _audioState.isPlaying,
                        songTitle: _audioState.currentSong!.title,
                        artist: _audioState.currentSong!.artists.join(', '),
                        song: _audioState.currentSong,
                        progress: _audioState.progress,
                        currentPosition: _audioState.currentPosition,
                        totalDuration:
                            _audioState.currentSong!.durationAsDuration ??
                            _audioState.totalDuration,
                        playlist: _audioState.playlist,
                        currentIndex: _audioState.currentIndex,
                        onPlayPause: _audioState.togglePlayPause,
                        onNext: _audioState.playNext,
                        onPrevious: _audioState.playPrevious,
                        onPlaylistItemTap: _audioState.playAtIndex,
                        onClose: _audioState.stop,
                      );
                    }
                    return const SizedBox.shrink();
                  },
                ),

                // Floating Navigation Bar
                if (widget.showFloatingNavBar)
                  MusicFlowFloatingNavBar(
                    currentIndex: _tabService.currentTab,
                    onTap: (index) {
                      _tabService.switchTab(index, context: context);
                    },
                    items: const [
                      FloatingNavBarItem(
                        icon: Icons.home_outlined,
                        activeIcon: Icons.home_rounded,
                        label: 'Home',
                      ),
                      FloatingNavBarItem(
                        icon: Icons.trending_up_rounded,
                        activeIcon: Icons.trending_up_rounded,
                        label: 'Trending',
                      ),
                      FloatingNavBarItem(
                        icon: Icons.search_rounded,
                        activeIcon: Icons.search_rounded,
                        label: 'Search',
                      ),
                      FloatingNavBarItem(
                        icon: Icons.auto_awesome_outlined,
                        activeIcon: Icons.auto_awesome_rounded,
                        label: 'AI Assistant',
                      ),
                      FloatingNavBarItem(
                        icon: Icons.library_music_outlined,
                        activeIcon: Icons.library_music_rounded,
                        label: 'Library',
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ),

        // Global Ad Interruption Overlay (Hiển thị đè lên toàn màn hình khi có quảng cáo xen kẽ)
        Positioned.fill(
          child: ValueListenableBuilder<AdPlaybackState>(
            valueListenable: AdManager.instance.playbackStateNotifier,
            builder: (context, adState, _) {
              final isPlaying = adState.isAdPlaying && adState.currentAd != null;
              if (!isPlaying) {
                return const IgnorePointer(
                  child: SizedBox.shrink(),
                );
              }
              return const AdInterruptionOverlay();
            },
          ),
        ),
      ],
    );
  }

  Widget _buildMiniAdBar(AdPlaybackState adState) {
    final ad = adState.currentAd!;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Container(
        height: 64,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          color: const Color(0xFF1E152A),
          border: Border.all(
            color: const Color(0xFFFFB300).withOpacity(0.4),
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.4),
              blurRadius: 16,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFFFB300).withOpacity(0.18),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.campaign_rounded,
                color: Color(0xFFFFB300),
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    ad.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Quảng cáo • Còn 0:${adState.remainingSeconds.toString().padLeft(2, '0')}s',
                    style: const TextStyle(
                      color: Color(0xFFFFB300),
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            if (adState.canSkip)
              TextButton.icon(
                onPressed: () => AdManager.instance.skipAd(),
                icon: const Icon(Icons.skip_next_rounded, size: 18, color: Colors.white),
                label: const Text(
                  'Bỏ qua',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
                style: TextButton.styleFrom(
                  backgroundColor: Colors.white.withOpacity(0.15),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              )
            else
              IconButton(
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const PremiumScreen()),
                  );
                },
                tooltip: 'Nâng cấp tắt quảng cáo',
                icon: const Icon(
                  Icons.workspace_premium_rounded,
                  color: Color(0xFFFFB300),
                  size: 22,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

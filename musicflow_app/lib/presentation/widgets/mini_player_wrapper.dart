import 'package:flutter/material.dart';
import 'package:musicflow_app/core/audio/global_audio_state.dart';
import 'package:musicflow_app/core/services/app_tab_service.dart';
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
                // Mini Player
                if (hasSong)
                  MiniPlayer(
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
      ],
    );
  }
}

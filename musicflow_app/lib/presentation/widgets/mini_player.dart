import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:musicflow_app/core/theme/app_theme.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/presentation/screens/player/player_screen.dart';

class MiniPlayer extends StatefulWidget {
  final bool isPlaying;
  final String songTitle;
  final String artist;
  final String? albumArt;
  final Song? song;
  final double progress;
  final Duration currentPosition;
  final Duration totalDuration;
  final VoidCallback onPlayPause;
  final VoidCallback? onNext;
  final VoidCallback? onPrevious;
  final VoidCallback? onClose;
  // Playlist support
  final List<Song> playlist;
  final int currentIndex;
  final Function(int)? onPlaylistItemTap;

  const MiniPlayer({
    super.key,
    required this.isPlaying,
    required this.songTitle,
    required this.artist,
    this.albumArt,
    this.song,
    this.progress = 0.0,
    this.currentPosition = Duration.zero,
    this.totalDuration = const Duration(minutes: 3, seconds: 30),
    required this.onPlayPause,
    this.onNext,
    this.onPrevious,
    this.onClose,
    this.playlist = const [],
    this.currentIndex = 0,
    this.onPlaylistItemTap,
  });

  @override
  State<MiniPlayer> createState() => _MiniPlayerState();
}

class _MiniPlayerState extends State<MiniPlayer>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _scaleAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: AppDurations.hover,
    );
    _scaleAnim = Tween<double>(begin: 1.0, end: 0.96).animate(
      CurvedAnimation(parent: _animController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  void _onTapDown(TapDownDetails details) {
    _animController.forward();
  }

  void _onTapUp(TapUpDetails details) {
    _animController.reverse();
  }

  void _onTapCancel() {
    _animController.reverse();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return AnimatedBuilder(
      animation: _scaleAnim,
      builder: (context, child) {
        return Transform.scale(scale: _scaleAnim.value, child: child);
      },
      child: Dismissible(
        key: const Key('mini_player'),
        direction: DismissDirection.horizontal,
        confirmDismiss: (direction) async {
          if (direction == DismissDirection.endToStart) {
            widget.onNext?.call();
            return false;
          } else {
            widget.onPrevious?.call();
            return false;
          }
        },
        background: _buildSwipeBackground(
          Icons.skip_previous_rounded,
          Alignment.centerLeft,
        ),
        secondaryBackground: _buildSwipeBackground(
          Icons.skip_next_rounded,
          Alignment.centerRight,
        ),
        child: GestureDetector(
          onTapDown: _onTapDown,
          onTapUp: _onTapUp,
          onTapCancel: _onTapCancel,
          onTap: () => _openFullPlayer(context),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.xs),
            child: ClipRRect(
              borderRadius: AppRadius.mediumBorder,
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 12.0, sigmaY: 12.0),
                child: Container(
                  height: 68,
                  decoration: BoxDecoration(
                    color: isDark
                        ? AppColors.darkSurfaceGlass
                        : AppColors.lightSurfaceGlass,
                    borderRadius: AppRadius.mediumBorder,
                    border: Border.all(
                      color: isDark
                          ? AppColors.darkBorderGlass
                          : AppColors.lightBorderGlass,
                      width: 1.0,
                    ),
                    boxShadow: isDark
                        ? [
                            BoxShadow(
                              color: AppColors.primary.withOpacity(0.06),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            )
                          ]
                        : [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.04),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            )
                          ],
                  ),
                  child: Column(
                    children: [
                      // Smooth, thin progress indicator
                      ClipRRect(
                        borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(AppRadius.medium),
                        ),
                        child: LinearProgressIndicator(
                          value: widget.progress.clamp(0.0, 1.0),
                          backgroundColor: isDark
                              ? AppColors.darkBorder
                              : AppColors.lightBorder,
                          valueColor: const AlwaysStoppedAnimation<Color>(
                            AppColors.primary,
                          ),
                          minHeight: 2.5,
                        ),
                      ),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
                          child: Row(
                            children: [
                              _buildAlbumArt(),
                              const SizedBox(width: AppSpacing.sm),
                              Expanded(child: _buildSongInfo()),
                              _buildControls(),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSwipeBackground(IconData icon, Alignment alignment) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.xs),
      decoration: BoxDecoration(
        color: AppColors.primary.withOpacity(0.15),
        borderRadius: AppRadius.mediumBorder,
      ),
      alignment: alignment,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
      child: Icon(icon, color: AppColors.primary, size: 28),
    );
  }

  Widget _buildAlbumArt() {
    final songImageUrl = widget.song?.imageUrl.trim() ?? '';
    final albumArt = widget.albumArt?.trim() ?? '';

    return Hero(
      tag: 'album_art',
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [AppColors.primary, AppColors.secondary],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(AppRadius.small),
          boxShadow: widget.isPlaying
              ? AppShadows.neonGlow(AppColors.primary)
              : null,
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(AppRadius.small),
          child: _buildAlbumArtImage(songImageUrl, albumArt),
        ),
      ),
    );
  }

  Widget _buildAlbumArtImage(String songImageUrl, String albumArt) {
    if (songImageUrl.isNotEmpty) {
      return Image.network(
        songImageUrl,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => _buildAnimatedMusicIcon(),
      );
    }

    if (albumArt.isNotEmpty) {
      if (albumArt.startsWith('http://') || albumArt.startsWith('https://')) {
        return Image.network(
          albumArt,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _buildAnimatedMusicIcon(),
        );
      }

      return Image.asset(
        albumArt,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => _buildAnimatedMusicIcon(),
      );
    }

    return _buildAnimatedMusicIcon();
  }

  Widget _buildAnimatedMusicIcon() {
    return Center(
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 300),
        child: widget.isPlaying
            ? const _PlayingWaveAnimation()
            : const Icon(Icons.music_note, color: Colors.white70, size: 20),
      ),
    );
  }

  Widget _buildSongInfo() {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          widget.songTitle,
          style: theme.textTheme.titleMedium?.copyWith(
            fontSize: 13,
            fontWeight: FontWeight.bold,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 2),
        Row(
          children: [
            if (widget.isPlaying)
              Container(
                width: 6,
                height: 6,
                margin: const EdgeInsets.only(right: 6),
                decoration: const BoxDecoration(
                  color: AppColors.secondary,
                  shape: BoxShape.circle,
                ),
              ),
            Expanded(
              child: Text(
                widget.artist,
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontSize: 11,
                  color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildControls() {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          icon: Icon(
            Icons.skip_previous_rounded,
            color: isDark ? Colors.white : AppColors.lightTextPrimary,
            size: 24,
          ),
          onPressed: widget.onPrevious,
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
        ),
        const SizedBox(width: 4),
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppColors.primary, AppColors.secondary],
            ),
            shape: BoxShape.circle,
            boxShadow: AppShadows.neonGlow(AppColors.primary),
          ),
          child: IconButton(
            icon: AnimatedSwitcher(
              duration: const Duration(milliseconds: 200),
              transitionBuilder: (child, anim) =>
                  ScaleTransition(scale: anim, child: child),
              child: Icon(
                widget.isPlaying
                    ? Icons.pause_rounded
                    : Icons.play_arrow_rounded,
                key: ValueKey(widget.isPlaying),
                color: Colors.white,
                size: 24,
              ),
            ),
            onPressed: widget.onPlayPause,
            padding: EdgeInsets.zero,
          ),
        ),
        const SizedBox(width: 4),
        IconButton(
          icon: Icon(
            Icons.skip_next_rounded,
            color: isDark ? Colors.white : AppColors.lightTextPrimary,
            size: 24,
          ),
          onPressed: widget.onNext,
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
        ),
      ],
    );
  }

  void _openFullPlayer(BuildContext context) {
    if (widget.song == null) return;
    Navigator.push(
      context,
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) => PlayerScreen(
          song: widget.song!,
          playlist: widget.playlist,
          currentIndex: widget.currentIndex,
          onSongChanged: widget.onPlaylistItemTap,
        ),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return SlideTransition(
            position: Tween<Offset>(begin: const Offset(0, 1), end: Offset.zero)
                .animate(
                  CurvedAnimation(
                    parent: animation,
                    curve: Curves.easeOutCubic,
                  ),
                ),
            child: child,
          );
        },
        transitionDuration: AppDurations.pageTransition,
      ),
    );
  }
}

class _PlayingWaveAnimation extends StatefulWidget {
  const _PlayingWaveAnimation();

  @override
  State<_PlayingWaveAnimation> createState() => _PlayingWaveAnimationState();
}

class _PlayingWaveAnimationState extends State<_PlayingWaveAnimation>
    with TickerProviderStateMixin {
  late List<AnimationController> _controllers;
  late List<Animation<double>> _animations;

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(3, (index) {
      return AnimationController(
        vsync: this,
        duration: Duration(milliseconds: 350 + index * 100),
      )..repeat(reverse: true);
    });

    _animations = _controllers.map((controller) {
      return Tween<double>(
        begin: 0.3,
        end: 1.0,
      ).animate(CurvedAnimation(parent: controller, curve: Curves.easeInOut));
    }).toList();
  }

  @override
  void dispose() {
    for (var controller in _controllers) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(3, (index) {
        return AnimatedBuilder(
          animation: _animations[index],
          builder: (context, child) {
            return Container(
              width: 3.5,
              height: 14 * _animations[index].value,
              margin: const EdgeInsets.symmetric(horizontal: 1),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(2.0),
              ),
            );
          },
        );
      }),
    );
  }
}

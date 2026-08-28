import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:musicflow_app/core/theme/app_theme.dart';
import 'package:musicflow_app/core/audio/audio_player_service.dart';
import 'package:musicflow_app/core/audio/global_audio_state.dart';
import 'package:musicflow_app/core/utils/lrc_parser.dart';
import 'package:musicflow_app/data/models/lrc_line_model.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import '../../widgets/song_options_menu.dart';
import 'package:musicflow_app/data/services/comment_service.dart';
import 'package:musicflow_app/data/services/like_service.dart';
import 'package:musicflow_app/data/services/lyrics_api_service.dart';
import 'package:musicflow_app/data/services/offline_song_service.dart';
import 'package:musicflow_app/presentation/widgets/player_bottom_action_bar.dart';
import 'package:musicflow_app/presentation/screens/artist/artist_screen.dart';
import 'package:musicflow_app/presentation/widgets/song_comments_sheet.dart';
import 'package:musicflow_app/presentation/widgets/synced_lyrics_view.dart';
import 'package:musicflow_app/presentation/widgets/song_share_sheet.dart';


class PlayerScreen extends StatefulWidget {
  final Song song;
  final List<Song> playlist;
  final int currentIndex;
  final Function(int)? onSongChanged;

  const PlayerScreen({
    super.key,
    required this.song,
    this.playlist = const [],
    this.currentIndex = 0,
    this.onSongChanged,
  });

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen>
    with SingleTickerProviderStateMixin {
  final AudioPlayerService _audioService = AudioPlayerService();
  final GlobalAudioState _globalAudioState = GlobalAudioState();
  final PageController _pageController = PageController(initialPage: 0);

  bool _isPlaying = false;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  int _currentPage = 0; // 0 = Player, 1 = Lyrics, 2 = Queue

  late Song _currentSong;
  late int _currentIndex;
  final bool _isChangingSong = false; // Debounce
  bool _isFavorite = false;
  int _likeCount = 0;
  int _commentCount = 0;
  bool _isDownloading = false;
  bool _isLyricsLoading = false;
  String? _lyricsError;
  bool _isLyricsSynced = true;
  bool _isEstimatedLyrics = false;
  String _rawLyricsContent = '';
  List<LrcLine> _lyricsLines = const [];
  Duration _lastUiPosition = Duration.zero;
  DateTime _lastUiPositionAt = DateTime.fromMillisecondsSinceEpoch(0);

  List<Song> get _activePlaylist => _globalAudioState.playlist.isNotEmpty
      ? _globalAudioState.playlist
      : widget.playlist;

  // Animation cho đĩa xoay
  late AnimationController _discRotationController;

  void _resumeDiscRotation() {
    if (_discRotationController.isAnimating) return;

    if (_discRotationController.value >= 1.0) {
      _discRotationController.value = 0.0;
    }

    _discRotationController.forward();
  }

  void _pauseDiscRotation() {
    if (_discRotationController.isAnimating) {
      _discRotationController.stop();
    }
  }

  @override
  void initState() {
    super.initState();
    _currentSong = widget.song;
    _currentIndex = widget.currentIndex;

    _discRotationController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 12),
    );

    _discRotationController.addStatusListener((status) {
      if (!mounted) return;

      if (status == AnimationStatus.completed) {
        _discRotationController.value = 0.0;
        if (_isPlaying) {
          _discRotationController.forward();
        }
      }
    });

    _initPlayer();
    _loadLikeStatus();
    _loadCommentCount();
    _loadLyricsForCurrentSong();

    _globalAudioState.addListener(_onGlobalAudioStateChanged);
  }

  void _onGlobalAudioStateChanged() {
    final globalSong = _globalAudioState.currentSong;
    final globalIndex = _globalAudioState.currentIndex;

    if (globalSong != null &&
        globalSong.id != _currentSong.id &&
        !_isChangingSong) {
      setState(() {
        _currentSong = globalSong;
        _currentIndex = globalIndex;
        _position = Duration.zero;
        _duration = globalSong.durationAsDuration ?? Duration.zero;
      });

      _discRotationController.value = 0.0;
      if (_isPlaying) {
        _resumeDiscRotation();
      }

      _loadLikeStatus();
      _loadCommentCount();
      _loadLyricsForCurrentSong();
      widget.onSongChanged?.call(globalIndex);
    }
  }

  Future<void> _loadLyricsForCurrentSong() async {
    setState(() {
      _isLyricsLoading = true;
      _lyricsError = null;
      _isLyricsSynced = true;
      _isEstimatedLyrics = false;
      _rawLyricsContent = '';
      _lyricsLines = const [];
    });

    final result = await LyricsApiService.fetchLrcLyrics(
      songId: _currentSong.id,
      fallbackLyrics: _currentSong.lyrics,
    );

    if (!mounted) return;

    if (!result.success) {
      setState(() {
        _isLyricsLoading = false;
        _lyricsError = result.message ?? 'Không thể tải lyrics';
      });
      return;
    }

    final parsedLines = LrcParser.parse(result.lyrics);
    final rawLyrics = result.lyrics.trim();
    _rawLyricsContent = rawLyrics;

    if (parsedLines.isEmpty && rawLyrics.isNotEmpty) {
      final estimatedLines = _buildEstimatedTimedLyrics(rawLyrics, _duration);

      setState(() {
        _isLyricsLoading = false;
        _isLyricsSynced = estimatedLines.isNotEmpty;
        _isEstimatedLyrics = true;
        _lyricsLines = estimatedLines;
        _lyricsError = estimatedLines.isEmpty
            ? 'Bài hát chưa có lyrics.'
            : null;
      });
      return;
    }

    setState(() {
      _isLyricsLoading = false;
      _isLyricsSynced = true;
      _isEstimatedLyrics = false;
      _lyricsLines = parsedLines;
      _lyricsError = parsedLines.isEmpty ? 'Bài hát chưa có lyrics.' : null;
    });
  }

  List<LrcLine> _buildEstimatedTimedLyrics(
    String rawLyrics,
    Duration totalDuration,
  ) {
    final lines = rawLyrics
        .split('\n')
        .map((line) => line.trim())
        .where((line) => line.isNotEmpty)
        .toList();

    if (lines.isEmpty) {
      return const [];
    }

    final weights = lines
        .map(
          (line) =>
              line.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).length,
        )
        .map((wordCount) => wordCount <= 0 ? 1 : wordCount)
        .toList();

    final weightSum = weights.fold<int>(0, (sum, item) => sum + item);
    final totalMs = totalDuration.inMilliseconds;
    final useTrackDuration = totalMs > 0 && weightSum > 0;

    int elapsedMs = 0;
    final List<LrcLine> timed = [];

    for (int i = 0; i < lines.length; i++) {
      timed.add(
        LrcLine(
          timestamp: Duration(milliseconds: elapsedMs),
          text: lines[i],
        ),
      );

      int lineDurationMs;
      if (useTrackDuration) {
        lineDurationMs = ((weights[i] / weightSum) * totalMs).round();
        if (lineDurationMs < 900) {
          lineDurationMs = 900;
        }
      } else {
        lineDurationMs = 1800 + (weights[i] * 320);
      }

      elapsedMs += lineDurationMs;
    }

    return timed;
  }

  @override
  void dispose() {
    _globalAudioState.removeListener(_onGlobalAudioStateChanged);
    _pageController.dispose();
    _discRotationController.dispose();
    super.dispose();
  }

  void _loadLikeStatus() {
    if (mounted) {
      setState(() {
        _isFavorite = false;
        _likeCount = _currentSong.likeCount;
      });
    }
  }

  Future<void> _toggleLikeSong() async {
    final nextFavorite = !_isFavorite;
    setState(() {
      _isFavorite = nextFavorite;
      _likeCount = nextFavorite
          ? _likeCount + 1
          : (_likeCount > 0 ? _likeCount - 1 : 0);
    });

    final result = await LikeService.toggleLike(
      _currentSong.id,
      liked: nextFavorite,
    );
    if (!mounted) return;

    if (result.success) {
      setState(() {
        _likeCount = result.likeCount ?? _likeCount;
      });
      _showActionMessage(
        nextFavorite ? 'Đã like bài hát' : 'Đã bỏ like bài hát',
      );
    } else {
      setState(() {
        _isFavorite = !nextFavorite;
        _likeCount = nextFavorite
            ? (_likeCount > 0 ? _likeCount - 1 : 0)
            : _likeCount + 1;
      });
      _showActionMessage(result.message ?? 'Không thể cập nhật like lúc này');
    }
  }

  Future<void> _loadCommentCount() async {
    try {
      final count = await CommentService.getCommentsCount(_currentSong.id);
      if (mounted) {
        setState(() {
          _commentCount = count;
        });
      }
    } catch (_) {}
  }

  void _openComments() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => SongCommentsSheet(
        songId: _currentSong.id,
        onCommentCountChanged: (count) {
          if (mounted) {
            setState(() {
              _commentCount = count;
            });
          }
        },
      ),
    );
  }

  Future<void> _downloadCurrentSong() async {
    if (_isDownloading) return;

    setState(() => _isDownloading = true);
    _showActionMessage('Bắt đầu tải bài hát xuống thiết bị...');

    try {
      final result = await OfflineSongService().downloadSong(_currentSong);
      final success = result.success;
      if (!mounted) return;

      if (success) {
        _showActionMessage('Đã lưu bài hát offline thành công!');
      } else {
        _showActionMessage('Tải nhạc thất bại. Vui lòng thử lại sau.');
      }
    } catch (e) {
      if (mounted) {
        _showActionMessage('Lỗi tải xuống: $e');
      }
    } finally {
      if (mounted) {
        setState(() => _isDownloading = false);
      }
    }
  }

  void _shareSong() {
    SongShareSheet.show(context, _currentSong);
  }


  void _showMoreOptions() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => SongOptionsSheet(song: _currentSong),
    );
  }

  void _openCurrentArtist() {
    if (_currentSong.artists.isEmpty) return;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => ArtistScreen(artistName: _currentSong.artists.first),
      ),
    );
  }

  void _showActionMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        duration: const Duration(milliseconds: 1500),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _initPlayer() async {
    _isPlaying = _audioService.isPlaying;
    _position = _audioService.player.position;
    _duration =
        _currentSong.durationAsDuration ??
        _audioService.player.duration ??
        Duration.zero;

    _audioService.player.playerStateStream.listen((state) {
      if (mounted) {
        setState(() {
          _isPlaying = state.playing;
        });
        if (state.playing) {
          _resumeDiscRotation();
        } else {
          _pauseDiscRotation();
        }
      }
    });

    if (_isPlaying) {
      _resumeDiscRotation();
    }

    _audioService.player.positionStream.listen((pos) {
      if (mounted) {
        _position = pos;
        final now = DateTime.now();
        final notifyByTime =
            now.difference(_lastUiPositionAt).inMilliseconds >= 250;
        final notifyByDistance =
            (pos - _lastUiPosition).inMilliseconds.abs() >= 300;

        if (notifyByTime || notifyByDistance) {
          _lastUiPositionAt = now;
          _lastUiPosition = pos;
          setState(() {});
        }
      }
    });

    _audioService.player.durationStream.listen((dur) {
      if (mounted && dur != null) {
        final durationChanged = dur != _duration;

        if (!durationChanged) return;

        setState(() {
          _duration = dur;

          if (_isEstimatedLyrics && _rawLyricsContent.isNotEmpty) {
            _lyricsLines = _buildEstimatedTimedLyrics(_rawLyricsContent, dur);
            _isLyricsSynced = _lyricsLines.isNotEmpty;
          }
        });
      }
    });
  }

  void _playNext() {
    _globalAudioState.playNext();
  }

  void _playPrevious() {
    _globalAudioState.playPrevious();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Blurred background image
          Positioned.fill(
            child: _currentSong.imageUrl.isNotEmpty
                ? Image.network(_currentSong.imageUrl, fit: BoxFit.cover)
                : Container(color: AppColors.darkBackground),
          ),
          Positioned.fill(
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 40.0, sigmaY: 40.0),
              child: Container(color: Colors.black.withOpacity(0.55)),
            ),
          ),
          // Gradient overlay mask
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withOpacity(0.3),
                    Colors.black.withOpacity(0.85),
                  ],
                ),
              ),
            ),
          ),
          SafeArea(
            child: Column(
              children: [
                _buildAppBar(),
                _buildPageIndicator(),
                Expanded(
                  child: PageView(
                    controller: _pageController,
                    onPageChanged: (page) {
                      setState(() {
                        _currentPage = page;
                      });
                    },
                    children: [
                      // Page 1: Player
                      _buildPlayerPage(),
                      // Page 2: Lyrics
                      _buildLyricsPage(),
                      // Page 3: Queue
                      if (_activePlaylist.isNotEmpty) _buildQueuePage(),
                    ],
                  ),
                ),
                if (_currentPage == 0) _buildSongInfo(),
                _buildProgressBar(),
                _buildControls(),
                const SizedBox(height: AppSpacing.sm),
                _buildBottomActionBar(),
                const SizedBox(height: AppSpacing.md),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPageIndicator() {
    final labels = <String>[
      'Đang phát',
      'Lyrics',
      if (_activePlaylist.isNotEmpty) 'Danh sách chờ',
    ];

    return Container(
      padding: const EdgeInsets.all(AppSpacing.xxs),
      margin: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(labels.length, (index) {
          final isActive = _currentPage == index;
          return GestureDetector(
            onTap: () {
              _pageController.animateToPage(
                index,
                duration: AppDurations.cardSlide,
                curve: Curves.easeInOut,
              );
            },
            child: AnimatedContainer(
              duration: AppDurations.hover,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: isActive ? AppColors.primary : Colors.transparent,
                borderRadius: BorderRadius.circular(16),
                boxShadow: isActive
                    ? AppShadows.neonGlow(AppColors.primary)
                    : null,
              ),
              child: Text(
                labels[index],
                style: TextStyle(
                  color: isActive ? Colors.white : Colors.white60,
                  fontSize: 12,
                  fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildPlayerPage() {
    return _buildAlbumArt();
  }

  Widget _buildLyricsPage() {
    if (_isLyricsLoading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.secondary),
      );
    }

    if (_lyricsError != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Text(
            _lyricsError!,
            style: const TextStyle(color: Colors.white70, fontSize: 15),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    return SyncedLyricsView(
      lyrics: _lyricsLines,
      currentPosition: _position,
      isSynced: _isLyricsSynced,
      onLineTap: _isEstimatedLyrics
          ? null
          : (timestamp) => _audioService.seek(timestamp),
    );
  }

  Widget _buildQueuePage() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Row(
              children: [
                const Icon(
                  Icons.queue_music_rounded,
                  color: AppColors.secondary,
                ),
                const SizedBox(width: 8),
                Text(
                  'Danh sách phát (${_activePlaylist.length} bài)',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: _activePlaylist.length,
              itemBuilder: (context, index) {
                final song = _activePlaylist[index];
                final isCurrentSong = index == _currentIndex;

                return Container(
                  margin: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: isCurrentSong
                        ? AppColors.primary.withOpacity(0.15)
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(AppRadius.small),
                    border: isCurrentSong
                        ? Border.all(color: AppColors.primary.withOpacity(0.3))
                        : null,
                  ),
                  child: ListTile(
                    leading: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          width: 24,
                          child: isCurrentSong
                              ? const Icon(
                                  Icons.equalizer_rounded,
                                  color: AppColors.secondary,
                                  size: 20,
                                )
                              : Text(
                                  '${index + 1}',
                                  style: TextStyle(
                                    color: Colors.grey[500],
                                    fontSize: 13,
                                  ),
                                ),
                        ),
                        const SizedBox(width: 8),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(AppRadius.small),
                          child: Image.network(
                            song.imageUrl,
                            width: 44,
                            height: 44,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(
                              width: 44,
                              height: 44,
                              color: Colors.grey[800],
                              child: const Icon(
                                Icons.music_note_rounded,
                                color: Colors.white54,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    title: Text(
                      song.title,
                      style: TextStyle(
                        color: isCurrentSong
                            ? AppColors.secondary
                            : Colors.white,
                        fontWeight: isCurrentSong
                            ? FontWeight.bold
                            : FontWeight.normal,
                        fontSize: 14,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(
                      song.artists.join(', '),
                      style: TextStyle(
                        color: isCurrentSong
                            ? AppColors.secondary.withOpacity(0.7)
                            : Colors.grey[400],
                        fontSize: 12,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    trailing: isCurrentSong
                        ? const Icon(
                            Icons.volume_up_rounded,
                            color: AppColors.secondary,
                            size: 20,
                          )
                        : null,
                    onTap: () {
                      if (!isCurrentSong) {
                        _globalAudioState.playAtIndex(index);
                      }
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAppBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
            icon: const Icon(
              Icons.keyboard_arrow_down_rounded,
              color: Colors.white,
              size: 32,
            ),
            onPressed: () => Navigator.pop(context),
          ),
          Text(
            _currentPage == 0
                ? 'ĐANG PHÁT'
                : _currentPage == 1
                ? 'LỜI BÀI HÁT'
                : 'DANH SÁCH CHỜ',
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 2.0,
            ),
          ),
          IconButton(
            icon: const Icon(Icons.more_vert_rounded, color: Colors.white),
            onPressed: _showMoreOptions,
          ),
        ],
      ),
    );
  }

  Widget _buildAlbumArt() {
    return Center(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final discSize = (constraints.maxWidth * 0.72).clamp(220.0, 310.0);

          return Hero(
            tag: 'album_art',
            child: AnimatedBuilder(
              animation: _discRotationController,
              builder: (context, child) {
                return Transform.rotate(
                  angle: _discRotationController.value * 2 * 3.14159,
                  child: child,
                );
              },
              child: Container(
                width: discSize,
                height: discSize,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withOpacity(0.25),
                      blurRadius: 32,
                      spreadRadius: 8,
                    ),
                  ],
                ),
                child: ClipOval(
                  child: _currentSong.imageUrl.isNotEmpty
                      ? Image.network(
                          _currentSong.imageUrl,
                          fit: BoxFit.cover,
                          filterQuality: FilterQuality.high,
                          errorBuilder: (_, __, ___) => _buildDefaultArt(),
                        )
                      : _buildDefaultArt(),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildDefaultArt() {
    return Container(
      width: double.infinity,
      height: double.infinity,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: [AppColors.primary, AppColors.secondary],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: const Icon(
        Icons.music_note_rounded,
        size: 56,
        color: Colors.white70,
      ),
    );
  }

  Widget _buildSongInfo() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
      child: Column(
        children: [
          Text(
            _currentSong.title,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.bold,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 6),
          GestureDetector(
            onTap: _openCurrentArtist,
            child: Text(
              _currentSong.artists.join(', '),
              style: TextStyle(
                color: AppColors.secondary.withOpacity(0.9),
                fontSize: 15,
                fontWeight: FontWeight.w500,
                decoration: TextDecoration.underline,
                decorationColor: AppColors.secondary.withOpacity(0.5),
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: 4),
        ],
      ),
    );
  }

  Widget _buildProgressBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
      child: Column(
        children: [
          SliderTheme(
            data: SliderTheme.of(context).copyWith(
              trackHeight: 3,
              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 5),
              overlayShape: const RoundSliderOverlayShape(overlayRadius: 12),
              activeTrackColor: AppColors.secondary,
              inactiveTrackColor: Colors.white24,
              thumbColor: AppColors.secondary,
              overlayColor: AppColors.secondary.withOpacity(0.2),
            ),
            child: Slider(
              value: _duration.inMilliseconds > 0
                  ? (_position.inMilliseconds / _duration.inMilliseconds).clamp(
                      0.0,
                      1.0,
                    )
                  : 0.0,
              onChanged: (value) {
                final newPosition = Duration(
                  milliseconds: (value * _duration.inMilliseconds).toInt(),
                );
                _audioService.seek(newPosition);
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  _formatDuration(_position),
                  style: const TextStyle(color: Colors.white70, fontSize: 11),
                ),
                Text(
                  _formatDuration(_duration),
                  style: const TextStyle(color: Colors.white70, fontSize: 11),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildControls() {
    final canGoPrevious = _currentIndex > 0;
    final canGoNext = _currentIndex < _activePlaylist.length - 1;
    final isShuffleEnabled = _globalAudioState.isShuffleEnabled;
    final repeatMode = _globalAudioState.repeatMode;
    final canUsePlaylistModes = _activePlaylist.isNotEmpty;
    final canTriggerPrevious =
        canGoPrevious ||
        isShuffleEnabled ||
        repeatMode == PlaybackRepeatMode.all;
    final canTriggerNext =
        canGoNext || isShuffleEnabled || repeatMode == PlaybackRepeatMode.all;

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        IconButton(
          icon: Icon(
            Icons.shuffle_rounded,
            color: isShuffleEnabled ? AppColors.secondary : Colors.white54,
          ),
          iconSize: 26,
          onPressed: canUsePlaylistModes
              ? () {
                  _globalAudioState.toggleShuffle();
                  setState(() {});
                }
              : null,
        ),
        IconButton(
          icon: Icon(
            Icons.skip_previous_rounded,
            color: canTriggerPrevious ? Colors.white : Colors.white38,
          ),
          iconSize: 38,
          onPressed: canTriggerPrevious ? _playPrevious : null,
        ),
        Container(
          width: 68,
          height: 68,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppColors.primary, AppColors.secondary],
            ),
            shape: BoxShape.circle,
            boxShadow: AppShadows.neonGlow(AppColors.primary),
          ),
          child: IconButton(
            icon: Icon(
              _isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
              color: Colors.white,
            ),
            iconSize: 38,
            onPressed: () {
              if (_isPlaying) {
                _audioService.pause();
              } else {
                _audioService.resume();
              }
            },
          ),
        ),
        IconButton(
          icon: Icon(
            Icons.skip_next_rounded,
            color: canTriggerNext ? Colors.white : Colors.white38,
          ),
          iconSize: 38,
          onPressed: canTriggerNext ? _playNext : null,
        ),
        IconButton(
          icon: Stack(
            clipBehavior: Clip.none,
            children: [
              Icon(
                repeatMode == PlaybackRepeatMode.one
                    ? Icons.repeat_one_rounded
                    : Icons.repeat_rounded,
                color: repeatMode == PlaybackRepeatMode.off
                    ? Colors.white54
                    : AppColors.secondary,
              ),
              if (repeatMode == PlaybackRepeatMode.all)
                Positioned(
                  right: -1,
                  top: -2,
                  child: Container(
                    width: 6,
                    height: 6,
                    decoration: const BoxDecoration(
                      color: AppColors.secondary,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
            ],
          ),
          iconSize: 26,
          onPressed: canUsePlaylistModes
              ? () {
                  _globalAudioState.cycleRepeatMode();
                  setState(() {});
                }
              : null,
        ),
      ],
    );
  }

  Widget _buildBottomActionBar() {
    return PlayerBottomActionBar(
      isLiked: _isFavorite,
      likeCount: _likeCount,
      commentCount: _commentCount,
      onLikePressed: _toggleLikeSong,
      onCommentPressed: _openComments,
      onDownloadPressed: _downloadCurrentSong,
      onSharePressed: _shareSong,
      onMorePressed: _showMoreOptions,
    );
  }

  String _formatDuration(Duration duration) {
    final minutes = duration.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = duration.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }
}

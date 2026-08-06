import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/song_model.dart';
import '../../../data/services/song_api_service.dart';
import '../../widgets/song_options_menu.dart';

class FlowchartScreen extends StatefulWidget {
  final void Function(Song song)? onSongTap;
  final void Function(List<Song> songs, int startIndex)? onPlayWithQueue;
  final int refreshTrigger;

  const FlowchartScreen({
    super.key,
    this.onSongTap,
    this.onPlayWithQueue,
    this.refreshTrigger = 0,
  });

  @override
  State<FlowchartScreen> createState() => _FlowchartScreenState();
}

class _FlowchartScreenState extends State<FlowchartScreen> {
  bool _isLoading = true;
  String? _error;

  List<Song> _flowSongs = <Song>[];
  List<Song> _risingSongs = <Song>[];
  Map<String, FlowchartSongMetrics> _risingMetrics =
      <String, FlowchartSongMetrics>{};

  int _flowDisplayLimit = 10;
  int _risingDisplayLimit = 10;
  Timer? _realtimeRefreshTimer;

  @override
  void initState() {
    super.initState();
    _loadTrendingData();
    _realtimeRefreshTimer = Timer.periodic(const Duration(minutes: 1), (_) {
      _loadTrendingData(showLoading: false);
    });
  }

  @override
  void dispose() {
    _realtimeRefreshTimer?.cancel();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant FlowchartScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.refreshTrigger != oldWidget.refreshTrigger) {
      _loadTrendingData(showLoading: false);
    }
  }

  Future<void> _loadTrendingData({bool showLoading = true}) async {
    if (showLoading) {
      setState(() {
        _isLoading = true;
        _error = null;
      });
    } else {
      setState(() {
        _error = null;
      });
    }

    try {
      final results = await Future.wait([
        SongApiService.fetchFlowchartData(hours: 12, limit: 50, mode: 'flow'),
        SongApiService.fetchFlowchartData(hours: 12, limit: 50, mode: 'rising'),
      ]);

      if (!mounted) {
        return;
      }

      final flowResult = results[0];
      final risingResult = results[1];

      setState(() {
        _flowSongs = List<Song>.from(flowResult.topSongs);
        _risingSongs = List<Song>.from(risingResult.topSongs);
        _risingMetrics = Map<String, FlowchartSongMetrics>.from(
          risingResult.songMetricsBySongId,
        );
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = e.toString();
        if (showLoading) {
          _isLoading = false;
        }
      });
    }
  }

  String _nowLabel() {
    final now = DateTime.now();
    final day = now.day.toString().padLeft(2, '0');
    final month = now.month.toString().padLeft(2, '0');
    final year = now.year.toString();
    final hour = now.hour.toString().padLeft(2, '0');
    final minute = now.minute.toString().padLeft(2, '0');
    return '$day.$month.$year - $hour:$minute';
  }

  String _formatCount(int value) {
    if (value >= 1000000) {
      return '${(value / 1000000).toStringAsFixed(1)}M';
    }
    if (value >= 1000) {
      return '${(value / 1000).toStringAsFixed(1)}K';
    }
    return '$value';
  }

  void _playFromQueue(List<Song> songs, int index) {
    if (songs.isEmpty || index < 0 || index >= songs.length) {
      return;
    }

    if (widget.onPlayWithQueue != null) {
      widget.onPlayWithQueue!(songs, index);
      return;
    }

    widget.onSongTap?.call(songs[index]);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadTrendingData,
          color: theme.colorScheme.primary,
          child: _buildBody(),
        ),
      ),
    );
  }

  Widget _buildBody() {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    if (_isLoading) {
      return Center(
        child: CircularProgressIndicator(color: theme.colorScheme.primary),
      );
    }

    if (_error != null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 100, 20, 24),
        children: [
          Icon(Icons.wifi_off_rounded, size: 42, color: theme.disabledColor),
          const SizedBox(height: 12),
          const Text(
            'Không tải được Trending Feed',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Text(
            _error!,
            textAlign: TextAlign.center,
            style: TextStyle(color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary),
          ),
          const SizedBox(height: 16),
          Center(
            child: ElevatedButton(
              onPressed: _loadTrendingData,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
              ),
              child: const Text('Thử lại'),
            ),
          ),
        ],
      );
    }

    final flowTop50 = _flowSongs.take(50).toList();
    final risingTop50 = _risingSongs.take(50).toList();
    final flowVisible = flowTop50
        .take(math.min(_flowDisplayLimit, flowTop50.length))
        .toList();
    final risingVisible = risingTop50
        .take(math.min(_risingDisplayLimit, risingTop50.length))
        .toList();

    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 8, 18, 0),
            child: _Header(nowLabel: _nowLabel()),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 18, 12, 0),
            child: _TrendingSpotlight(
              songs: flowTop50,
              formatCount: _formatCount,
              onTapSong: (index) => _playFromQueue(flowTop50, index),
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 24, 18, 10),
            child: Row(
              children: [
                Text(
                  'Top Flow',
                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800, fontSize: 18),
                ),
                const SizedBox(width: 8),
                Text(
                  '(Nghe nhiều nhất)',
                  style: TextStyle(
                    color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate((context, index) {
              final song = flowVisible[index];
              return Padding(
                padding: const EdgeInsets.only(bottom: 9),
                child: _FeedTile(
                  rank: index + 1,
                  song: song,
                  subtitle: '${_formatCount(song.playCount)}',
                  onTap: () => _playFromQueue(flowTop50, index),
                ),
              );
            }, childCount: flowVisible.length),
          ),
        ),
        if (flowTop50.length > 10)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 18),
              child: Center(
                child: OutlinedButton.icon(
                  onPressed: () {
                    setState(() {
                      _flowDisplayLimit = _flowDisplayLimit == 10 ? 50 : 10;
                    });
                  },
                  icon: Icon(
                    _flowDisplayLimit == 10
                        ? Icons.keyboard_arrow_down_rounded
                        : Icons.keyboard_arrow_up_rounded,
                    color: isDark ? Colors.white70 : AppColors.lightTextPrimary,
                    size: 18,
                  ),
                  label: Text(
                    _flowDisplayLimit == 10
                        ? 'XEM THÊM TOP FLOW'
                        : 'RÚT GỌN TOP FLOW',
                    style: TextStyle(
                      color: isDark ? Colors.white : AppColors.lightTextPrimary,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.3,
                      fontSize: 12,
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    backgroundColor: isDark ? Colors.white.withOpacity(0.02) : Colors.black.withOpacity(0.01),
                    foregroundColor: isDark ? Colors.white : AppColors.lightTextPrimary,
                    side: BorderSide(color: isDark ? Colors.white12 : Colors.black12),
                    shape: const StadiumBorder(),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 11,
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _Header extends StatelessWidget {
  final String nowLabel;

  const _Header({required this.nowLabel});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Row(
      children: [
        Expanded(
          child: RichText(
            text: const TextSpan(
              style: TextStyle(
                fontSize: 36,
                fontWeight: FontWeight.w900,
                letterSpacing: -1.3,
              ),
              children: [
                TextSpan(
                  text: '#',
                  style: TextStyle(color: AppColors.primary),
                ),
                TextSpan(
                  text: 'flow',
                  style: TextStyle(color: AppColors.secondary),
                ),
                TextSpan(
                  text: 'charts',
                  style: TextStyle(color: AppColors.accentPink),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 8),
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              nowLabel,
              style: TextStyle(
                color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _TrendingSpotlight extends StatelessWidget {
  final List<Song> songs;
  final String Function(int) formatCount;
  final void Function(int) onTapSong;

  const _TrendingSpotlight({
    required this.songs,
    required this.formatCount,
    required this.onTapSong,
  });

  @override
  Widget build(BuildContext context) {
    final highlights = songs.take(3).toList();
    if (highlights.isEmpty) return const SizedBox.shrink();

    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    Song? first = highlights.isNotEmpty ? highlights[0] : null;
    Song? second = highlights.length > 1 ? highlights[1] : null;
    Song? third = highlights.length > 2 ? highlights[2] : null;

    return Container(
      decoration: BoxDecoration(
        borderRadius: AppRadius.mediumBorder,
        color: isDark ? AppColors.darkSurfaceGlass : AppColors.lightSurfaceGlass,
        border: Border.all(color: isDark ? AppColors.darkBorderGlass : AppColors.lightBorderGlass),
      ),
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 20),
      child: Column(
        children: [
          Row(
            children: [
              const Icon(Icons.star_rounded, color: Colors.amber, size: 20),
              const SizedBox(width: 6),
              Text(
                'Top Spotlight',
                style: theme.textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              // 2nd Place
              if (second != null)
                Expanded(
                  child: _PodiumItem(
                    song: second,
                    rank: 2,
                    medalColor: const Color(0xFFC0C0C0),
                    onTap: () => onTapSong(1),
                    formatCount: formatCount,
                  ),
                )
              else
                const Spacer(),

              // 1st Place
              if (first != null)
                Expanded(
                  child: _PodiumItem(
                    song: first,
                    rank: 1,
                    medalColor: const Color(0xFFFFD700),
                    onTap: () => onTapSong(0),
                    formatCount: formatCount,
                  ),
                )
              else
                const Spacer(),

              // 3rd Place
              if (third != null)
                Expanded(
                  child: _PodiumItem(
                    song: third,
                    rank: 3,
                    medalColor: const Color(0xFFCD7F32),
                    onTap: () => onTapSong(2),
                    formatCount: formatCount,
                  ),
                )
              else
                const Spacer(),
            ],
          ),
        ],
      ),
    );
  }
}

class _PodiumItem extends StatelessWidget {
  final Song song;
  final int rank;
  final Color medalColor;
  final VoidCallback onTap;
  final String Function(int) formatCount;

  const _PodiumItem({
    required this.song,
    required this.rank,
    required this.medalColor,
    required this.onTap,
    required this.formatCount,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final imageSize = rank == 1 ? 82.0 : 66.0;

    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          Stack(
            alignment: Alignment.center,
            clipBehavior: Clip.none,
            children: [
              if (rank == 1)
                Positioned(
                  child: Container(
                    width: imageSize + 12,
                    height: imageSize + 12,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: medalColor.withOpacity(0.35),
                          blurRadius: 16,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                  ),
                ),
              Container(
                width: imageSize,
                height: imageSize,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: medalColor,
                    width: rank == 1 ? 3 : 2,
                  ),
                ),
                child: ClipOval(
                  child: Image.network(
                    song.imageUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
                      child: const Icon(Icons.music_note_rounded, color: Colors.white24),
                    ),
                  ),
                ),
              ),
              Positioned(
                bottom: -8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                  decoration: BoxDecoration(
                    color: medalColor,
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.2),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      )
                    ],
                  ),
                  child: Text(
                    '$rank',
                    style: const TextStyle(
                      color: Colors.black,
                      fontWeight: FontWeight.w900,
                      fontSize: 12,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            margin: const EdgeInsets.symmetric(horizontal: 4),
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
            decoration: BoxDecoration(
              color: isDark ? Colors.white.withOpacity(0.03) : Colors.black.withOpacity(0.02),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isDark ? Colors.white.withOpacity(0.04) : Colors.black.withOpacity(0.02),
              ),
            ),
            child: Column(
              children: [
                Text(
                  song.title,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    fontSize: rank == 1 ? 12 : 11,
                    color: isDark ? Colors.white : AppColors.lightTextPrimary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 2),
                Text(
                  song.artists.join(', '),
                  style: TextStyle(
                    color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                    fontSize: 9,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 4),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      Icons.play_arrow_rounded,
                      size: 11,
                      color: AppColors.secondary,
                    ),
                    const SizedBox(width: 1),
                    Text(
                      formatCount(song.playCount),
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: AppColors.secondary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FeedTile extends StatelessWidget {
  final int rank;
  final Song song;
  final String subtitle;
  final Color subtitleColor;
  final VoidCallback onTap;

  const _FeedTile({
    required this.rank,
    required this.song,
    required this.subtitle,
    this.subtitleColor = const Color(0xFFB9B6C9),
    required this.onTap,
  });

  String _formatDuration(double? durationInSeconds) {
    if (durationInSeconds == null) return "0:00";
    final int totalSeconds = durationInSeconds.toInt();
    final int minutes = totalSeconds ~/ 60;
    final int seconds = totalSeconds % 60;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final rankColor = switch (rank) {
      1 => const Color(0xFFFFD873),
      2 => const Color(0xFFE4E7EF),
      3 => const Color(0xFFFFB07A),
      _ => isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
    };

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Ink(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          color: isDark ? Colors.white.withOpacity(0.03) : Colors.black.withOpacity(0.02),
          border: Border.all(color: isDark ? Colors.white12 : Colors.black12),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: _SongArt(imageUrl: song.imageUrl, size: 54),
              ),
              const SizedBox(width: 10),
              SizedBox(
                width: 26,
                child: Text(
                  '$rank',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                    color: rankColor,
                    height: 1,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      song.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: isDark ? Colors.white : AppColors.lightTextPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      song.artists.join(', '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(
                          Icons.play_arrow_rounded,
                          color: isDark ? AppColors.darkTextSecondary.withOpacity(0.7) : AppColors.lightTextSecondary.withOpacity(0.7),
                          size: 14,
                        ),
                        const SizedBox(width: 2),
                        Text(
                          subtitle,
                          style: TextStyle(
                            color: isDark ? AppColors.secondary : AppColors.primary,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '·',
                          style: TextStyle(
                            color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          _formatDuration(song.duration),
                          style: TextStyle(
                            color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              IconButton(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                constraints: const BoxConstraints(),
                icon: Icon(
                  Icons.more_vert_rounded,
                  color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                  size: 20,
                ),
                onPressed: () {
                  showModalBottomSheet(
                    context: context,
                    backgroundColor: Colors.transparent,
                    isScrollControlled: true,
                    builder: (context) => SongOptionsSheet(song: song),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SongArt extends StatelessWidget {
  final String imageUrl;
  final double size;

  const _SongArt({required this.imageUrl, this.size = 52});

  @override
  Widget build(BuildContext context) {
    if (imageUrl.isEmpty) {
      return _fallback();
    }

    return Image.network(
      imageUrl,
      width: size,
      height: size,
      fit: BoxFit.cover,
      errorBuilder: (_, __, ___) => _fallback(),
    );
  }

  Widget _fallback() {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF4C3A8D), Color(0xFF1B1533)],
        ),
      ),
      child: const Icon(
        Icons.music_note_rounded,
        color: Colors.white70,
        size: 20,
      ),
    );
  }
}

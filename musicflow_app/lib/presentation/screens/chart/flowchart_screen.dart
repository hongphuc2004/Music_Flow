import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/data/services/song_api_service.dart';
import 'package:musicflow_app/presentation/widgets/song_options_menu.dart';

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
    return Scaffold(
      backgroundColor: const Color(0xFF120C21),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: <Color>[
              Color(0xFF281A4F),
              Color(0xFF2D1956),
              Color(0xFF191329),
            ],
          ),
        ),
        child: SafeArea(
          child: RefreshIndicator(
            onRefresh: _loadTrendingData,
            color: const Color(0xFF4AF2E2),
            child: _buildBody(),
          ),
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF4AF2E2)),
      );
    }

    if (_error != null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 100, 20, 24),
        children: [
          const Icon(Icons.wifi_off_rounded, size: 42, color: Colors.white54),
          const SizedBox(height: 12),
          const Text(
            'Khong tai duoc Trending Feed',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          Text(
            _error!,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white70),
          ),
          const SizedBox(height: 16),
          Center(
            child: ElevatedButton(
              onPressed: _loadTrendingData,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4AF2E2),
                foregroundColor: const Color(0xFF151024),
              ),
              child: const Text('Thu lai'),
            ),
          ),
        ],
      );
    }

    final flowTop50 = _flowSongs.take(50).toList();
    final risingTop50 = _risingSongs.take(50).toList();
    final flowVisible = flowTop50.take(math.min(_flowDisplayLimit, flowTop50.length)).toList();
    final risingVisible =
        risingTop50.take(math.min(_risingDisplayLimit, risingTop50.length)).toList();

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
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 10),
            child: Row(
              children: const [
                Text(
                  'Top Flow',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                ),
                SizedBox(width: 8),
                Text(
                  '(Nghe nhieu nhat)',
                  style: TextStyle(color: Colors.white60, fontSize: 12),
                ),
              ],
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
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
              },
              childCount: flowVisible.length,
            ),
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
                    color: Colors.white70,
                    size: 18,
                  ),
                  label: Text(
                    _flowDisplayLimit == 10 ? 'XEM THEM TOP FLOW' : 'RUT GON TOP FLOW',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.3,
                      fontSize: 12,
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    backgroundColor: const Color(0x1E261F49),
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Colors.white12),
                    shape: const StadiumBorder(),
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 11),
                  ),
                ),
              ),
            ),
          ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 0, 18, 10),
            child: Row(
              children: const [
                Text(
                  'Top Rising',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                ),
                SizedBox(width: 8),
                Text(
                  '(Tang nhanh 24h)',
                  style: TextStyle(color: Colors.white60, fontSize: 12),
                ),
              ],
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final song = risingVisible[index];
                final metrics = _risingMetrics[song.id];
                final risingScore = metrics?.risingScore ?? 0;
                final up = risingScore >= 0;

                return Padding(
                  padding: const EdgeInsets.only(bottom: 9),
                  child: _FeedTile(
                    rank: index + 1,
                    song: song,
                    subtitle:
                        '${up ? '+' : '-'}${risingScore.abs()} trong 24h (${_formatCount(metrics?.last24h ?? 0)})',
                    subtitleColor:
                        up ? const Color(0xFF49E7CF) : const Color(0xFFFFAA63),
                    onTap: () => _playFromQueue(risingTop50, index),
                  ),
                );
              },
              childCount: risingVisible.length,
            ),
          ),
        ),
        if (risingTop50.length > 10)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
              child: Center(
                child: OutlinedButton.icon(
                  onPressed: () {
                    setState(() {
                      _risingDisplayLimit = _risingDisplayLimit == 10 ? 50 : 10;
                    });
                  },
                  icon: Icon(
                    _risingDisplayLimit == 10
                        ? Icons.keyboard_arrow_down_rounded
                        : Icons.keyboard_arrow_up_rounded,
                    color: Colors.white70,
                    size: 18,
                  ),
                  label: Text(
                    _risingDisplayLimit == 10
                        ? 'XEM THEM TOP RISING'
                        : 'RUT GON TOP RISING',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.3,
                      fontSize: 12,
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    backgroundColor: const Color(0x1E261F49),
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Colors.white12),
                    shape: const StadiumBorder(),
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 11),
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
    return Row(
      children: [
        Expanded(
          child: RichText(
            text: const TextSpan(
              style: TextStyle(
                fontSize: 40,
                fontWeight: FontWeight.w900,
                letterSpacing: -1.3,
              ),
              children: [
                TextSpan(text: '#', style: TextStyle(color: Color(0xFFFFB15B))),
                TextSpan(text: 'flow', style: TextStyle(color: Color(0xFFFF4FA3))),
                TextSpan(text: 'feed', style: TextStyle(color: Color(0xFF58A6FF))),
              ],
            ),
          ),
        ),
        const SizedBox(width: 8),
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: const [
                Icon(Icons.mic_none_rounded, color: Colors.white70, size: 24),
                SizedBox(width: 12),
                Icon(Icons.search_rounded, color: Colors.white70, size: 25),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              nowLabel,
              style: const TextStyle(color: Colors.white70, fontSize: 13),
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
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        color: const Color(0x38201A3E),
        border: Border.all(color: Colors.white10),
      ),
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
      child: Column(
        children: [
          const Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Trending Feed',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
            ),
          ),
          const SizedBox(height: 10),
          ...List.generate(highlights.length, (index) {
            final song = highlights[index];
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => onTapSong(index),
                child: Ink(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    color: const Color(0x3520183A),
                    border: Border.all(color: Colors.white12),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 8),
                    child: Row(
                      children: [
                        Container(
                          width: 24,
                          height: 24,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: const Color(0xFF3A2A72),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            '${index + 1}',
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 12,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: _SongArt(imageUrl: song.imageUrl, size: 42),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                song.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 15,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${song.artists.join(', ')} • ${formatCount(song.playCount)} nghe',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(color: Colors.white70, fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 6),
                        const Icon(Icons.play_circle_fill_rounded,
                            color: Color(0xFF49E7CF), size: 22),
                      ],
                    ),
                  ),
                ),
              ),
            );
          }),
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
    final rankColor = switch (rank) {
      1 => const Color(0xFFFFD873),
      2 => const Color(0xFFE4E7EF),
      3 => const Color(0xFFFFB07A),
      _ => Colors.white,
    };

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Ink(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          color: const Color(0x3B1D1838),
          border: Border.all(color: Colors.white12),
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
                    fontSize: 20,
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
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      song.artists.join(', '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Colors.white60, fontSize: 13),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.play_arrow_rounded, color: Colors.white60, size: 16),
                        const SizedBox(width: 4),
                        Text(
                          subtitle,
                          style: TextStyle(
                            color: subtitleColor,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(width: 6),
                        const Text('·', style: TextStyle(color: Colors.white60, fontSize: 13, fontWeight: FontWeight.bold)),
                        const SizedBox(width: 6),
                        Text(
                          _formatDuration(song.duration),
                          style: const TextStyle(color: Colors.white60, fontSize: 13),
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
                icon: const Icon(Icons.more_vert_rounded, color: Colors.white70, size: 20),
                onPressed: () {
                  showModalBottomSheet(
                    context: context,
                    backgroundColor: Colors.transparent,
                    isScrollControlled: true,
                    builder: (context) => SongOptionsMenu(song: song),
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
          colors: [
            Color(0xFF4C3A8D),
            Color(0xFF1B1533),
          ],
        ),
      ),
      child: const Icon(Icons.music_note_rounded, color: Colors.white70, size: 20),
    );
  }
}


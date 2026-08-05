import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/data/models/topic_model.dart';
import 'package:musicflow_app/data/services/topic_api_service.dart';
import 'package:musicflow_app/presentation/widgets/song_options_menu.dart';
import 'home_shared.dart';

class HomeTopicSongsScreen extends StatefulWidget {
  final Topic topic;
  final Function(Song)? onSongTap;
  final Function(List<Song>, {int startIndex})? onPlayAll;

  const HomeTopicSongsScreen({
    super.key,
    required this.topic,
    this.onSongTap,
    this.onPlayAll,
  });

  @override
  State<HomeTopicSongsScreen> createState() => _HomeTopicSongsScreenState();
}

class _HomeTopicSongsScreenState extends State<HomeTopicSongsScreen> {
  List<Song> songs = [];
  bool isLoading = true;
  String? errorMessage;

  @override
  void initState() {
    super.initState();
    fetchSongs();
  }

  Future<void> fetchSongs() async {
    setState(() {
      isLoading = true;
      errorMessage = null;
    });

    try {
      final fetchedSongs = await TopicApiService.fetchSongsByTopic(widget.topic.id);
      setState(() {
        songs = fetchedSongs;
        isLoading = false;
      });
    } catch (e) {
      setState(() {
        errorMessage = 'Đã xảy ra lỗi: $e';
        isLoading = false;
      });
    }
  }

  void _playSong(Song song, {int? index}) {
    Navigator.pop(context);

    Future.delayed(const Duration(milliseconds: 50), () {
      if (index != null && widget.onPlayAll != null) {
        widget.onPlayAll!(songs, startIndex: index);
      } else if (widget.onSongTap != null) {
        widget.onSongTap!(song);
      }
    });
  }

  void _playAll({bool shuffle = false}) {
    if (songs.isEmpty) return;

    Navigator.pop(context);

    Future.delayed(const Duration(milliseconds: 50), () {
      final list = shuffle ? (List<Song>.from(songs)..shuffle()) : songs;
      if (widget.onPlayAll != null) {
        widget.onPlayAll!(list, startIndex: 0);
      } else if (widget.onSongTap != null) {
        widget.onSongTap!(list.first);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: HomePalette.background(context),
      body: Stack(
        children: [
          const HomeBackdrop(),
          CustomScrollView(
            slivers: [
              _buildSliverAppBar(isDark),
              _buildBody(isDark),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSliverAppBar(bool isDark) {
    final accentColor = HomePalette.primary;

    return SliverAppBar(
      expandedHeight: 240,
      pinned: true,
      backgroundColor: Colors.transparent,
      elevation: 0,
      leading: IconButton(
        icon: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: (isDark ? Colors.black : Colors.white).withValues(alpha: 0.3),
            shape: BoxShape.circle,
          ),
          child: Icon(Icons.arrow_back, color: HomePalette.textPrimary(context)),
        ),
        onPressed: () => Navigator.pop(context),
      ),
      flexibleSpace: FlexibleSpaceBar(
        title: Text(
          widget.topic.name,
          style: TextStyle(
            color: HomePalette.textPrimary(context),
            fontWeight: FontWeight.w900,
            fontSize: 20,
            shadows: [
              Shadow(
                color: (isDark ? Colors.black : Colors.white).withValues(alpha: 0.5),
                blurRadius: 4,
              ),
            ],
          ),
        ),
        background: Stack(
          fit: StackFit.expand,
          children: [
            if (widget.topic.avatar.isNotEmpty)
              Image.network(
                widget.topic.avatar,
                fit: BoxFit.cover,
              )
            else
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [accentColor, accentColor.withValues(alpha: 0.5)],
                  ),
                ),
              ),
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Colors.transparent,
                    HomePalette.background(context).withValues(alpha: 0.6),
                    HomePalette.background(context),
                  ],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(bool isDark) {
    if (isLoading) {
      return const SliverFillRemaining(
        child: Center(
          child: CircularProgressIndicator(color: HomePalette.primary),
        ),
      );
    }

    if (errorMessage != null) {
      return SliverFillRemaining(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.wifi_off_rounded, size: 48, color: Colors.grey),
                const SizedBox(height: 16),
                Text(
                  errorMessage!,
                  style: TextStyle(color: HomePalette.textSecondary(context)),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: fetchSongs,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: HomePalette.primary,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  child: const Text('Thử lại', style: TextStyle(color: Colors.white)),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (songs.isEmpty) {
      return const SliverFillRemaining(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.music_off_rounded, size: 64, color: Colors.grey),
              SizedBox(height: 16),
              Text(
                'Không tìm thấy bài hát nào trong chủ đề này',
                style: TextStyle(color: Colors.grey, fontSize: 15, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
      );
    }

    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
      sliver: SliverList(
        delegate: SliverChildBuilderDelegate((context, index) {
          if (index == 0) {
            return _buildHeaderButtons();
          }
          final song = songs[index - 1];
          return _buildSongRow(song, index);
        }, childCount: songs.length + 1),
      ),
    );
  }

  Widget _buildHeaderButtons() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16.0),
      child: Row(
        children: [
          Text(
            '${songs.length} bài hát',
            style: TextStyle(
              color: HomePalette.textSecondary(context),
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
          const Spacer(),
          ElevatedButton.icon(
            onPressed: () => _playAll(shuffle: false),
            icon: const Icon(Icons.play_arrow_rounded, size: 18),
            label: const Text('Phát tất cả'),
            style: ElevatedButton.styleFrom(
              backgroundColor: HomePalette.primary,
              foregroundColor: Colors.white,
              elevation: 4,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            ),
          ),
          const SizedBox(width: 8),
          OutlinedButton(
            onPressed: () => _playAll(shuffle: true),
            style: OutlinedButton.styleFrom(
              side: BorderSide(color: HomePalette.primary.withValues(alpha: 0.4)),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
            child: const Icon(Icons.shuffle_rounded, size: 18, color: HomePalette.primary),
          ),
        ],
      ),
    );
  }

  Widget _buildSongRow(Song song, int index) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _playSong(song, index: index - 1),
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: HomePalette.card(context).withValues(alpha: 0.95),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: HomePalette.cardBorder(context)),
            ),
            child: Row(
              children: [
                SizedBox(
                  width: 24,
                  child: Center(
                    child: Text(
                      '$index',
                      style: TextStyle(
                        color: HomePalette.textSecondary(context).withValues(alpha: 0.6),
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                HomeArtwork(
                  imageUrl: song.imageUrl,
                  size: 48,
                  borderRadius: 10,
                  iconSize: 20,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        song.title,
                        style: TextStyle(
                          color: HomePalette.textPrimary(context),
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        song.artists.join(', '),
                        style: TextStyle(
                          color: HomePalette.textSecondary(context),
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                SongOptionsMenu(song: song),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

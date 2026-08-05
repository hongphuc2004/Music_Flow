import 'package:flutter/material.dart';
import 'package:musicflow_app/core/config/api_client.dart';
import 'package:musicflow_app/data/models/playlist_model.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/data/models/user_model.dart';
import 'package:musicflow_app/data/services/artist_api_service.dart';
import 'package:musicflow_app/data/services/auth_service.dart';
import 'package:musicflow_app/data/services/playlist_api_service.dart';
import 'package:musicflow_app/data/services/song_api_service.dart';
import 'package:musicflow_app/data/services/play_history_service.dart';
import 'package:musicflow_app/data/models/topic_model.dart';
import 'package:musicflow_app/data/services/topic_api_service.dart';
import 'package:musicflow_app/presentation/screens/home/home_playlist_detail_screen.dart';
import 'package:musicflow_app/presentation/screens/home/home_artist_section.dart';
import 'package:musicflow_app/presentation/screens/home/home_playlist_section.dart';
import 'package:musicflow_app/presentation/screens/home/home_recommended_section.dart';
import 'package:musicflow_app/presentation/screens/home/home_shared.dart';
import 'package:musicflow_app/presentation/screens/home/home_song_list_section.dart';
import 'package:musicflow_app/presentation/screens/home/home_top_section.dart';
import 'package:musicflow_app/presentation/screens/home/home_topic_section.dart';
import 'package:musicflow_app/presentation/screens/home/home_new_releases_section.dart';
import 'package:musicflow_app/presentation/screens/ai_dj/ai_dj_screen.dart';

class HomeScreen extends StatefulWidget {
  final Function(Song)? onSongTap;
  final Function(List<Song>, {int startIndex})? onPlayAll;

  const HomeScreen({super.key, this.onSongTap, this.onPlayAll});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<Song> songs = [];
  List<Playlist> systemPlaylists = [];
  List<Song> recommendedSongs = [];
  List<Song> recentHistory = [];
  List<Topic> topics = [];
  final Map<String, String> _artistAvatarByName = {};
  User? _currentUser;
  bool isLoading = true;
  String? errorMessage;
  String _selectedMood = '🎯 Tất cả';

  Song? get _featuredSong {
    if (recommendedSongs.isNotEmpty) return recommendedSongs.first;
    if (songs.isNotEmpty) return songs.first;
    return null;
  }

  List<HomeArtistPreview> get _featuredArtists {
    final mergedSongs = [...recommendedSongs, ...songs];
    final seen = <String>{};
    final artists = <HomeArtistPreview>[];

    for (final song in mergedSongs) {
      for (final artistName in song.artists) {
        final normalized = artistName.trim().toLowerCase();
        if (normalized.isEmpty || seen.contains(normalized)) continue;

        seen.add(normalized);
        final verified = Song.artistVerified[normalized] ?? false;
        final followers = Song.artistFollowers[normalized] ?? 0;
        artists.add(
          HomeArtistPreview(
            name: artistName.trim(),
            imageUrl: _artistAvatarByName[normalized] ?? song.imageUrl,
            isVerified: verified,
            followersCount: followers,
          ),
        );

        if (artists.length >= 12) {
          return artists;
        }
      }
    }

    return artists;
  }

  @override
  void initState() {
    super.initState();
    AuthService.currentUserNotifier.addListener(_handleCurrentUserChanged);
    _loadCurrentUser();
    fetchData();
  }

  @override
  void dispose() {
    AuthService.currentUserNotifier.removeListener(_handleCurrentUserChanged);
    super.dispose();
  }

  Future<void> _loadCurrentUser() async {
    final user = await AuthService.getCurrentUser();
    if (!mounted) return;

    setState(() {
      _currentUser = user;
    });
  }

  void _handleCurrentUserChanged() {
    if (!mounted) return;

    setState(() {
      _currentUser = AuthService.currentUserNotifier.value;
    });
  }

  Future<void> fetchData() async {
    setState(() {
      isLoading = true;
      errorMessage = null;
    });

    try {
      final history = await PlayHistoryService.getRecentHistory(limit: 8);

      final results = await Future.wait([
        SongApiService.fetchSongs(),
        SongApiService.fetchRecommendedSongs(limit: 12),
        PlaylistApiService.getSystemPlaylists(limit: 12),
        TopicApiService.fetchTopics(),
      ]);

      final systemPlaylistResult = results[2] as PlaylistResult;
      if (!systemPlaylistResult.success) {
        throw Exception(
          systemPlaylistResult.message ?? 'Không thể tải playlist hệ thống',
        );
      }

      setState(() {
        songs = results[0] as List<Song>;
        recommendedSongs = results[1] as List<Song>;
        systemPlaylists = systemPlaylistResult.playlists ?? [];
        topics = results[3] as List<Topic>;
        recentHistory = history;
        isLoading = false;
      });

      _loadFeaturedArtistAvatars();
    } on NetworkException catch (e) {
      setState(() {
        errorMessage = e.message;
        isLoading = false;
      });
    } catch (e) {
      setState(() {
        errorMessage = 'Đã xảy ra lỗi: $e';
        isLoading = false;
      });
    }
  }

  Future<void> _refreshRecommendedSongs() async {
    try {
      final newRecommended = await SongApiService.fetchRecommendedSongs(
        limit: 12,
      );
      if (!mounted) return;
      setState(() {
        recommendedSongs = newRecommended;
      });
      _loadFeaturedArtistAvatars();
    } catch (_) {}
  }

  Future<void> _loadFeaturedArtistAvatars() async {
    final mergedSongs = [...recommendedSongs, ...songs];

    final normalizedNames = <String>[];
    final queryNameByNormalized = <String, String>{};
    final seen = <String>{};

    for (final song in mergedSongs) {
      for (final artistName in song.artists) {
        final normalized = artistName.trim().toLowerCase();
        if (normalized.isEmpty || seen.contains(normalized)) continue;

        seen.add(normalized);
        normalizedNames.add(normalized);
        queryNameByNormalized[normalized] = artistName.trim();

        if (normalizedNames.length >= 16) {
          break;
        }
      }
      if (normalizedNames.length >= 16) {
        break;
      }
    }

    final targets = normalizedNames
        .where((name) => !_artistAvatarByName.containsKey(name))
        .toList();

    final remainingTargets = <String>[];
    for (final name in targets) {
      final queryName = queryNameByNormalized[name] ?? name;
      final cachedAvatar = ArtistApiService.getCachedAvatar(queryName);
      if (cachedAvatar != null && cachedAvatar.isNotEmpty) {
        _artistAvatarByName[name] = cachedAvatar;
      } else {
        remainingTargets.add(name);
      }
    }

    if (remainingTargets.isEmpty) {
      if (mounted) {
        setState(() {});
      }
      return;
    }

    final responses = await Future.wait(
      remainingTargets.map((name) {
        final queryName = queryNameByNormalized[name] ?? name;
        return ArtistApiService.fetchArtistProfileByName(queryName);
      }),
    );

    if (!mounted) {
      return;
    }

    final updates = <String, String>{};
    for (var i = 0; i < remainingTargets.length; i++) {
      final result = responses[i];
      final avatar = result.artist?.avatarUrl ?? '';
      updates[remainingTargets[i]] = avatar; 
      if (result.success && avatar.isNotEmpty) {
        final queryName = queryNameByNormalized[remainingTargets[i]] ?? remainingTargets[i];
        ArtistApiService.cacheAvatar(queryName, avatar);
      }
    }

    if (updates.isEmpty) {
      return;
    }

    setState(() {
      _artistAvatarByName.addAll(updates);
    });
  }

  void _onSongTap(Song song) async {
    widget.onSongTap?.call(song);
    await PlayHistoryService.addToHistory(song);
    final history = await PlayHistoryService.getRecentHistory(limit: 8);
    if (mounted) {
      setState(() {
        recentHistory = history;
      });
    }
  }

  void _onAlbumTap(Playlist playlist) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => AlbumDetailScreen(
          playlist: playlist,
          onSongTap: widget.onSongTap,
          onPlayAll: widget.onPlayAll,
        ),
      ),
    );
  }

  String _formatDuration(Duration? duration) {
    if (duration == null) return '--:--';

    final minutes = duration.inMinutes;
    final seconds = duration.inSeconds % 60;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }

  String _resolveHomeDisplayName(User? user) {
    final name = user?.name.trim() ?? _currentUser?.name.trim();
    if (name != null && name.isNotEmpty) {
      return name;
    }
    return 'MusicFlow';
  }

  // Filter songs dynamically based on selected Mood Chip
  List<Song> get _filteredSongs {
    if (_selectedMood == '🎯 Tất cả') return songs;
    
    final filterText = _selectedMood.split(' ').last.toLowerCase();
    return songs.where((song) {
      final titleMatch = song.title.toLowerCase().contains(filterText);
      final lyricMatch = song.lyrics.toLowerCase().contains(filterText);
      return titleMatch || lyricMatch;
    }).toList();
  }

  List<Playlist> get _filteredPlaylists {
    if (_selectedMood == '🎯 Tất cả') return systemPlaylists;
    
    final filterText = _selectedMood.split(' ').last.toLowerCase();
    return systemPlaylists.where((p) {
      final nameMatch = p.name.toLowerCase().contains(filterText);
      final descMatch = p.description.toLowerCase().contains(filterText);
      return nameMatch || descMatch;
    }).toList();
  }

  // Calculate top trending songs sorted by likeCount descending
  List<Song> get _trendingSongs {
    final sList = _filteredSongs.isNotEmpty ? _filteredSongs : songs;
    final sorted = [...sList]..sort((a, b) => b.likeCount.compareTo(a.likeCount));
    return sorted;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: HomePalette.background(context),
      body: Stack(
        children: [
          const HomeBackdrop(),
          SafeArea(bottom: false, child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildBody() {
    final theme = Theme.of(context);

    if (isLoading) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(color: theme.colorScheme.primary),
            const SizedBox(height: 16),
            Text(
              'Đang tải không gian âm nhạc...',
              style: TextStyle(
                color: HomePalette.textSecondary(context),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      );
    }

    if (errorMessage != null) {
      return _buildErrorWidget();
    }

    final filteredP = _filteredPlaylists;
    final trendingList = _trendingSongs;

    return RefreshIndicator(
      onRefresh: fetchData,
      color: theme.colorScheme.primary,
      backgroundColor: HomePalette.card(context),
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 100),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ValueListenableBuilder<User?>(
                    valueListenable: AuthService.currentUserNotifier,
                    builder: (context, currentUser, _) {
                      return HomeTopBar(
                        displayName: _resolveHomeDisplayName(currentUser),
                        onSearchTap: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Vui lòng chuyển sang Tab Tìm kiếm ở thanh điều hướng để tìm nhạc!'),
                            ),
                          );
                        },
                      );
                    },
                  ),
                  const SizedBox(height: 16),
                  HomeMoodFilter(
                    selectedMood: _selectedMood,
                    onMoodChanged: (mood) {
                      setState(() {
                        _selectedMood = mood;
                      });
                    },
                  ),
                  const SizedBox(height: 20),
                  if (recommendedSongs.isNotEmpty) ...[
                    HomeHeroCarousel(
                      recommendedSongs: recommendedSongs,
                      onPlaySong: _onSongTap,
                      onPlayRecommended: recommendedSongs.isEmpty
                          ? null
                          : () => widget.onPlayAll?.call(
                                recommendedSongs,
                                startIndex: 0,
                              ),
                    ),
                    const SizedBox(height: 20),
                  ],
                  HomeQuickActions(
                    featuredSong: _featuredSong,
                    playlistCount: systemPlaylists.length,
                    recommendedCount: recommendedSongs.length,
                    onPlayFeatured: _featuredSong == null
                        ? null
                        : () => _onSongTap(_featuredSong!),
                    onOpenPlaylists: systemPlaylists.isEmpty
                        ? null
                        : () => _onAlbumTap(systemPlaylists.first),
                    onPlayRecommended: recommendedSongs.isEmpty
                        ? null
                        : () => widget.onPlayAll?.call(
                            recommendedSongs,
                            startIndex: 0,
                          ),
                  ),
                  const SizedBox(height: 28),
                  
                  // Recently Played (Nghe gần đây)
                  if (recentHistory.isNotEmpty) ...[
                    HomeSectionHeader(
                      title: 'Nghe gần đây',
                      subtitle: 'Tiếp tục thưởng thức các giai điệu yêu thích',
                    ),
                    const SizedBox(height: 14),
                    HomeRecommendedList(
                      songs: recentHistory,
                      formatDuration: _formatDuration,
                      onPlayAll: (list, {startIndex = 0}) => widget.onPlayAll?.call(list, startIndex: startIndex),
                    ),
                    const SizedBox(height: 28),
                  ],

                  // AI DJ Banner Card
                  HomeAiDjBanner(
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => AiDjScreen(
                            onSongTap: (song) => widget.onSongTap?.call(song),
                            onPlayAll: (songs, {startIndex = 0}) =>
                                widget.onPlayAll?.call(songs, startIndex: startIndex),
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 28),

                  if (filteredP.isNotEmpty) ...[
                    HomeSectionHeader(
                      title: 'Playlists nổi bật',
                      subtitle: 'Chọn một tâm trạng phù hợp để bắt đầu nghe',
                      trailing: Text(
                        '${filteredP.length} playlist',
                        style: TextStyle(
                          color: HomePalette.textSecondary(context),
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    HomePlaylistCarousel(
                      playlists: filteredP,
                      onPlaylistTap: _onAlbumTap,
                    ),
                    const SizedBox(height: 28),
                  ],
                  if (recommendedSongs.isNotEmpty) ...[
                    HomeSectionHeader(
                      title: 'Gợi ý dành cho bạn',
                      subtitle: 'Những bài hát giúp bạn vào mood nhanh hơn',
                      trailing: HomeGhostButton(
                        icon: Icons.refresh,
                        label: 'Làm mới',
                        onTap: _refreshRecommendedSongs,
                      ),
                    ),
                    const SizedBox(height: 14),
                    HomeRecommendedList(
                      songs: recommendedSongs,
                      formatDuration: _formatDuration,
                      onPlayAll: widget.onPlayAll,
                    ),
                    const SizedBox(height: 28),
                  ],
                  
                  // Bảng xếp hạng Hot 5 (replaces All Songs)
                  if (trendingList.isNotEmpty) ...[
                    HomeSectionHeader(
                      title: 'Bảng Xếp Hạng Hot 5',
                      subtitle: 'Những bài hát đang thịnh hành nhất hệ thống',
                      trailing: HomeCountBadge(label: 'Trending 🔥'),
                    ),
                    const SizedBox(height: 14),
                    HomeTrendingChart(
                      songs: trendingList,
                      onSongTap: _onSongTap,
                      formatDuration: _formatDuration,
                    ),
                    const SizedBox(height: 28),
                  ],

                  if (_featuredArtists.isNotEmpty) ...[
                    HomeSectionHeader(
                      title: 'Nghệ sĩ nổi bật',
                      subtitle: 'Khám phá những gương mặt đang thịnh hành',
                    ),
                    const SizedBox(height: 14),
                    HomeArtistCarousel(
                      artists: _featuredArtists.take(6).toList(),
                      allArtists: _featuredArtists,
                    ),
                  ],

                  // Chủ đề & Thể loại (Topics)
                  if (topics.isNotEmpty) ...[
                    const SizedBox(height: 28),
                    HomeSectionHeader(
                      title: 'Chủ đề & Thể loại',
                      subtitle: 'Khám phá âm nhạc theo tâm trạng và phong cách',
                    ),
                    const SizedBox(height: 14),
                    HomeTopicSection(
                      topics: topics,
                      onSongTap: _onSongTap,
                      onPlayAll: widget.onPlayAll,
                    ),
                  ],

                  // Album & Playlist Mới (New Releases)
                  if (systemPlaylists.isNotEmpty) ...[
                    const SizedBox(height: 28),
                    HomeSectionHeader(
                      title: 'Album & Playlist Mới',
                      subtitle: 'Những tuyển tập âm nhạc vừa mới được ra mắt',
                    ),
                    const SizedBox(height: 14),
                    HomeNewReleasesSection(
                      playlists: systemPlaylists,
                      onPlaylistTap: _onAlbumTap,
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorWidget() {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: HomePalette.card(context),
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: HomePalette.cardBorder(context)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.wifi_off_rounded,
                size: 56,
                color: theme.disabledColor,
              ),
              const SizedBox(height: 16),
              Text(
                'Lỗi kết nối mạng',
                style: TextStyle(
                  color: HomePalette.textPrimary(context),
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                errorMessage!,
                style: TextStyle(
                  color: HomePalette.textSecondary(context),
                  fontSize: 13,
                  height: 1.4,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                onPressed: fetchData,
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: const Text('Thử lại'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: theme.colorScheme.primary,
                  foregroundColor: isDark ? Colors.black : Colors.white,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 22,
                    vertical: 12,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  textStyle: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

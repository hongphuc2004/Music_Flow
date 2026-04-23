import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/playlist_model.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/data/models/user_model.dart';
import 'package:musicflow_app/data/services/artist_api_service.dart';
import 'package:musicflow_app/data/services/auth_service.dart';
import 'package:musicflow_app/data/services/playlist_api_service.dart';
import 'package:musicflow_app/data/services/song_api_service.dart';
import 'package:musicflow_app/presentation/screens/home/album_detail_screen.dart';
import 'package:musicflow_app/presentation/screens/home/home_artist_section.dart';
import 'package:musicflow_app/presentation/screens/home/home_playlist_section.dart';
import 'package:musicflow_app/presentation/screens/home/home_recommended_section.dart';
import 'package:musicflow_app/presentation/screens/home/home_shared.dart';
import 'package:musicflow_app/presentation/screens/home/home_song_list_section.dart';
import 'package:musicflow_app/presentation/screens/home/home_top_section.dart';

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
  final Map<String, String> _artistAvatarByName = {};
  User? _currentUser;
  bool isLoading = true;
  String? errorMessage;

  Song? get _featuredSong {
    if (recommendedSongs.isNotEmpty) return recommendedSongs.first;
    if (songs.isNotEmpty) return songs.first;
    return null;
  }

  List<HomeArtistPreview> get _featuredArtists {
    final mergedSongs = [
      ...recommendedSongs,
      ...songs,
    ];
    final seen = <String>{};
    final artists = <HomeArtistPreview>[];

    for (final song in mergedSongs) {
      for (final artistName in song.artists) {
        final normalized = artistName.trim().toLowerCase();
        if (normalized.isEmpty || seen.contains(normalized)) continue;

        seen.add(normalized);
        artists.add(
          HomeArtistPreview(
            name: artistName.trim(),
            imageUrl: _artistAvatarByName[normalized] ?? song.imageUrl,
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
      final results = await Future.wait([
        SongApiService.fetchSongs(),
        SongApiService.fetchRecommendedSongs(limit: 12),
        PlaylistApiService.getSystemPlaylists(limit: 12),
      ]);

      final systemPlaylistResult = results[2] as PlaylistResult;
      if (!systemPlaylistResult.success) {
        throw Exception(
          systemPlaylistResult.message ?? 'Khong the tai playlist he thong',
        );
      }

      setState(() {
        songs = results[0] as List<Song>;
        recommendedSongs = results[1] as List<Song>;
        systemPlaylists = systemPlaylistResult.playlists ?? [];
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
        errorMessage = 'Da xay ra loi: $e';
        isLoading = false;
      });
    }
  }

  Future<void> _refreshRecommendedSongs() async {
    try {
      final newRecommended =
          await SongApiService.fetchRecommendedSongs(limit: 12);
      if (!mounted) return;
      setState(() {
        recommendedSongs = newRecommended;
      });
      _loadFeaturedArtistAvatars();
    } catch (_) {}
  }

  Future<void> _loadFeaturedArtistAvatars() async {
    final mergedSongs = [
      ...recommendedSongs,
      ...songs,
    ];

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

    if (targets.isEmpty) {
      return;
    }

    final responses = await Future.wait(
      targets.map((name) {
        final queryName = queryNameByNormalized[name] ?? name;
        return ArtistApiService.fetchArtistProfileByName(queryName);
      }),
    );

    if (!mounted) {
      return;
    }

    final updates = <String, String>{};
    for (var i = 0; i < targets.length; i++) {
      final result = responses[i];
      final avatar = result.artist?.avatarUrl ?? '';
      if (result.success && avatar.isNotEmpty) {
        updates[targets[i]] = avatar;
      }
    }

    if (updates.isEmpty) {
      return;
    }

    setState(() {
      _artistAvatarByName.addAll(updates);
    });
  }

  void _onSongTap(Song song) {
    widget.onSongTap?.call(song);
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          const HomeBackdrop(),
          SafeArea(
            bottom: false,
            child: _buildBody(),
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (isLoading) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(color: HomePalette.accent),
            SizedBox(height: 16),
            Text(
              'Dang tai khong gian am nhac...',
              style: TextStyle(color: Colors.white70),
            ),
          ],
        ),
      );
    }

    if (errorMessage != null) {
      return _buildErrorWidget();
    }

    return RefreshIndicator(
      onRefresh: fetchData,
      color: HomePalette.accent,
      backgroundColor: HomePalette.card,
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
                      );
                    },
                  ),
                  const SizedBox(height: 20),
                  if (_featuredSong != null)
                    HomeHeroSection(
                      featuredSong: _featuredSong!,
                      librarySongCount: songs.length,
                      recommendedSongs: recommendedSongs,
                      onPlaySong: _onSongTap,
                      onPlayRecommended: recommendedSongs.isEmpty
                          ? null
                          : () => widget.onPlayAll?.call(
                                recommendedSongs,
                                startIndex: 0,
                              ),
                    ),
                  const SizedBox(height: 18),
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
                  if (systemPlaylists.isNotEmpty) ...[
                    HomeSectionHeader(
                      title: 'Playlist cho hom nay',
                      subtitle: 'Chon nhanh mot mood de bat dau nghe',
                      trailing: Text(
                        '${systemPlaylists.length} playlist',
                        style: TextStyle(
                          color: Colors.grey[500],
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    HomePlaylistCarousel(
                      playlists: systemPlaylists,
                      onPlaylistTap: _onAlbumTap,
                    ),
                    const SizedBox(height: 28),
                  ],
                  if (recommendedSongs.isNotEmpty) ...[
                    HomeSectionHeader(
                      title: 'Goi y danh cho ban',
                      subtitle: 'Nhung bai hat de vao mood nhanh hon',
                      trailing: HomeGhostButton(
                        icon: Icons.refresh,
                        label: 'Lam moi',
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
                  if (_featuredArtists.isNotEmpty) ...[
                    HomeSectionHeader(
                      title: 'Nghe si noi bat',
                      subtitle: 'Luot ngang de kham pha nhanh nhung cai ten dang hot',
                    ),
                    const SizedBox(height: 14),
                    HomeArtistCarousel(
                      artists: _featuredArtists.take(6).toList(),
                      allArtists: _featuredArtists,
                    ),
                    const SizedBox(height: 28),
                  ],
                  HomeSectionHeader(
                    title: 'Tat ca bai hat',
                    subtitle: 'Thu vien dang co san cho buoi nghe cua ban',
                    trailing: HomeCountBadge(label: '${songs.length} bai'),
                  ),
                  const SizedBox(height: 14),
                  HomeSongList(
                    songs: songs,
                    onSongTap: _onSongTap,
                    formatDuration: _formatDuration,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorWidget() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: HomePalette.card,
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.wifi_off_rounded, size: 64, color: Colors.white54),
              const SizedBox(height: 16),
              const Text(
                'Ket noi dang gap van de',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                errorMessage!,
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 14,
                  height: 1.45,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 22),
              ElevatedButton.icon(
                onPressed: fetchData,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Thu lai'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: HomePalette.accent,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 22,
                    vertical: 14,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(18),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

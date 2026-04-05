import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/playlist_model.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/data/services/playlist_api_service.dart';
import 'package:musicflow_app/data/services/song_api_service.dart';
import 'package:musicflow_app/presentation/screens/home/album_detail_screen.dart';
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
  bool isLoading = true;
  String? errorMessage;

  Song? get _featuredSong {
    if (recommendedSongs.isNotEmpty) return recommendedSongs.first;
    if (songs.isNotEmpty) return songs.first;
    return null;
  }

  @override
  void initState() {
    super.initState();
    fetchData();
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
    } catch (_) {}
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
                  const HomeTopBar(),
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
            border: Border.all(color: Colors.white.withOpacity(0.06)),
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

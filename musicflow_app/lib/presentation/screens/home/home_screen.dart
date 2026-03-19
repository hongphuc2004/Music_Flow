import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/playlist_model.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/data/services/playlist_api_service.dart';
import 'package:musicflow_app/data/services/song_api_service.dart';
import 'package:musicflow_app/presentation/screens/home/album_detail_screen.dart';
import 'package:musicflow_app/presentation/widgets/song_options_menu.dart';

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
      // Fetch songs, system playlists và recommended songs song song
      final results = await Future.wait([
        SongApiService.fetchSongs(),
        SongApiService.fetchRecommendedSongs(limit: 12),
        PlaylistApiService.getSystemPlaylists(limit: 12),
      ]);

      final systemPlaylistResult = results[2] as PlaylistResult;
      if (!systemPlaylistResult.success) {
        throw Exception(systemPlaylistResult.message ?? 'Không thể tải playlist hệ thống');
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
        errorMessage = 'Đã xảy ra lỗi: $e';
        isLoading = false;
      });
    }
  }

  void _onSongTap(Song song) {
    // Gọi callback để MainScreen biết và hiện MiniPlayer
    widget.onSongTap?.call(song);
  }

  Future<void> _refreshRecommendedSongs() async {
    try {
      final newRecommended = await SongApiService.fetchRecommendedSongs(limit: 12);
      setState(() {
        recommendedSongs = newRecommended;
      });
    } catch (e) {
      // Ignore errors on refresh, keep current list
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Image.asset('assets/images/logo.png', width: 28, height: 28),
            const SizedBox(width: 8),
            const Text('MusicFlow'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () {},
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    // Loading
    if (isLoading) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(color: Colors.greenAccent),
            SizedBox(height: 16),
            Text('Đang tải...', style: TextStyle(color: Colors.grey)),
          ],
        ),
      );
    }

    // Error
    if (errorMessage != null) {
      return _buildErrorWidget();
    }

    // Content với Pull to Refresh
    return RefreshIndicator(
      onRefresh: fetchData,
      color: Colors.greenAccent,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 80),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(),
            _songList(),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorWidget() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.wifi_off, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            Text(
              errorMessage!,
              style: const TextStyle(color: Colors.white70, fontSize: 16),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: fetchData,
              icon: const Icon(Icons.refresh),
              label: const Text('Thử lại'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.greenAccent,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (systemPlaylists.isNotEmpty) ...[
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 16, 16, 12),
            child: Text(
              'Playlist gợi ý',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
          ),
          SizedBox(
            height: 200,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              itemCount: systemPlaylists.length,
              itemBuilder: (context, index) {
                final playlist = systemPlaylists[index];
                return _buildAlbumCard(playlist);
              },
            ),
          ),
          const SizedBox(height: 16),
        ],
        _buildSuggestedSongs(),
        const SizedBox(height: 16),
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: Text(
            'Tất cả bài hát',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSuggestedSongs() {
    if (recommendedSongs.isEmpty) return const SizedBox.shrink();
    
    // Group songs into columns of 3
    final columns = <List<Song>>[];
    for (var i = 0; i < recommendedSongs.length; i += 3) {
      columns.add(recommendedSongs.sublist(i, (i + 3).clamp(0, recommendedSongs.length)));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header with title, play all and refresh buttons
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: Row(
            children: [
              const Text(
                'Gợi ý bài hát',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const Spacer(),
              // Play all button
              InkWell(
                onTap: () => widget.onPlayAll?.call(recommendedSongs, startIndex: 0),
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey[600]!),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.play_arrow, size: 18, color: Colors.grey[300]),
                      const SizedBox(width: 4),
                      Text(
                        'Phát tất cả',
                        style: TextStyle(fontSize: 12, color: Colors.grey[300]),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // Refresh button
              InkWell(
                onTap: _refreshRecommendedSongs,
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey[600]!),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.refresh, size: 18, color: Colors.grey[300]),
                ),
              ),
            ],
          ),
        ),
        // Horizontal scrollable song list
        SizedBox(
          height: 210, // 3 songs * 70 height each
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: columns.length,
            itemBuilder: (context, columnIndex) {
              final columnSongs = columns[columnIndex];
              return Container(
                width: MediaQuery.of(context).size.width * 0.75,
                margin: const EdgeInsets.only(right: 8),
                child: Column(
                  children: columnSongs.map((song) => _buildSuggestedSongTile(song, recommendedSongs)).toList(),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildSuggestedSongTile(Song song, List<Song> playlist) {
    return InkWell(
      onTap: () {
        final index = playlist.indexOf(song);
        widget.onPlayAll?.call(playlist, startIndex: index);
      },
      child: Container(
        height: 70,
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
        child: Row(
          children: [
            // Thumbnail
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: Image.network(
                song.imageUrl,
                width: 56,
                height: 56,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  width: 56,
                  height: 56,
                  color: Colors.grey[800],
                  child: const Icon(Icons.music_note, color: Colors.white54),
                ),
              ),
            ),
            const SizedBox(width: 12),
            // Title and artist
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    song.title,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: Colors.white,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    song.artist,
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey[400],
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            // Options menu
            SongOptionsMenu(song: song),
          ],
        ),
      ),
    );
  }

  Widget _buildAlbumCard(Playlist playlist) {
    Color albumColor = const Color(0xFF6c63ff);

    return GestureDetector(
      onTap: () => _onAlbumTap(playlist),
      child: Container(
        width: 150,
        margin: const EdgeInsets.only(right: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Album cover
            Container(
              width: 150,
              height: 150,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                color: albumColor.withOpacity(0.3),
                boxShadow: [
                  BoxShadow(
                    color: albumColor.withOpacity(0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: playlist.displayCoverImage.isNotEmpty
                    ? Image.network(
                        playlist.displayCoverImage,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => _buildPlaceholderCover(albumColor, playlist.name),
                      )
                    : _buildPlaceholderCover(albumColor, playlist.name),
              ),
            ),
            const SizedBox(height: 8),
            // Album name
            Text(
              playlist.name,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            // Description
            if (playlist.description.isNotEmpty)
              Text(
                playlist.description,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey[400],
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlaceholderCover(Color color, String name) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            color,
            color.withOpacity(0.6),
          ],
        ),
      ),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.queue_music,
              size: 48,
              color: Colors.white.withOpacity(0.8),
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Text(
                name,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Colors.white.withOpacity(0.9),
                ),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
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

  Widget _songList() {
    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: songs.length,
      itemBuilder: (context, index) {
        final song = songs[index];

        return ListTile(
          leading: CircleAvatar(
            radius: 20,
            backgroundImage: NetworkImage(song.imageUrl),
            onBackgroundImageError: (_, __) {},
            child: song.imageUrl.isEmpty
                ? const Icon(Icons.music_note, color: Colors.white54)
                : null,
          ),
          title: Text(
            song.title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          subtitle: Text(
            song.artist,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          trailing: SongOptionsMenu(song: song),
          onTap: () => _onSongTap(song),
        );
      },
    );
  }
}
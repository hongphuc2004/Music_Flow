import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/data/services/offline_song_service.dart';
import 'package:musicflow_app/presentation/widgets/mini_player_wrapper.dart';

class DownloadedSongsScreen extends StatefulWidget {
  final Function(Song)? onSongTap;
  final Function(List<Song>, {int startIndex})? onPlayAll;

  const DownloadedSongsScreen({
    super.key,
    this.onSongTap,
    this.onPlayAll,
  });

  @override
  State<DownloadedSongsScreen> createState() => _DownloadedSongsScreenState();
}

class _DownloadedSongsScreenState extends State<DownloadedSongsScreen> {
  final OfflineSongService _offlineService = OfflineSongService();

  List<Song> _downloadedSongs = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadDownloadedSongs();
  }

  Future<void> _loadDownloadedSongs() async {
    setState(() => _isLoading = true);

    final songs = await _offlineService.getDownloadedSongsAsSongs();

    if (!mounted) return;
    setState(() {
      _isLoading = false;
      _downloadedSongs = songs;
    });
  }

  Future<void> _removeDownloadedSong(Song song) async {
    await _offlineService.removeDownloadedSong(song.id);
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Da xoa bai tai ve: ${song.title}'),
        duration: const Duration(seconds: 2),
      ),
    );

    await _loadDownloadedSongs();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: const Text(
          'Bai hat da tai',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
      ),
      body: MiniPlayerWrapper(
        child: _isLoading
            ? const Center(
                child: CircularProgressIndicator(color: Colors.greenAccent),
              )
            : _downloadedSongs.isEmpty
                ? _buildEmptyState()
                : RefreshIndicator(
                    onRefresh: _loadDownloadedSongs,
                    color: Colors.greenAccent,
                    child: Column(
                      children: [
                        Padding(
                          padding: const EdgeInsets.all(16),
                          child: Row(
                            children: [
                              Expanded(
                                child: ElevatedButton.icon(
                                  onPressed: () {
                                    widget.onPlayAll?.call(_downloadedSongs, startIndex: 0);
                                  },
                                  icon: const Icon(Icons.play_arrow),
                                  label: Text('Phat tat ca (${_downloadedSongs.length})'),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.greenAccent,
                                    foregroundColor: Colors.black,
                                    padding: const EdgeInsets.symmetric(vertical: 12),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(25),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        Expanded(
                          child: ListView.builder(
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            itemCount: _downloadedSongs.length,
                            itemBuilder: (context, index) {
                              final song = _downloadedSongs[index];
                              return ListTile(
                                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                                leading: ClipRRect(
                                  borderRadius: BorderRadius.circular(6),
                                  child: song.imageUrl.isNotEmpty
                                      ? Image.network(
                                          song.imageUrl,
                                          width: 50,
                                          height: 50,
                                          fit: BoxFit.cover,
                                          errorBuilder: (_, __, ___) => Container(
                                            width: 50,
                                            height: 50,
                                            color: Colors.grey[800],
                                            child: const Icon(
                                              Icons.download_done,
                                              color: Colors.greenAccent,
                                            ),
                                          ),
                                        )
                                      : Container(
                                          width: 50,
                                          height: 50,
                                          color: Colors.grey[800],
                                          child: const Icon(
                                            Icons.download_done,
                                            color: Colors.greenAccent,
                                          ),
                                        ),
                                ),
                                title: Text(
                                  song.title,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w500,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                subtitle: Text(
                                  song.artist,
                                  style: TextStyle(color: Colors.grey[400], fontSize: 13),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                trailing: IconButton(
                                  icon: const Icon(Icons.delete_outline, color: Colors.redAccent),
                                  onPressed: () => _removeDownloadedSong(song),
                                  tooltip: 'Xoa ban tai offline',
                                ),
                                onTap: () => widget.onSongTap?.call(song),
                              );
                            },
                          ),
                        ),
                      ],
                    ),
                  ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                color: Colors.grey[900],
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.download_for_offline_outlined,
                size: 60,
                color: Colors.greenAccent,
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'Chua co bai hat da tai',
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Vao man hinh player va nhan Download\nde tai bai hat nghe offline',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey[400], fontSize: 14),
            ),
          ],
        ),
      ),
    );
  }
}

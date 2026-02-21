import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/data/services/play_history_service.dart';
import 'package:musicflow_app/presentation/widgets/song_options_menu.dart';
import 'package:musicflow_app/presentation/widgets/mini_player.dart';
import 'package:musicflow_app/core/audio/global_audio_state.dart';

class HistoryScreen extends StatefulWidget {
  final List<Song> history;
  final Function(Song)? onSongTap;
  final Function(List<Song>, {int startIndex})? onPlayAll;

  const HistoryScreen({
    super.key,
    required this.history,
    this.onSongTap,
    this.onPlayAll,
  });

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  late List<Song> _history;
  final GlobalAudioState _audioState = GlobalAudioState();

  @override
  void initState() {
    super.initState();
    _history = List.from(widget.history);
    _audioState.addListener(_onAudioStateChanged);
  }

  @override
  void dispose() {
    _audioState.removeListener(_onAudioStateChanged);
    super.dispose();
  }

  void _onAudioStateChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  void _playAll() {
    if (_history.isEmpty) return;
    widget.onPlayAll?.call(_history, startIndex: 0);
  }

  void _playSong(Song song, int index) {
    if (widget.onPlayAll != null) {
      widget.onPlayAll!(_history, startIndex: index);
    } else {
      widget.onSongTap?.call(song);
    }
  }

  Future<void> _removeSong(Song song) async {
    await PlayHistoryService.removeFromHistory(song.id);
    setState(() {
      _history.removeWhere((s) => s.id == song.id);
    });
    
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Đã xóa "${song.title}" khỏi lịch sử')),
      );
    }
  }

  void _clearAllHistory() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: const Text('Xóa lịch sử?', style: TextStyle(color: Colors.white)),
        content: Text(
          'Bạn có chắc muốn xóa toàn bộ lịch sử phát nhạc?',
          style: TextStyle(color: Colors.grey[400]),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Hủy', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              await PlayHistoryService.clearHistory();
              setState(() {
                _history.clear();
              });
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Đã xóa toàn bộ lịch sử')),
                );
              }
            },
            child: const Text('Xóa', style: TextStyle(color: Colors.redAccent)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        title: const Text('Lịch sử phát'),
        actions: [
          if (_history.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.delete_sweep),
              onPressed: _clearAllHistory,
              tooltip: 'Xóa tất cả',
            ),
        ],
      ),
      body: Stack(
        children: [
          _history.isEmpty
              ? _buildEmptyState()
              : Column(
                  children: [
                    // Play all button
                    if (_history.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            Text(
                              '${_history.length} bài hát',
                              style: TextStyle(color: Colors.grey[400]),
                            ),
                            const Spacer(),
                            ElevatedButton.icon(
                              onPressed: _playAll,
                              icon: const Icon(Icons.play_arrow),
                              label: const Text('Phát tất cả'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.greenAccent,
                                foregroundColor: Colors.black,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(20),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    
                    // Song list
                    Expanded(
                      child: ListView.builder(
                        itemCount: _history.length,
                        padding: const EdgeInsets.only(bottom: 100),
                        itemBuilder: (context, index) {
                          final song = _history[index];
                          return _buildSongTile(song, index);
                        },
                      ),
                    ),
                  ],
                ),
                
          // Mini Player
          if (_audioState.currentSong != null)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: MiniPlayer(
                isPlaying: _audioState.isPlaying,
                songTitle: _audioState.currentSong!.title,
                artist: _audioState.currentSong!.artist,
                song: _audioState.currentSong,
                progress: _audioState.progress,
                playlist: _audioState.playlist,
                currentIndex: _audioState.currentIndex,
                onPlayPause: _audioState.togglePlayPause,
                onNext: _audioState.playNext,
                onPrevious: _audioState.playPrevious,
                onPlaylistItemTap: _audioState.playAtIndex,
                onClose: _audioState.stop,
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.history, color: Colors.grey[600], size: 80),
          const SizedBox(height: 16),
          const Text(
            'Lịch sử trống',
            style: TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Các bài hát bạn nghe sẽ xuất hiện ở đây',
            style: TextStyle(color: Colors.grey[400]),
          ),
        ],
      ),
    );
  }

  Widget _buildSongTile(Song song, int index) {
    return Dismissible(
      key: Key('${song.id}_$index'),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        color: Colors.red.withOpacity(0.2),
        child: const Icon(Icons.delete, color: Colors.redAccent),
      ),
      onDismissed: (_) => _removeSong(song),
      child: ListTile(
        leading: ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Image.network(
            song.imageUrl,
            width: 50,
            height: 50,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => Container(
              width: 50,
              height: 50,
              color: Colors.grey[800],
              child: const Icon(Icons.music_note, color: Colors.white54),
            ),
          ),
        ),
        title: Text(
          song.title,
          style: const TextStyle(color: Colors.white),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Text(
          song.artist,
          style: TextStyle(color: Colors.grey[400]),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        trailing: SongOptionsMenu(song: song),
        onTap: () => _playSong(song, index),
      ),
    );
  }
}

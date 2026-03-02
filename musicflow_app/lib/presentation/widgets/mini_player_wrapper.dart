import 'package:flutter/material.dart';
import 'package:musicflow_app/core/audio/global_audio_state.dart';
import 'package:musicflow_app/presentation/widgets/mini_player.dart';

/// Widget wrapper để hiển thị MiniPlayer ở các màn hình con
/// Sử dụng widget này để wrap body của các screen cần MiniPlayer
class MiniPlayerWrapper extends StatefulWidget {
  final Widget child;

  const MiniPlayerWrapper({
    super.key,
    required this.child,
  });

  @override
  State<MiniPlayerWrapper> createState() => _MiniPlayerWrapperState();
}

class _MiniPlayerWrapperState extends State<MiniPlayerWrapper> {
  final GlobalAudioState _audioState = GlobalAudioState();

  @override
  void initState() {
    super.initState();
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

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // Main content with padding at bottom for MiniPlayer
        Positioned.fill(
          child: Padding(
            padding: EdgeInsets.only(
              bottom: _audioState.currentSong != null ? 70 : 0,
            ),
            child: widget.child,
          ),
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
              currentPosition: _audioState.currentPosition,
              totalDuration: _audioState.currentSong!.durationAsDuration ?? _audioState.totalDuration,
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
    );
  }
}

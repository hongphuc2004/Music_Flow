import 'package:audio_service/audio_service.dart';
import 'package:just_audio/just_audio.dart';

/// AudioHandler để quản lý background playback với notification controls
class MusicFlowAudioHandler extends BaseAudioHandler with SeekHandler {
  final AudioPlayer _player = AudioPlayer();
  String? _currentUrl;

  MusicFlowAudioHandler() {
    _init();
  }

  AudioPlayer get player => _player;
  String? get currentUrl => _currentUrl;

  void _init() {
    // Broadcast playback state changes
    _player.playbackEventStream.map(_transformEvent).pipe(playbackState);

    // Broadcast current media item
    _player.currentIndexStream.listen((index) {
      if (mediaItem.value != null) {
        // Media item already set
      }
    });
  }

  PlaybackState _transformEvent(PlaybackEvent event) {
    return PlaybackState(
      controls: [
        MediaControl.skipToPrevious,
        if (_player.playing) MediaControl.pause else MediaControl.play,
        MediaControl.stop,
        MediaControl.skipToNext,
      ],
      systemActions: const {
        MediaAction.seek,
        MediaAction.seekForward,
        MediaAction.seekBackward,
      },
      androidCompactActionIndices: const [0, 1, 3],
      processingState: const {
        ProcessingState.idle: AudioProcessingState.idle,
        ProcessingState.loading: AudioProcessingState.loading,
        ProcessingState.buffering: AudioProcessingState.buffering,
        ProcessingState.ready: AudioProcessingState.ready,
        ProcessingState.completed: AudioProcessingState.completed,
      }[_player.processingState]!,
      playing: _player.playing,
      updatePosition: _player.position,
      bufferedPosition: _player.bufferedPosition,
      speed: _player.speed,
      queueIndex: event.currentIndex,
    );
  }

  /// Play a song with URL and metadata
  Future<void> playFromUrl({
    required String url,
    required String title,
    required String artist,
    String? artUri,
    Duration? duration,
  }) async {
    try {
      print('🎵 Playing URL: $url');

      // Stop current playback if different URL
      if (_currentUrl != null && _currentUrl != url) {
        await _player.stop();
      }

      // Update media item for notification
      mediaItem.add(MediaItem(
        id: url,
        title: title,
        artist: artist,
        artUri: artUri != null && artUri.isNotEmpty ? Uri.parse(artUri) : null,
        duration: duration,
      ));

      // Only set URL if different
      if (_currentUrl != url) {
        _currentUrl = url;
        await _player.setUrl(url);
      }

      await _player.play();
    } catch (e) {
      print('❌ Audio error: $e');
      _currentUrl = null;
    }
  }

  @override
  Future<void> play() => _player.play();

  @override
  Future<void> pause() => _player.pause();

  @override
  Future<void> stop() async {
    await _player.stop();
    _currentUrl = null;
    return super.stop();
  }

  @override
  Future<void> seek(Duration position) => _player.seek(position);

  @override
  Future<void> skipToNext() async {
    // TODO: Implement skip to next - sẽ được kết nối với playlist
  }

  @override
  Future<void> skipToPrevious() async {
    // TODO: Implement skip to previous - sẽ được kết nối với playlist
  }

  Future<void> dispose() async {
    await _player.dispose();
  }
}

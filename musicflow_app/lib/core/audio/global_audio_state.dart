import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import 'dart:math';
import 'package:musicflow_app/core/config/api_config.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/core/audio/audio_player_service.dart';
import 'package:musicflow_app/data/services/offline_song_service.dart';
import 'package:musicflow_app/data/services/play_history_service.dart';

enum PlaybackRepeatMode { off, all, one }

/// Global audio state notifier để quản lý trạng thái phát nhạc
/// Có thể truy cập từ bất kỳ đâu trong app
class GlobalAudioState extends ChangeNotifier {
  static final GlobalAudioState _instance = GlobalAudioState._internal();
  factory GlobalAudioState() => _instance;
  GlobalAudioState._internal();

  final AudioPlayerService _audioService = AudioPlayerService();

  // Current song info
  Song? _currentSong;
  List<Song> _playlist = [];
  int _currentIndex = 0;
  bool _isPlaying = false;
  double _progress = 0.0;
  bool _isChangingSong = false;
  bool _isInitialized = false;
  Duration _currentPosition = Duration.zero;
  Duration _totalDuration = Duration.zero;
  bool _isShuffleEnabled = false;
  PlaybackRepeatMode _repeatMode = PlaybackRepeatMode.off;
  final Random _random = Random();

  // Getters
  Song? get currentSong => _currentSong;
  List<Song> get playlist => _playlist;
  int get currentIndex => _currentIndex;
  bool get isPlaying => _isPlaying;
  double get progress => _progress;
  AudioPlayerService get audioService => _audioService;
  Duration get currentPosition => _currentPosition;
  Duration get totalDuration => _totalDuration;
  bool get hasActiveQueue => _currentSong != null && _playlist.isNotEmpty;
  bool get isShuffleEnabled => _isShuffleEnabled;
  PlaybackRepeatMode get repeatMode => _repeatMode;

  void initialize() {
    if (_isInitialized) return;
    _isInitialized = true;
    
    // Listen to player state
    _audioService.player.playerStateStream.listen((state) {
      _isPlaying = state.playing;
      notifyListeners();
    });

    // Listen to progress
    _audioService.player.positionStream.listen((position) {
      _currentPosition = position;
      final duration = _audioService.player.duration;
      if (duration != null && duration.inMilliseconds > 0) {
        _totalDuration = duration;
        _progress = position.inMilliseconds / duration.inMilliseconds;
      }
      notifyListeners();
    });

    // Listen to completion
    _audioService.player.processingStateStream.listen((state) {
      if (state == ProcessingState.completed) {
        playNext(fromCompletion: true);
      }
    });
  }

  /// Play a single song
  void playSong(Song song) {
    _playlist = [song];
    _currentIndex = 0;
    _currentSong = song;
    notifyListeners();
    _playCurrentSong();
  }

  /// Play a playlist from specific index
  void playPlaylist(List<Song> songs, {int startIndex = 0}) {
    if (songs.isEmpty) return;
    _playlist = List.from(songs);
    _currentIndex = startIndex;
    _currentSong = songs[startIndex];
    notifyListeners();
    _playCurrentSong();
  }

  void _playCurrentSong() {
    if (_currentSong == null) return;
    
    // Reset position và set duration từ metadata ngay lập tức
    _currentPosition = Duration.zero;
    _totalDuration = _currentSong!.durationAsDuration ?? Duration.zero;
    _progress = 0.0;
    
    // Record to play history
    PlayHistoryService.addToHistory(_currentSong!);

    _playWithBestSource();
  }

  Future<void> _playWithBestSource() async {
    if (_currentSong == null) return;

    final localPath = await OfflineSongService().getLocalPathIfDownloaded(_currentSong!.id);
    final playbackUrl = localPath != null
        ? Uri.file(localPath).toString()
        : ApiConfig.songStreamUrl(_currentSong!.id);

    _audioService.play(
      url: playbackUrl,
      title: _currentSong!.title,
      artist: _currentSong!.artists.join(', '),
      imageUrl: _currentSong!.imageUrl,
      duration: _currentSong!.durationAsDuration,
    );
  }

  void playNext({bool fromCompletion = false}) {
    if (_playlist.isEmpty || _isChangingSong) return;

    if (fromCompletion && _repeatMode == PlaybackRepeatMode.one) {
      _audioService.seek(Duration.zero);
      _audioService.resume();
      return;
    }

    final nextIndex = _resolveNextIndex();
    if (nextIndex == null) {
      return;
    }

    _isChangingSong = true;
    _currentIndex = nextIndex;
    _currentSong = _playlist[_currentIndex];
    notifyListeners();
    _playCurrentSong();

    Future.delayed(const Duration(milliseconds: 500), () {
      _isChangingSong = false;
    });
  }

  void playPrevious() {
    if (_playlist.isEmpty || _isChangingSong) return;

    if (_currentPosition > const Duration(seconds: 3)) {
      _audioService.seek(Duration.zero);
      return;
    }

    final previousIndex = _resolvePreviousIndex();
    if (previousIndex == null) {
      _audioService.seek(Duration.zero);
      return;
    }

    _isChangingSong = true;
    _currentIndex = previousIndex;
    _currentSong = _playlist[_currentIndex];
    notifyListeners();
    _playCurrentSong();

    Future.delayed(const Duration(milliseconds: 500), () {
      _isChangingSong = false;
    });
  }

  void togglePlayPause() {
    if (_isPlaying) {
      _audioService.pause();
    } else {
      _audioService.player.play();
    }
  }

  void playAtIndex(int index) {
    if (index >= 0 && index < _playlist.length) {
      _currentIndex = index;
      _currentSong = _playlist[index];
      notifyListeners();
      _playCurrentSong();
    }
  }

  int addToQueue(Song song, {bool playNext = true}) {
    if (!hasActiveQueue) {
      playSong(song);
      return 0;
    }

    final insertIndex = playNext
        ? (_currentIndex + 1).clamp(0, _playlist.length)
        : _playlist.length;

    _playlist.insert(insertIndex, song);
    notifyListeners();
    return insertIndex;
  }

  void toggleShuffle() {
    _isShuffleEnabled = !_isShuffleEnabled;
    notifyListeners();
  }

  PlaybackRepeatMode cycleRepeatMode() {
    switch (_repeatMode) {
      case PlaybackRepeatMode.off:
        _repeatMode = PlaybackRepeatMode.all;
        break;
      case PlaybackRepeatMode.all:
        _repeatMode = PlaybackRepeatMode.one;
        break;
      case PlaybackRepeatMode.one:
        _repeatMode = PlaybackRepeatMode.off;
        break;
    }

    notifyListeners();
    return _repeatMode;
  }

  int? _resolveNextIndex() {
    if (_playlist.isEmpty) return null;

    if (_isShuffleEnabled && _playlist.length > 1) {
      return _randomIndexExcluding(_currentIndex);
    }

    if (_currentIndex < _playlist.length - 1) {
      return _currentIndex + 1;
    }

    if (_repeatMode == PlaybackRepeatMode.all) {
      return 0;
    }

    return null;
  }

  int? _resolvePreviousIndex() {
    if (_playlist.isEmpty) return null;

    if (_isShuffleEnabled && _playlist.length > 1) {
      return _randomIndexExcluding(_currentIndex);
    }

    if (_currentIndex > 0) {
      return _currentIndex - 1;
    }

    if (_repeatMode == PlaybackRepeatMode.all) {
      return _playlist.length - 1;
    }

    return null;
  }

  int _randomIndexExcluding(int excludedIndex) {
    if (_playlist.length <= 1) return 0;

    var index = excludedIndex;
    while (index == excludedIndex) {
      index = _random.nextInt(_playlist.length);
    }
    return index;
  }

  void stop() {
    _audioService.player.stop();
    _playlist.clear();
    _currentIndex = 0;
    _currentSong = null;
    _isPlaying = false;
    notifyListeners();
  }
}

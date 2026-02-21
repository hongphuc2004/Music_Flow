import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/core/audio/audio_player_service.dart';
import 'package:musicflow_app/data/services/play_history_service.dart';

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

  // Getters
  Song? get currentSong => _currentSong;
  List<Song> get playlist => _playlist;
  int get currentIndex => _currentIndex;
  bool get isPlaying => _isPlaying;
  double get progress => _progress;
  AudioPlayerService get audioService => _audioService;

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
      final duration = _audioService.player.duration;
      if (duration != null && duration.inMilliseconds > 0) {
        _progress = position.inMilliseconds / duration.inMilliseconds;
        notifyListeners();
      }
    });

    // Listen to completion
    _audioService.player.processingStateStream.listen((state) {
      if (state == ProcessingState.completed) {
        playNext();
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
    
    // Record to play history
    PlayHistoryService.addToHistory(_currentSong!);
    
    _audioService.play(
      url: _currentSong!.audioUrl,
      title: _currentSong!.title,
      artist: _currentSong!.artist,
      imageUrl: _currentSong!.imageUrl,
    );
  }

  void playNext() {
    if (_playlist.isEmpty || _isChangingSong) return;
    
    if (_currentIndex < _playlist.length - 1) {
      _isChangingSong = true;
      _currentIndex++;
      _currentSong = _playlist[_currentIndex];
      notifyListeners();
      _playCurrentSong();
      
      Future.delayed(const Duration(milliseconds: 500), () {
        _isChangingSong = false;
      });
    }
  }

  void playPrevious() {
    if (_playlist.isEmpty || _isChangingSong) return;
    
    if (_currentIndex > 0) {
      _isChangingSong = true;
      _currentIndex--;
      _currentSong = _playlist[_currentIndex];
      notifyListeners();
      _playCurrentSong();
      
      Future.delayed(const Duration(milliseconds: 500), () {
        _isChangingSong = false;
      });
    } else {
      _audioService.seek(Duration.zero);
    }
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

  void stop() {
    _audioService.player.stop();
    _playlist.clear();
    _currentIndex = 0;
    _currentSong = null;
    _isPlaying = false;
    notifyListeners();
  }
}

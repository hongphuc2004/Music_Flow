import 'package:audio_service/audio_service.dart';
import 'package:just_audio/just_audio.dart';
import 'dart:ui' show Color;
import 'audio_handler.dart';

/// Singleton service để quản lý audio playback với background support
class AudioPlayerService {
  static final AudioPlayerService _instance = AudioPlayerService._internal();
  static MusicFlowAudioHandler? _audioHandler;
  static bool _isInitialized = false;

  factory AudioPlayerService() => _instance;

  AudioPlayerService._internal();

  /// Khởi tạo audio service - phải gọi trước khi sử dụng
  static Future<void> init() async {
    if (_isInitialized) return;
    
    _audioHandler = await AudioService.init(
      builder: () => MusicFlowAudioHandler(),
      config: const AudioServiceConfig(
        androidNotificationChannelId: 'com.musicflow.app.audio',
        androidNotificationChannelName: 'MusicFlow Audio',
        androidNotificationOngoing: false,
        androidStopForegroundOnPause: false,  // Giữ notification khi pause
        androidShowNotificationBadge: true,
        notificationColor: Color(0xFF69F0AE),  // greenAccent
        androidNotificationIcon: 'mipmap/ic_launcher',
        fastForwardInterval: Duration(seconds: 10),
        rewindInterval: Duration(seconds: 10),
      ),
    );
    
    _isInitialized = true;
    print('✅ AudioService initialized');
  }

  /// Lấy audio handler
  MusicFlowAudioHandler get handler {
    if (_audioHandler == null) {
      throw Exception('AudioService chưa được khởi tạo! Gọi AudioPlayerService.init() trước.');
    }
    return _audioHandler!;
  }

  /// Lấy audio player (để lắng nghe streams)
  AudioPlayer get player => handler.player;

  /// Phát nhạc với metadata cho notification
  Future<void> play({
    required String url,
    required String title,
    required String artist,
    String? imageUrl,
    Duration? duration,
  }) async {
    await handler.playFromUrl(
      url: url,
      title: title,
      artist: artist,
      artUri: imageUrl,
      duration: duration,
    );
  }

  /// Phát nhạc chỉ với URL (backward compatible)
  Future<void> playUrl(String url) async {
    await handler.playFromUrl(
      url: url,
      title: 'Unknown',
      artist: 'Unknown',
    );
  }

  Future<void> pause() async {
    await handler.pause();
  }

  Future<void> resume() async {
    await handler.play();
  }

  Future<void> stop() async {
    await handler.stop();
  }

  Future<void> seek(Duration position) async {
    await handler.seek(position);
  }

  bool get isPlaying => handler.player.playing;

  /// Stream để lắng nghe playback state
  Stream<PlaybackState> get playbackStateStream => handler.playbackState;

  /// Stream để lắng nghe media item hiện tại
  Stream<MediaItem?> get mediaItemStream => handler.mediaItem;
}
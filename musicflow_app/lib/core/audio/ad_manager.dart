import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import 'package:musicflow_app/core/audio/ad_playback_state.dart';
import 'package:musicflow_app/data/models/ad_model.dart';
import 'package:musicflow_app/data/services/ad_service.dart';

/// Quản lý vòng đời Quảng cáo (AdManager):
/// - Tuân thủ nguyên tắc: Backend là nguồn xác định tier duy nhất.
/// - Phát Audio Ad dưới dạng Interruption bằng player riêng biệt (không ảnh hưởng Queue).
/// - Quản lý trạng thái qua AdPlaybackState.
/// - Tự động Preload quảng cáo ở 85% thời lượng bài hát.
/// - Fallback an toàn 100% nếu gặp bất kỳ lỗi mạng/audio nào.
class AdManager {
  static final AdManager _instance = AdManager._internal();
  static AdManager get instance => _instance;

  AdManager._internal() {
    _initAdPlayer();
  }

  final AudioPlayer _adPlayer = AudioPlayer();
  final ValueNotifier<AdPlaybackState> playbackStateNotifier =
      ValueNotifier<AdPlaybackState>(AdPlaybackState.idleState);

  int _songsPlayedCount = 0;
  bool _isPreloading = false;
  Timer? _countdownTimer;
  Completer<void>? _adFinishedCompleter;

  // Getters
  AdPlaybackState get state => playbackStateNotifier.value;
  int get songsPlayedCount => _songsPlayedCount;
  bool get isAdPlaying => playbackStateNotifier.value.isAdPlaying;

  void _initAdPlayer() {
    try {
      // Lắng nghe khi Audio Ad phát xong
      _adPlayer.processingStateStream.listen((processingState) {
        if (processingState == ProcessingState.completed) {
          _handleAdCompleted();
        }
      });

      // Lắng nghe lỗi từ Ad player để kích hoạt Fallback
      _adPlayer.playbackEventStream.listen(
        (event) {},
        onError: (Object e, StackTrace st) {
          debugPrint('[AdManager] Ad playback error, triggering fallback: $e');
          _handleAdError();
        },
      );
    } catch (e) {
      debugPrint('[AdManager] _initAdPlayer initialization warning: $e');
    }
  }

  /// Tăng số bài hát đã nghe khi một bài hát được phát thành công
  void incrementSongsPlayed() {
    _songsPlayedCount++;
    debugPrint('[AdManager] Songs played count: $_songsPlayedCount');
  }

  /// Reset bộ đếm sau khi đã phát quảng cáo xong
  void resetSongsPlayed() {
    _songsPlayedCount = 0;
  }

  /// Kiểm tra và Preload quảng cáo trước khi bài hát kết thúc (khoảng 85% tiến độ)
  Future<void> preloadNextAdIfNeeded({required double songProgress}) async {
    // Chỉ trigger khi bài hát đạt từ 85% trở lên
    if (songProgress < 0.85) return;
    if (_isPreloading) return;
    if (playbackStateNotifier.value.hasPreloadedAd) return;
    if (playbackStateNotifier.value.isAdPlaying) return;

    _isPreloading = true;

    try {
      // Backend xác thực Tier và quyết định có Ad hay không
      // Gửi số bài sẽ hoàn thành sau bài này (_songsPlayedCount + 1)
      final decision = await AdService.checkNextAd(
        songsPlayedCount: _songsPlayedCount + 1,
      );

      if (!decision.hasAd || decision.ad == null) {
        _isPreloading = false;
        return;
      }

      final ad = decision.ad!;
      if (ad.audioUrl.isEmpty) {
        _isPreloading = false;
        return;
      }

      playbackStateNotifier.value = playbackStateNotifier.value.copyWith(
        status: AdStatus.preloading,
        currentAd: ad,
        userTier: decision.tier,
      );

      // Preload audio ad vào buffer của _adPlayer
      await _adPlayer.setAudioSource(
        AudioSource.uri(Uri.parse(ad.audioUrl)),
        preload: true,
      );

      playbackStateNotifier.value = playbackStateNotifier.value.copyWith(
        status: AdStatus.ready,
        currentAd: ad,
        userTier: decision.tier,
      );
      debugPrint('[AdManager] Ad preloaded successfully: "${ad.title}"');
    } catch (e) {
      debugPrint('[AdManager] Preload ad failed (fallback to normal music): $e');
      // Fallback: Xóa state ad bị lỗi để không chặn bài tiếp theo
      playbackStateNotifier.value = AdPlaybackState.idleState;
    } finally {
      _isPreloading = false;
    }
  }

  /// Kiểm tra xem hiện có quảng cáo sẵn sàng để phát hay không
  bool hasReadyAd() {
    return playbackStateNotifier.value.hasPreloadedAd;
  }

  /// Nạp nhanh và phát quảng cáo ngay lập tức (khi người dùng bấm Next đạt ngưỡng mà chưa kịp preload)
  Future<void> prepareAndPlayAd({
    required AdModel ad,
    required String userTier,
    required VoidCallback onFinished,
  }) async {
    try {
      playbackStateNotifier.value = playbackStateNotifier.value.copyWith(
        status: AdStatus.preloading,
        currentAd: ad,
        userTier: userTier,
      );

      await _adPlayer.setAudioSource(
        AudioSource.uri(Uri.parse(ad.audioUrl)),
        preload: true,
      );

      playbackStateNotifier.value = playbackStateNotifier.value.copyWith(
        status: AdStatus.ready,
        currentAd: ad,
        userTier: userTier,
      );

      await playAdInterruption(onFinished: onFinished);
    } catch (e) {
      debugPrint('[AdManager] prepareAndPlayAd error: $e');
      _cleanupAdPlayback();
      onFinished();
    }
  }

  /// Kích hoạt Audio Ad Interruption:
  /// Tạm dừng luồng phát chính, phát Ad bằng _adPlayer riêng, khi xong gọi onFinished.
  Future<void> playAdInterruption({required VoidCallback onFinished}) async {
    final currentAd = playbackStateNotifier.value.currentAd;
    if (currentAd == null) {
      onFinished();
      return;
    }

    _adFinishedCompleter = Completer<void>();

    try {
      final duration = currentAd.duration > 0 ? currentAd.duration : 15;
      final canSkip = currentAd.canSkip;
      final skipAfter = currentAd.skipAfterSeconds;

      // Cập nhật trạng thái đang phát Ad
      playbackStateNotifier.value = playbackStateNotifier.value.copyWith(
        status: AdStatus.playing,
        remainingSeconds: duration,
        elapsedSeconds: 0,
        canSkip: false,
      );

      // Ghi nhận impression lên server
      AdService.recordImpression(currentAd.id);

      // Bắt đầu đếm ngược thời gian
      _startCountdownTimer(
        totalDuration: duration,
        canSkipAtEnd: canSkip,
        skipAfterSeconds: skipAfter,
      );

      // Phát audio ad
      await _adPlayer.play();

      // Đợi cho đến khi ad kết thúc hoặc bị skip
      await _adFinishedCompleter?.future;
    } catch (e) {
      debugPrint('[AdManager] Error playing ad interruption, resuming music: $e');
      _cleanupAdPlayback();
    } finally {
      _cleanupAdPlayback();
      resetSongsPlayed();
      onFinished();
    }
  }

  void _startCountdownTimer({
    required int totalDuration,
    required bool canSkipAtEnd,
    required int skipAfterSeconds,
  }) {
    _countdownTimer?.cancel();
    int elapsed = 0;

    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      elapsed++;
      final remaining = (totalDuration - elapsed).clamp(0, totalDuration);
      // Cho phép skip sau 5s hoặc khi đếm ngược về 0:00
      final canSkipNow = (elapsed >= 5) || (remaining <= 0) || (canSkipAtEnd && elapsed >= skipAfterSeconds);

      playbackStateNotifier.value = playbackStateNotifier.value.copyWith(
        status: canSkipNow ? AdStatus.canSkip : AdStatus.playing,
        remainingSeconds: remaining,
        elapsedSeconds: elapsed,
        canSkip: canSkipNow,
      );

      if (elapsed >= totalDuration) {
        timer.cancel();
        // Hết thời gian quảng cáo -> Tự động tắt quảng cáo và tiếp tục phát nhạc!
        _handleAdCompleted();
      }
    });
  }

  /// Người dùng bấm "Bỏ qua quảng cáo" hoặc "Tắt"
  void skipAd() {
    debugPrint('[AdManager] User closed/skipped the ad.');
    _handleAdCompleted();
  }

  void _handleAdCompleted() {
    _countdownTimer?.cancel();
    playbackStateNotifier.value = playbackStateNotifier.value.copyWith(
      status: AdStatus.completed,
      remainingSeconds: 0,
    );
    _adPlayer.stop();
    if (_adFinishedCompleter != null && !_adFinishedCompleter!.isCompleted) {
      _adFinishedCompleter!.complete();
    }
  }

  void _handleAdError() {
    _countdownTimer?.cancel();
    playbackStateNotifier.value = playbackStateNotifier.value.copyWith(
      status: AdStatus.failed,
    );
    _adPlayer.stop();
    if (_adFinishedCompleter != null && !_adFinishedCompleter!.isCompleted) {
      _adFinishedCompleter!.complete();
    }
  }

  void _cleanupAdPlayback() {
    _countdownTimer?.cancel();
    playbackStateNotifier.value = AdPlaybackState.idleState;
  }

  void dispose() {
    _countdownTimer?.cancel();
    _adPlayer.dispose();
  }
}

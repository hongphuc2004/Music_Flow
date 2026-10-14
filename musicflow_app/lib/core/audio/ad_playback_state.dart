import 'package:musicflow_app/data/models/ad_model.dart';

enum AdStatus {
  idle,       // Không có quảng cáo
  preloading, // Đang buffer audio ad ở chế độ nền
  ready,      // Ad đã preload sẵn sàng phát
  playing,    // Đang phát quảng cáo xen kẽ
  canSkip,    // Đã thỏa mãn điều kiện bỏ qua (ví dụ: sau 5s)
  completed,  // Đã phát xong
  failed,     // Gặp sự cố tải quảng cáo -> tự động fallback
}

class AdPlaybackState {
  final AdStatus status;
  final AdModel? currentAd;
  final int remainingSeconds;
  final int elapsedSeconds;
  final bool canSkip;
  final String userTier;

  const AdPlaybackState({
    this.status = AdStatus.idle,
    this.currentAd,
    this.remainingSeconds = 0,
    this.elapsedSeconds = 0,
    this.canSkip = false,
    this.userTier = 'basic',
  });

  bool get isAdPlaying =>
      status == AdStatus.playing || status == AdStatus.canSkip;

  bool get hasPreloadedAd =>
      status == AdStatus.ready && currentAd != null;

  AdPlaybackState copyWith({
    AdStatus? status,
    AdModel? currentAd,
    int? remainingSeconds,
    int? elapsedSeconds,
    bool? canSkip,
    String? userTier,
  }) {
    return AdPlaybackState(
      status: status ?? this.status,
      currentAd: currentAd ?? this.currentAd,
      remainingSeconds: remainingSeconds ?? this.remainingSeconds,
      elapsedSeconds: elapsedSeconds ?? this.elapsedSeconds,
      canSkip: canSkip ?? this.canSkip,
      userTier: userTier ?? this.userTier,
    );
  }

  static const AdPlaybackState idleState = AdPlaybackState(
    status: AdStatus.idle,
    currentAd: null,
    remainingSeconds: 0,
    elapsedSeconds: 0,
    canSkip: false,
    userTier: 'basic',
  );
}

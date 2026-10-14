import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/ad_model.dart';
import 'package:musicflow_app/data/services/ad_service.dart';
import 'package:musicflow_app/presentation/screens/premium/premium_screen.dart';
import 'package:url_launcher/url_launcher.dart';

/// Widget hiển thị Banner quảng cáo trên trang chủ hoặc view danh sách
/// Chỉ hiển thị với Tài khoản FREE (Basic). Tự động ẩn 100% với Gói PLUS, PREMIUM.
class AdBannerWidget extends StatefulWidget {
  final EdgeInsetsGeometry padding;

  const AdBannerWidget({
    super.key,
    this.padding = const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
  });

  @override
  State<AdBannerWidget> createState() => _AdBannerWidgetState();
}

class _AdBannerWidgetState extends State<AdBannerWidget> {
  AdModel? _bannerAd;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadBanner();
  }

  Future<void> _loadBanner() async {
    final banners = await AdService.getBannerAds();
    if (mounted) {
      setState(() {
        _bannerAd = banners.isNotEmpty ? banners.first : null;
        _isLoading = false;
      });
      if (_bannerAd != null) {
        AdService.recordImpression(_bannerAd!.id);
      }
    }
  }

  void _onTapBanner() {
    if (_bannerAd == null) return;
    AdService.recordClick(_bannerAd!.id);

    final url = _bannerAd!.targetUrl;
    if (url.startsWith('http')) {
      launchUrl(Uri.parse(url));
    } else {
      Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const PremiumScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading || _bannerAd == null) {
      return const SizedBox.shrink();
    }

    final ad = _bannerAd!;

    return Padding(
      padding: widget.padding,
      child: InkWell(
        onTap: _onTapBanner,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: const LinearGradient(
              colors: [Color(0xFF1E1435), Color(0xFF120B22)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            border: Border.all(
              color: Colors.white.withOpacity(0.08),
              width: 1,
            ),
          ),
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              if (ad.imageUrl.isNotEmpty)
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Image.network(
                    ad.imageUrl,
                    width: 52,
                    height: 52,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                  ),
                ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFB300).withOpacity(0.18),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text(
                            'TÀI TRỢ',
                            style: TextStyle(
                              color: Color(0xFFFFB300),
                              fontSize: 9.5,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            ad.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      ad.description.isNotEmpty
                          ? ad.description
                          : 'Nâng cấp Gói PLUS để tắt quảng cáo.',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.55),
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                color: Colors.white38,
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

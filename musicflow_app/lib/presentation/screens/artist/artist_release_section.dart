import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/presentation/screens/artist/artist_shared.dart';

class ArtistReleaseSection extends StatelessWidget {
  final Song? latestSong;

  const ArtistReleaseSection({super.key, this.latestSong});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const ArtistSectionHeader(
          title: 'Latest Release',
          subtitle: 'Diem nhan moi nhat de fan bat vao nghe ngay',
        ),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: ArtistPalette.surfaceSoft.withOpacity(0.95),
            borderRadius: BorderRadius.circular(26),
            border: Border.all(color: Colors.white.withOpacity(0.06)),
          ),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: SizedBox(
                  width: 92,
                  height: 92,
                  child: latestSong?.imageUrl.isNotEmpty == true
                      ? Image.network(
                          latestSong!.imageUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => _fallback(),
                        )
                      : _fallback(),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: ArtistPalette.warmAccent.withOpacity(0.14),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: const Text(
                        'Moi ra mat',
                        style: TextStyle(
                          color: ArtistPalette.warmAccent,
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      latestSong?.title ?? 'Chưa có bản phát hành mới',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      latestSong == null
                          ? 'Section nay se rat hop de noi bat single hoac album moi nhat.'
                          : latestSong!.artists.join(', '),
                      style: TextStyle(
                        color: Colors.grey[400],
                        fontSize: 13,
                        height: 1.4,
                      ),
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _fallback() {
    return Container(
      color: ArtistPalette.surface,
      child: const Icon(Icons.album_rounded, color: Colors.white54, size: 34),
    );
  }
}

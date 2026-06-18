import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/presentation/screens/artist/artist_shared.dart';
import 'package:musicflow_app/presentation/widgets/song_options_menu.dart';

class ArtistPopularSection extends StatelessWidget {
  final List<Song> songs;
  final void Function(Song song, int index)? onSongTap;

  const ArtistPopularSection({super.key, required this.songs, this.onSongTap});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ArtistSectionHeader(
          title: 'Popular Songs',
          subtitle: 'Nhung bai duoc nghe nhieu nhat cua artist nay',
          trailing: Text(
            '${songs.length} bai',
            style: TextStyle(
              color: Colors.grey[500],
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(height: 14),
        if (songs.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              color: ArtistPalette.surface.withOpacity(0.9),
              borderRadius: BorderRadius.circular(26),
              border: Border.all(color: Colors.white.withOpacity(0.06)),
            ),
            child: Column(
              children: [
                const Icon(
                  Icons.queue_music_rounded,
                  color: Colors.white54,
                  size: 42,
                ),
                const SizedBox(height: 12),
                Text(
                  'Nghệ sĩ này chưa có bài hát cong khai',
                  style: TextStyle(
                    color: Colors.grey[300],
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          )
        else
          Container(
            decoration: BoxDecoration(
              color: ArtistPalette.surface.withOpacity(0.9),
              borderRadius: BorderRadius.circular(26),
              border: Border.all(color: Colors.white.withOpacity(0.06)),
            ),
            child: Column(
              children: List.generate(
                songs.length,
                (index) => _PopularSongTile(
                  song: songs[index],
                  index: index,
                  isLast: index == songs.length - 1,
                  onTap: () => onSongTap?.call(songs[index], index),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _PopularSongTile extends StatelessWidget {
  final Song song;
  final int index;
  final bool isLast;
  final VoidCallback onTap;

  const _PopularSongTile({
    required this.song,
    required this.index,
    required this.isLast,
    required this.onTap,
  });

  String _formatDuration(Duration? duration) {
    if (duration == null) return '--:--';
    final minutes = duration.inMinutes;
    final seconds = duration.inSeconds % 60;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.vertical(
          top: index == 0 ? const Radius.circular(26) : Radius.zero,
          bottom: isLast ? const Radius.circular(26) : Radius.zero,
        ),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            border: isLast
                ? null
                : Border(
                    bottom: BorderSide(color: Colors.white.withOpacity(0.05)),
                  ),
          ),
          child: Row(
            children: [
              SizedBox(
                width: 28,
                child: Text(
                  '${index + 1}',
                  style: TextStyle(
                    color: Colors.grey[500],
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: SizedBox(
                  width: 58,
                  height: 58,
                  child: song.imageUrl.isNotEmpty
                      ? Image.network(
                          song.imageUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => _tileFallback(),
                        )
                      : _tileFallback(),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      song.title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      song.artists.join(', '),
                      style: TextStyle(color: Colors.grey[400], fontSize: 13),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Text(
                _formatDuration(song.durationAsDuration),
                style: TextStyle(
                  color: Colors.grey[500],
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(width: 6),
              SongOptionsMenu(song: song),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tileFallback() {
    return Container(
      color: ArtistPalette.surfaceSoft,
      child: const Icon(Icons.music_note_rounded, color: Colors.white54),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:musicflow_app/core/audio/audio_player_service.dart';
import 'package:musicflow_app/data/models/song_model.dart';

class PlayerScreen extends StatefulWidget {
  final Song song;

  const PlayerScreen({super.key, required this.song});

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen> {
  final AudioPlayerService _audioService = AudioPlayerService();
  bool _isPlaying = false;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  bool _showLyrics = false;

  @override
  void initState() {
    super.initState();
    _initPlayer();
  }

  Future<void> _initPlayer() async {
    // KHÔNG gọi play() ở đây nữa - nhạc đã được phát từ MainScreen rồi
    // Chỉ setup listeners
    
    // Lấy trạng thái hiện tại
    _isPlaying = _audioService.isPlaying;
    _position = _audioService.player.position;
    _duration = _audioService.player.duration ?? Duration.zero;
    
    // Lắng nghe trạng thái playing
    _audioService.player.playerStateStream.listen((state) {
      if (mounted) {
        setState(() {
          _isPlaying = state.playing;
        });
      }
    });

    // Lắng nghe vị trí hiện tại
    _audioService.player.positionStream.listen((pos) {
      if (mounted) {
        setState(() {
          _position = pos;
        });
      }
    });

    // Lắng nghe tổng thời lượng
    _audioService.player.durationStream.listen((dur) {
      if (mounted && dur != null) {
        setState(() {
          _duration = dur;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Colors.grey.shade900,
              Colors.black,
            ],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              _buildAppBar(),
              Expanded(
                child: _showLyrics ? _buildLyrics() : _buildAlbumArt(),
              ),
              _buildSongInfo(),
              _buildProgressBar(),
              _buildControls(),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAppBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
            icon: const Icon(Icons.keyboard_arrow_down, color: Colors.white, size: 32),
            onPressed: () => Navigator.pop(context),
          ),
          const Text(
            'ĐANG PHÁT',
            style: TextStyle(
              color: Colors.white70,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.5,
            ),
          ),
          IconButton(
            icon: const Icon(Icons.more_vert, color: Colors.white),
            onPressed: () {},
          ),
        ],
      ),
    );
  }

  Widget _buildAlbumArt() {
    return GestureDetector(
      onTap: () => setState(() => _showLyrics = true),
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Hero(
          tag: 'album_art',
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: Colors.greenAccent.withOpacity(0.3),
                  blurRadius: 30,
                  spreadRadius: 5,
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: widget.song.imageUrl.isNotEmpty
                  ? Image.network(
                      widget.song.imageUrl,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => _buildDefaultArt(),
                    )
                  : _buildDefaultArt(),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDefaultArt() {
    return Container(
      width: double.infinity,
      height: double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.greenAccent, Colors.tealAccent],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: const Icon(Icons.music_note, size: 100, color: Colors.black54),
    );
  }

  Widget _buildLyrics() {
    return GestureDetector(
      onTap: () => setState(() => _showLyrics = false),
      child: Container(
        margin: const EdgeInsets.all(20),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.1),
          borderRadius: BorderRadius.circular(20),
        ),
        child: SingleChildScrollView(
          child: Column(
            children: [
              const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.lyrics, color: Colors.greenAccent, size: 20),
                  SizedBox(width: 8),
                  Text(
                    'LỜI BÀI HÁT',
                    style: TextStyle(
                      color: Colors.greenAccent,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.5,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Text(
                widget.song.lyrics.isNotEmpty
                    ? widget.song.lyrics
                    : 'Không có lời bài hát',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  height: 2,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSongInfo() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          Text(
            widget.song.title,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            widget.song.artist,
            style: TextStyle(
              color: Colors.grey.shade400,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 8),
          TextButton.icon(
            onPressed: () => setState(() => _showLyrics = !_showLyrics),
            icon: Icon(
              _showLyrics ? Icons.album : Icons.lyrics,
              color: Colors.greenAccent,
              size: 18,
            ),
            label: Text(
              _showLyrics ? 'Xem ảnh bìa' : 'Xem lời bài hát',
              style: const TextStyle(color: Colors.greenAccent),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProgressBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Column(
        children: [
          SliderTheme(
            data: SliderTheme.of(context).copyWith(
              trackHeight: 4,
              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
              overlayShape: const RoundSliderOverlayShape(overlayRadius: 14),
              activeTrackColor: Colors.greenAccent,
              inactiveTrackColor: Colors.grey.shade800,
              thumbColor: Colors.greenAccent,
              overlayColor: Colors.greenAccent.withOpacity(0.2),
            ),
            child: Slider(
              value: _duration.inMilliseconds > 0
                  ? _position.inMilliseconds / _duration.inMilliseconds
                  : 0,
              onChanged: (value) {
                final newPosition = Duration(
                  milliseconds: (value * _duration.inMilliseconds).toInt(),
                );
                _audioService.seek(newPosition);
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  _formatDuration(_position),
                  style: TextStyle(color: Colors.grey.shade400, fontSize: 12),
                ),
                Text(
                  _formatDuration(_duration),
                  style: TextStyle(color: Colors.grey.shade400, fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildControls() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        IconButton(
          icon: const Icon(Icons.shuffle, color: Colors.white54),
          iconSize: 28,
          onPressed: () {},
        ),
        IconButton(
          icon: const Icon(Icons.skip_previous_rounded, color: Colors.white),
          iconSize: 40,
          onPressed: () {},
        ),
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            color: Colors.greenAccent,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: Colors.greenAccent.withOpacity(0.4),
                blurRadius: 15,
                spreadRadius: 2,
              ),
            ],
          ),
          child: IconButton(
            icon: Icon(
              _isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
              color: Colors.black,
            ),
            iconSize: 40,
            onPressed: () {
              if (_isPlaying) {
                _audioService.pause();
              } else {
                _audioService.resume();
              }
            },
          ),
        ),
        IconButton(
          icon: const Icon(Icons.skip_next_rounded, color: Colors.white),
          iconSize: 40,
          onPressed: () {},
        ),
        IconButton(
          icon: const Icon(Icons.repeat, color: Colors.white54),
          iconSize: 28,
          onPressed: () {},
        ),
      ],
    );
  }

  String _formatDuration(Duration duration) {
    final minutes = duration.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = duration.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }
}
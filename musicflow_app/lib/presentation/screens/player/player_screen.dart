import 'package:flutter/material.dart';
import 'package:musicflow_app/core/audio/audio_player_service.dart';
import 'package:musicflow_app/data/models/song_model.dart';

class PlayerScreen extends StatefulWidget {
  final Song song;
  final List<Song> playlist;
  final int currentIndex;
  final Function(int)? onSongChanged;

  const PlayerScreen({
    super.key,
    required this.song,
    this.playlist = const [],
    this.currentIndex = 0,
    this.onSongChanged,
  });

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen> {
  final AudioPlayerService _audioService = AudioPlayerService();
  final PageController _pageController = PageController(initialPage: 0);
  
  bool _isPlaying = false;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  bool _showLyrics = false;
  int _currentPage = 0;  // 0 = Player, 1 = Queue

  late Song _currentSong;
  late int _currentIndex;
  bool _isChangingSong = false;  // Debounce

  @override
  void initState() {
    super.initState();
    _currentSong = widget.song;
    _currentIndex = widget.currentIndex;
    _initPlayer();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
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

  void _playNext() {
    if (widget.playlist.isEmpty || _isChangingSong) return;
    
    if (_currentIndex < widget.playlist.length - 1) {
      _isChangingSong = true;
      final newIndex = _currentIndex + 1;
      final newSong = widget.playlist[newIndex];
      
      setState(() {
        _currentIndex = newIndex;
        _currentSong = newSong;
      });
      
      // Gọi callback để MainScreen cập nhật
      widget.onSongChanged?.call(newIndex);
      
      print('⏭️ PlayerScreen: Playing next: ${newSong.title}');
      
      Future.delayed(const Duration(milliseconds: 500), () {
        _isChangingSong = false;
      });
    }
  }

  void _playPrevious() {
    if (widget.playlist.isEmpty || _isChangingSong) return;
    
    if (_currentIndex > 0) {
      _isChangingSong = true;
      final newIndex = _currentIndex - 1;
      final newSong = widget.playlist[newIndex];
      
      setState(() {
        _currentIndex = newIndex;
        _currentSong = newSong;
      });
      
      // Gọi callback để MainScreen cập nhật
      widget.onSongChanged?.call(newIndex);
      
      print('⏮️ PlayerScreen: Playing previous: ${newSong.title}');
      
      Future.delayed(const Duration(milliseconds: 500), () {
        _isChangingSong = false;
      });
    } else {
      // Đang ở bài đầu, phát lại từ đầu
      _audioService.seek(Duration.zero);
    }
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
              // Page indicator
              if (widget.playlist.isNotEmpty) _buildPageIndicator(),
              Expanded(
                child: PageView(
                  controller: _pageController,
                  onPageChanged: (page) {
                    setState(() {
                      _currentPage = page;
                    });
                  },
                  children: [
                    // Page 1: Player
                    _buildPlayerPage(),
                    // Page 2: Queue
                    if (widget.playlist.isNotEmpty) _buildQueuePage(),
                  ],
                ),
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

  Widget _buildPageIndicator() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _buildDot(0, 'Đang phát'),
          const SizedBox(width: 8),
          _buildDot(1, 'Danh sách chờ'),
        ],
      ),
    );
  }

  Widget _buildDot(int index, String label) {
    final isActive = _currentPage == index;
    return GestureDetector(
      onTap: () {
        _pageController.animateToPage(
          index,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeInOut,
        );
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isActive ? Colors.greenAccent.withOpacity(0.2) : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isActive ? Colors.greenAccent : Colors.grey,
            fontSize: 12,
            fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ),
    );
  }

  Widget _buildPlayerPage() {
    return _showLyrics ? _buildLyrics() : _buildAlbumArt();
  }

  Widget _buildQueuePage() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                const Icon(Icons.queue_music, color: Colors.greenAccent),
                const SizedBox(width: 8),
                Text(
                  'Danh sách phát (${widget.playlist.length} bài)',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: widget.playlist.length,
              itemBuilder: (context, index) {
                final song = widget.playlist[index];
                final isCurrentSong = index == _currentIndex;
                
                return Container(
                  margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: isCurrentSong 
                        ? Colors.greenAccent.withOpacity(0.15) 
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: ListTile(
                    leading: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          width: 24,
                          child: isCurrentSong
                              ? const Icon(
                                  Icons.equalizer,
                                  color: Colors.greenAccent,
                                  size: 20,
                                )
                              : Text(
                                  '${index + 1}',
                                  style: TextStyle(
                                    color: Colors.grey[500],
                                    fontSize: 14,
                                  ),
                                ),
                        ),
                        const SizedBox(width: 12),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: Image.network(
                            song.imageUrl,
                            width: 45,
                            height: 45,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(
                              width: 45,
                              height: 45,
                              color: Colors.grey[800],
                              child: const Icon(
                                Icons.music_note,
                                color: Colors.white54,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    title: Text(
                      song.title,
                      style: TextStyle(
                        color: isCurrentSong ? Colors.greenAccent : Colors.white,
                        fontWeight: isCurrentSong ? FontWeight.bold : FontWeight.normal,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(
                      song.artist,
                      style: TextStyle(
                        color: isCurrentSong ? Colors.greenAccent.withOpacity(0.7) : Colors.grey,
                        fontSize: 13,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    trailing: isCurrentSong
                        ? const Icon(Icons.volume_up, color: Colors.greenAccent, size: 20)
                        : null,
                    onTap: () {
                      if (!isCurrentSong) {
                        // Gọi callback để phát bài này
                        widget.onSongChanged?.call(index);
                        setState(() {
                          _currentIndex = index;
                          _currentSong = song;
                        });
                      }
                    },
                  ),
                );
              },
            ),
          ),
        ],
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
          Text(
            _currentPage == 0 ? 'ĐANG PHÁT' : 'DANH SÁCH CHỜ',
            style: const TextStyle(
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
              child: _currentSong.imageUrl.isNotEmpty
                  ? Image.network(
                      _currentSong.imageUrl,
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
                _currentSong.lyrics.isNotEmpty
                    ? _currentSong.lyrics
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
            _currentSong.title,
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
            _currentSong.artist,
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
    final canGoPrevious = _currentIndex > 0;
    final canGoNext = _currentIndex < widget.playlist.length - 1;
    
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        IconButton(
          icon: const Icon(Icons.shuffle, color: Colors.white54),
          iconSize: 28,
          onPressed: () {},
        ),
        IconButton(
          icon: Icon(
            Icons.skip_previous_rounded, 
            color: canGoPrevious ? Colors.white : Colors.white38,
          ),
          iconSize: 40,
          onPressed: canGoPrevious ? _playPrevious : null,
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
          icon: Icon(
            Icons.skip_next_rounded, 
            color: canGoNext ? Colors.white : Colors.white38,
          ),
          iconSize: 40,
          onPressed: canGoNext ? _playNext : null,
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
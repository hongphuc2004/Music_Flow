import 'package:flutter/material.dart';
import 'package:musicflow_app/core/audio/audio_player_service.dart';
import 'package:musicflow_app/core/audio/global_audio_state.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/data/services/comment_service.dart';
import 'package:musicflow_app/data/services/favorite_service.dart';
import 'package:musicflow_app/data/services/like_service.dart';
import 'package:musicflow_app/data/services/offline_song_service.dart';
import 'package:musicflow_app/presentation/widgets/player_bottom_action_bar.dart';
import 'package:musicflow_app/presentation/widgets/song_comments_sheet.dart';

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

class _PlayerScreenState extends State<PlayerScreen> with SingleTickerProviderStateMixin {
  final AudioPlayerService _audioService = AudioPlayerService();
  final GlobalAudioState _globalAudioState = GlobalAudioState();
  final PageController _pageController = PageController(initialPage: 0);
  
  bool _isPlaying = false;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  int _currentPage = 0;  // 0 = Player, 1 = Queue

  late Song _currentSong;
  late int _currentIndex;
  bool _isChangingSong = false;  // Debounce
  bool _isFavorite = false;
  int _likeCount = 0;
  int _commentCount = 0;
  bool _isDownloading = false;
  
  // Animation cho đĩa xoay
  late AnimationController _discRotationController;
  
  @override
  void initState() {
    super.initState();
    _currentSong = widget.song;
    _currentIndex = widget.currentIndex;
    
    // Khởi tạo animation controller cho đĩa xoay
    _discRotationController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 10), // Xoay 1 vòng trong 10 giây
    );
    
    _initPlayer();
    _loadLikeStatus();
    _loadCommentCount();
    
    // Lắng nghe GlobalAudioState để sync khi auto-next
    _globalAudioState.addListener(_onGlobalAudioStateChanged);
  }
  
  /// Sync local state khi GlobalAudioState thay đổi (auto-next)
  void _onGlobalAudioStateChanged() {
    final globalSong = _globalAudioState.currentSong;
    final globalIndex = _globalAudioState.currentIndex;
    
    // Chỉ sync nếu bài hát khác với local state
    if (globalSong != null && 
        globalSong.id != _currentSong.id && 
        !_isChangingSong) {
      setState(() {
        _currentSong = globalSong;
        _currentIndex = globalIndex;
        _position = Duration.zero;
        _duration = globalSong.durationAsDuration ?? Duration.zero;
      });
      _loadLikeStatus();
      _loadCommentCount();
      widget.onSongChanged?.call(globalIndex);
    }
  }

  @override
  void dispose() {
    _globalAudioState.removeListener(_onGlobalAudioStateChanged);
    _pageController.dispose();
    _discRotationController.dispose();
    super.dispose();
  }

  /// Lấy trạng thái like + tổng like cho bài hiện tại
  Future<void> _loadLikeStatus() async {
    final result = await LikeService.getLikeStatus(_currentSong.id);
    if (mounted && result.success) {
      setState(() {
        _isFavorite = result.isLiked ?? false;
        _likeCount = result.likeCount ?? 0;
      });
    }
  }

  Future<void> _toggleLikeSong() async {
    final result = await LikeService.toggleLike(_currentSong.id);
    if (!mounted) return;

    if (result.success) {
      final nextFavorite = result.isLiked ?? _isFavorite;
      setState(() {
        _likeCount = result.likeCount ?? _likeCount;
        _isFavorite = nextFavorite;
      });
      _showActionMessage(nextFavorite ? 'Da like bai hat' : 'Da bo like bai hat');
      return;
    }

    _showActionMessage(result.message ?? 'Khong the cap nhat like luc nay');
  }

  Future<void> _loadCommentCount() async {
    final result = await CommentService.getSongComments(
      _currentSong.id,
      page: 1,
      limit: 1,
      sort: 'top',
    );
    if (!mounted || !result.success) return;

    setState(() {
      _commentCount = result.totalComments;
    });
  }

  void _openComments() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF111111),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => SongCommentsSheet(
        songId: _currentSong.id,
        initialCommentCount: _commentCount,
        onCommentCountChanged: (count) {
          if (!mounted) return;
          setState(() {
            _commentCount = count;
          });
        },
      ),
    );
  }

  void _shareSong() {
    _showActionMessage('Chia se: ${_currentSong.title} - ${_currentSong.artist}');
  }

  Future<void> _downloadCurrentSong() async {
    if (_isDownloading) return;

    setState(() {
      _isDownloading = true;
    });

    final result = await OfflineSongService().downloadSong(_currentSong);

    if (!mounted) return;

    setState(() {
      _isDownloading = false;
    });

    _showActionMessage(result.message);
  }

  Future<void> _toggleFavoriteFromMenu() async {
    final result = await FavoriteService.toggleFavorite(_currentSong.id);
    if (!mounted) return;
    _showActionMessage(result.message ?? 'Khong the cap nhat yeu thich luc nay');
  }

  void _showMoreOptions() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: const Color(0xFF181818),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      builder: (_) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.queue_music, color: Colors.white70),
                title: const Text('Them vao danh sach phat', style: TextStyle(color: Colors.white)),
                onTap: () => Navigator.pop(context),
              ),
              ListTile(
                leading: const Icon(Icons.favorite_border, color: Colors.white70),
                title: const Text('Them/Xoa bai hat yeu thich', style: TextStyle(color: Colors.white)),
                onTap: () {
                  Navigator.pop(context);
                  _toggleFavoriteFromMenu();
                },
              ),
              ListTile(
                leading: const Icon(Icons.person_outline, color: Colors.white70),
                title: const Text('Xem nghe si', style: TextStyle(color: Colors.white)),
                onTap: () => Navigator.pop(context),
              ),
              ListTile(
                leading: const Icon(Icons.info_outline, color: Colors.white70),
                title: const Text('Thong tin bai hat', style: TextStyle(color: Colors.white)),
                onTap: () => Navigator.pop(context),
              ),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }

  void _showActionMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        duration: const Duration(milliseconds: 1500),
      ),
    );
  }

  Future<void> _initPlayer() async {
    // KHÔNG gọi play() ở đây nữa - nhạc đã được phát từ MainScreen rồi
    // Chỉ setup listeners
    
    // Lấy trạng thái hiện tại
    _isPlaying = _audioService.isPlaying;
    _position = _audioService.player.position;
    
    // Ưu tiên lấy duration từ song metadata (có sẵn từ backend)
    // Fallback về player duration nếu không có
    _duration = _currentSong.durationAsDuration ?? 
                _audioService.player.duration ?? 
                Duration.zero;
    
    // Lắng nghe trạng thái playing
    _audioService.player.playerStateStream.listen((state) {
      if (mounted) {
        setState(() {
          _isPlaying = state.playing;
        });
        // Điều khiển đĩa xoay
        if (state.playing) {
          _discRotationController.repeat();
        } else {
          _discRotationController.stop();
        }
      }
    });
    
    // Bắt đầu xoay nếu đang phát
    if (_isPlaying) {
      _discRotationController.repeat();
    }

    // Lắng nghe vị trí hiện tại
    _audioService.player.positionStream.listen((pos) {
      if (mounted) {
        _position = pos;
        setState(() {}); // Rebuild UI
      }
    });

    // Lắng nghe tổng thời lượng (backup nếu song metadata không có)
    _audioService.player.durationStream.listen((dur) {
      if (mounted && dur != null && _duration == Duration.zero) {
        _duration = dur;
        setState(() {});
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
        _position = Duration.zero;  // Reset position
        _duration = newSong.durationAsDuration ?? Duration.zero;  // Update duration
      });
      
      // Refresh like state cho bài mới
      _loadLikeStatus();
      _loadCommentCount();
      
      // Gọi callback để MainScreen cập nhật
      widget.onSongChanged?.call(newIndex);
      
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
        _position = Duration.zero;  // Reset position
        _duration = newSong.durationAsDuration ?? Duration.zero;  // Update duration
      });
      
      // Refresh like state cho bài mới
      _loadLikeStatus();
      _loadCommentCount();
      
      // Gọi callback để MainScreen cập nhật
      widget.onSongChanged?.call(newIndex);
      
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
              const SizedBox(height: 14),
              _buildBottomActionBar(),
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
    return _buildAlbumArt();
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
                          _position = Duration.zero;  // Reset position
                          _duration = song.durationAsDuration ?? Duration.zero;  // Update duration
                        });
                        // Refresh like state
                        _loadLikeStatus();
                        _loadCommentCount();
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
    return Center(
      child: LayoutBuilder(
          builder: (context, constraints) {
            final discSize = (constraints.maxWidth * 0.72).clamp(220.0, 320.0);

            return Hero(
              tag: 'album_art',
              child: AnimatedBuilder(
                animation: _discRotationController,
                builder: (context, child) {
                  return Transform.rotate(
                    angle: _discRotationController.value * 2 * 3.14159,
                    child: child,
                  );
                },
                child: SizedBox(
                  width: discSize,
                  height: discSize,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.5),
                          blurRadius: 30,
                          spreadRadius: 10,
                        ),
                      ],
                    ),
                    child: ClipOval(
                      child: _currentSong.imageUrl.isNotEmpty
                          ? Image.network(
                              _currentSong.imageUrl,
                              fit: BoxFit.cover,
                              filterQuality: FilterQuality.high,
                              errorBuilder: (_, __, ___) => _buildDefaultArt(),
                            )
                          : _buildDefaultArt(),
                    ),
                  ),
                ),
              ),
            );
          },
      ),
    );
  }

  Widget _buildDefaultArt() {
    return Container(
      width: double.infinity,
      height: double.infinity,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: [Colors.greenAccent, Colors.tealAccent],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: const Icon(Icons.music_note, size: 50, color: Colors.black54),
    );
  }

  Widget _buildSongInfo() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        children: [
          // Tên bài hát - căn giữa
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
          // Tên nghệ sĩ - căn giữa
          Text(
            _currentSong.artist,
            style: TextStyle(
              color: Colors.grey.shade400,
              fontSize: 16,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
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
                  ? (_position.inMilliseconds / _duration.inMilliseconds).clamp(0.0, 1.0)
                  : 0.0,
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

  Widget _buildBottomActionBar() {
    return PlayerBottomActionBar(
      isLiked: _isFavorite,
      likeCount: _likeCount,
      commentCount: _commentCount,
      onLikePressed: _toggleLikeSong,
      onCommentPressed: _openComments,
      onDownloadPressed: _downloadCurrentSong,
      onSharePressed: _shareSong,
      onMorePressed: _showMoreOptions,
    );
  }

  String _formatDuration(Duration duration) {
    final minutes = duration.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = duration.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }
}
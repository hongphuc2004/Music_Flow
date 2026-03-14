import 'package:flutter/material.dart';
import 'package:musicflow_app/core/audio/audio_player_service.dart';
import 'package:musicflow_app/core/audio/global_audio_state.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/data/services/comment_service.dart';
import 'package:musicflow_app/data/services/favorite_service.dart';
import 'package:musicflow_app/data/services/lrc_service.dart';
import 'package:musicflow_app/presentation/widgets/player_bottom_action_bar.dart';
import 'package:musicflow_app/presentation/widgets/song_comments_sheet.dart';

/// Class đại diện cho 1 dòng lyrics với timestamp
class LyricLine {
  final Duration timestamp;
  final String text;

  LyricLine({required this.timestamp, required this.text});
}

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
  final ScrollController _lyricsScrollController = ScrollController();
  
  bool _isPlaying = false;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  bool _showLyrics = false;
  int _currentPage = 0;  // 0 = Player, 1 = Queue

  late Song _currentSong;
  late int _currentIndex;
  bool _isChangingSong = false;  // Debounce
  bool _isFavorite = false;  // Trạng thái yêu thích (dùng trong _checkFavorite)
  int _likeCount = 0;
  int _commentCount = 0;
  
  // Animation cho đĩa xoay
  late AnimationController _discRotationController;
  
  // Lyrics đã parse
  List<LyricLine> _parsedLyrics = [];
  int _currentLyricIndex = -1;
  bool _hasRealTimestamp = false;
  
  // LRC Service - Synced lyrics
  bool _isFetchingLrc = false;
  String? _syncedLrcLyrics;

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
    _checkFavorite();
    _loadCommentCount();
    _fetchSyncedLyrics(); // Fetch LRC từ LRCLIB trước
    
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
      _checkFavorite();
      _loadCommentCount();
      _fetchSyncedLyrics(); // Fetch LRC cho bài mới
      widget.onSongChanged?.call(globalIndex);
    }
  }

  @override
  void dispose() {
    _globalAudioState.removeListener(_onGlobalAudioStateChanged);
    _pageController.dispose();
    _discRotationController.dispose();
    _lyricsScrollController.dispose();
    super.dispose();
  }
  
  /// Kiểm tra lyrics từ API có khớp với bài hát hiện tại không
  bool _verifyLyricsMatch(String? apiTrackName, String? apiArtistName) {
    if (apiTrackName == null) return false;
    
    final currentTitle = _currentSong.title.toLowerCase().trim();
    final apiTitle = apiTrackName.toLowerCase().trim();
    
    // So sánh tên bài hát - chấp nhận nếu chứa nhau hoặc tương tự
    if (currentTitle == apiTitle) return true;
    if (currentTitle.contains(apiTitle) || apiTitle.contains(currentTitle)) return true;
    
    // So sánh bằng cách loại bỏ ký tự đặc biệt
    final cleanCurrent = currentTitle.replaceAll(RegExp(r'[^a-z0-9\s]'), '');
    final cleanApi = apiTitle.replaceAll(RegExp(r'[^a-z0-9\s]'), '');
    if (cleanCurrent == cleanApi) return true;
    if (cleanCurrent.contains(cleanApi) || cleanApi.contains(cleanCurrent)) return true;
    
    // Tính similarity - nếu >= 60% thì chấp nhận
    final similarity = _calculateSimilarity(cleanCurrent, cleanApi);
    return similarity >= 0.6;
  }
  
  /// Tính độ tương đồng giữa 2 chuỗi (0.0 - 1.0)
  double _calculateSimilarity(String s1, String s2) {
    if (s1.isEmpty || s2.isEmpty) return 0.0;
    if (s1 == s2) return 1.0;
    
    final words1 = s1.split(' ').where((w) => w.isNotEmpty).toSet();
    final words2 = s2.split(' ').where((w) => w.isNotEmpty).toSet();
    
    if (words1.isEmpty || words2.isEmpty) return 0.0;
    
    final intersection = words1.intersection(words2).length;
    final union = words1.union(words2).length;
    
    return intersection / union;
  }
  
  /// Fetch synced lyrics - tự động verify và fallback
  Future<void> _fetchSyncedLyrics() async {
    if (_isFetchingLrc) return;
    
    setState(() {
      _isFetchingLrc = true;
      _syncedLrcLyrics = null;
    });
    
    try {
      final durationSeconds = _duration.inSeconds > 0 ? _duration.inSeconds : null;
      
      final result = await LrcService.fetchLyrics(
        trackName: _currentSong.title,
        artistName: _currentSong.artist,
        duration: durationSeconds,
      );
      
      if (mounted) {
        // Kiểm tra API có lyrics và ĐÚNG bài hát không
        if (result != null && result.hasSyncedLyrics && 
            _verifyLyricsMatch(result.trackName, result.artistName)) {
          // API lyrics đúng bài → dùng để sync chuẩn
          _syncedLrcLyrics = result.syncedLyrics;
        } else if (_currentSong.lyrics.isNotEmpty) {
          // API không có hoặc SAI bài → dùng local
          _syncedLrcLyrics = null;
        } else {
          // Không có lyrics nào
          _syncedLrcLyrics = null;
        }
        _isFetchingLrc = false;
        _parseLyrics();
        setState(() {});
      }
    } catch (e) {
      // Lỗi API → fallback về local lyrics nếu có
      if (mounted) {
        _syncedLrcLyrics = null;
        _isFetchingLrc = false;
        _parseLyrics();
        setState(() {});
      }
    }
  }
  
  /// Parse lyrics từ format LRC hoặc plain text
  void _parseLyrics() {
    _parsedLyrics = [];
    _currentLyricIndex = -1;
    _hasRealTimestamp = false;
    
    // Ưu tiên sử dụng synced LRC từ LRCLIB nếu có
    final lyricsSource = _syncedLrcLyrics ?? _currentSong.lyrics;
    
    if (lyricsSource.isEmpty) return;
    
    final lines = lyricsSource.split('\n');
    final lrcRegex = RegExp(r'^\[(\d{2}):(\d{2})(?:[.:](\d{2,3}))?\](.*)$');
    
    // Keywords metadata cần lọc
    final metadataKeywords = [
      '作曲', '作词', '编曲', '制作人', '混音', '母带', '录音', '和声',
      '吉他', '贝斯', '鼓', '键盘', '弦乐', '监制', '出品', '发行',
      '演唱', '原唱', '翻唱', '配唱', '制作', '统筹', '企划', '策划',
      'Composer', 'Lyricist', 'Arranger', 'Producer', 'Written by',
      'Composed by', 'Lyrics by', 'Music by', 'Arranged by',
    ];
    
    for (final line in lines) {
      final match = lrcRegex.firstMatch(line.trim());
      if (match != null) {
        _hasRealTimestamp = true;
        final minutes = int.parse(match.group(1)!);
        final seconds = int.parse(match.group(2)!);
        final millisStr = match.group(3);
        final millis = millisStr != null 
            ? (millisStr.length == 2 ? int.parse(millisStr) * 10 : int.parse(millisStr))
            : 0;
        final text = match.group(4)?.trim() ?? '';
        
        if (text.isNotEmpty) {
          // Lọc metadata tiếng Trung
          bool isMetadata = false;
          for (final keyword in metadataKeywords) {
            if (text.startsWith(keyword) || 
                text.contains('$keyword:') || 
                text.contains('$keyword：') ||
                text.contains('$keyword :') ||
                text.contains('$keyword ：')) {
              isMetadata = true;
              break;
            }
          }
          
          if (!isMetadata) {
            _parsedLyrics.add(LyricLine(
              timestamp: Duration(minutes: minutes, seconds: seconds, milliseconds: millis),
              text: text,
            ));
          }
        }
      }
    }
    
    // Nếu không có timestamp thật, chia đều từ đầu đến cuối bài
    if (!_hasRealTimestamp) {
      List<String> cleanLines = [];
      for (final line in lines) {
        if (line.trim().isNotEmpty) {
          cleanLines.add(line.trim());
        }
      }
      
      if (cleanLines.isNotEmpty && _duration.inMilliseconds > 0) {
        // Chia đều từ đầu đến cuối bài
        final msPerLine = _duration.inMilliseconds ~/ cleanLines.length;
        
        for (int i = 0; i < cleanLines.length; i++) {
          _parsedLyrics.add(LyricLine(
            timestamp: Duration(milliseconds: i * msPerLine),
            text: cleanLines[i],
          ));
        }
      } else {
        // Không có duration, chỉ hiển thị text
        for (final line in cleanLines) {
          _parsedLyrics.add(LyricLine(
            timestamp: Duration.zero,
            text: line,
          ));
        }
      }
    }
  }
  
  /// Cập nhật dòng lyrics hiện tại dựa vào position
  void _updateCurrentLyricIndex() {
    if (_parsedLyrics.isEmpty) return;
    
    final currentPos = _position;
    
    // Tìm dòng hiện tại - dòng có timestamp <= currentPos
    int currentLineIndex = -1;
    for (int i = 0; i < _parsedLyrics.length; i++) {
      if (currentPos >= _parsedLyrics[i].timestamp) {
        currentLineIndex = i;
      } else {
        break;
      }
    }
    
    if (currentLineIndex != _currentLyricIndex) {
      _currentLyricIndex = currentLineIndex;
      _scrollToCurrentLyric();
    }
  }
  
  /// Auto scroll đến dòng lyrics hiện tại
  void _scrollToCurrentLyric() {
    if (!_lyricsScrollController.hasClients) return;
    if (_currentLyricIndex < 0) return;
    
    final targetOffset = (_currentLyricIndex * 60.0) - 100;
    
    _lyricsScrollController.animateTo(
      targetOffset.clamp(0.0, _lyricsScrollController.position.maxScrollExtent),
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOutCubic,
    );
  }

  /// Kiểm tra bài hát có trong yêu thích không
  Future<void> _checkFavorite() async {
    final result = await FavoriteService.checkFavorite(_currentSong.id);
    if (mounted && result.success) {
      setState(() {
        _isFavorite = result.isFavorite ?? false;
      });
    }
  }

  Future<void> _toggleLikeSong() async {
    final result = await FavoriteService.toggleFavorite(_currentSong.id);
    if (!mounted) return;

    if (result.success) {
      final nextFavorite = result.isFavorite ?? _isFavorite;
      setState(() {
        if (!_isFavorite && nextFavorite) {
          _likeCount += 1;
        }
        if (_isFavorite && !nextFavorite) {
          _likeCount = (_likeCount - 1).clamp(0, 1 << 31);
        }
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

  void _toggleLyricsView() {
    setState(() {
      _showLyrics = !_showLyrics;
    });
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
        _updateCurrentLyricIndex(); // Cập nhật lyrics theo position
        setState(() {}); // Rebuild UI
      }
    });

    // Lắng nghe tổng thời lượng (backup nếu song metadata không có)
    _audioService.player.durationStream.listen((dur) {
      if (mounted && dur != null && _duration == Duration.zero) {
        _duration = dur;
        if (_parsedLyrics.isEmpty && !_isFetchingLrc) {
          _parseLyrics();
        }
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
      
      // Check trạng thái yêu thích của bài mới
      _checkFavorite();
      _loadCommentCount();
      _fetchSyncedLyrics(); // Fetch LRC cho bài mới
      
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
      
      // Check trạng thái yêu thích của bài mới
      _checkFavorite();
      _loadCommentCount();
      _fetchSyncedLyrics(); // Fetch LRC cho bài mới
      
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
                          _position = Duration.zero;  // Reset position
                          _duration = song.durationAsDuration ?? Duration.zero;  // Update duration
                        });
                        // Check trạng thái yêu thích
                        _checkFavorite();
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
    return GestureDetector(
      onTap: () => setState(() => _showLyrics = true),
      child: Center(
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
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.lyrics, color: Colors.greenAccent, size: 20),
                const SizedBox(width: 8),
                const Text(
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
            // Hiển thị loading khi đang fetch LRC
            if (_isFetchingLrc)
              const Expanded(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.greenAccent,
                        ),
                      ),
                      SizedBox(height: 12),
                      Text(
                        'Đang tìm lời bài hát...',
                        style: TextStyle(
                          color: Colors.white70,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                ),
              )
            else if (_parsedLyrics.isEmpty)
              Expanded(
                child: Center(
                  child: Text(
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
                ),
              )
            else
              Expanded(
                child: ListView.builder(
                      controller: _lyricsScrollController,
                      itemCount: _parsedLyrics.length,
                      itemBuilder: (context, index) {
                        final isCurrentLine = index == _currentLyricIndex;
                        final isPastLine = index < _currentLyricIndex;
                        
                        // Luôn hiển thị karaoke đơn giản (highlight theo dòng)
                        return AnimatedContainer(
                          duration: const Duration(milliseconds: 300),
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          child: Text(
                            _parsedLyrics[index].text,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: isCurrentLine 
                                  ? Colors.greenAccent 
                                  : isPastLine 
                                      ? Colors.greenAccent.withOpacity(0.5)
                                      : Colors.white.withOpacity(0.6),
                              fontSize: isCurrentLine ? 20 : 16,
                              fontWeight: isCurrentLine ? FontWeight.bold : FontWeight.normal,
                              height: 1.5,
                            ),
                          ),
                        );
                      },
                    ),
              ),
          ],
        ),
      ),
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
      onSharePressed: _shareSong,
      onLyricsPressed: _toggleLyricsView,
      onMorePressed: _showMoreOptions,
    );
  }

  String _formatDuration(Duration duration) {
    final minutes = duration.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = duration.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }
}
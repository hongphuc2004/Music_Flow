import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/presentation/widgets/mini_player.dart';
import 'package:musicflow_app/presentation/screens/splash/splash_screen.dart';
import 'package:musicflow_app/presentation/screens/home/home_screen.dart';
import 'package:musicflow_app/presentation/screens/search/search_screen.dart';
import 'package:musicflow_app/presentation/screens/library/library_screen.dart';
import 'package:musicflow_app/core/audio/audio_player_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Khởi tạo Audio Service cho background playback
  await AudioPlayerService.init();
  
  runApp(const MusicFlowApp());
}

class MusicFlowApp extends StatelessWidget {
  const MusicFlowApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MusicFlow',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: Colors.black,
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.black,
          elevation: 0,
        ),
      ),
      home: const SplashScreen(),
    );
  }
}

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => MainScreenState();
}

class MainScreenState extends State<MainScreen> {
  int _currentIndex = 0;
  
  // Mini player state
  final AudioPlayerService _audioService = AudioPlayerService();
  Song? _currentSong;
  bool _isPlaying = false;
  double _progress = 0.0;

  // Playlist/Queue state
  List<Song> _playlist = [];
  int _currentPlaylistIndex = 0;
  
  // Debounce cho next/previous
  bool _isChangingSong = false;

  @override
  void initState() {
    super.initState();
    _setupAudioListeners();
  }

  void _setupAudioListeners() {
    // Lắng nghe trạng thái playing
    _audioService.player.playerStateStream.listen((state) {
      if (mounted) {
        setState(() {
          _isPlaying = state.playing;
        });
      }
    });

    // Lắng nghe progress
    _audioService.player.positionStream.listen((position) {
      final duration = _audioService.player.duration;
      if (mounted && duration != null && duration.inMilliseconds > 0) {
        setState(() {
          _progress = position.inMilliseconds / duration.inMilliseconds;
        });
      }
    });

    // Lắng nghe khi bài hát kết thúc để tự động phát bài tiếp theo
    _audioService.player.processingStateStream.listen((state) {
      if (state == ProcessingState.completed) {
        _playNext();
      }
    });
  }

  // Phát một bài hát đơn lẻ (xóa playlist cũ)
  void playSong(Song song) {
    print('🎵 MainScreen.playSong called!');
    print('🎵 Song: ${song.title} - ${song.artist}');
    
    setState(() {
      _playlist = [song];
      _currentPlaylistIndex = 0;
      _currentSong = song;
    });
    
    _playCurrentSong();
  }

  // Phát playlist từ vị trí chỉ định
  void playPlaylist(List<Song> songs, {int startIndex = 0}) {
    if (songs.isEmpty) return;
    
    print('🎵 MainScreen.playPlaylist called!');
    print('🎵 Playlist: ${songs.length} songs, starting at index $startIndex');
    
    setState(() {
      _playlist = List.from(songs);
      _currentPlaylistIndex = startIndex;
      _currentSong = songs[startIndex];
    });
    
    _playCurrentSong();
  }

  void _playCurrentSong() {
    if (_currentSong == null) return;
    
    _audioService.play(
      url: _currentSong!.audioUrl,
      title: _currentSong!.title,
      artist: _currentSong!.artist,
      imageUrl: _currentSong!.imageUrl,
    ).then((_) {
      print('✅ Audio play() completed');
    }).catchError((e) {
      print('❌ Audio play() error: $e');
    });
  }

  void _playNext() {
    if (_playlist.isEmpty || _isChangingSong) return;
    
    if (_currentPlaylistIndex < _playlist.length - 1) {
      _isChangingSong = true;
      setState(() {
        _currentPlaylistIndex++;
        _currentSong = _playlist[_currentPlaylistIndex];
      });
      _playCurrentSong();
      print('⏭️ Playing next: ${_currentSong?.title}');
      
      // Reset debounce sau 500ms
      Future.delayed(const Duration(milliseconds: 500), () {
        _isChangingSong = false;
      });
    } else {
      // Đã hết playlist, có thể loop hoặc dừng
      print('🏁 Playlist ended');
    }
  }

  void _playPrevious() {
    if (_playlist.isEmpty || _isChangingSong) return;
    
    if (_currentPlaylistIndex > 0) {
      _isChangingSong = true;
      setState(() {
        _currentPlaylistIndex--;
        _currentSong = _playlist[_currentPlaylistIndex];
      });
      _playCurrentSong();
      print('⏮️ Playing previous: ${_currentSong?.title}');
      
      // Reset debounce sau 500ms
      Future.delayed(const Duration(milliseconds: 500), () {
        _isChangingSong = false;
      });
    } else {
      // Đang ở bài đầu tiên, phát lại từ đầu
      _audioService.seek(Duration.zero);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          IndexedStack(
            index: _currentIndex,
            children: [
              HomeScreen(
                onSongTap: playSong,
                onPlayAll: playPlaylist,
              ),
              SearchScreen(onSongTap: playSong),
              const LibraryScreen(),
            ],
          ),

          // Mini Player - chỉ hiện khi có bài hát đang phát
          if (_currentSong != null)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: MiniPlayer(
                isPlaying: _isPlaying,
                songTitle: _currentSong!.title,
                artist: _currentSong!.artist,
                song: _currentSong,
                progress: _progress,
                playlist: _playlist,
                currentIndex: _currentPlaylistIndex,
                onPlayPause: () {
                  if (_isPlaying) {
                    _audioService.pause();
                  } else {
                    _audioService.player.play();
                  }
                },
                onNext: _playNext,
                onPrevious: _playPrevious,
                onPlaylistItemTap: (index) {
                  // Khi user tap vào bài hát trong queue của PlayerScreen
                  playPlaylist(_playlist, startIndex: index);
                },
                onClose: () {
                  _audioService.player.stop();
                  setState(() {
                    _playlist.clear();
                    _currentPlaylistIndex = 0;
                    _currentSong = null;
                    _isPlaying = false;
                  });
                },
              ),
            ),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        backgroundColor: Colors.black,
        selectedItemColor: Colors.greenAccent,
        unselectedItemColor: Colors.grey,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.search), label: 'Search'),
          BottomNavigationBarItem(icon: Icon(Icons.library_music), label: 'Library'),
        ],
      ),
    );
  }
}
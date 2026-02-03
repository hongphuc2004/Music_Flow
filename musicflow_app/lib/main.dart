import 'package:flutter/material.dart';
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
  }

  // Hàm này sẽ được gọi từ HomeScreen khi click vào bài hát
  void playSong(Song song) {
    setState(() {
      _currentSong = song;
    });
    // Sử dụng play() với metadata để hiển thị notification đẹp
    _audioService.play(
      url: song.audioUrl,
      title: song.title,
      artist: song.artist,
      imageUrl: song.imageUrl,
    );
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
              HomeScreen(onSongTap: playSong),
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
                onPlayPause: () {
                  if (_isPlaying) {
                    _audioService.pause();
                  } else {
                    _audioService.player.play();
                  }
                },
                onNext: () {
                  // TODO: Implement next song
                },
                onPrevious: () {
                  // TODO: Implement previous song
                },
                onClose: () {
                  _audioService.player.stop();
                  setState(() {
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
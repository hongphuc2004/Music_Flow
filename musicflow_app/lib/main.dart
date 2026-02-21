import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/presentation/widgets/mini_player.dart';
import 'package:musicflow_app/presentation/screens/splash/splash_screen.dart';
import 'package:musicflow_app/presentation/screens/home/home_screen.dart';
import 'package:musicflow_app/presentation/screens/search/search_screen.dart';
import 'package:musicflow_app/presentation/screens/library/library_screen.dart';
import 'package:musicflow_app/core/audio/audio_player_service.dart';
import 'package:musicflow_app/core/audio/global_audio_state.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Khởi tạo Audio Service cho background playback
  await AudioPlayerService.init();
  
  // Khởi tạo Global Audio State
  GlobalAudioState().initialize();
  
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
  final GlobalAudioState _audioState = GlobalAudioState();

  @override
  void initState() {
    super.initState();
    // Listen to audio state changes
    _audioState.addListener(_onAudioStateChanged);
  }

  @override
  void dispose() {
    _audioState.removeListener(_onAudioStateChanged);
    super.dispose();
  }

  void _onAudioStateChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  // Phát một bài hát đơn lẻ
  void playSong(Song song) {
    _audioState.playSong(song);
  }

  // Phát playlist từ vị trí chỉ định
  void playPlaylist(List<Song> songs, {int startIndex = 0}) {
    _audioState.playPlaylist(songs, startIndex: startIndex);
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
              LibraryScreen(
                onSongTap: playSong,
                onPlayAll: playPlaylist,
              ),
            ],
          ),

          // Mini Player - chỉ hiện khi có bài hát đang phát
          if (_audioState.currentSong != null)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: MiniPlayer(
                isPlaying: _audioState.isPlaying,
                songTitle: _audioState.currentSong!.title,
                artist: _audioState.currentSong!.artist,
                song: _audioState.currentSong,
                progress: _audioState.progress,
                playlist: _audioState.playlist,
                currentIndex: _audioState.currentIndex,
                onPlayPause: _audioState.togglePlayPause,
                onNext: _audioState.playNext,
                onPrevious: _audioState.playPrevious,
                onPlaylistItemTap: _audioState.playAtIndex,
                onClose: _audioState.stop,
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
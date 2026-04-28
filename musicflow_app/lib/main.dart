import 'dart:async';

import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/presentation/widgets/mini_player.dart';
import 'package:musicflow_app/presentation/screens/splash/splash_screen.dart';
import 'package:musicflow_app/presentation/screens/home/home_screen.dart';
import 'package:musicflow_app/presentation/screens/chart/flowchart_screen.dart';
import 'package:musicflow_app/presentation/screens/search/search_screen.dart';
import 'package:musicflow_app/presentation/screens/ai_dj/ai_dj_screen.dart';
import 'package:musicflow_app/presentation/screens/library/library_screen.dart';
import 'package:musicflow_app/core/audio/audio_player_service.dart';
import 'package:musicflow_app/core/audio/global_audio_state.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MusicFlowApp());
  unawaited(_bootstrapAudioServices());
}

Future<void> _bootstrapAudioServices() async {
  try {
    await AudioPlayerService.init();
    GlobalAudioState().initialize();
  } catch (e) {
    debugPrint('AudioService init failed: $e');
  }
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
  int _flowchartRefreshTrigger = 0;
  final GlobalAudioState _audioState = GlobalAudioState();
  final GlobalKey<LibraryScreenState> _libraryKey =
      GlobalKey<LibraryScreenState>();
  final List<Widget?> _tabCache = List<Widget?>.filled(5, null);

  @override
  void initState() {
    super.initState();
    _tabCache[0] = _buildTab(0);
  }

  Widget _buildTab(int index) {
    switch (index) {
      case 0:
        return HomeScreen(onSongTap: playSong, onPlayAll: playPlaylist);
      case 1:
        return FlowchartScreen(
          onSongTap: playSong,
          onPlayWithQueue: (songs, startIndex) =>
              playPlaylist(songs, startIndex: startIndex),
          refreshTrigger: _flowchartRefreshTrigger,
        );
      case 2:
        return SearchScreen(onSongTap: playSong);
      case 3:
        return AiDjScreen(onSongTap: playSong, onPlayAll: playPlaylist);
      case 4:
        return LibraryScreen(
          key: _libraryKey,
          onSongTap: playSong,
          onPlayAll: playPlaylist,
        );
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildTabForIndex(int index) {
    final cachedTab = _tabCache[index];
    if (cachedTab != null) {
      return cachedTab;
    }

    final tab = _buildTab(index);
    _tabCache[index] = tab;
    return tab;
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
    final tabs = List<Widget>.generate(
      5,
      (index) => index == _currentIndex
          ? _buildTabForIndex(index)
          : (_tabCache[index] ?? const SizedBox.shrink()),
    );

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          IndexedStack(index: _currentIndex, children: tabs),

          // Mini Player chỉ rebuild khi trạng thái audio thay đổi
          AnimatedBuilder(
            animation: _audioState,
            builder: (context, child) {
              if (_audioState.currentSong == null) {
                return const SizedBox.shrink();
              }

              return Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: MiniPlayer(
                  isPlaying: _audioState.isPlaying,
                  songTitle: _audioState.currentSong!.title,
                  artist: _audioState.currentSong!.artists.join(', '),
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
              );
            },
          ),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) {
          if (_tabCache[index] == null) {
            setState(() {
              _tabCache[index] = _buildTab(index);
            });
          }

          setState(() {
            _currentIndex = index;
            if (index == 1) {
              _flowchartRefreshTrigger++;
              _tabCache[1] = _buildTab(1);
            }
          });
          // Refresh Library khi chuyển sang tab Library
          if (index == 4) {
            _libraryKey.currentState?.refreshFavorites();
          }
        },
        type: BottomNavigationBarType.fixed,
        backgroundColor: Colors.black,
        selectedItemColor: Colors.greenAccent,
        unselectedItemColor: Colors.grey,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Home'),
          BottomNavigationBarItem(
            icon: Icon(Icons.trending_up_rounded),
            label: 'Trending',
          ),
          BottomNavigationBarItem(icon: Icon(Icons.search), label: 'Search'),
          BottomNavigationBarItem(
            icon: Icon(Icons.auto_awesome),
            label: 'Mood Music',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.library_music),
            label: 'Library',
          ),
        ],
      ),
    );
  }
}

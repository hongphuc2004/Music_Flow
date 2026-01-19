import 'package:flutter/material.dart';
import 'package:musicflow_app/presentation/widgets/mini_player.dart';
import 'package:musicflow_app/presentation/screens/splash/splash_screen.dart';
import 'package:musicflow_app/presentation/screens/home/home_screen.dart';
import 'package:musicflow_app/presentation/screens/search/search_screen.dart';
import 'package:musicflow_app/presentation/screens/library/library_screen.dart';

void main() {
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
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _currentIndex = 0;
  
  // Mock mini player data
  bool _isPlaying = true;
  bool _showMiniPlayer = true;
  String _songTitle = 'Lạc Trôi';
  String _artist = 'Sơn Tùng M-TP';
  double _progress = 0.35;

  final List<Widget> _screens = const [
    HomeScreen(),
    SearchScreen(),
    LibraryScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          _screens[_currentIndex],

          // Mini Player nổi
          if (_showMiniPlayer)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: MiniPlayer(
                isPlaying: _isPlaying,
                songTitle: _songTitle,
                artist: _artist,
                progress: _progress,
                onPlayPause: () {
                  setState(() {
                    _isPlaying = !_isPlaying;
                  });
                },
                onNext: () {
                  setState(() {
                    _songTitle = 'Hãy Trao Cho Anh';
                    _artist = 'Sơn Tùng M-TP ft. Snoop Dogg';
                    _progress = 0.0;
                  });
                },
                onPrevious: () {
                  setState(() {
                    _songTitle = 'Chạy Ngay Đi';
                    _artist = 'Sơn Tùng M-TP';
                    _progress = 0.0;
                  });
                },
                onClose: () {
                  setState(() {
                    _showMiniPlayer = false;
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

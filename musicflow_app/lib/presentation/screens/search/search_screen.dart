import 'package:flutter/material.dart';
import 'dart:async';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../data/services/song_api_service.dart';
import '../../../data/services/topic_api_service.dart';
import '../../../data/models/song_model.dart';
import '../../../data/models/topic_model.dart';
import '../../widgets/song_options_menu.dart';

class SearchScreen extends StatefulWidget {
  final Function(Song)? onSongTap;
  
  const SearchScreen({super.key, this.onSongTap});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();
  
  List<Song> _searchResults = [];
  List<String> _searchHistory = [];
  List<Topic> _topics = [];
  List<Song> _topicSongs = [];
  
  bool _isLoading = false;
  bool _isLoadingTopics = false;
  bool _isLoadingTopicSongs = false;
  String? _errorMessage;
  Timer? _debounceTimer;
  bool _hasSearched = false;
  bool _isSearchFocused = false;
  Topic? _selectedTopic;

  @override
  void initState() {
    super.initState();
    _loadSearchHistory();
    _loadTopics();
    
    // Lắng nghe focus của search input
    _searchFocusNode.addListener(_onFocusChange);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocusNode.removeListener(_onFocusChange);
    _searchFocusNode.dispose();
    _debounceTimer?.cancel();
    super.dispose();
  }

  void _onFocusChange() {
    setState(() {
      _isSearchFocused = _searchFocusNode.hasFocus;
      // Khi focus vào search, reset selected topic
      if (_isSearchFocused) {
        _selectedTopic = null;
        _topicSongs = [];
      }
    });
  }

  // Load danh sách topics
  Future<void> _loadTopics() async {
    setState(() {
      _isLoadingTopics = true;
    });

    try {
      final topics = await TopicApiService.fetchTopics();
      setState(() {
        _topics = topics;
        _isLoadingTopics = false;
      });
    } catch (e) {
      setState(() {
        _isLoadingTopics = false;
      });
    }
  }

  // Load bài hát theo topic
  Future<void> _loadSongsByTopic(Topic topic) async {
    setState(() {
      _selectedTopic = topic;
      _isLoadingTopicSongs = true;
      _isSearchFocused = false;
      _hasSearched = false;
      _searchResults = [];
    });

    // Unfocus search input
    _searchFocusNode.unfocus();

    try {
      final songs = await TopicApiService.fetchSongsByTopic(topic.id);
      setState(() {
        _topicSongs = songs;
        _isLoadingTopicSongs = false;
      });
    } catch (e) {
      setState(() {
        _isLoadingTopicSongs = false;
      });
    }
  }

  // Quay lại danh sách topics
  void _backToTopics() {
    setState(() {
      _selectedTopic = null;
      _topicSongs = [];
    });
  }

  // Load lịch sử tìm kiếm từ SharedPreferences
  Future<void> _loadSearchHistory() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _searchHistory = prefs.getStringList('search_history') ?? [];
    });
  }

  // Lưu lịch sử tìm kiếm
  Future<void> _saveToHistory(String query) async {
    if (query.trim().isEmpty) return;
    
    final prefs = await SharedPreferences.getInstance();
    _searchHistory.remove(query);
    _searchHistory.insert(0, query);
    if (_searchHistory.length > 10) {
      _searchHistory = _searchHistory.sublist(0, 10);
    }
    await prefs.setStringList('search_history', _searchHistory);
    setState(() {});
  }

  // Xóa một mục lịch sử
  Future<void> _removeFromHistory(String query) async {
    final prefs = await SharedPreferences.getInstance();
    _searchHistory.remove(query);
    await prefs.setStringList('search_history', _searchHistory);
    setState(() {});
  }

  // Xóa toàn bộ lịch sử
  Future<void> _clearHistory() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('search_history');
    setState(() {
      _searchHistory = [];
    });
  }

  // Tìm kiếm với debounce
  void _onSearch(String query) {
    _debounceTimer?.cancel();
    
    if (query.trim().isEmpty) {
      setState(() {
        _hasSearched = false;
        _searchResults = [];
      });
      return;
    }
    
    _debounceTimer = Timer(const Duration(milliseconds: 500), () {
      _performSearch(query);
    });
  }

  // Thực hiện tìm kiếm
  Future<void> _performSearch(String query) async {
    if (query.trim().isEmpty) return;
    
    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _hasSearched = true;
      _selectedTopic = null;
    });

    try {
      final songs = await SongApiService.searchSongs(query: query);
      setState(() {
        _searchResults = songs;
        _isLoading = false;
      });
      _saveToHistory(query);
    } catch (e) {
      setState(() {
        _errorMessage = 'Tìm kiếm thất bại';
        _isLoading = false;
      });
    }
  }

  // Tìm kiếm từ lịch sử
  void _searchFromHistory(String query) {
    _searchController.text = query;
    _performSearch(query);
  }

  // Xử lý nút back
  Future<bool> _onWillPop() async {
    // Nếu đang xem kết quả tìm kiếm -> quay về lịch sử/topics
    if (_hasSearched) {
      setState(() {
        _hasSearched = false;
        _searchResults = [];
        _searchController.clear();
      });
      return false;
    }
    
    // Nếu đang focus search -> unfocus và quay về topics
    if (_isSearchFocused) {
      _searchFocusNode.unfocus();
      setState(() {
        _isSearchFocused = false;
      });
      return false;
    }
    
    // Nếu đang xem bài hát của topic -> quay về danh sách topics
    if (_selectedTopic != null) {
      _backToTopics();
      return false;
    }
    
    // Mặc định cho phép back (thoát)
    return true;
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        final shouldPop = await _onWillPop();
        if (shouldPop && context.mounted) {
          Navigator.of(context).maybePop();
        }
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        body: SafeArea(
          child: Column(
            children: [
              _buildSearchBar(),
              Expanded(child: _buildContent()),
            ],
          ),
        ),
      ),
    );
  }

  // 🔍 Search bar
  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _searchController,
              focusNode: _searchFocusNode,
              onChanged: _onSearch,
              onSubmitted: _performSearch,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Tìm bài hát, nghệ sĩ...',
                hintStyle: const TextStyle(color: Colors.grey),
                prefixIcon: const Icon(Icons.search, color: Colors.grey),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, color: Colors.grey),
                        onPressed: () {
                          _searchController.clear();
                          setState(() {
                            _hasSearched = false;
                            _searchResults = [];
                          });
                        },
                      )
                    : null,
                filled: true,
                fillColor: Colors.grey.shade900,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          // Nút hủy khi đang focus search
          if (_isSearchFocused) ...[
            const SizedBox(width: 8),
            TextButton(
              onPressed: () {
                _searchFocusNode.unfocus();
                _searchController.clear();
                setState(() {
                  _hasSearched = false;
                  _searchResults = [];
                  _isSearchFocused = false;
                });
              },
              child: const Text(
                'Hủy',
                style: TextStyle(color: Colors.white),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // 📄 Nội dung chính
  Widget _buildContent() {
    // Nếu đang focus vào search -> hiển thị lịch sử hoặc kết quả
    if (_isSearchFocused || _hasSearched) {
      if (_hasSearched) {
        return _buildSearchResult();
      }
      return _buildSearchHistory();
    }
    
    // Nếu đang xem bài hát theo topic
    if (_selectedTopic != null) {
      return _buildTopicSongs();
    }
    
    // Mặc định hiển thị danh sách topics
    return _buildTopicsGrid();
  }

  // 🎵 Danh sách Topics dạng Grid
  Widget _buildTopicsGrid() {
    if (_isLoadingTopics) {
      return const Center(
        child: CircularProgressIndicator(color: Colors.green),
      );
    }

    if (_topics.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.category_outlined, size: 64, color: Colors.grey),
            SizedBox(height: 16),
            Text(
              'Chưa có chủ đề nào',
              style: TextStyle(color: Colors.grey, fontSize: 16),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Text(
            'Vibes',
            style: TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        Expanded(
          child: GridView.builder(
            padding: const EdgeInsets.all(16),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
              childAspectRatio: 1.6,
            ),
            itemCount: _topics.length,
            itemBuilder: (context, index) {
              final topic = _topics[index];
              return _buildTopicCard(topic);
            },
          ),
        ),
      ],
    );
  }

  // 🎨 Card cho mỗi Topic
  Widget _buildTopicCard(Topic topic) {
    // Lấy tên file ảnh local dựa trên tên topic (lowercase)
    String? localImagePath = _getTopicImagePath(topic.name);

    return GestureDetector(
      onTap: () => _loadSongsByTopic(topic),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.grey.shade800,
          borderRadius: BorderRadius.circular(8),
          image: localImagePath != null
              ? DecorationImage(
                  image: AssetImage(localImagePath),
                  fit: BoxFit.cover,
                )
              : null,
        ),
        child: Stack(
          children: [
            Positioned(
              left: 12,
              top: 12,
              child: Text(
                topic.name,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Lấy đường dẫn ảnh local cho topic
  String? _getTopicImagePath(String topicName) {
    // Map tên topic với file ảnh (không phân biệt hoa thường)
    final Map<String, String> topicImages = {
      'pop': 'assets/images/pop.jpg',
      'edm': 'assets/images/edm.jpg',
      // Thêm các topic khác ở đây khi có thêm ảnh
    };
    
    return topicImages[topicName.toLowerCase()];
  }

  // 🎵 Danh sách bài hát theo Topic
  Widget _buildTopicSongs() {
    if (_isLoadingTopicSongs) {
      return const Center(
        child: CircularProgressIndicator(color: Colors.green),
      );
    }

    if (_topicSongs.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.music_off, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            Text(
              'Chưa có bài hát trong "${_selectedTopic?.name}"',
              style: const TextStyle(color: Colors.grey, fontSize: 16),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Text(
            _selectedTopic?.name ?? '',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        Expanded(
          child: ListView.builder(
            itemCount: _topicSongs.length,
            itemBuilder: (context, index) {
              final song = _topicSongs[index];
              return _buildSongTile(song);
            },
          ),
        ),
      ],
    );
  }

  // 🕐 Lịch sử tìm kiếm
  Widget _buildSearchHistory() {
    if (_searchHistory.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.search, size: 64, color: Colors.grey),
            SizedBox(height: 16),
            Text(
              'Tìm kiếm bài hát, nghệ sĩ yêu thích',
              style: TextStyle(color: Colors.grey, fontSize: 16),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Tìm kiếm gần đây',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              TextButton(
                onPressed: _clearHistory,
                child: const Text(
                  'Xóa tất cả',
                  style: TextStyle(color: Colors.grey),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView.builder(
            itemCount: _searchHistory.length,
            itemBuilder: (context, index) {
              final query = _searchHistory[index];
              return ListTile(
                leading: const Icon(Icons.history, color: Colors.grey),
                title: Text(
                  query,
                  style: const TextStyle(color: Colors.white),
                ),
                trailing: IconButton(
                  icon: const Icon(Icons.close, color: Colors.grey, size: 20),
                  onPressed: () => _removeFromHistory(query),
                ),
                onTap: () => _searchFromHistory(query),
              );
            },
          ),
        ),
      ],
    );
  }

  // 📄 Danh sách kết quả tìm kiếm
  Widget _buildSearchResult() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: Colors.green),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              _errorMessage!,
              style: const TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => _performSearch(_searchController.text),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.green,
              ),
              child: const Text('Thử lại'),
            ),
          ],
        ),
      );
    }

    if (_searchResults.isEmpty) {
      return const Center(
        child: Text(
          'Không tìm thấy kết quả',
          style: TextStyle(color: Colors.grey),
        ),
      );
    }

    return ListView.builder(
      itemCount: _searchResults.length,
      itemBuilder: (context, index) {
        final song = _searchResults[index];
        return _buildSongTile(song);
      },
    );
  }

  // 🎵 Widget hiển thị một bài hát
  Widget _buildSongTile(Song song) {
    return ListTile(
      leading: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image.network(
          song.imageUrl,
          width: 48,
          height: 48,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: Colors.grey.shade800,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.music_note, color: Colors.white),
          ),
        ),
      ),
      title: Text(
        song.title,
        style: const TextStyle(color: Colors.white),
      ),
      subtitle: Text(
        song.artist,
        style: const TextStyle(color: Colors.grey),
      ),
      trailing: SongOptionsMenu(song: song),
      onTap: () {
        widget.onSongTap?.call(song);
      },
    );
  }
}

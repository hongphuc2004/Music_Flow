import 'dart:async';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:speech_to_text/speech_recognition_result.dart';
import 'package:speech_to_text/speech_to_text.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/services/song_api_service.dart';
import '../../../data/services/topic_api_service.dart';
import '../../../data/models/song_model.dart';
import '../../../data/models/topic_model.dart';
import '../../widgets/song_options_menu.dart';
import '../artist/artist_screen.dart';

class SearchScreen extends StatefulWidget {
  final Function(Song)? onSongTap;

  const SearchScreen({super.key, this.onSongTap});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();
  final SpeechToText _speechToText = SpeechToText();

  List<Song> _searchResults = [];
  List<SearchArtist> _artistResults = [];
  List<String> _searchHistory = [];
  List<Topic> _topics = [];
  List<Song> _topicSongs = [];

  bool _isLoading = false;
  bool _isLoadingTopics = false;
  bool _isLoadingTopicSongs = false;
  String? _errorMessage;
  String? _topicsErrorMessage;
  String? _topicSongsErrorMessage;
  Timer? _debounceTimer;
  bool _hasSearched = false;
  bool _isSearchFocused = false;
  bool _isListening = false;
  bool _isSpeechAvailable = false;
  Topic? _selectedTopic;

  @override
  void initState() {
    super.initState();
    _loadSearchHistory();
    _loadTopics();
    _initSpeech();
    _searchFocusNode.addListener(_onFocusChange);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocusNode.removeListener(_onFocusChange);
    _searchFocusNode.dispose();
    _debounceTimer?.cancel();
    _speechToText.cancel();
    super.dispose();
  }

  Future<void> _initSpeech() async {
    final available = await _speechToText.initialize(
      onStatus: (status) {
        if (!mounted) return;
        setState(() {
          _isListening = status == 'listening';
        });
      },
      onError: (_) {
        if (!mounted) return;
        setState(() {
          _isListening = false;
        });
      },
    );

    if (!mounted) return;
    setState(() {
      _isSpeechAvailable = available;
    });
  }

  Future<void> _toggleVoiceSearch() async {
    if (!_isSpeechAvailable) {
      await _initSpeech();
      if (!_isSpeechAvailable && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Thiết bị chưa hỗ trợ tìm kiếm giọng nói'),
          ),
        );
      }
      return;
    }

    if (_isListening) {
      await _speechToText.stop();
      if (!mounted) return;
      setState(() {
        _isListening = false;
      });
      return;
    }

    _searchFocusNode.unfocus();
    setState(() {
      _isSearchFocused = true;
      _selectedTopic = null;
      _topicSongs = [];
    });

    await _speechToText.listen(
      onResult: _onSpeechResult,
      listenMode: ListenMode.search,
      partialResults: true,
      cancelOnError: true,
      localeId: 'vi_VN',
    );

    if (!mounted) return;
    setState(() {
      _isListening = true;
    });
  }

  void _onSpeechResult(SpeechRecognitionResult result) {
    final words = result.recognizedWords.trim();
    if (words.isEmpty) return;

    _searchController.value = TextEditingValue(
      text: words,
      selection: TextSelection.collapsed(offset: words.length),
    );

    _onSearch(words);

    if (result.finalResult) {
      _performSearch(words);
    }
  }

  void _onFocusChange() {
    setState(() {
      _isSearchFocused = _searchFocusNode.hasFocus;
      if (_isSearchFocused) {
        _selectedTopic = null;
        _topicSongs = [];
      }
    });
  }

  Future<void> _loadTopics() async {
    setState(() {
      _isLoadingTopics = true;
      _topicsErrorMessage = null;
    });

    try {
      final topics = await TopicApiService.fetchTopics();
      setState(() {
        _topics = topics;
        _isLoadingTopics = false;
      });
    } catch (e) {
      setState(() {
        _topicsErrorMessage = e.toString();
        _isLoadingTopics = false;
      });
    }
  }

  Future<void> _loadSongsByTopic(Topic topic) async {
    setState(() {
      _selectedTopic = topic;
      _isLoadingTopicSongs = true;
      _topicSongsErrorMessage = null;
      _isSearchFocused = false;
      _hasSearched = false;
      _searchResults = [];
    });

    _searchFocusNode.unfocus();

    try {
      final songs = await TopicApiService.fetchSongsByTopic(topic.id);
      setState(() {
        _topicSongs = songs;
        _isLoadingTopicSongs = false;
      });
    } catch (e) {
      setState(() {
        _topicSongsErrorMessage = e.toString();
        _isLoadingTopicSongs = false;
      });
    }
  }

  void _backToTopics() {
    setState(() {
      _selectedTopic = null;
      _topicSongs = [];
    });
  }

  Future<void> _loadSearchHistory() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _searchHistory = prefs.getStringList('search_history') ?? [];
    });
  }

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

  Future<void> _removeFromHistory(String query) async {
    final prefs = await SharedPreferences.getInstance();
    _searchHistory.remove(query);
    await prefs.setStringList('search_history', _searchHistory);
    setState(() {});
  }

  Future<void> _clearHistory() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('search_history');
    setState(() {
      _searchHistory = [];
    });
  }

  void _onSearch(String query) {
    _debounceTimer?.cancel();

    if (query.trim().isEmpty) {
      setState(() {
        _hasSearched = false;
        _searchResults = [];
        _artistResults = [];
      });
      return;
    }

    _debounceTimer = Timer(const Duration(milliseconds: 500), () {
      _performSearch(query);
    });
  }

  Future<void> _performSearch(String query) async {
    if (query.trim().isEmpty) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _hasSearched = true;
      _selectedTopic = null;
    });

    try {
      final result = await SongApiService.searchAll(query: query);
      setState(() {
        _searchResults = result.songs;
        _artistResults = result.artists;
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

  void _searchFromHistory(String query) {
    _searchController.text = query;
    _performSearch(query);
  }

  Future<bool> _onWillPop() async {
    if (_hasSearched) {
      setState(() {
        _hasSearched = false;
        _searchResults = [];
        _artistResults = [];
        _searchController.clear();
      });
      return false;
    }

    if (_isSearchFocused) {
      _searchFocusNode.unfocus();
      setState(() {
        _isSearchFocused = false;
      });
      return false;
    }

    if (_selectedTopic != null) {
      _backToTopics();
      return false;
    }

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
        backgroundColor: Colors.transparent,
        body: SafeArea(
          child: Stack(
            children: [
              Column(
                children: [
                  _buildSearchBar(),
                  Expanded(child: _buildContent()),
                ],
              ),
              if (_isListening) _buildVoiceSearchOverlay(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
      child: Row(
        children: [
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                boxShadow: _isSearchFocused ? AppShadows.neonGlow(AppColors.primary) : null,
                borderRadius: BorderRadius.circular(30),
              ),
              child: TextField(
                controller: _searchController,
                focusNode: _searchFocusNode,
                onChanged: (value) {
                  setState(() {});
                  _onSearch(value);
                },
                onSubmitted: _performSearch,
                style: TextStyle(
                  color: isDark ? Colors.white : AppColors.lightTextPrimary,
                  fontSize: 15,
                ),
                decoration: InputDecoration(
                  hintText: 'Tìm bài hát, nghệ sĩ...',
                  hintStyle: TextStyle(
                    color: isDark ? AppColors.darkTextSecondary.withOpacity(0.6) : AppColors.lightTextSecondary.withOpacity(0.6),
                  ),
                  prefixIcon: Icon(
                    Icons.search_rounded,
                    color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                  ),
                  suffixIcon: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (_searchController.text.isNotEmpty)
                        IconButton(
                          icon: Icon(
                            Icons.clear_rounded,
                            color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                          ),
                          onPressed: () {
                            _searchController.clear();
                            setState(() {
                              _hasSearched = false;
                              _searchResults = [];
                              _artistResults = [];
                            });
                          },
                        ),
                      IconButton(
                        icon: Icon(
                          _isListening ? Icons.mic_rounded : Icons.mic_none_rounded,
                          color: _isListening ? AppColors.secondary : (isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary),
                        ),
                        tooltip: 'Tìm bằng giọng nói',
                        onPressed: _toggleVoiceSearch,
                      ),
                      const SizedBox(width: AppSpacing.xxs),
                    ],
                  ),
                  filled: true,
                  fillColor: isDark
                      ? Colors.white.withOpacity(0.04)
                      : Colors.black.withOpacity(0.02),
                  contentPadding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(30),
                    borderSide: BorderSide(
                      color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
                    ),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(30),
                    borderSide: const BorderSide(
                      color: AppColors.primary,
                      width: 1.5,
                    ),
                  ),
                ),
              ),
            ),
          ),
          if (_isSearchFocused) ...[
            const SizedBox(width: AppSpacing.xs),
            TextButton(
              onPressed: () {
                _searchFocusNode.unfocus();
                _searchController.clear();
                setState(() {
                  _hasSearched = false;
                  _searchResults = [];
                  _artistResults = [];
                  _isSearchFocused = false;
                });
              },
              child: Text(
                'Hủy',
                style: TextStyle(
                  color: isDark ? Colors.white : AppColors.lightTextPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildContent() {
    if (_isSearchFocused || _hasSearched) {
      if (_hasSearched) {
        return _buildSearchResult();
      }
      return _buildSearchHistory();
    }

    if (_selectedTopic != null) {
      return _buildTopicSongs();
    }

    return _buildTopicsGrid();
  }

  Widget _buildTopicsGrid() {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    if (_isLoadingTopics) {
      return Center(
        child: CircularProgressIndicator(color: theme.colorScheme.primary),
      );
    }

    if (_topicsErrorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.wifi_off_rounded, size: 56, color: theme.disabledColor),
              const SizedBox(height: AppSpacing.md),
              Text(
                'Không tải được danh mục',
                style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                _topicsErrorMessage!,
                style: theme.textTheme.bodyMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.md),
              ElevatedButton(
                onPressed: _loadTopics,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: AppRadius.smallBorder),
                ),
                child: const Text('Thử lại'),
              ),
            ],
          ),
        ),
      );
    }

    if (_topics.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.category_outlined, size: 56, color: Colors.grey),
            SizedBox(height: AppSpacing.md),
            Text(
              'Chưa có chủ đề nào',
              style: TextStyle(color: Colors.grey, fontSize: 15),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.xs),
          child: Text(
            'Vibes & Thể loại',
            style: theme.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        Expanded(
          child: GridView.builder(
            padding: const EdgeInsets.all(AppSpacing.md),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: AppSpacing.md,
              mainAxisSpacing: AppSpacing.md,
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

  Widget _buildTopicCard(Topic topic) {
    return GestureDetector(
      onTap: () => _loadSongsByTopic(topic),
      child: ClipRRect(
        borderRadius: AppRadius.mediumBorder,
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.primary.withOpacity(0.1),
            borderRadius: AppRadius.mediumBorder,
            image: topic.avatar.isNotEmpty
                ? DecorationImage(
                    image: NetworkImage(topic.avatar),
                    fit: BoxFit.cover,
                  )
                : null,
          ),
          child: Stack(
            children: [
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withOpacity(0.15),
                      Colors.black.withOpacity(0.70),
                    ],
                  ),
                ),
              ),
              Positioned(
                left: AppSpacing.sm,
                bottom: AppSpacing.sm,
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
      ),
    );
  }

  Widget _buildTopicSongs() {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    if (_isLoadingTopicSongs) {
      return Center(
        child: CircularProgressIndicator(color: theme.colorScheme.primary),
      );
    }

    if (_topicSongsErrorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline_rounded, size: 56, color: Colors.grey),
              const SizedBox(height: AppSpacing.md),
              Text(
                _topicSongsErrorMessage!,
                style: const TextStyle(color: Colors.grey, fontSize: 14),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.md),
              ElevatedButton(
                onPressed: _selectedTopic == null
                    ? null
                    : () => _loadSongsByTopic(_selectedTopic!),
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                child: const Text('Thử lại'),
              ),
            ],
          ),
        ),
      );
    }

    if (_topicSongs.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.music_off_rounded, size: 56, color: Colors.grey),
            const SizedBox(height: AppSpacing.md),
            Text(
              'Chưa có bài hát trong "${_selectedTopic?.name}"',
              style: const TextStyle(color: Colors.grey, fontSize: 15),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.xs),
          child: Row(
            children: [
              IconButton(
                icon: Icon(
                  Icons.arrow_back_ios_new_rounded,
                  color: isDark ? Colors.white : AppColors.lightTextPrimary,
                  size: 20,
                ),
                onPressed: _backToTopics,
              ),
              const SizedBox(width: AppSpacing.xs),
              Text(
                _selectedTopic?.name ?? '',
                style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.only(bottom: 24),
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

  Widget _buildSearchHistory() {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    if (_searchHistory.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.search_rounded,
              size: 64,
              color: isDark ? AppColors.darkTextSecondary.withOpacity(0.5) : AppColors.lightTextSecondary.withOpacity(0.5),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              'Tìm kiếm bài hát, nghệ sĩ yêu thích',
              style: TextStyle(
                color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                fontSize: 15,
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.xs),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Tìm kiếm gần đây',
                style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
              ),
              TextButton(
                onPressed: _clearHistory,
                child: Text(
                  'Xóa tất cả',
                  style: TextStyle(color: isDark ? AppColors.secondary : AppColors.primary),
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
                leading: Icon(
                  Icons.history_rounded,
                  color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                ),
                title: Text(
                  query,
                  style: TextStyle(color: isDark ? Colors.white : AppColors.lightTextPrimary),
                ),
                trailing: IconButton(
                  icon: Icon(
                    Icons.close_rounded,
                    color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                    size: 18,
                  ),
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

  Widget _buildSearchResult() {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    if (_isLoading) {
      return Center(
        child: CircularProgressIndicator(color: theme.colorScheme.primary),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              _errorMessage!,
              style: TextStyle(color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary),
            ),
            const SizedBox(height: AppSpacing.md),
            ElevatedButton(
              onPressed: () => _performSearch(_searchController.text),
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
              child: const Text('Thử lại'),
            ),
          ],
        ),
      );
    }

    if (_searchResults.isEmpty && _artistResults.isEmpty) {
      return Center(
        child: Text(
          'Không tìm thấy kết quả',
          style: TextStyle(color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        if (_artistResults.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.sm, AppSpacing.md, AppSpacing.xs),
            child: Text(
              'Nghệ sĩ',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
          ),
          ..._artistResults.map(_buildArtistTile),
          const SizedBox(height: AppSpacing.xs),
        ],
        if (_searchResults.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.sm, AppSpacing.md, AppSpacing.xs),
            child: Text(
              'Bài hát',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
          ),
          ..._searchResults.map(_buildSongTile),
        ],
      ],
    );
  }

  Widget _buildArtistTile(SearchArtist artist) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return ListTile(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => ArtistScreen(artistName: artist.name),
          ),
        );
      },
      leading: CircleAvatar(
        radius: 22,
        backgroundColor: isDark ? AppColors.darkBorder : AppColors.lightBorder,
        backgroundImage: artist.avatar.isNotEmpty ? NetworkImage(artist.avatar) : null,
        child: artist.avatar.isEmpty
            ? Icon(Icons.person_rounded, color: isDark ? Colors.white70 : Colors.black45)
            : null,
      ),
      title: Text(
        artist.name,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: isDark ? Colors.white : AppColors.lightTextPrimary,
          fontWeight: FontWeight.bold,
          fontSize: 14,
        ),
      ),
      subtitle: Text(
        'Nghệ sĩ',
        style: TextStyle(
          color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
          fontSize: 12,
        ),
      ),
      trailing: Icon(
        Icons.chevron_right_rounded,
        color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
      ),
    );
  }

  Widget _buildSongTile(Song song) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return InkWell(
      onTap: () => widget.onSongTap?.call(song),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.xs),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(AppRadius.small),
              child: Image.network(
                song.imageUrl,
                width: 52,
                height: 52,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
                    borderRadius: BorderRadius.circular(AppRadius.small),
                  ),
                  child: Icon(
                    Icons.music_note_rounded,
                    color: isDark ? Colors.white30 : Colors.black26,
                  ),
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    song.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: isDark ? Colors.white : AppColors.lightTextPrimary,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    song.artists.join(', '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(
                        Icons.play_arrow_rounded,
                        color: isDark ? AppColors.darkTextSecondary.withOpacity(0.7) : AppColors.lightTextSecondary.withOpacity(0.7),
                        size: 14,
                      ),
                      const SizedBox(width: 2),
                      Text(
                        '${song.playCount}',
                        style: TextStyle(
                          color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                          fontSize: 11,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Text(
                        '·',
                        style: TextStyle(
                          color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Text(
                        _formatDuration(song.duration),
                        style: TextStyle(
                          color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            IconButton(
              icon: Icon(
                Icons.more_vert_rounded,
                color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                size: 20,
              ),
              onPressed: () {
                showModalBottomSheet(
                  context: context,
                  backgroundColor: Colors.transparent,
                  isScrollControlled: true,
                  builder: (context) => SongOptionsSheet(song: song),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  String _formatDuration(double? durationInSeconds) {
    if (durationInSeconds == null) return "0:00";
    final int totalSeconds = durationInSeconds.toInt();
    final int minutes = totalSeconds ~/ 60;
    final int seconds = totalSeconds % 60;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }

  Widget _buildVoiceSearchOverlay() {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Positioned.fill(
      child: ClipRRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 12.0, sigmaY: 12.0),
          child: Container(
            color: (isDark ? AppColors.darkBackground : AppColors.lightBackground).withOpacity(0.85),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: AppColors.secondary.withOpacity(0.15),
                    shape: BoxShape.circle,
                    boxShadow: AppShadows.neonGlow(AppColors.secondary),
                  ),
                  child: const Icon(
                    Icons.mic_rounded,
                    size: 48,
                    color: AppColors.secondary,
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                Text(
                  'Đang lắng nghe...',
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                  child: Text(
                    _searchController.text.isNotEmpty
                        ? '"${_searchController.text}"'
                        : 'Hãy nói tên bài hát hoặc nghệ sĩ',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyLarge?.copyWith(
                      fontStyle: _searchController.text.isEmpty ? FontStyle.italic : FontStyle.normal,
                      color: _searchController.text.isNotEmpty
                          ? (isDark ? Colors.white : AppColors.lightTextPrimary)
                          : theme.hintColor,
                    ),
                  ),
                ),
                const SizedBox(height: 48),
                // Audio Wave animation
                SizedBox(
                  height: 40,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(5, (index) {
                      return _VoiceWaveBar(index: index);
                    }),
                  ),
                ),
                const SizedBox(height: 60),
                // Cancel button
                Container(
                  decoration: BoxDecoration(
                    borderRadius: AppRadius.badgeBorder,
                    border: Border.all(
                      color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
                    ),
                  ),
                  child: TextButton.icon(
                    onPressed: () async {
                      await _speechToText.stop();
                      setState(() {
                        _isListening = false;
                      });
                    },
                    icon: Icon(
                      Icons.close_rounded,
                      size: 18,
                      color: isDark ? Colors.white : AppColors.lightTextPrimary,
                    ),
                    label: Text(
                      'Hủy bỏ',
                      style: TextStyle(
                        color: isDark ? Colors.white : AppColors.lightTextPrimary,
                      ),
                    ),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _VoiceWaveBar extends StatefulWidget {
  final int index;
  const _VoiceWaveBar({required this.index});

  @override
  State<_VoiceWaveBar> createState() => _VoiceWaveBarState();
}

class _VoiceWaveBarState extends State<_VoiceWaveBar> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: 300 + widget.index * 80),
    )..repeat(reverse: true);

    _animation = Tween<double>(begin: 8.0, end: 32.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Container(
          width: 5,
          height: _animation.value,
          margin: const EdgeInsets.symmetric(horizontal: 2.5),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppColors.primary, AppColors.secondary],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
            borderRadius: BorderRadius.circular(2.5),
          ),
        );
      },
    );
  }
}

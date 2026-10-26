import 'package:flutter/material.dart';
import 'package:musicflow_app/core/theme/app_theme.dart';
import 'package:musicflow_app/data/models/artist_profile_model.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/data/services/artist_api_service.dart';
import 'package:musicflow_app/presentation/screens/artist/artist_screen.dart';
import 'package:musicflow_app/core/utils/app_toast.dart';
import 'package:musicflow_app/presentation/screens/artist/artist_followers_sheet.dart';
import 'package:musicflow_app/presentation/widgets/liquid_glass_button.dart';

/// Artist Header Card styled after Lucian UX/UI Prompt #054
/// Features:
/// - Gradient cover banner with abstract lighting accents
/// - Overlapping circular avatar with conic gradient ring & online green dot
/// - Micro-animations:
///   * Avatar spring bounce/pop animation on follow
///   * Follow pill button with vertical sliding text transition
///   * Rolling animated counter for Followers count
/// - Action buttons: circular share/message button & animated follow pill
/// - Artist Name with verified badge (ONLY displayed if artist.isVerified == true)
/// - Subtitle and Bio
/// - 3-column stats row: Followers, Lượt nghe (listeners), Số bài hát (songs)
/// - Play All & Shuffle playback controls
/// - Similar people (Nghệ sĩ tương tự) suggestion pane expanding when followed
class ArtistHeaderSection extends StatefulWidget {
  final ArtistProfile artist;
  final bool isFollowing;
  final bool isFollowLoading;
  final VoidCallback? onBack;
  final VoidCallback onPlayAll;
  final VoidCallback onShuffle;
  final VoidCallback onFollow;
  final VoidCallback? onShare;

  const ArtistHeaderSection({
    super.key,
    required this.artist,
    required this.isFollowing,
    required this.isFollowLoading,
    this.onBack,
    required this.onPlayAll,
    required this.onShuffle,
    required this.onFollow,
    this.onShare,
  });

  @override
  State<ArtistHeaderSection> createState() => _ArtistHeaderSectionState();
}

class _ArtistHeaderSectionState extends State<ArtistHeaderSection>
    with SingleTickerProviderStateMixin {
  bool _isActionPressed = false;

  late final AnimationController _avatarPopController;
  late final Animation<double> _avatarScaleAnimation;

  List<ArtistSuggestion> _suggestions = [];
  bool _isLoadingSuggestions = false;

  static const Color _cardBg = Color(0xFF141724);

  @override
  void initState() {
    super.initState();

    _avatarPopController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 450),
    );

    _avatarScaleAnimation = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.0, end: 1.09)
            .chain(CurveTween(curve: Curves.easeOutBack)),
        weight: 40,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.09, end: 1.0)
            .chain(CurveTween(curve: Curves.easeInOutCubic)),
        weight: 60,
      ),
    ]).animate(_avatarPopController);

    _loadSuggestions();
  }

  @override
  void didUpdateWidget(ArtistHeaderSection oldWidget) {
    super.didUpdateWidget(oldWidget);

    // Trigger avatar bounce animation when switching from unfollowed -> followed
    if (!oldWidget.isFollowing && widget.isFollowing) {
      _avatarPopController.forward(from: 0.0);
      if (_suggestions.isEmpty && !_isLoadingSuggestions) {
        _loadSuggestions();
      }
    }

    if (oldWidget.artist.id != widget.artist.id ||
        oldWidget.artist.name != widget.artist.name) {
      _loadSuggestions();
    }
  }

  @override
  void dispose() {
    _avatarPopController.dispose();
    super.dispose();
  }

  Future<void> _loadSuggestions() async {
    if (!mounted) return;
    setState(() => _isLoadingSuggestions = true);

    // 1. Fetch from Backend /api/artist/suggestions
    List<ArtistSuggestion> results = await ArtistApiService.fetchSuggestions(
      artistId: widget.artist.id,
      artistName: widget.artist.name,
      limit: 3,
    );

    // 2. Fallback: If backend returned empty, generate from artist.songs collaborators
    if (results.isEmpty && widget.artist.songs.isNotEmpty) {
      final currentName = widget.artist.name.trim().toLowerCase();
      final collabCounts = <String, int>{};
      final displayNames = <String, String>{};

      for (final song in widget.artist.songs) {
        for (final artistName in song.artists) {
          final normalized = artistName.trim().toLowerCase();
          if (normalized.isEmpty || normalized == currentName) continue;
          collabCounts[normalized] = (collabCounts[normalized] ?? 0) + 1;
          displayNames[normalized] = artistName.trim();
        }
      }

      final sortedCollaborators = collabCounts.keys.toList()
        ..sort((a, b) => collabCounts[b]!.compareTo(collabCounts[a]!));

      final fallbackList = <ArtistSuggestion>[];
      for (final norm in sortedCollaborators.take(3)) {
        final displayName = displayNames[norm] ?? norm;
        final avatar = Song.artistAvatars[norm] ?? '';
        final verified = Song.artistVerified[norm] ?? false;
        final followers = Song.artistFollowers[norm] ?? 0;
        final count = collabCounts[norm] ?? 1;

        fallbackList.add(
          ArtistSuggestion(
            id: '',
            name: displayName,
            avatarUrl: avatar,
            isVerified: verified,
            followersCount: followers,
            role: 'Hợp tác · $count bài hát',
            isFollowing: false,
          ),
        );
      }
      results = fallbackList;
    }

    // 3. Fallback: If still empty, pick 2-3 popular artists from globally cached metadata
    if (results.isEmpty) {
      final currentName = widget.artist.name.trim().toLowerCase();
      final seen = <String>{currentName};
      for (final entry in Song.artistAvatars.entries) {
        if (seen.contains(entry.key)) continue;
        seen.add(entry.key);
        results.add(
          ArtistSuggestion(
            id: '',
            name: entry.key,
            avatarUrl: entry.value,
            isVerified: Song.artistVerified[entry.key] ?? false,
            followersCount: Song.artistFollowers[entry.key] ?? 0,
            role: 'Nghệ sĩ thịnh hành',
            isFollowing: false,
          ),
        );
        if (results.length >= 2) break;
      }
    }

    if (!mounted) return;
    setState(() {
      _suggestions = results;
      _isLoadingSuggestions = false;
    });
  }

  String _formatCount(int value) {
    if (value >= 1000000) {
      return '${(value / 1000000).toStringAsFixed(1)}M';
    }
    return value.toString().replaceAllMapped(
      RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
      (Match m) => '${m[1]},',
    );
  }

  @override
  Widget build(BuildContext context) {
    final artist = widget.artist;

    return Container(
      decoration: BoxDecoration(
        color: _cardBg,
        borderRadius: BorderRadius.circular(30),
        border: Border.all(
          color: Colors.white.withOpacity(0.08),
          width: 1.0,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.45),
            blurRadius: 32,
            offset: const Offset(0, 16),
          ),
        ],
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Cover Banner (Height: 124px)
              _buildCoverBanner(),

              // Spacer for the avatar and right action buttons (avatar overlaps by 42px)
              const SizedBox(height: 52),

              // 2. Artist Details Body
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Artist Name & Verified Badge (Admin-approved only)
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Flexible(
                          child: Text(
                            artist.name,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 21,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.4,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        // ⚠️ Tích xanh: CHỈ HIỂN THỊ KHI ĐÃ ĐƯỢC ADMIN DUYỆT (isVerified == true)
                        if (artist.isVerified) ...[
                          const SizedBox(width: 7),
                          Container(
                            width: 19,
                            height: 19,
                            decoration: const BoxDecoration(
                              color: Color(0xFF3D8BFF),
                              shape: BoxShape.circle,
                            ),
                            child: const Center(
                              child: Icon(
                                Icons.check_rounded,
                                color: Colors.white,
                                size: 13,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),

                    const SizedBox(height: 3),

                    // Role / Subtitle
                    Text(
                      'Nghệ sĩ · MusicFlow',
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.52),
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.1,
                      ),
                    ),

                    // Bio
                    if (artist.bio.trim().isNotEmpty) ...[
                      const SizedBox(height: 10),
                      Text(
                        artist.bio.trim(),
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.72),
                          fontSize: 13.5,
                          height: 1.5,
                        ),
                      ),
                    ],

                    const SizedBox(height: 18),

                    // 3. Stats Row (Followers | Lượt nghe | Số bài hát) with Animated Counter
                    _buildStatsRow(artist),

                    const SizedBox(height: 20),

                    // 4. Play All & Shuffle Buttons
                    _buildPlaybackActions(),

                    // 5. Similar People / Suggested Artists (Prompt #054)
                    _buildSimilarPeopleSection(),

                    const SizedBox(height: 20),
                  ],
                ),
              ),
            ],
          ),

          // 6. Overlapping Avatar (Top: 82px, Left: 20px) with pop bounce animation
          Positioned(
            top: 82,
            left: 20,
            child: ScaleTransition(
              scale: _avatarScaleAnimation,
              child: _buildAvatar(artist),
            ),
          ),

          // 7. Action Buttons on Right (Top: 136px, Right: 18px)
          Positioned(
            top: 136,
            right: 18,
            child: _buildTopActionButtons(),
          ),

          // Back button on cover (if onBack provided)
          if (widget.onBack != null)
            Positioned(
              top: 12,
              left: 12,
              child: _buildBackButton(),
            ),
        ],
      ),
    );
  }

  /// Cover banner with abstract gradients and lighting accents
  Widget _buildCoverBanner() {
    final artist = widget.artist;

    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
      child: SizedBox(
        height: 124,
        width: double.infinity,
        child: Stack(
          children: [
            // Background image or gradient
            Positioned.fill(
              child: artist.coverUrl.isNotEmpty
                  ? Image.network(
                      artist.coverUrl,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => _buildCoverGradient(),
                    )
                  : _buildCoverGradient(),
            ),

            // Gradient tint overlay
            Positioned.fill(
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withOpacity(0.15),
                      Colors.black.withOpacity(0.55),
                    ],
                  ),
                ),
              ),
            ),

            // Top-right lighting circle (accent glow from #054)
            Positioned(
              top: -50,
              right: -30,
              child: Container(
                width: 150,
                height: 150,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      Colors.white.withOpacity(0.40),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),

            // Bottom-left darker abstract sphere
            Positioned(
              bottom: -50,
              left: -40,
              child: Container(
                width: 200,
                height: 100,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFF28145A).withOpacity(0.35),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCoverGradient() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFFFFB547),
            Color(0xFFFF6B8B),
            Color(0xFF7B61FF),
          ],
        ),
      ),
    );
  }

  /// Overlapping avatar with conic gradient ring and online green indicator dot
  Widget _buildAvatar(ArtistProfile artist) {
    return SizedBox(
      width: 86,
      height: 86,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // Conic / Sweep gradient ring
          Container(
            width: 86,
            height: 86,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: SweepGradient(
                colors: [
                  Color(0xFFFFB547),
                  Color(0xFFFF6B8B),
                  Color(0xFF7B61FF),
                  Color(0xFF00BCD4),
                  Color(0xFFFFB547),
                ],
              ),
            ),
            padding: const EdgeInsets.all(3.0),
            child: Container(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: _cardBg,
                  width: 3.0,
                ),
                color: const Color(0xFF1E2433),
              ),
              child: ClipOval(
                child: artist.avatarUrl.isNotEmpty
                    ? Image.network(
                        artist.avatarUrl,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => _buildAvatarFallback(artist),
                      )
                    : _buildAvatarFallback(artist),
              ),
            ),
          ),

          // Green online / active status indicator dot
          Positioned(
            right: 4,
            bottom: 4,
            child: Container(
              width: 17,
              height: 17,
              decoration: BoxDecoration(
                color: const Color(0xFF22C38E),
                shape: BoxShape.circle,
                border: Border.all(
                  color: _cardBg,
                  width: 2.5,
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF22C38E).withOpacity(0.4),
                    blurRadius: 6,
                    offset: const Offset(0, 1),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAvatarFallback(ArtistProfile artist) {
    return Container(
      color: const Color(0xFF1E2433),
      child: Center(
        child: Text(
          artist.name.isNotEmpty ? artist.name[0].toUpperCase() : 'A',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 26,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
    );
  }

  /// Right side action buttons: Circle action button & Animated Follow pill
  Widget _buildTopActionButtons() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Circular message / share button (.u054-msg)
        GestureDetector(
          onTapDown: (_) => setState(() => _isActionPressed = true),
          onTapUp: (_) {
            setState(() => _isActionPressed = false);
            widget.onShare?.call();
          },
          onTapCancel: () => setState(() => _isActionPressed = false),
          child: AnimatedScale(
            scale: _isActionPressed ? 0.90 : 1.0,
            duration: const Duration(milliseconds: 150),
            child: Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withOpacity(0.08),
                border: Border.all(
                  color: Colors.white.withOpacity(0.12),
                  width: 1.0,
                ),
              ),
              child: Icon(
                Icons.share_rounded,
                size: 19,
                color: Colors.white.withOpacity(0.88),
              ),
            ),
          ),
        ),

        const SizedBox(width: 8),

        // Animated Liquid Glass Follow Button (Lucian UX/UI Prompt #001)
        LiquidGlassFollowButton(
          isFollowing: widget.isFollowing,
          isLoading: widget.isFollowLoading,
          onTap: widget.onFollow,
          followingText: 'Đã theo dõi',
          followText: 'Quan tâm',
        ),
      ],
    );
  }

  /// 3-column stats row: Followers (with sliding rolling counter), Lượt nghe, Số bài hát
  Widget _buildStatsRow(ArtistProfile artist) {
    return Row(
      children: [
        GestureDetector(
          onTap: () {
            ArtistFollowersSheet.show(
              context,
              artistId: artist.id,
              artistName: artist.name,
            );
          },
          child: _buildStatItem(
            _formatCount(artist.followers),
            'Followers',
            isAnimated: true,
          ),
        ),
        const SizedBox(width: 26),
        // following -> lượt nghe
        _buildStatItem(_formatCount(artist.monthlyListeners), 'Lượt nghe'),
        const SizedBox(width: 26),
        // post -> số bài hát
        _buildStatItem(_formatCount(artist.totalSongs), 'Số bài hát'),
      ],
    );
  }

  Widget _buildStatItem(String value, String label, {bool isAnimated = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (isAnimated)
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 360),
            transitionBuilder: (child, animation) {
              return ClipRect(
                child: SlideTransition(
                  position: Tween<Offset>(
                    begin: const Offset(0.0, 0.6),
                    end: Offset.zero,
                  ).animate(
                    CurvedAnimation(
                      parent: animation,
                      curve: Curves.easeOutCubic,
                    ),
                  ),
                  child: FadeTransition(
                    opacity: animation,
                    child: child,
                  ),
                ),
              );
            },
            child: Text(
              value,
              key: ValueKey(value),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.4,
              ),
            ),
          )
        else
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.4,
            ),
          ),
        const SizedBox(height: 2),
        Text(
          label,
          style: TextStyle(
            color: Colors.white.withOpacity(0.50),
            fontSize: 12,
            fontWeight: FontWeight.w600,
            letterSpacing: -0.1,
          ),
        ),
      ],
    );
  }

  /// Play All and Shuffle action controls
  Widget _buildPlaybackActions() {
    return Row(
      children: [
        Expanded(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.primary, AppColors.secondary],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withOpacity(0.35),
                  blurRadius: 14,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: widget.onPlayAll,
                borderRadius: BorderRadius.circular(16),
                child: const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.play_arrow_rounded, color: Colors.white, size: 20),
                      SizedBox(width: 6),
                      Text(
                        'Phát tất cả',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Material(
          color: Colors.white.withOpacity(0.06),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(color: Colors.white.withOpacity(0.08)),
          ),
          child: InkWell(
            onTap: widget.onShuffle,
            borderRadius: BorderRadius.circular(16),
            child: const Padding(
              padding: EdgeInsets.all(12),
              child: Icon(
                Icons.shuffle_rounded,
                color: Colors.white70,
                size: 20,
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// Similar People / Gợi ý nghệ sĩ khác (Prompt #054)
  /// Hiển thị khi người dùng đã theo dõi nghệ sĩ này (widget.isFollowing == true)
  Widget _buildSimilarPeopleSection() {
    return AnimatedCrossFade(
      duration: const Duration(milliseconds: 380),
      firstCurve: Curves.easeOutCubic,
      secondCurve: Curves.easeOutCubic,
      crossFadeState: widget.isFollowing
          ? CrossFadeState.showSecond
          : CrossFadeState.showFirst,
      firstChild: const SizedBox.shrink(),
      secondChild: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 18),
          // Subtle separator
          Container(
            height: 1,
            color: Colors.white.withOpacity(0.08),
          ),
          const SizedBox(height: 14),

          // Section Title
          Row(
            children: [
              Text(
                'Similar people',
                style: TextStyle(
                  color: Colors.white.withOpacity(0.55),
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.2,
                ),
              ),
              const Spacer(),
              Text(
                'Gợi ý',
                style: TextStyle(
                  color: Colors.white.withOpacity(0.35),
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),

          const SizedBox(height: 10),

          // Suggestion list
          if (_isLoadingSuggestions && _suggestions.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Center(
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white.withOpacity(0.5),
                  ),
                ),
              ),
            )
          else if (_suggestions.isNotEmpty)
            ..._suggestions.map((suggestion) => _buildSuggestionItem(suggestion))
          else
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                'Không có nghệ sĩ tương tự khả dụng',
                style: TextStyle(
                  color: Colors.white.withOpacity(0.35),
                  fontSize: 12,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildSuggestionItem(ArtistSuggestion suggestion) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => ArtistScreen(artistName: suggestion.name),
              ),
            );
          },
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
            child: Row(
              children: [
                // Mini avatar with gradient or image
                _buildMiniAvatar(suggestion),

                const SizedBox(width: 12),

                // Name and collaborative/category role
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              suggestion.name,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                letterSpacing: -0.2,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (suggestion.isVerified) ...[
                            const SizedBox(width: 4),
                            const Icon(
                              Icons.check_circle_rounded,
                              size: 13,
                              color: Color(0xFF3D8BFF),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        suggestion.role,
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.48),
                          fontSize: 12,
                          letterSpacing: -0.1,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),

                const SizedBox(width: 8),

                // Mini Follow / Following Pill Button
                GestureDetector(
                  onTap: () => _toggleMiniFollow(suggestion),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 240),
                    height: 32,
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(999),
                      color: suggestion.isFollowing
                          ? Colors.white.withOpacity(0.09)
                          : const Color(0xFFECE7FF),
                      border: Border.all(
                        color: suggestion.isFollowing
                            ? Colors.white.withOpacity(0.18)
                            : Colors.transparent,
                        width: 1.0,
                      ),
                    ),
                    child: Center(
                      child: Text(
                        suggestion.isFollowing ? 'Following' : 'Follow',
                        style: TextStyle(
                          color: suggestion.isFollowing
                              ? Colors.white70
                              : const Color(0xFF4C3CB8),
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.2,
                        ),
                      ),
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

  Widget _buildMiniAvatar(ArtistSuggestion suggestion) {
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF9E86FF),
            Color(0xFF3D8BFF),
          ],
        ),
        border: Border.all(
          color: Colors.white.withOpacity(0.15),
          width: 1.0,
        ),
      ),
      child: ClipOval(
        child: suggestion.avatarUrl.isNotEmpty
            ? Image.network(
                suggestion.avatarUrl,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => _miniAvatarFallback(suggestion),
              )
            : _miniAvatarFallback(suggestion),
      ),
    );
  }

  Widget _miniAvatarFallback(ArtistSuggestion suggestion) {
    return Center(
      child: Text(
        suggestion.name.isNotEmpty ? suggestion.name[0].toUpperCase() : 'A',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 16,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Future<void> _toggleMiniFollow(ArtistSuggestion suggestion) async {
    setState(() {
      suggestion.isFollowing = !suggestion.isFollowing;
    });

    if (suggestion.id.isNotEmpty) {
      final res = await ArtistApiService.toggleFollowArtist(suggestion.id);
      if (mounted) {
        if (res.success) {
          AppToast.showSuccess(
            context,
            suggestion.isFollowing
                ? 'Đã theo dõi ${suggestion.name}'
                : 'Đã bỏ theo dõi ${suggestion.name}',
          );
        } else {
          AppToast.showError(
            context,
            res.message ?? 'Không thể cập nhật theo dõi',
          );
        }
      }
    } else {
      if (mounted) {
        AppToast.showSuccess(
          context,
          suggestion.isFollowing
              ? 'Đã theo dõi ${suggestion.name}'
              : 'Đã bỏ theo dõi ${suggestion.name}',
        );
      }
    }
  }

  Widget _buildBackButton() {
    return Material(
      color: Colors.black.withOpacity(0.40),
      shape: const CircleBorder(),
      child: InkWell(
        onTap: widget.onBack,
        customBorder: const CircleBorder(),
        child: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: Colors.white.withOpacity(0.18),
              width: 1.0,
            ),
          ),
          child: const Center(
            child: Icon(
              Icons.arrow_back_rounded,
              color: Colors.white,
              size: 18,
            ),
          ),
        ),
      ),
    );
  }
}

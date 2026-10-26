import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/services/artist_api_service.dart';

class ArtistFollowersSheet extends StatefulWidget {
  final String? artistId;
  final String artistName;

  const ArtistFollowersSheet({
    super.key,
    this.artistId,
    required this.artistName,
  });

  static void show(BuildContext context, {String? artistId, required String artistName}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ArtistFollowersSheet(
        artistId: artistId,
        artistName: artistName,
      ),
    );
  }

  @override
  State<ArtistFollowersSheet> createState() => _ArtistFollowersSheetState();
}

class _ArtistFollowersSheetState extends State<ArtistFollowersSheet> {
  List<ArtistFollower> _followers = [];
  bool _isLoading = true;
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadFollowers();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadFollowers({String search = ''}) async {
    setState(() => _isLoading = true);
    try {
      final list = await ArtistApiService.fetchArtistFollowers(
        artistId: widget.artistId,
        search: search,
      );
      if (mounted) {
        setState(() {
          _followers = list;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  List<ArtistFollower> get _filteredFollowers {
    if (_searchQuery.trim().isEmpty) return _followers;
    final q = _searchQuery.trim().toLowerCase();
    return _followers.where((f) {
      return f.name.toLowerCase().contains(q) || f.email.toLowerCase().contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.9,
      builder: (context, scrollController) {
        return Container(
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1E1E2C) : Colors.white,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.3),
                blurRadius: 20,
                offset: const Offset(0, -4),
              ),
            ],
          ),
          child: Column(
            children: [
              // Drag handle
              Center(
                child: Container(
                  margin: const EdgeInsets.symmetric(vertical: 10),
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: isDark ? Colors.white24 : Colors.black12,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),

              // Title
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.xs,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Người quan tâm',
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                          ),
                        ),
                        Text(
                          'Khán giả theo dõi ${widget.artistName}',
                          style: TextStyle(
                            fontSize: 12,
                            color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                          ),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 20),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
              ),

              // Search bar
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.xs,
                ),
                child: Container(
                  height: 40,
                  decoration: BoxDecoration(
                    color: isDark
                        ? Colors.white.withOpacity(0.06)
                        : Colors.black.withOpacity(0.04),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: TextField(
                    controller: _searchController,
                    onChanged: (val) {
                      setState(() {
                        _searchQuery = val;
                      });
                    },
                    style: TextStyle(
                      fontSize: 13,
                      color: isDark ? AppColors.darkTextPrimary : AppColors.lightTextPrimary,
                    ),
                    decoration: InputDecoration(
                      hintText: 'Tìm người theo dõi...',
                      hintStyle: TextStyle(
                        fontSize: 13,
                        color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                      ),
                      prefixIcon: const Icon(Icons.search_rounded, size: 18),
                      suffixIcon: _searchQuery.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.close_rounded, size: 16),
                              onPressed: () {
                                _searchController.clear();
                                setState(() {
                                  _searchQuery = '';
                                });
                              },
                            )
                          : null,
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(vertical: 10),
                    ),
                  ),
                ),
              ),

              const SizedBox(height: AppSpacing.xs),

              // Followers list
              Expanded(
                child: _isLoading
                    ? const Center(
                        child: CircularProgressIndicator(color: AppColors.primary),
                      )
                    : _filteredFollowers.isEmpty
                        ? Center(
                            child: Padding(
                              padding: const EdgeInsets.all(AppSpacing.xl),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.people_outline_rounded,
                                    size: 48,
                                    color: isDark
                                        ? AppColors.darkTextSecondary
                                        : AppColors.lightTextSecondary,
                                  ),
                                  const SizedBox(height: AppSpacing.sm),
                                  Text(
                                    _searchQuery.isNotEmpty
                                        ? 'Không tìm thấy người nghe nào'
                                        : 'Chưa có người nghe nào theo dõi',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: isDark
                                          ? AppColors.darkTextPrimary
                                          : AppColors.lightTextPrimary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          )
                        : ListView.separated(
                            controller: scrollController,
                            padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.md,
                              vertical: AppSpacing.sm,
                            ),
                            itemCount: _filteredFollowers.length,
                            separatorBuilder: (_, __) => Divider(
                              height: 1,
                              indent: 56,
                              color: isDark
                                  ? Colors.white.withOpacity(0.05)
                                  : Colors.black.withOpacity(0.04),
                            ),
                            itemBuilder: (context, index) {
                              final follower = _filteredFollowers[index];
                              return ListTile(
                                contentPadding: EdgeInsets.zero,
                                leading: CircleAvatar(
                                  radius: 20,
                                  backgroundColor: AppColors.primary.withOpacity(0.15),
                                  backgroundImage: follower.avatarUrl.isNotEmpty
                                      ? NetworkImage(follower.avatarUrl)
                                      : null,
                                  child: follower.avatarUrl.isEmpty
                                      ? Text(
                                          follower.name.isNotEmpty
                                              ? follower.name[0].toUpperCase()
                                              : 'U',
                                          style: const TextStyle(
                                            fontWeight: FontWeight.bold,
                                            color: AppColors.primary,
                                          ),
                                        )
                                      : null,
                                ),
                                title: Text(
                                  follower.name.isNotEmpty ? follower.name : 'Người dùng ẩn danh',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 14,
                                  ),
                                ),
                                subtitle: Text(
                                  follower.email.isNotEmpty
                                      ? follower.email.replaceFirst(
                                          RegExp(r'(?<=..).(?=.*@)'),
                                          '***',
                                        )
                                      : 'Thính giả MusicFlow',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: isDark
                                        ? AppColors.darkTextSecondary
                                        : AppColors.lightTextSecondary,
                                  ),
                                ),
                              );
                            },
                          ),
              ),
            ],
          ),
        );
      },
    );
  }
}

import 'package:flutter/material.dart';
import '../../widgets/music_flow_backdrop.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/app_toast.dart';
import '../../../data/models/user_model.dart';
import '../../../data/services/auth_service.dart';
import '../../../data/services/play_history_service.dart';
import '../login/login_screen.dart';
import '../../../core/theme/theme_service.dart';
import 'edit_profile_screen.dart';
import '../premium/premium_screen.dart';
import '../../../core/services/app_settings_service.dart';

class SettingsScreen extends StatefulWidget {
  final VoidCallback? onLogout;

  const SettingsScreen({super.key, this.onLogout});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  User? _currentUser;
  bool _isLoggedIn = false;
  bool _isLoading = true;

  bool _highQualityStreaming = true;
  bool _downloadOverWifiOnly = true;
  bool _showLyrics = true;
  bool _autoPlay = true;

  @override
  void initState() {
    super.initState();
    AuthService.currentUserNotifier.addListener(_handleCurrentUserChanged);
    _loadUserData();
  }

  @override
  void dispose() {
    AuthService.currentUserNotifier.removeListener(_handleCurrentUserChanged);
    super.dispose();
  }

  Future<void> _loadUserData() async {
    final isLoggedIn = await AuthService.isLoggedIn();
    User? user;
    if (isLoggedIn) {
      user = await AuthService.getCurrentUser();
    }

    if (!mounted) return;

    setState(() {
      _isLoggedIn = isLoggedIn;
      _currentUser = user;
      _isLoading = false;
    });
  }

  void _handleCurrentUserChanged() {
    if (!mounted) return;

    final user = AuthService.currentUserNotifier.value;
    setState(() {
      _currentUser = user;
      _isLoggedIn = user != null;
      _isLoading = false;
    });
  }

  Future<void> _openEditProfile() async {
    if (_currentUser == null) return;

    final result = await Navigator.push<User>(
      context,
      MaterialPageRoute(builder: (_) => const EditProfileScreen()),
    );

    if (!mounted) return;

    if (result != null) {
      setState(() {
        _currentUser = result;
      });
    } else {
      await _loadUserData();
    }
  }

  Future<void> _logout() async {
    final confirm = await showDialog<bool>(

      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: AppRadius.mediumBorder),
        title: const Text('Đăng Xuất'),
        content: const Text('Bạn có chắc muốn đăng xuất khỏi tài khoản này?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Hủy'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.accentPink,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: AppRadius.smallBorder),
            ),
            child: const Text('Đăng xuất'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await AuthService.logout();
      widget.onLogout?.call();
      if (!mounted) return;
      Navigator.pop(context);
      AppToast.showInfo(context, 'Đã đăng xuất');
    }
  }

  Future<void> _clearPlayHistory() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: AppRadius.mediumBorder),
        title: const Text('Xóa lịch sử phát'),
        content: const Text('Bạn có chắc muốn xóa toàn bộ lịch sử nghe nhạc?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Hủy'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.accentPink,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: AppRadius.smallBorder),
            ),
            child: const Text('Xóa'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await PlayHistoryService.clearHistory();
      if (!mounted) return;
      AppToast.showSuccess(context, 'Đã xóa lịch sử phát');
    }
  }

  void _showAboutDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: AppRadius.mediumBorder),
        title: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.primary, AppColors.secondary],
                ),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.music_note_rounded, color: Colors.white),
            ),
            const SizedBox(width: 12),
            const Text('MusicFlow'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: const [
            Text('Phiên bản: 1.0.0'),
            SizedBox(height: 8),
            Text('Ứng dụng nghe nhạc trực tuyến đa nền tảng.'),
            SizedBox(height: 16),
            Text(
              '© 2026 MusicFlow',
              style: TextStyle(color: Colors.grey, fontSize: 12),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Đóng'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return MusicFlowBackdrop(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          leading: IconButton(
            icon: Icon(
              Icons.arrow_back_ios_new_rounded,
              color: isDark ? Colors.white : AppColors.lightTextPrimary,
              size: 20,
            ),
            onPressed: () => Navigator.pop(context),
          ),
          title: Text(
            'Cài đặt',
            style: theme.textTheme.titleLarge?.copyWith(fontSize: 18),
          ),
        ),
        body: _isLoading
            ? const Center(
                child: CircularProgressIndicator(color: AppColors.primary),
              )
            : ListView(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                children: [
                  _buildSectionHeader('Tài khoản'),
                  if (_isLoggedIn && _currentUser != null) ...[
                    _buildAccountCard(),
                    const SizedBox(height: 12),
                    _buildPremiumBannerCard(),
                  ] else ...[
                    _buildLoginPrompt(),
                    const SizedBox(height: 12),
                    _buildPremiumBannerCard(),
                  ],
                  const SizedBox(height: AppSpacing.md),

                  _buildSectionHeader('Phát nhạc'),
                  _buildGroupContainer(
                    children: [
                      _buildSwitchTile(
                        icon: Icons.high_quality_rounded,
                        title: 'Chất lượng cao',
                        subtitle: 'Phát nhạc ở chất lượng cao nhất',
                        value: _highQualityStreaming,
                        onChanged: (value) =>
                            setState(() => _highQualityStreaming = value),
                      ),
                      const Divider(height: 1, indent: 56),
                      _buildSwitchTile(
                        icon: Icons.lyrics_rounded,
                        title: 'Hiển thị lời bài hát',
                        subtitle: 'Hiển thị lời khi phát nhạc',
                        value: _showLyrics,
                        onChanged: (value) => setState(() => _showLyrics = value),
                      ),
                      const Divider(height: 1, indent: 56),
                      _buildSwitchTile(
                        icon: Icons.play_circle_outline_rounded,
                        title: 'Tự động phát',
                        subtitle: 'Tự động phát bài hát tiếp theo',
                        value: _autoPlay,
                        onChanged: (value) => setState(() => _autoPlay = value),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),

                  _buildSectionHeader('Trợ lý AI'),
                  _buildGroupContainer(
                    children: [
                      AnimatedBuilder(
                        animation: AppSettingsService(),
                        builder: (context, _) {
                          return _buildSwitchTile(
                            icon: Icons.auto_awesome_rounded,
                            title: 'Nút Trợ lý AI nổi',
                            subtitle: 'Hiển thị nút trợ lý AI nổi trên các màn hình',
                            value: AppSettingsService().isFloatingAiEnabled,
                            onChanged: (val) {
                              AppSettingsService().setFloatingAiEnabled(val);
                            },
                          );
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),

                  _buildSectionHeader('Tải xuống'),
                  _buildGroupContainer(
                    children: [
                      _buildSwitchTile(
                        icon: Icons.wifi_rounded,
                        title: 'Chỉ tải qua Wi-Fi',
                        subtitle: 'Tải nhạc chỉ khi có kết nối Wi-Fi',
                        value: _downloadOverWifiOnly,
                        onChanged: (value) =>
                            setState(() => _downloadOverWifiOnly = value),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),

                  _buildSectionHeader('Bộ nhớ'),
                  _buildGroupContainer(
                    children: [
                      _buildActionTile(
                        icon: Icons.history_rounded,
                        title: 'Xóa lịch sử phát',
                        subtitle: 'Xóa toàn bộ lịch sử nghe nhạc',
                        onTap: _clearPlayHistory,
                      ),
                      const Divider(height: 1, indent: 56),
                      _buildActionTile(
                        icon: Icons.cleaning_services_rounded,
                        title: 'Xóa bộ nhớ cache',
                        subtitle: 'Giải phóng bộ nhớ tạm trên máy',
                        onTap: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Đã xóa cache thành công')),
                          );
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),

                  _buildSectionHeader('Giao diện'),
                  _buildGroupContainer(
                    children: [
                      _buildSwitchTile(
                        icon: Icons.dark_mode_outlined,
                        title: 'Chế độ tối',
                        subtitle: 'Sử dụng giao diện màu tối cho ứng dụng',
                        value: ThemeService().isDarkMode,
                        onChanged: (value) {
                          ThemeService().toggleTheme(value);
                          setState(() {});
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),

                  _buildSectionHeader('Khác'),
                  _buildGroupContainer(
                    children: [
                      _buildActionTile(
                        icon: Icons.info_outline_rounded,
                        title: 'Về ứng dụng',
                        subtitle: 'Phiên bản 1.0.0',
                        onTap: _showAboutDialog,
                      ),
                      const Divider(height: 1, indent: 56),
                      _buildActionTile(
                        icon: Icons.privacy_tip_outlined,
                        title: 'Chính sách bảo mật',
                        onTap: () {},
                      ),
                      const Divider(height: 1, indent: 56),
                      _buildActionTile(
                        icon: Icons.description_outlined,
                        title: 'Điều khoản sử dụng',
                        onTap: () {},
                      ),
                    ],
                  ),

                  if (_isLoggedIn) ...[
                    const SizedBox(height: 32),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: ElevatedButton.icon(
                        onPressed: _logout,
                        icon: const Icon(Icons.logout_rounded, color: Colors.white),
                        label: const Text('Đăng xuất tài khoản', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.accentPink.withOpacity(0.18),
                          foregroundColor: AppColors.accentPink,
                          minimumSize: const Size(double.infinity, 50),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: const BorderSide(color: AppColors.accentPink, width: 1),
                          ),
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 48),
                ],
              ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.fromLTRB(6, 12, 6, 8),
      child: Text(
        title,
        style: TextStyle(
          color: isDark ? AppColors.darkTextSecondary.withOpacity(0.8) : AppColors.lightTextSecondary.withOpacity(0.8),
          fontSize: 13,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildGroupContainer({required List<Widget> children}) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurfaceGlass : AppColors.lightSurfaceGlass,
        borderRadius: AppRadius.mediumBorder,
        border: Border.all(color: isDark ? AppColors.darkBorderGlass : AppColors.lightBorderGlass),
      ),
      child: Column(
        children: children,
      ),
    );
  }

  Widget _buildAccountCard() {
    final hasAvatar = _currentUser?.avatar.trim().isNotEmpty == true;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isPremium = _currentUser?.hasActivePremium == true;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurfaceGlass : AppColors.lightSurfaceGlass,
        borderRadius: AppRadius.mediumBorder,
        border: Border.all(
          color: isPremium
              ? const Color(0xFFF59E0B).withOpacity(0.4)
              : (isDark ? AppColors.darkBorderGlass : AppColors.lightBorderGlass),
        ),
      ),
      child: Row(
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: AppColors.primary,
                backgroundImage: hasAvatar
                    ? NetworkImage(_currentUser!.avatar)
                    : null,
                child: !hasAvatar
                    ? Text(
                        _currentUser?.name.substring(0, 1).toUpperCase() ?? 'U',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      )
                    : null,
              ),
              if (isPremium)
                Positioned(
                  right: -4,
                  bottom: -4,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: const BoxDecoration(
                      color: Color(0xFFF59E0B),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.workspace_premium_rounded,
                      size: 14,
                      color: Color(0xFF090D1A),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        _currentUser?.name ?? 'Người dùng',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: isDark ? Colors.white : AppColors.lightTextPrimary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (isPremium) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFFF59E0B), Color(0xFFFFD700)],
                          ),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          _currentUser!.planBadge,
                          style: const TextStyle(
                            color: Color(0xFF090D1A),
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  _currentUser?.email ?? '',
                  style: TextStyle(
                    color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.edit_rounded, color: AppColors.primary),
            onPressed: _openEditProfile,
          ),
        ],
      ),
    );
  }

  Widget _buildPremiumBannerCard() {
    final isPremium = _currentUser?.hasActivePremium == true;

    return InkWell(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const PremiumScreen()),
        );
      },
      borderRadius: BorderRadius.circular(18),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isPremium
                ? [
                    const Color(0xFF2E1C0A),
                    const Color(0xFF1E1308),
                  ]
                : [
                    const Color(0xFF251849),
                    const Color(0xFF160E30),
                  ],
          ),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: isPremium
                ? const Color(0xFFF59E0B).withOpacity(0.5)
                : const Color(0xFF6C63FF).withOpacity(0.4),
            width: 1.2,
          ),
          boxShadow: [
            BoxShadow(
              color: isPremium
                  ? const Color(0xFFF59E0B).withOpacity(0.12)
                  : const Color(0xFF6C63FF).withOpacity(0.12),
              blurRadius: 16,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                gradient: isPremium
                    ? const LinearGradient(
                        colors: [Color(0xFFF59E0B), Color(0xFFFFD700)],
                      )
                    : const LinearGradient(
                        colors: [Color(0xFF6C63FF), Color(0xFF00E5FF)],
                      ),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                Icons.workspace_premium_rounded,
                color: isPremium ? const Color(0xFF090D1A) : Colors.white,
                size: 24,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        isPremium ? 'Gói MusicFlow Premium' : 'Nâng cấp MusicFlow Premium',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    isPremium
                        ? 'Đang hoạt động · Quản lý hoặc đổi gói cước'
                        : 'Mở khóa âm thanh 320k, AI DJ 24/7 & Tải 1GB',
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.arrow_forward_ios_rounded,
              color: Colors.white54,
              size: 14,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLoginPrompt() {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurfaceGlass : AppColors.lightSurfaceGlass,
        borderRadius: AppRadius.mediumBorder,
        border: Border.all(color: isDark ? AppColors.darkBorderGlass : AppColors.lightBorderGlass),
      ),
      child: Column(
        children: [
          Icon(
            Icons.account_circle_outlined,
            size: 44,
            color: isDark ? AppColors.darkTextSecondary.withOpacity(0.5) : AppColors.lightTextSecondary.withOpacity(0.5),
          ),
          const SizedBox(height: 12),
          Text(
            'Đăng nhập để sử dụng đầy đủ các tính năng',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: isDark ? Colors.white : AppColors.lightTextPrimary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(
            'Playlist và thư viện cá nhân sẽ được đồng bộ',
            style: TextStyle(color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary, fontSize: 12),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const LoginScreen()),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
            ),
            child: const Text('Đăng nhập ngay'),
          ),
        ],
      ),
    );
  }

  Widget _buildSwitchTile({
    required IconData icon,
    required String title,
    String? subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return ListTile(
      leading: Icon(icon, color: AppColors.primary, size: 22),
      title: Text(title, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: isDark ? Colors.white : AppColors.lightTextPrimary)),
      subtitle: subtitle != null
          ? Text(
              subtitle,
              style: TextStyle(color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary, fontSize: 11),
            )
          : null,
      trailing: Switch(
        value: value,
        onChanged: onChanged,
        activeColor: AppColors.secondary,
      ),
    );
  }

  Widget _buildActionTile({
    required IconData icon,
    required String title,
    String? subtitle,
    required VoidCallback onTap,
    Color? textColor,
  }) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return ListTile(
      leading: Icon(icon, color: AppColors.primary, size: 22),
      title: Text(
        title,
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: textColor ?? (isDark ? Colors.white : AppColors.lightTextPrimary),
        ),
      ),
      subtitle: subtitle != null
          ? Text(
              subtitle,
              style: TextStyle(color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary, fontSize: 11),
            )
          : null,
      trailing: Icon(Icons.chevron_right_rounded, color: isDark ? AppColors.darkTextSecondary.withOpacity(0.5) : AppColors.lightTextSecondary.withOpacity(0.5), size: 20),
      onTap: onTap,
    );
  }
}

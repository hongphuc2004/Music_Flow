import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/user_model.dart';
import 'package:musicflow_app/data/services/auth_service.dart';
import 'package:musicflow_app/data/services/play_history_service.dart';
import 'package:musicflow_app/presentation/screens/login/login_screen.dart';
import 'package:musicflow_app/core/theme/theme_service.dart';

import 'edit_profile_screen.dart';

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
        backgroundColor: const Color(0xFF1E1E1E),
        title: const Text('Đăng Xuất', style: TextStyle(color: Colors.white)),
        content: Text(
          'Bạn có chắc muốn đăng xuất?',
          style: TextStyle(color: Colors.grey[400]),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Hủy', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text(
              'Đăng xuất',
              style: TextStyle(color: Colors.redAccent),
            ),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await AuthService.logout();
      widget.onLogout?.call();
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Đã đăng xuất')));
    }
  }

  Future<void> _clearPlayHistory() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: const Text(
          'Xóa lịch sử phát',
          style: TextStyle(color: Colors.white),
        ),
        content: Text(
          'Bạn có chắc muốn xóa toàn bộ lịch sử phát nhạc?',
          style: TextStyle(color: Colors.grey[400]),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Hủy', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Xóa', style: TextStyle(color: Colors.redAccent)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await PlayHistoryService.clearHistory();
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Đã xóa lịch sử phát')));
    }
  }

  void _showAboutDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Colors.greenAccent, Colors.tealAccent],
                ),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.music_note, color: Colors.black),
            ),
            const SizedBox(width: 12),
            const Text('MusicFlow', style: TextStyle(color: Colors.white)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Phien ban: 1.0.0', style: TextStyle(color: Colors.grey[400])),
            const SizedBox(height: 8),
            Text(
              'Ung dung nghe nhac truc tuyen',
              style: TextStyle(color: Colors.grey[400]),
            ),
            const SizedBox(height: 16),
            Text(
              '© 2024 MusicFlow',
              style: TextStyle(color: Colors.grey[600], fontSize: 12),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text(
              'Dong',
              style: TextStyle(color: Colors.greenAccent),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: theme.appBarTheme.backgroundColor,
        foregroundColor: theme.appBarTheme.foregroundColor,
        title: const Text('Cài đặt'),
        elevation: 0,
      ),
      body: _isLoading
          ? Center(
              child: CircularProgressIndicator(color: theme.colorScheme.primary),
            )
          : ListView(
              children: [
                _buildSectionHeader('Tài khoản'),
                if (_isLoggedIn && _currentUser != null)
                  _buildAccountCard()
                else
                  _buildLoginPrompt(),
                const SizedBox(height: 16),
                _buildSectionHeader('Phát nhạc'),
                _buildSwitchTile(
                  icon: Icons.high_quality,
                  title: 'Chất lượng cao',
                  subtitle: 'Phát nhạc ở chất lượng cao nhất',
                  value: _highQualityStreaming,
                  onChanged: (value) =>
                      setState(() => _highQualityStreaming = value),
                ),
                _buildSwitchTile(
                  icon: Icons.lyrics,
                  title: 'Hiển thị lời bài hát',
                  subtitle: 'Hiển thị lời khi phát nhạc',
                  value: _showLyrics,
                  onChanged: (value) => setState(() => _showLyrics = value),
                ),
                _buildSwitchTile(
                  icon: Icons.play_circle_outline,
                  title: 'Tự động phát',
                  subtitle: 'Tự động phát bài hát tiếp theo',
                  value: _autoPlay,
                  onChanged: (value) => setState(() => _autoPlay = value),
                ),
                const SizedBox(height: 16),
                _buildSectionHeader('Tải xuống'),
                _buildSwitchTile(
                  icon: Icons.wifi,
                  title: 'Chỉ tải qua Wi-Fi',
                  subtitle: 'Tải nhạc chỉ khi có Wi-Fi',
                  value: _downloadOverWifiOnly,
                  onChanged: (value) =>
                      setState(() => _downloadOverWifiOnly = value),
                ),
                const SizedBox(height: 16),
                _buildSectionHeader('Bộ nhớ'),
                _buildActionTile(
                  icon: Icons.history,
                  title: 'Xóa lịch sử phát',
                  subtitle: 'Xóa toàn bộ lịch sử nghe nhạc',
                  onTap: _clearPlayHistory,
                ),
                _buildActionTile(
                  icon: Icons.cached,
                  title: 'Xóa bộ nhớ cache',
                  subtitle: 'Giải phóng dung lượng',
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Đã xóa cache')),
                    );
                  },
                ),
                const SizedBox(height: 16),
                _buildSectionHeader('Giao diện'),
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
                const SizedBox(height: 16),
                _buildSectionHeader('Khác'),
                _buildActionTile(
                  icon: Icons.info_outline,
                  title: 'Về ứng dụng',
                  subtitle: 'Phiên bản 1.0.0',
                  onTap: _showAboutDialog,
                ),
                _buildActionTile(
                  icon: Icons.privacy_tip_outlined,
                  title: 'Chính sách bảo mật',
                  onTap: () {},
                ),
                _buildActionTile(
                  icon: Icons.description_outlined,
                  title: 'Điều khoản sử dụng',
                  onTap: () {},
                ),
                if (_isLoggedIn) ...[
                  const SizedBox(height: 24),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: ElevatedButton.icon(
                      onPressed: _logout,
                      icon: const Icon(Icons.logout),
                      label: const Text('Đăng xuất'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.red.withOpacity(0.2),
                        foregroundColor: Colors.redAccent,
                        minimumSize: const Size(double.infinity, 50),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 100),
              ],
            ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Text(
        title,
        style: TextStyle(
          color: Colors.grey[500],
          fontSize: 13,
          fontWeight: FontWeight.w600,
          letterSpacing: 1,
        ),
      ),
    );
  }

  Widget _buildAccountCard() {
    final hasAvatar = _currentUser?.avatar.trim().isNotEmpty == true;
    final primaryColor = Theme.of(context).colorScheme.primary;
    final secondaryColor = Theme.of(context).colorScheme.secondary;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            primaryColor.withOpacity(0.18),
            secondaryColor.withOpacity(0.08),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: primaryColor.withOpacity(0.25)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 30,
            backgroundColor: primaryColor,
            backgroundImage: hasAvatar
                ? NetworkImage(_currentUser!.avatar)
                : null,
            child: !hasAvatar
                ? Text(
                    _currentUser?.name.substring(0, 1).toUpperCase() ?? 'U',
                    style: TextStyle(
                      color: Theme.of(context).brightness == Brightness.dark ? Colors.black : Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  )
                : null,
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _currentUser?.name ?? 'Người dùng',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _currentUser?.email ?? '',
                  style: TextStyle(color: Theme.of(context).textTheme.bodySmall?.color, fontSize: 14),
                ),
              ],
            ),
          ),
          IconButton(
            icon: Icon(Icons.edit, color: Theme.of(context).colorScheme.primary),
            onPressed: _openEditProfile,
          ),
        ],
      ),
    );
  }

  Widget _buildLoginPrompt() {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF161922) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? const Color(0xFF262C3A) : Colors.grey[200]!),
      ),
      child: Column(
        children: [
          Icon(
            Icons.account_circle_outlined,
            size: 48,
            color: theme.disabledColor,
          ),
          const SizedBox(height: 12),
          Text(
            'Đăng nhập để sử dụng các tính năng của MusicFlow',
            style: TextStyle(fontSize: 16, color: theme.textTheme.titleMedium?.color),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'Playlist và yêu thích sẽ được lưu trữ an toàn',
            style: TextStyle(color: theme.textTheme.bodySmall?.color, fontSize: 13),
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
              backgroundColor: theme.colorScheme.primary,
              foregroundColor: isDark ? Colors.black : Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
            ),
            child: const Text('Đăng nhập'),
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
    return ListTile(
      leading: Icon(icon, color: theme.colorScheme.primary),
      title: Text(title),
      subtitle: subtitle != null
          ? Text(
              subtitle,
              style: TextStyle(color: theme.textTheme.bodySmall?.color, fontSize: 12),
            )
          : null,
      trailing: Switch(
        value: value,
        onChanged: onChanged,
        activeColor: theme.colorScheme.primary,
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
    return ListTile(
      leading: Icon(icon, color: theme.colorScheme.primary),
      title: Text(title, style: textColor != null ? TextStyle(color: textColor) : null),
      subtitle: subtitle != null
          ? Text(
              subtitle,
              style: TextStyle(color: theme.textTheme.bodySmall?.color, fontSize: 12),
            )
          : null,
      trailing: Icon(Icons.chevron_right, color: theme.disabledColor),
      onTap: onTap,
    );
  }
}

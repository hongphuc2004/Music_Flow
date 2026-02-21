import 'package:flutter/material.dart';
import 'package:musicflow_app/data/services/auth_service.dart';
import 'package:musicflow_app/data/services/play_history_service.dart';
import 'package:musicflow_app/data/models/user_model.dart';
import 'package:musicflow_app/presentation/screens/login/login_screen.dart';

class SettingsScreen extends StatefulWidget {
  final VoidCallback? onLogout;

  const SettingsScreen({
    super.key,
    this.onLogout,
  });

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  User? _currentUser;
  bool _isLoggedIn = false;
  bool _isLoading = true;

  // Settings states
  bool _highQualityStreaming = true;
  bool _downloadOverWifiOnly = true;
  bool _showLyrics = true;
  bool _autoPlay = true;

  @override
  void initState() {
    super.initState();
    _loadUserData();
  }

  Future<void> _loadUserData() async {
    final isLoggedIn = await AuthService.isLoggedIn();
    User? user;
    if (isLoggedIn) {
      user = await AuthService.getCurrentUser();
    }
    
    if (mounted) {
      setState(() {
        _isLoggedIn = isLoggedIn;
        _currentUser = user;
        _isLoading = false;
      });
    }
  }

  Future<void> _logout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: const Text('Đăng xuất', style: TextStyle(color: Colors.white)),
        content: Text(
          'Bạn có chắc muốn đăng xuất khỏi tài khoản?',
          style: TextStyle(color: Colors.grey[400]),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Hủy', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Đăng xuất', style: TextStyle(color: Colors.redAccent)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await AuthService.logout();
      widget.onLogout?.call();
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã đăng xuất')),
        );
      }
    }
  }

  Future<void> _clearPlayHistory() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: const Text('Xóa lịch sử phát', style: TextStyle(color: Colors.white)),
        content: Text(
          'Xóa toàn bộ lịch sử phát nhạc?',
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
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã xóa lịch sử phát')),
        );
      }
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
            Text('Phiên bản: 1.0.0', style: TextStyle(color: Colors.grey[400])),
            const SizedBox(height: 8),
            Text(
              'Ứng dụng nghe nhạc trực tuyến',
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
            child: const Text('Đóng', style: TextStyle(color: Colors.greenAccent)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        title: const Text('Cài đặt'),
        elevation: 0,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Colors.greenAccent))
          : ListView(
              children: [
                // Account Section
                _buildSectionHeader('Tài khoản'),
                if (_isLoggedIn && _currentUser != null)
                  _buildAccountCard()
                else
                  _buildLoginPrompt(),

                const SizedBox(height: 16),

                // Playback Section
                _buildSectionHeader('Phát nhạc'),
                _buildSwitchTile(
                  icon: Icons.high_quality,
                  title: 'Chất lượng cao',
                  subtitle: 'Phát nhạc ở chất lượng cao nhất',
                  value: _highQualityStreaming,
                  onChanged: (value) {
                    setState(() => _highQualityStreaming = value);
                  },
                ),
                _buildSwitchTile(
                  icon: Icons.lyrics,
                  title: 'Hiển thị lời bài hát',
                  subtitle: 'Hiển thị lời khi phát nhạc',
                  value: _showLyrics,
                  onChanged: (value) {
                    setState(() => _showLyrics = value);
                  },
                ),
                _buildSwitchTile(
                  icon: Icons.play_circle_outline,
                  title: 'Tự động phát',
                  subtitle: 'Tự động phát bài hát tiếp theo',
                  value: _autoPlay,
                  onChanged: (value) {
                    setState(() => _autoPlay = value);
                  },
                ),

                const SizedBox(height: 16),

                // Download Section
                _buildSectionHeader('Tải xuống'),
                _buildSwitchTile(
                  icon: Icons.wifi,
                  title: 'Chỉ tải qua Wi-Fi',
                  subtitle: 'Tải nhạc chỉ khi có Wi-Fi',
                  value: _downloadOverWifiOnly,
                  onChanged: (value) {
                    setState(() => _downloadOverWifiOnly = value);
                  },
                ),

                const SizedBox(height: 16),

                // Storage Section
                _buildSectionHeader('Bộ nhớ'),
                _buildActionTile(
                  icon: Icons.history,
                  title: 'Xóa lịch sử phát',
                  subtitle: 'Xóa toàn bộ lịch sử nghe nhạc',
                  onTap: _clearPlayHistory,
                  textColor: Colors.white,
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
                  textColor: Colors.white,
                ),

                const SizedBox(height: 16),

                // About Section
                _buildSectionHeader('Khác'),
                _buildActionTile(
                  icon: Icons.info_outline,
                  title: 'Về ứng dụng',
                  subtitle: 'Phiên bản 1.0.0',
                  onTap: _showAboutDialog,
                  textColor: Colors.white,
                ),
                _buildActionTile(
                  icon: Icons.privacy_tip_outlined,
                  title: 'Chính sách bảo mật',
                  onTap: () {
                    // TODO: Open privacy policy
                  },
                  textColor: Colors.white,
                ),
                _buildActionTile(
                  icon: Icons.description_outlined,
                  title: 'Điều khoản sử dụng',
                  onTap: () {
                    // TODO: Open terms of service
                  },
                  textColor: Colors.white,
                ),

                // Logout button
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
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Colors.greenAccent.withOpacity(0.2),
            Colors.tealAccent.withOpacity(0.1),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.greenAccent.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 30,
            backgroundColor: Colors.greenAccent,
            child: Text(
              _currentUser?.name.substring(0, 1).toUpperCase() ?? 'U',
              style: const TextStyle(
                color: Colors.black,
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _currentUser?.name ?? 'Người dùng',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _currentUser?.email ?? '',
                  style: TextStyle(
                    color: Colors.grey[400],
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.edit, color: Colors.greenAccent),
            onPressed: () {
              // TODO: Edit profile
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Tính năng đang phát triển')),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildLoginPrompt() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.grey[900],
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Icon(Icons.account_circle_outlined, size: 48, color: Colors.grey[600]),
          const SizedBox(height: 12),
          const Text(
            'Đăng nhập để đồng bộ dữ liệu',
            style: TextStyle(color: Colors.white, fontSize: 16),
          ),
          const SizedBox(height: 8),
          Text(
            'Playlist, yêu thích sẽ được lưu trữ an toàn',
            style: TextStyle(color: Colors.grey[500], fontSize: 13),
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
              backgroundColor: Colors.greenAccent,
              foregroundColor: Colors.black,
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
    return ListTile(
      leading: Icon(icon, color: Colors.greenAccent),
      title: Text(title, style: const TextStyle(color: Colors.white)),
      subtitle: subtitle != null
          ? Text(subtitle, style: TextStyle(color: Colors.grey[500], fontSize: 12))
          : null,
      trailing: Switch(
        value: value,
        onChanged: onChanged,
        activeColor: Colors.greenAccent,
      ),
    );
  }

  Widget _buildActionTile({
    required IconData icon,
    required String title,
    String? subtitle,
    required VoidCallback onTap,
    Color textColor = Colors.white,
  }) {
    return ListTile(
      leading: Icon(icon, color: Colors.greenAccent),
      title: Text(title, style: TextStyle(color: textColor)),
      subtitle: subtitle != null
          ? Text(subtitle, style: TextStyle(color: Colors.grey[500], fontSize: 12))
          : null,
      trailing: Icon(Icons.chevron_right, color: Colors.grey[600]),
      onTap: onTap,
    );
  }
}

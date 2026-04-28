import 'package:flutter/material.dart';
import 'package:musicflow_app/data/models/user_model.dart';
import 'package:musicflow_app/data/services/auth_service.dart';
import 'package:musicflow_app/data/services/play_history_service.dart';
import 'package:musicflow_app/presentation/screens/login/login_screen.dart';

import 'edit_profile_screen.dart';

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
        title: const Text('Dang xuat', style: TextStyle(color: Colors.white)),
        content: Text(
          'Ban co chac muon dang xuat khoi tai khoan?',
          style: TextStyle(color: Colors.grey[400]),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Huy', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Dang xuat', style: TextStyle(color: Colors.redAccent)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await AuthService.logout();
      widget.onLogout?.call();
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Da dang xuat')),
      );
    }
  }

  Future<void> _clearPlayHistory() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: const Text('Xoa lich su phat', style: TextStyle(color: Colors.white)),
        content: Text(
          'Xoa toan bo lich su phat nhac?',
          style: TextStyle(color: Colors.grey[400]),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Huy', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Xoa', style: TextStyle(color: Colors.redAccent)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await PlayHistoryService.clearHistory();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Da xoa lich su phat')),
      );
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
            child: const Text('Dong', style: TextStyle(color: Colors.greenAccent)),
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
        title: const Text('Cai dat'),
        elevation: 0,
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: Colors.greenAccent),
            )
          : ListView(
              children: [
                _buildSectionHeader('Tai khoan'),
                if (_isLoggedIn && _currentUser != null)
                  _buildAccountCard()
                else
                  _buildLoginPrompt(),
                const SizedBox(height: 16),
                _buildSectionHeader('Phat nhac'),
                _buildSwitchTile(
                  icon: Icons.high_quality,
                  title: 'Chat luong cao',
                  subtitle: 'Phat nhac o chat luong cao nhat',
                  value: _highQualityStreaming,
                  onChanged: (value) => setState(() => _highQualityStreaming = value),
                ),
                _buildSwitchTile(
                  icon: Icons.lyrics,
                  title: 'Hien thi loi bai hat',
                  subtitle: 'Hien thi loi khi phat nhac',
                  value: _showLyrics,
                  onChanged: (value) => setState(() => _showLyrics = value),
                ),
                _buildSwitchTile(
                  icon: Icons.play_circle_outline,
                  title: 'Tu dong phat',
                  subtitle: 'Tu dong phat bai hat tiep theo',
                  value: _autoPlay,
                  onChanged: (value) => setState(() => _autoPlay = value),
                ),
                const SizedBox(height: 16),
                _buildSectionHeader('Tai xuong'),
                _buildSwitchTile(
                  icon: Icons.wifi,
                  title: 'Chi tai qua Wi-Fi',
                  subtitle: 'Tai nhac chi khi co Wi-Fi',
                  value: _downloadOverWifiOnly,
                  onChanged: (value) => setState(() => _downloadOverWifiOnly = value),
                ),
                const SizedBox(height: 16),
                _buildSectionHeader('Bo nho'),
                _buildActionTile(
                  icon: Icons.history,
                  title: 'Xoa lich su phat',
                  subtitle: 'Xoa toan bo lich su nghe nhac',
                  onTap: _clearPlayHistory,
                ),
                _buildActionTile(
                  icon: Icons.cached,
                  title: 'Xoa bo nho cache',
                  subtitle: 'Giai phong dung luong',
                  onTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Da xoa cache')),
                    );
                  },
                ),
                const SizedBox(height: 16),
                _buildSectionHeader('Khac'),
                _buildActionTile(
                  icon: Icons.info_outline,
                  title: 'Ve ung dung',
                  subtitle: 'Phien ban 1.0.0',
                  onTap: _showAboutDialog,
                ),
                _buildActionTile(
                  icon: Icons.privacy_tip_outlined,
                  title: 'Chinh sach bao mat',
                  onTap: () {},
                ),
                _buildActionTile(
                  icon: Icons.description_outlined,
                  title: 'Dieu khoan su dung',
                  onTap: () {},
                ),
                if (_isLoggedIn) ...[
                  const SizedBox(height: 24),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: ElevatedButton.icon(
                      onPressed: _logout,
                      icon: const Icon(Icons.logout),
                      label: const Text('Dang xuat'),
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
            backgroundImage: hasAvatar ? NetworkImage(_currentUser!.avatar) : null,
            child: !hasAvatar
                ? Text(
                    _currentUser?.name.substring(0, 1).toUpperCase() ?? 'U',
                    style: const TextStyle(
                      color: Colors.black,
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
                  _currentUser?.name ?? 'Nguoi dung',
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
            onPressed: _openEditProfile,
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
            'Dang nhap de dong bo du lieu',
            style: TextStyle(color: Colors.white, fontSize: 16),
          ),
          const SizedBox(height: 8),
          Text(
            'Playlist va yeu thich se duoc luu tru an toan',
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
            child: const Text('Dang nhap'),
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
        activeThumbColor: Colors.greenAccent,
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

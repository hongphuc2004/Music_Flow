import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import '../../widgets/music_flow_backdrop.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/config/api_config.dart';
import '../../../data/models/user_model.dart';
import '../../../data/services/auth_service.dart';

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final ImagePicker _imagePicker = ImagePicker();

  User? _user;
  File? _selectedAvatarFile;
  bool _isLoading = true;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final token = await AuthService.getToken();
      if (token == null || token.isEmpty) {
        throw Exception('Bạn chưa đăng nhập');
      }

      final response = await http.get(
        Uri.parse(ApiConfig.usersMeEndpoint),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode != 200) {
        throw Exception('Không thể tải thông tin cá nhân');
      }

      final decoded = jsonDecode(response.body);
      final userJson = decoded is Map<String, dynamic>
          ? (decoded['user'] ?? decoded)
          : null;

      if (userJson is! Map<String, dynamic>) {
        throw Exception('Dữ liệu người dùng không hợp lệ');
      }

      final user = User.fromJson(userJson);
      _applyUser(user);
    } catch (_) {
      final localUser = await AuthService.getCurrentUser();
      if (localUser != null) {
        _applyUser(localUser);
      } else {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Không thể tải thông tin người dùng')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  void _applyUser(User user) {
    _user = user;
    _nameController.text = user.name;
    _emailController.text = user.email;
  }

  Future<void> _pickAvatar() async {
    try {
      final image = await _imagePicker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 500,
        maxHeight: 500,
        imageQuality: 80,
      );

      if (image != null) {
        setState(() {
          _selectedAvatarFile = File(image.path);
        });
      }
    } catch (_) {}
  }

  Future<void> _saveProfile() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tên hiển thị không được để trống')),
      );
      return;
    }

    setState(() {
      _isSaving = true;
    });

    final token = await AuthService.getToken();
    if (token == null || token.isEmpty) {
      setState(() => _isSaving = false);
      return;
    }

    try {
      final request = http.MultipartRequest(
        'PUT',
        Uri.parse(ApiConfig.usersUpdateEndpoint),
      );

      request.headers['Authorization'] = 'Bearer $token';
      request.fields['name'] = name;

      if (_selectedAvatarFile != null) {
        request.files.add(
          await http.MultipartFile.fromPath(
            'avatar',
            _selectedAvatarFile!.path,
          ),
        );
      }

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);

      final decoded = _tryDecodeJson(response.body);

      if (response.statusCode == 200 &&
          decoded is Map<String, dynamic> &&
          decoded['success'] == true) {
        final userJson = decoded['user'] ?? decoded['data'];
        if (userJson is Map<String, dynamic>) {
          final updatedUser = User.fromJson(userJson);
          await AuthService.updateStoredUser(updatedUser);

          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Cập nhật thông tin thành công')),
          );
          Navigator.pop(context, updatedUser);
          return;
        }
      }

      final errorMsg = _buildUpdateErrorMessage(
        statusCode: response.statusCode,
        decoded: decoded,
        rawBody: response.body,
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(errorMsg),
          duration: const Duration(seconds: 4),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Lỗi kết nối: $e')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSaving = false;
        });
      }
    }
  }

  dynamic _tryDecodeJson(String body) {
    try {
      return jsonDecode(body);
    } catch (_) {
      return null;
    }
  }

  String _buildUpdateErrorMessage({
    required int statusCode,
    required dynamic decoded,
    required String rawBody,
  }) {
    if (decoded is Map<String, dynamic>) {
      final message = decoded['message']?.toString().trim();
      if (message != null && message.isNotEmpty) {
        return message;
      }
    }
    return 'Cập nhật thất bại (HTTP $statusCode)';
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
            'Cập nhật thông tin cá nhân',
            style: theme.textTheme.titleLarge?.copyWith(fontSize: 18),
          ),
        ),
        body: _isLoading
            ? const Center(
                child: CircularProgressIndicator(color: AppColors.primary),
              )
            : SingleChildScrollView(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  children: [
                    _ProfileCard(
                      child: Column(
                        children: [
                          _AvatarPicker(
                            avatarUrl: _user?.avatar ?? '',
                            selectedFile: _selectedAvatarFile,
                            onPick: _pickAvatar,
                          ),
                          const SizedBox(height: 28),
                          _ProfileInputField(
                            controller: _nameController,
                            label: 'Tên hiển thị',
                            textInputAction: TextInputAction.next,
                          ),
                          const SizedBox(height: AppSpacing.md),
                          _ProfileInputField(
                            controller: _emailController,
                            label: 'Địa chỉ Email',
                            readOnly: true,
                            keyboardType: TextInputType.emailAddress,
                          ),
                          const SizedBox(height: 32),
                          _SaveProfileButton(
                            isLoading: _isSaving,
                            onTap: _isSaving ? null : _saveProfile,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}

class AnimatedAvatarRing extends StatefulWidget {
  final Widget child;
  const AnimatedAvatarRing({super.key, required this.child});

  @override
  State<AnimatedAvatarRing> createState() => _AnimatedAvatarRingState();
}

class _AnimatedAvatarRingState extends State<AnimatedAvatarRing> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 5),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Container(
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: SweepGradient(
              transform: GradientRotation(_controller.value * 2 * 3.14159),
              colors: const [
                AppColors.primary,
                AppColors.secondary,
                AppColors.accentPink,
                AppColors.primary,
              ],
            ),
          ),
          child: child,
        );
      },
      child: widget.child,
    );
  }
}

class _ProfileCard extends StatelessWidget {
  final Widget child;

  const _ProfileCard({required this.child});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurfaceGlass : AppColors.lightSurfaceGlass,
        borderRadius: AppRadius.mediumBorder,
        border: Border.all(color: isDark ? AppColors.darkBorderGlass : AppColors.lightBorderGlass),
        boxShadow: isDark
            ? [
                BoxShadow(
                  color: AppColors.primary.withOpacity(0.04),
                  blurRadius: 18,
                  offset: const Offset(0, 8),
                ),
              ]
            : [
                BoxShadow(
                  color: Colors.black.withOpacity(0.02),
                  blurRadius: 12,
                  offset: const Offset(0, 8),
                ),
              ],
      ),
      child: child,
    );
  }
}

class _AvatarPicker extends StatelessWidget {
  final String avatarUrl;
  final File? selectedFile;
  final VoidCallback onPick;

  const _AvatarPicker({
    required this.avatarUrl,
    required this.selectedFile,
    required this.onPick,
  });

  @override
  Widget build(BuildContext context) {
    final hasSelectedFile = selectedFile != null;
    final hasRemoteAvatar = avatarUrl.trim().isNotEmpty;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Column(
      children: [
        Stack(
          children: [
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: onPick,
                borderRadius: BorderRadius.circular(999),
                child: Padding(
                  padding: const EdgeInsets.all(2),
                  child: AnimatedAvatarRing(
                    child: CircleAvatar(
                      radius: 52,
                      backgroundColor: AppColors.primary.withOpacity(0.18),
                      backgroundImage: hasSelectedFile
                          ? FileImage(selectedFile!) as ImageProvider
                          : (hasRemoteAvatar
                              ? NetworkImage(avatarUrl)
                              : null),
                      child: !hasSelectedFile && !hasRemoteAvatar
                          ? const Icon(
                              Icons.person_rounded,
                              size: 48,
                              color: Colors.white70,
                            )
                          : null,
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              right: 2,
              bottom: 2,
              child: Container(
                padding: const EdgeInsets.all(6),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [AppColors.primary, AppColors.secondary],
                  ),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.camera_alt_rounded,
                  size: 16,
                  color: Colors.white,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Text(
          'Thay đổi ảnh đại diện',
          style: TextStyle(
            color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
            fontSize: 12,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

class _ProfileInputField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final bool readOnly;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;

  const _ProfileInputField({
    required this.controller,
    required this.label,
    this.readOnly = false,
    this.keyboardType,
    this.textInputAction,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return TextField(
      controller: controller,
      readOnly: readOnly,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      style: TextStyle(
        color: isDark ? Colors.white : AppColors.lightTextPrimary,
        fontSize: 15,
      ),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(
          color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
        ),
        filled: true,
        fillColor: isDark ? Colors.white.withOpacity(0.02) : Colors.black.withOpacity(0.01),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(
            color: AppColors.primary,
            width: 1.5,
          ),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      ),
    );
  }
}

class _SaveProfileButton extends StatelessWidget {
  final bool isLoading;
  final VoidCallback? onTap;

  const _SaveProfileButton({required this.isLoading, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      height: 48,
      decoration: BoxDecoration(
        gradient: onTap != null
            ? const LinearGradient(
                colors: [AppColors.primary, AppColors.secondary],
              )
            : null,
        color: onTap == null ? Colors.grey[800] : null,
        borderRadius: BorderRadius.circular(24),
        boxShadow: onTap != null ? AppShadows.neonGlow(AppColors.primary) : null,
      ),
      child: ElevatedButton(
        onPressed: onTap,
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.transparent,
          shadowColor: Colors.transparent,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        ),
        child: isLoading
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  color: Colors.white,
                  strokeWidth: 2,
                ),
              )
            : const Text(
                'Lưu thay đổi',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                ),
              ),
      ),
    );
  }
}

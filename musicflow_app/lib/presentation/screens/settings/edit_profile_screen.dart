import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:musicflow_app/core/config/api_config.dart';
import 'package:musicflow_app/data/models/user_model.dart';
import 'package:musicflow_app/data/services/auth_service.dart';

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
        throw Exception('Du lieu nguoi dung khong hop le');
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
        imageQuality: 85,
        maxWidth: 1200,
      );

      if (image == null || !mounted) return;

      setState(() {
        _selectedAvatarFile = File(image.path);
      });
    } catch (e) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Không mở được thư viện ảnh. Hãy cấp quyền truy cập ảnh trong cài đặt thiết bị. ($e)',
          ),
        ),
      );
    }
  }

  Future<void> _saveProfile() async {
    final user = _user;
    if (user == null) return;

    final trimmedName = _nameController.text.trim();
    if (trimmedName.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng nhập tên hiển thị')),
      );
      return;
    }

    setState(() {
      _isSaving = true;
    });

    try {
      final token = await AuthService.getToken();
      if (token == null || token.isEmpty) {
        throw Exception('Bạn chưa đăng nhập');
      }

      final request = http.MultipartRequest(
        'PUT',
        Uri.parse(ApiConfig.usersUpdateEndpoint),
      );
      request.headers['Authorization'] = 'Bearer $token';
      request.fields['name'] = trimmedName;

      if (_selectedAvatarFile != null) {
        request.files.add(
          await http.MultipartFile.fromPath('avatar', _selectedAvatarFile!.path),
        );
      }

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);
      final decoded = _tryDecodeJson(response.body);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        final message = _buildUpdateErrorMessage(
          statusCode: response.statusCode,
          decoded: decoded,
          rawBody: response.body,
        );
        throw Exception(message);
      }

      final userJson = decoded is Map<String, dynamic>
          ? (decoded['user'] ?? decoded)
          : null;
      if (userJson is! Map<String, dynamic>) {
        throw Exception('Server tra ve du lieu khong hop le sau khi cap nhat');
      }

      final updatedUser = User.fromJson(userJson);
      await AuthService.updateStoredUser(updatedUser);

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cập nhật thông tin thành công')),
      );
      Navigator.pop(context, updatedUser);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
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

    final trimmedBody = rawBody.trimLeft();
    if (trimmedBody.startsWith('<!DOCTYPE html') ||
        trimmedBody.startsWith('<html')) {
      return 'Backend đang trả về trang HTML thay vì API JSON. Thường là do server chưa restart hoặc chưa có route PUT /api/users/update.';
    }

    if (trimmedBody.contains('Cannot PUT /api/users/update')) {
      return 'Backend chua nhan route PUT /api/users/update. Hay restart server Node.js roi thu lai.';
    }

    return 'Cập nhật thất bại (HTTP $statusCode)';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        elevation: 0,
        title: const Text('Cập nhật thông tin cá nhân'),
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: Colors.greenAccent),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
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
                        const SizedBox(height: 24),
                        _ProfileInputField(
                          controller: _nameController,
                          label: 'Name',
                          textInputAction: TextInputAction.next,
                        ),
                        const SizedBox(height: 16),
                        _ProfileInputField(
                          controller: _emailController,
                          label: 'Email',
                          readOnly: true,
                          keyboardType: TextInputType.emailAddress,
                        ),
                        const SizedBox(height: 24),
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
    );
  }
}

class _ProfileCard extends StatelessWidget {
  final Widget child;

  const _ProfileCard({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF12161D),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: Colors.white.withOpacity(0.06)),
        boxShadow: [
          BoxShadow(
            color: Colors.greenAccent.withOpacity(0.05),
            blurRadius: 18,
            offset: const Offset(0, 10),
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
                  child: CircleAvatar(
                    radius: 52,
                    backgroundColor: Colors.greenAccent.withOpacity(0.18),
                    backgroundImage: hasSelectedFile
                        ? FileImage(selectedFile!) as ImageProvider
                        : hasRemoteAvatar
                            ? NetworkImage(avatarUrl)
                            : null,
                    child: !hasSelectedFile && !hasRemoteAvatar
                        ? const Icon(
                            Icons.person,
                            size: 46,
                            color: Colors.greenAccent,
                          )
                        : null,
                  ),
                ),
              ),
            ),
            Positioned(
              right: 0,
              bottom: 0,
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: onPick,
                  borderRadius: BorderRadius.circular(999),
                  child: Ink(
                    width: 36,
                    height: 36,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(
                        colors: [Color(0xFF69F0AE), Color(0xFF2FE0C5)],
                      ),
                    ),
                    child: const Icon(
                      Icons.camera_alt_rounded,
                      size: 18,
                      color: Colors.black,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        TextButton.icon(
          onPressed: onPick,
          icon: const Icon(
            Icons.photo_library_outlined,
            color: Colors.greenAccent,
          ),
          label: const Text(
            'Chon anh moi',
            style: TextStyle(color: Colors.greenAccent),
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
  final TextInputAction? textInputAction;
  final TextInputType? keyboardType;

  const _ProfileInputField({
    required this.controller,
    required this.label,
    this.readOnly = false,
    this.textInputAction,
    this.keyboardType,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      readOnly: readOnly,
      textInputAction: textInputAction,
      keyboardType: keyboardType,
      style: TextStyle(
        color: readOnly ? Colors.white70 : Colors.white,
      ),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: Colors.grey[400]),
        filled: true,
        fillColor: const Color(0xFF1A1F27),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: BorderSide(color: Colors.white.withOpacity(0.06)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: Colors.greenAccent),
        ),
      ),
    );
  }
}

class _SaveProfileButton extends StatelessWidget {
  final bool isLoading;
  final VoidCallback? onTap;

  const _SaveProfileButton({
    required this.isLoading,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          gradient: const LinearGradient(
            colors: [Color(0xFF69F0AE), Color(0xFF2FE0C5)],
          ),
        ),
        child: ElevatedButton(
          onPressed: onTap,
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.transparent,
            shadowColor: Colors.transparent,
            foregroundColor: Colors.black,
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
            ),
            textStyle: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
            ),
          ),
          child: isLoading
              ? const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.4,
                    color: Colors.black,
                  ),
                )
              : const Text('Cap nhat'),
        ),
      ),
    );
  }
}


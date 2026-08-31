import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:musicflow_app/core/theme/app_theme.dart';
import 'package:musicflow_app/core/utils/app_toast.dart';
import 'package:musicflow_app/data/services/auth_service.dart';
import 'package:musicflow_app/presentation/screens/login/login_screen.dart';
import 'package:musicflow_app/presentation/widgets/music_flow_backdrop.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final TextEditingController nameController = TextEditingController();
  final TextEditingController emailController = TextEditingController();
  final TextEditingController passwordController = TextEditingController();
  final TextEditingController confirmPasswordController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;

  Future<void> _register() async {
    final name = nameController.text.trim();
    final email = emailController.text.trim();
    final password = passwordController.text;
    final confirmPassword = confirmPasswordController.text;

    if (name.isEmpty || email.isEmpty || password.isEmpty) {
      AppToast.showError(context, 'Vui lòng nhập đầy đủ thông tin');
      return;
    }

    if (password.length < 6) {
      AppToast.showError(context, 'Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    if (password != confirmPassword) {
      AppToast.showError(context, 'Mật khẩu xác nhận không khớp');
      return;
    }

    if (!_isValidEmail(email)) {
      AppToast.showError(context, 'Email không hợp lệ');
      return;
    }

    setState(() => _isLoading = true);
    final result = await AuthService.register(
      name: name,
      email: email,
      password: password,
    );
    setState(() => _isLoading = false);

    if (result.success) {
      if (mounted) {
        AppToast.showSuccess(context, 'Đăng ký thành công! Vui lòng đăng nhập.');
        Navigator.pushReplacement(
          context,
          PageRouteBuilder(
            pageBuilder: (_, __, ___) => const LoginScreen(),
            transitionsBuilder: (_, animation, __, child) => FadeTransition(
              opacity: animation,
              child: child,
            ),
            transitionDuration: AppDurations.pageTransition,
          ),
        );
      }
    } else {
      if (mounted) {
        AppToast.showError(context, result.message ?? 'Đăng ký thất bại');
      }
    }
  }

  bool _isValidEmail(String email) {
    return RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(email);
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
              Icons.chevron_left_rounded,
              color: isDark ? Colors.white : AppColors.lightTextPrimary,
              size: 28,
            ),
            onPressed: () => Navigator.pop(context),
          ),
          title: Text(
            'Đăng ký',
            style: theme.textTheme.titleLarge?.copyWith(fontSize: 18),
          ),
        ),
        body: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Logo section with soft aura glow
                Container(
                  padding: const EdgeInsets.all(AppSpacing.xs),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withOpacity(0.12),
                        blurRadius: 20,
                        spreadRadius: 1,
                      )
                    ],
                  ),
                  child: Image.asset(
                    'assets/images/logo.png',
                    width: 72,
                    height: 72,
                    fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => const Icon(
                      Icons.music_note_rounded,
                      size: 72,
                      color: AppColors.primary,
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  'Tạo tài khoản',
                  style: theme.textTheme.displayLarge?.copyWith(
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),

                // Glass Form Container
                ClipRRect(
                  borderRadius: AppRadius.largeBorder,
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                    child: Container(
                      padding: const EdgeInsets.all(AppSpacing.lg),
                      decoration: BoxDecoration(
                        color: isDark
                            ? AppColors.darkSurfaceGlass
                            : AppColors.lightSurfaceGlass,
                        borderRadius: AppRadius.largeBorder,
                        border: Border.all(
                          color: isDark
                              ? AppColors.darkBorderGlass
                              : AppColors.lightBorderGlass,
                          width: 1.2,
                        ),
                        boxShadow: AppShadows.cardShadow,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Name Field
                          _buildTextField(
                            controller: nameController,
                            labelText: 'Họ và tên',
                            icon: Icons.person_outline_rounded,
                            isDark: isDark,
                          ),
                          const SizedBox(height: AppSpacing.md),

                          // Email Field
                          _buildTextField(
                            controller: emailController,
                            labelText: 'Email',
                            icon: Icons.email_outlined,
                            keyboardType: TextInputType.emailAddress,
                            isDark: isDark,
                          ),
                          const SizedBox(height: AppSpacing.md),

                          // Password Field
                          _buildTextField(
                            controller: passwordController,
                            labelText: 'Mật khẩu',
                            icon: Icons.lock_outline_rounded,
                            obscureText: _obscurePassword,
                            isDark: isDark,
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscurePassword
                                    ? Icons.visibility_off_rounded
                                    : Icons.visibility_rounded,
                                color: isDark
                                    ? AppColors.darkTextSecondary
                                    : AppColors.lightTextSecondary,
                              ),
                              onPressed: () {
                                setState(() => _obscurePassword = !_obscurePassword);
                              },
                            ),
                          ),
                          const SizedBox(height: AppSpacing.md),

                          // Confirm Password Field
                          _buildTextField(
                            controller: confirmPasswordController,
                            labelText: 'Xác nhận mật khẩu',
                            icon: Icons.lock_clock_outlined,
                            obscureText: _obscureConfirmPassword,
                            isDark: isDark,
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscureConfirmPassword
                                    ? Icons.visibility_off_rounded
                                    : Icons.visibility_rounded,
                                color: isDark
                                    ? AppColors.darkTextSecondary
                                    : AppColors.lightTextSecondary,
                              ),
                              onPressed: () {
                                setState(() {
                                  _obscureConfirmPassword = !_obscureConfirmPassword;
                                });
                              },
                            ),
                          ),
                          const SizedBox(height: AppSpacing.lg),

                          // Submit Button
                          Container(
                            height: 48,
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [AppColors.primary, AppColors.secondary],
                              ),
                              borderRadius: AppRadius.smallBorder,
                              boxShadow: AppShadows.neonGlow(AppColors.primary),
                            ),
                            child: ElevatedButton(
                              onPressed: _isLoading ? null : _register,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.transparent,
                                shadowColor: Colors.transparent,
                                shape: RoundedRectangleBorder(
                                  borderRadius: AppRadius.smallBorder,
                                ),
                              ),
                              child: _isLoading
                                  ? const SizedBox(
                                      height: 20,
                                      width: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                      ),
                                    )
                                  : const Text(
                                      'Đăng ký',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),

                // Login Link
                TextButton(
                  onPressed: () {
                    Navigator.pop(context);
                  },
                  child: Text(
                    'Đã có tài khoản? Đăng nhập',
                    style: TextStyle(
                      color: isDark ? AppColors.secondary : AppColors.primary,
                      fontWeight: FontWeight.bold,
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

  Widget _buildTextField({
    required TextEditingController controller,
    required String labelText,
    required IconData icon,
    bool obscureText = false,
    TextInputType keyboardType = TextInputType.text,
    Widget? suffixIcon,
    required bool isDark,
  }) {
    return TextFormField(
      controller: controller,
      obscureText: obscureText,
      keyboardType: keyboardType,
      style: TextStyle(color: isDark ? Colors.white : AppColors.lightTextPrimary),
      decoration: InputDecoration(
        labelText: labelText,
        labelStyle: TextStyle(
          color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
        ),
        prefixIcon: Icon(
          icon,
          color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
        ),
        suffixIcon: suffixIcon,
        filled: true,
        fillColor: isDark ? Colors.white.withOpacity(0.03) : Colors.black.withOpacity(0.02),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppRadius.smallBorder,
          borderSide: BorderSide(
            color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: AppRadius.smallBorder,
          borderSide: const BorderSide(
            color: AppColors.primary,
            width: 1.5,
          ),
        ),
        contentPadding: const EdgeInsets.symmetric(vertical: 14),
      ),
    );
  }
}

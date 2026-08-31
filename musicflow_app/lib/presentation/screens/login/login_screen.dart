import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:musicflow_app/main.dart';
import 'package:musicflow_app/core/theme/app_theme.dart';
import 'package:musicflow_app/core/utils/app_toast.dart';
import 'package:musicflow_app/data/services/auth_service.dart';
import 'package:musicflow_app/presentation/screens/login/register_screen.dart';
import 'package:musicflow_app/presentation/widgets/music_flow_backdrop.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController emailController = TextEditingController();
  final TextEditingController passwordController = TextEditingController();
  bool _isLoading = false;
  bool _isGoogleLoading = false;
  bool _obscurePassword = true;

  Future<void> _login() async {
    final email = emailController.text.trim();
    final password = passwordController.text;

    if (email.isEmpty || password.isEmpty) {
      AppToast.showError(context, 'Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }

    setState(() => _isLoading = true);
    final result = await AuthService.login(email: email, password: password);
    setState(() => _isLoading = false);

    if (result.success) {
      if (mounted) {
        AppToast.showSuccess(context, 'Chào mừng bạn quay trở lại!');
        Navigator.pushReplacement(
          context,
          PageRouteBuilder(
            pageBuilder: (_, __, ___) => const MainScreen(),
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
        AppToast.showError(context, result.message ?? 'Đăng nhập thất bại');
      }
    }
  }

  Future<void> _loginWithGoogle() async {
    setState(() => _isGoogleLoading = true);
    final result = await AuthService.signInWithGoogle();
    setState(() => _isGoogleLoading = false);

    if (result.success) {
      if (mounted) {
        AppToast.showSuccess(context, 'Đăng nhập Google thành công!');
        Navigator.pushReplacement(
          context,
          PageRouteBuilder(
            pageBuilder: (_, __, ___) => const MainScreen(),
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
        AppToast.showError(context, result.message ?? 'Đăng nhập Google thất bại');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return MusicFlowBackdrop(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Logo section with soft aura glow
                Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withOpacity(0.15),
                        blurRadius: 24,
                        spreadRadius: 2,
                      )
                    ],
                  ),
                  child: Image.asset(
                    'assets/images/logo.png',
                    width: 96,
                    height: 96,
                    fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => const Icon(
                      Icons.music_note_rounded,
                      size: 96,
                      color: AppColors.primary,
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  'MusicFlow',
                  style: theme.textTheme.displayLarge?.copyWith(
                    fontSize: 32,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  'Your Flow, Your Music',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: isDark ? AppColors.darkTextSecondary : AppColors.lightTextSecondary,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: AppSpacing.xl),

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
                          Text(
                            'Đăng nhập',
                            textAlign: TextAlign.center,
                            style: theme.textTheme.titleLarge?.copyWith(
                              fontSize: 22,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.3,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.lg),

                          // Email field
                          _buildTextField(
                            controller: emailController,
                            labelText: 'Email',
                            icon: Icons.email_outlined,
                            keyboardType: TextInputType.emailAddress,
                            isDark: isDark,
                          ),
                          const SizedBox(height: AppSpacing.md),

                          // Password field
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
                          const SizedBox(height: AppSpacing.lg),

                          // Submit Button with Gradient
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
                              onPressed: _isLoading ? null : _login,
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
                                      'Đăng nhập',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                            ),
                          ),
                          const SizedBox(height: AppSpacing.md),

                          // Or divider
                          Row(
                            children: [
                              Expanded(
                                child: Divider(
                                  color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
                                ),
                              ),
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
                                child: Text(
                                  'hoặc',
                                  style: theme.textTheme.bodyMedium?.copyWith(
                                    fontSize: 12,
                                    color: isDark
                                        ? AppColors.darkTextSecondary.withOpacity(0.7)
                                        : AppColors.lightTextSecondary.withOpacity(0.7),
                                  ),
                                ),
                              ),
                              Expanded(
                                child: Divider(
                                  color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.md),

                          // Google Sign In (High-contrast, Official Google theme)
                          Container(
                            height: 48,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: AppRadius.smallBorder,
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withOpacity(0.12),
                                  blurRadius: 8,
                                  offset: const Offset(0, 3),
                                ),
                              ],
                            ),
                            child: Material(
                              color: Colors.transparent,
                              borderRadius: AppRadius.smallBorder,
                              child: InkWell(
                                onTap: _isGoogleLoading ? null : _loginWithGoogle,
                                borderRadius: AppRadius.smallBorder,
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 16),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      if (_isGoogleLoading)
                                        const SizedBox(
                                          height: 20,
                                          width: 20,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF4285F4)),
                                          ),
                                        )
                                      else
                                        Image.asset(
                                          'assets/images/google_logo.png',
                                          height: 22,
                                          width: 22,
                                          errorBuilder: (_, __, ___) => const Icon(
                                            Icons.g_mobiledata_rounded,
                                            size: 24,
                                            color: Color(0xFF4285F4),
                                          ),
                                        ),
                                      const SizedBox(width: 10),
                                      const Text(
                                        'Đăng nhập với Google',
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w700,
                                          color: Color(0xFF1F2937),
                                          letterSpacing: 0.1,
                                        ),
                                      ),
                                    ],
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
                const SizedBox(height: AppSpacing.lg),

                // Register Link
                TextButton(
                  onPressed: () {
                    Navigator.push(
                      context,
                      PageRouteBuilder(
                        pageBuilder: (_, __, ___) => const RegisterScreen(),
                        transitionsBuilder: (_, animation, __, child) => SlideTransition(
                          position: Tween<Offset>(begin: const Offset(1, 0), end: Offset.zero)
                              .animate(animation),
                          child: child,
                        ),
                        transitionDuration: AppDurations.cardSlide,
                      ),
                    );
                  },
                  child: Text(
                    'Chưa có tài khoản? Đăng ký ngay',
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

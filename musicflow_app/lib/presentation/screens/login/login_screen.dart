import 'package:flutter/material.dart';
import 'package:musicflow_app/main.dart';
import 'package:musicflow_app/core/theme/app_theme.dart';
import 'package:musicflow_app/core/utils/app_toast.dart';
import 'package:musicflow_app/data/services/auth_service.dart';
import 'package:musicflow_app/presentation/widgets/animated_p_logo.dart';

class LoginScreen extends StatefulWidget {
  final bool initialIsSignUp;

  const LoginScreen({
    super.key,
    this.initialIsSignUp = false,
  });

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  bool _isSignUp = false;
  bool _isLoading = false;
  bool _isGoogleLoading = false;
  bool _isSuccess = false;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _keepMeSignedIn = true;

  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _confirmPasswordController =
      TextEditingController();

  final FocusNode _nameFocus = FocusNode();
  final FocusNode _emailFocus = FocusNode();
  final FocusNode _passwordFocus = FocusNode();

  // Entrance animation for page transition
  late AnimationController _entranceController;
  late Animation<Offset> _sheetSlideAnimation;
  late Animation<double> _headerFadeAnimation;

  @override
  void initState() {
    super.initState();
    _isSignUp = widget.initialIsSignUp;

    _entranceController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 650),
    );

    _sheetSlideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.18),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(
        parent: _entranceController,
        curve: Curves.easeOutCubic,
      ),
    );

    _headerFadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _entranceController,
        curve: Curves.easeOut,
      ),
    );

    _entranceController.forward();
  }

  @override
  void dispose() {
    _entranceController.dispose();
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _nameFocus.dispose();
    _emailFocus.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  void _switchTab(bool isSignUp) {
    if (_isSignUp == isSignUp || _isLoading) return;
    setState(() {
      _isSignUp = isSignUp;
      _isSuccess = false;
    });
  }

  Future<void> _handleAuth() async {
    if (_isLoading || _isSuccess) return;

    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (email.isEmpty || password.isEmpty) {
      AppToast.showError(context, 'Vui lòng nhập đầy đủ thông tin');
      return;
    }

    if (_isSignUp) {
      final name = _nameController.text.trim();
      final confirmPassword = _confirmPasswordController.text;

      if (name.isEmpty) {
        AppToast.showError(context, 'Vui lòng nhập họ và tên');
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

      setState(() => _isLoading = true);
      final result = await AuthService.register(
        name: name,
        email: email,
        password: password,
      );
      if (!mounted) return;
      setState(() => _isLoading = false);

      if (result.success) {
        setState(() => _isSuccess = true);
        AppToast.showSuccess(context, 'Đăng ký tài khoản thành công!');
        await Future.delayed(const Duration(milliseconds: 600));
        _navigateToHome();
      } else {
        AppToast.showError(context, result.message ?? 'Đăng ký thất bại');
      }
    } else {
      setState(() => _isLoading = true);
      final result = await AuthService.login(
        email: email,
        password: password,
      );
      if (!mounted) return;
      setState(() => _isLoading = false);

      if (result.success) {
        setState(() => _isSuccess = true);
        AppToast.showSuccess(context, 'Chào mừng bạn quay trở lại!');
        await Future.delayed(const Duration(milliseconds: 600));
        _navigateToHome();
      } else {
        AppToast.showError(context, result.message ?? 'Đăng nhập thất bại');
      }
    }
  }

  Future<void> _handleGoogleSignIn() async {
    if (_isGoogleLoading || _isLoading) return;

    setState(() => _isGoogleLoading = true);
    final result = await AuthService.signInWithGoogle();
    if (!mounted) return;
    setState(() => _isGoogleLoading = false);

    if (result.success) {
      setState(() => _isSuccess = true);
      AppToast.showSuccess(context, 'Đăng nhập Google thành công!');
      await Future.delayed(const Duration(milliseconds: 600));
      _navigateToHome();
    } else {
      AppToast.showError(context, result.message ?? 'Đăng nhập Google thất bại');
    }
  }

  void _navigateToHome() {
    if (!mounted) return;
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

  void _showForgotPasswordDialog() {
    final resetEmailController =
        TextEditingController(text: _emailController.text);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF161822),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Quên mật khẩu?',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Nhập email của bạn để nhận liên kết khôi phục mật khẩu:',
              style: TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: resetEmailController,
              keyboardType: TextInputType.emailAddress,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'your-email@example.com',
                hintStyle: const TextStyle(color: Color(0xFF64748B)),
                filled: true,
                fillColor: const Color(0xFF0F1017),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFF282C3F)),
                ),
                prefixIcon: const Icon(Icons.email_outlined,
                    color: Color(0xFF64748B), size: 20),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Hủy', style: TextStyle(color: Color(0xFF94A3B8))),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              AppToast.showSuccess(
                  context, 'Đã gửi hướng dẫn khôi phục qua email!');
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2563EB),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Gửi',
                style: TextStyle(
                    color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF090A0F),
      resizeToAvoidBottomInset: true,
      body: Stack(
        children: [
          // Background ambient gradient orb at top
          Positioned(
            top: -40,
            left: 0,
            right: 0,
            height: 320,
            child: Container(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(0, -0.3),
                  radius: 0.9,
                  colors: [
                    const Color(0xFF1E293B).withOpacity(0.7),
                    const Color(0xFF00E5FF).withOpacity(0.08),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),

          SafeArea(
            bottom: false,
            child: LayoutBuilder(
              builder: (context, constraints) {
                final totalHeight = constraints.maxHeight;
                final topHeight = totalHeight * 0.38; // TOP ≈ 38-40%
                final bottomMinHeight = totalHeight * 0.62; // BOTTOM ≈ 60-62%

                return SingleChildScrollView(
                  physics: const ClampingScrollPhysics(),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(minHeight: totalHeight),
                    child: Column(
                      children: [
                        // 1. TOP SECTION (≈ 38-40% of screen height)
                        SizedBox(
                          height: topHeight,
                          child: FadeTransition(
                            opacity: _headerFadeAnimation,
                            child: Padding(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 24),
                              child: Column(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceEvenly,
                                crossAxisAlignment: CrossAxisAlignment.center,
                                children: [
                                  const SizedBox(height: 8),
                                  // Row: Mini Logo + MusicFlow title
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    crossAxisAlignment:
                                        CrossAxisAlignment.center,
                                    children: [
                                      const AnimatedPLogo(
                                        animationValue: 1.0,
                                        size: 26,
                                        isStatic: true,
                                      ),
                                      const SizedBox(width: 8),
                                      RichText(
                                        text: const TextSpan(
                                          children: [
                                            TextSpan(
                                              text: 'Music',
                                              style: TextStyle(
                                                fontSize: 22,
                                                fontStyle: FontStyle.italic,
                                                fontWeight: FontWeight.bold,
                                                color: Colors.white,
                                                letterSpacing: -0.5,
                                              ),
                                            ),
                                            TextSpan(
                                              text: 'Flow',
                                              style: TextStyle(
                                                fontSize: 22,
                                                fontWeight: FontWeight.w900,
                                                color: Color(0xFF00E5FF),
                                                letterSpacing: -0.5,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),

                                  // "Welcome back." with elegant serif italic style
                                  Text(
                                    _isSignUp ? 'Create account.' : 'Welcome back.',
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(
                                      fontSize: 32,
                                      fontFamily: 'serif',
                                      fontStyle: FontStyle.italic,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                      letterSpacing: -0.5,
                                    ),
                                  ),

                                  // Subtitle
                                  Text(
                                    _isSignUp
                                        ? 'Join MusicFlow — your rhythm awaits.'
                                        : 'Pick up where you left off — your music is waiting.',
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(
                                      fontSize: 13.5,
                                      color: Color(0xFF94A3B8),
                                      fontWeight: FontWeight.w400,
                                      letterSpacing: 0.1,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                ],
                              ),
                            ),
                          ),
                        ),

                        // 2. BOTTOM SECTION (≈ 60-62% of screen height)
                        ConstrainedBox(
                          constraints:
                              BoxConstraints(minHeight: bottomMinHeight),
                          child: SlideTransition(
                            position: _sheetSlideAnimation,
                            child: Container(
                              width: double.infinity,
                              decoration: const BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.vertical(
                                  top: Radius.circular(32),
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black26,
                                    blurRadius: 24,
                                    offset: Offset(0, -6),
                                  ),
                                ],
                              ),
                              child: SafeArea(
                                top: false,
                                bottom: true,
                                child: Padding(
                                  padding: const EdgeInsets.fromLTRB(
                                      24, 22, 24, 20),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.stretch,
                                    children: [
                                      // 1. Tab Switch: Sign In / Sign Up
                                      _buildSegmentedTab(),

                                      const SizedBox(height: 18),

                                      // 2. Full Name (Sign Up only)
                                      if (_isSignUp) ...[
                                        _buildInputField(
                                          controller: _nameController,
                                          focusNode: _nameFocus,
                                          hintText: 'Full name',
                                          icon: Icons.person_outline_rounded,
                                          keyboardType: TextInputType.name,
                                        ),
                                        const SizedBox(height: 12),
                                      ],

                                      // 3. Email address input
                                      _buildInputField(
                                        controller: _emailController,
                                        focusNode: _emailFocus,
                                        hintText: 'Email address',
                                        icon: Icons.mail_outline_rounded,
                                        keyboardType:
                                            TextInputType.emailAddress,
                                      ),

                                      const SizedBox(height: 12),

                                      // 4. Password input
                                      _buildInputField(
                                        controller: _passwordController,
                                        focusNode: _passwordFocus,
                                        hintText: 'Password',
                                        icon: Icons.lock_outline_rounded,
                                        obscureText: _obscurePassword,
                                        suffixIcon: IconButton(
                                          icon: Icon(
                                            _obscurePassword
                                                ? Icons.visibility_off_outlined
                                                : Icons.visibility_outlined,
                                            color: const Color(0xFF9CA3AF),
                                            size: 20,
                                          ),
                                          onPressed: () => setState(() =>
                                              _obscurePassword =
                                                  !_obscurePassword),
                                        ),
                                      ),

                                      // 5. Confirm Password (Sign Up only)
                                      if (_isSignUp) ...[
                                        const SizedBox(height: 12),
                                        _buildInputField(
                                          controller:
                                              _confirmPasswordController,
                                          hintText: 'Confirm password',
                                          icon: Icons.lock_outline_rounded,
                                          obscureText:
                                              _obscureConfirmPassword,
                                          suffixIcon: IconButton(
                                            icon: Icon(
                                              _obscureConfirmPassword
                                                  ? Icons
                                                      .visibility_off_outlined
                                                  : Icons.visibility_outlined,
                                              color: const Color(0xFF9CA3AF),
                                              size: 20,
                                            ),
                                            onPressed: () => setState(() =>
                                                _obscureConfirmPassword =
                                                    !_obscureConfirmPassword),
                                          ),
                                        ),
                                      ],

                                      // 6. Options Row: Keep me signed in & Forgot Password?
                                      if (!_isSignUp) ...[
                                        const SizedBox(height: 14),
                                        Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.spaceBetween,
                                          children: [
                                            // Custom Rounded Checkbox
                                            InkWell(
                                              onTap: () => setState(() =>
                                                  _keepMeSignedIn =
                                                      !_keepMeSignedIn),
                                              borderRadius:
                                                  BorderRadius.circular(6),
                                              child: Row(
                                                mainAxisSize:
                                                    MainAxisSize.min,
                                                children: [
                                                  Container(
                                                    width: 20,
                                                    height: 20,
                                                    decoration: BoxDecoration(
                                                      color: _keepMeSignedIn
                                                          ? const Color(
                                                              0xFF3B82F6)
                                                          : Colors.white,
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                              6),
                                                      border: Border.all(
                                                        color: _keepMeSignedIn
                                                            ? const Color(
                                                                0xFF3B82F6)
                                                            : const Color(
                                                                0xFFD1D5DB),
                                                        width: 1.5,
                                                      ),
                                                    ),
                                                    child: _keepMeSignedIn
                                                        ? const Icon(
                                                            Icons.check,
                                                            size: 14,
                                                            color:
                                                                Colors.white,
                                                          )
                                                        : null,
                                                  ),
                                                  const SizedBox(width: 8),
                                                  const Text(
                                                    'Keep me signed in',
                                                    style: TextStyle(
                                                      fontSize: 13,
                                                      color: Color(0xFF4B5563),
                                                      fontWeight:
                                                          FontWeight.w500,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),

                                            // Forgot Password?
                                            GestureDetector(
                                              onTap:
                                                  _showForgotPasswordDialog,
                                              child: const Text(
                                                'Forgot Password?',
                                                style: TextStyle(
                                                  fontSize: 13,
                                                  color: Color(0xFF3B82F6),
                                                  fontWeight:
                                                      FontWeight.w600,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],

                                      const SizedBox(height: 18),

                                      // 7. Primary Action Button (Sign in / Sign up)
                                      _buildActionButton(),

                                      const SizedBox(height: 18),

                                      // 8. Divider: OR CONTINUE WITH
                                      Row(
                                        children: [
                                          Expanded(
                                            child: Container(
                                              height: 1,
                                              color: const Color(0xFFE5E7EB),
                                            ),
                                          ),
                                          const Padding(
                                            padding: EdgeInsets.symmetric(
                                                horizontal: 14),
                                            child: Text(
                                              'OR CONTINUE WITH',
                                              style: TextStyle(
                                                fontSize: 11,
                                                letterSpacing: 1.1,
                                                fontWeight: FontWeight.w600,
                                                color: Color(0xFF9CA3AF),
                                              ),
                                            ),
                                          ),
                                          Expanded(
                                            child: Container(
                                              height: 1,
                                              color: const Color(0xFFE5E7EB),
                                            ),
                                          ),
                                        ],
                                      ),

                                      const SizedBox(height: 16),

                                      // 9. Google Button (Unified size with Primary Button)
                                      _buildGoogleButton(),

                                      const SizedBox(height: 18),

                                      // 10. Footer Switcher Link
                                      _buildFooter(),
                                      const SizedBox(height: 8),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSegmentedTab() {
    return Container(
      height: 48,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: const Color(0xFFF3F4F6),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Stack(
        children: [
          AnimatedAlign(
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeInOutCubic,
            alignment:
                _isSignUp ? Alignment.centerRight : Alignment.centerLeft,
            child: FractionallySizedBox(
              widthFactor: 0.5,
              heightFactor: 1.0,
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF111218),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.16),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => _switchTab(false),
                  child: Center(
                    child: Text(
                      'Sign In',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color:
                            !_isSignUp ? Colors.white : const Color(0xFF6B7280),
                      ),
                    ),
                  ),
                ),
              ),
              Expanded(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => _switchTab(true),
                  child: Center(
                    child: Text(
                      'Sign Up',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color:
                            _isSignUp ? Colors.white : const Color(0xFF6B7280),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInputField({
    required TextEditingController controller,
    required String hintText,
    required IconData icon,
    FocusNode? focusNode,
    bool obscureText = false,
    TextInputType keyboardType = TextInputType.text,
    Widget? suffixIcon,
  }) {
    return Container(
      height: 52,
      decoration: BoxDecoration(
        color: const Color(0xFFF3F4F6),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: const Color(0xFFE5E7EB),
          width: 1.0,
        ),
      ),
      child: Center(
        child: TextField(
          controller: controller,
          focusNode: focusNode,
          obscureText: obscureText,
          keyboardType: keyboardType,
          style: const TextStyle(
            color: Color(0xFF111827),
            fontSize: 14.5,
            fontWeight: FontWeight.w500,
          ),
          decoration: InputDecoration(
            hintText: hintText,
            hintStyle: const TextStyle(
              color: Color(0xFF9CA3AF),
              fontSize: 14,
              fontWeight: FontWeight.w400,
            ),
            prefixIcon: Icon(
              icon,
              color: const Color(0xFF9CA3AF),
              size: 20,
            ),
            suffixIcon: suffixIcon,
            border: InputBorder.none,
            contentPadding: const EdgeInsets.symmetric(
              vertical: 14,
              horizontal: 16,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildActionButton() {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      height: 52,
      decoration: BoxDecoration(
        color: _isSuccess ? const Color(0xFF10B981) : const Color(0xFF3B82F6),
        borderRadius: BorderRadius.circular(26),
        boxShadow: [
          BoxShadow(
            color: _isSuccess
                ? const Color(0xFF10B981).withOpacity(0.35)
                : const Color(0xFF3B82F6).withOpacity(0.35),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(26),
          onTap: _handleAuth,
          child: Center(
            child: _isLoading
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.4,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  )
                : _isSuccess
                    ? const Icon(
                        Icons.check_circle_rounded,
                        color: Colors.white,
                        size: 26,
                      )
                    : Text(
                        _isSignUp ? 'Sign Up' : 'Sign in',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 15.5,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.2,
                        ),
                      ),
          ),
        ),
      ),
    );
  }

  Widget _buildGoogleButton() {
    return Container(
      height: 52,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(26),
        border: Border.all(
          color: const Color(0xFFE5E7EB),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(26),
          onTap: _handleGoogleSignIn,
          child: Center(
            child: _isGoogleLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor:
                          AlwaysStoppedAnimation<Color>(Color(0xFF4285F4)),
                    ),
                  )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Image.asset(
                        'assets/images/google_logo.png',
                        height: 20,
                        width: 20,
                        errorBuilder: (_, __, ___) => const Icon(
                          Icons.g_mobiledata_rounded,
                          size: 24,
                          color: Color(0xFF4285F4),
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'Google',
                        style: TextStyle(
                          fontSize: 14.5,
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
    );
  }

  Widget _buildFooter() {
    return GestureDetector(
      onTap: () => _switchTab(!_isSignUp),
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: RichText(
          textAlign: TextAlign.center,
          text: TextSpan(
            style: const TextStyle(
              fontSize: 13.5,
              color: Color(0xFF6B7280),
            ),
            children: [
              TextSpan(
                text: _isSignUp
                    ? 'Already have an account? '
                    : 'New to MusicFlow? ',
              ),
              TextSpan(
                text: _isSignUp ? 'Sign in' : 'Create an account',
                style: const TextStyle(
                  color: Color(0xFF3B82F6),
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

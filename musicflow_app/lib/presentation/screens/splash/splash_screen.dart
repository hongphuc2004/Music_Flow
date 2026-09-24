import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:musicflow_app/main.dart';
import 'package:musicflow_app/data/services/auth_service.dart';
import 'package:musicflow_app/presentation/screens/login/login_screen.dart';
import 'package:musicflow_app/presentation/widgets/animated_p_logo.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  // Timeline sub-animations
  late Animation<double> _strokeAnimation;
  late Animation<double> _fillAnimation;
  late Animation<double> _wordmarkFadeAnimation;
  late Animation<Offset> _wordmarkSlideAnimation;

  @override
  void initState() {
    super.initState();

    // Set immersive dark status bar
    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        systemNavigationBarColor: Color(0xFF090A0F),
        systemNavigationBarIconBrightness: Brightness.light,
      ),
    );

    // Total Duration: 5200ms
    // Phase 1 (0.0s - 0.5s): Dark background
    // Phase 2 (0.5s - 2.5s): Draw outline logo
    // Phase 3 (2.5s - 3.5s): Fill & complete logo
    // Phase 4 (3.5s - 4.5s): Logo stabilized in center
    // Phase 5 (4.0s - 5.0s): Wordmark fades & slides in
    // Phase 6 (~5.2s): Smooth transition to Login/Main screen
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 5200),
    );

    // 0.5s -> 2.5s: 500 / 5200 ≈ 0.096, 2500 / 5200 ≈ 0.481
    _strokeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.096, 0.481, curve: Curves.easeInOutCubic),
      ),
    );

    // 2.5s -> 3.5s: 2500 / 5200 ≈ 0.481, 3500 / 5200 ≈ 0.673
    _fillAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.481, 0.673, curve: Curves.easeOutCubic),
      ),
    );

    // 4.0s -> 5.0s: 4000 / 5200 ≈ 0.769, 5000 / 5200 ≈ 0.962
    _wordmarkFadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.769, 0.962, curve: Curves.easeOut),
      ),
    );

    _wordmarkSlideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.30),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.769, 0.962, curve: Curves.easeOutCubic),
      ),
    );

    _controller.forward();
    _checkAuthAndNavigate();
  }

  Future<void> _checkAuthAndNavigate() async {
    // Wait for the full animation sequence to conclude (~5250ms)
    await Future.delayed(const Duration(milliseconds: 5250));

    final isLoggedIn = await AuthService.isLoggedIn();

    if (mounted) {
      // Cinematic smooth fade transition to LoginScreen or MainScreen
      Navigator.pushReplacement(
        context,
        PageRouteBuilder(
          transitionDuration: const Duration(milliseconds: 700),
          pageBuilder: (_, animation, ___) =>
              isLoggedIn ? const MainScreen() : const LoginScreen(),
          transitionsBuilder: (_, animation, __, child) {
            return FadeTransition(
              opacity: CurvedAnimation(
                parent: animation,
                curve: Curves.easeInOut,
              ),
              child: child,
            );
          },
        ),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;

    return Scaffold(
      backgroundColor: const Color(0xFF090A0F),
      body: Stack(
        alignment: Alignment.center,
        children: [
          // Ambient radial background glow (revealed softly as logo fills)
          AnimatedBuilder(
            animation: _fillAnimation,
            builder: (context, _) {
              final glowAlpha = _fillAnimation.value;
              if (glowAlpha <= 0.01) return const SizedBox.shrink();

              return Positioned(
                top: size.height * 0.28,
                child: Opacity(
                  opacity: glowAlpha.clamp(0.0, 1.0),
                  child: Container(
                    width: size.width * 0.85,
                    height: size.width * 0.85,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(
                        colors: [
                          const Color(0xFF00E5FF).withOpacity(0.12),
                          const Color(0xFF6C63FF).withOpacity(0.08),
                          Colors.transparent,
                        ],
                        stops: const [0.0, 0.45, 1.0],
                      ),
                    ),
                  ),
                ),
              );
            },
          ),

          // Main Center Container with Logo and Wordmark
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Animated stylized "P" Logo (stroke draw -> cross-fade to assets/images/logo.png)
                AnimatedBuilder(
                  animation: _controller,
                  builder: (context, _) {
                    return AnimatedPLogo(
                      strokeProgress: _strokeAnimation.value,
                      fillProgress: _fillAnimation.value,
                      size: 135,
                    );
                  },
                ),

                const SizedBox(height: 26),

                // Brand Wordmark + Slogan (Fade & Slide in at 4.0s - 5.0s)
                SlideTransition(
                  position: _wordmarkSlideAnimation,
                  child: FadeTransition(
                    opacity: _wordmarkFadeAnimation,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // "MusicFlow" brand title matching reference typography style
                        RichText(
                          text: const TextSpan(
                            children: [
                              TextSpan(
                                text: 'Music',
                                style: TextStyle(
                                  fontSize: 34,
                                  fontStyle: FontStyle.italic,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white,
                                  letterSpacing: -0.5,
                                ),
                              ),
                              TextSpan(
                                text: 'Flow',
                                style: TextStyle(
                                  fontSize: 34,
                                  fontWeight: FontWeight.w900,
                                  color: Color(0xFF00E5FF),
                                  letterSpacing: -0.5,
                                ),
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 8),

                        // Glowing horizontal light streak under title
                        Container(
                          width: 58,
                          height: 2,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(1),
                            gradient: const LinearGradient(
                              colors: [
                                Colors.transparent,
                                Color(0xFF00E5FF),
                                Colors.transparent,
                              ],
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF00E5FF).withOpacity(0.85),
                                blurRadius: 6,
                                spreadRadius: 1,
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 12),

                        // Slogan
                        const Text(
                          'A daily dose of beautiful music.',
                          style: TextStyle(
                            color: Color(0xFF94A3B8),
                            fontSize: 13.5,
                            fontWeight: FontWeight.w400,
                            letterSpacing: 0.2,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

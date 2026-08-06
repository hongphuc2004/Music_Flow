import 'package:flutter/material.dart';

class AppColors {
  static const Color primary = Color(0xFF6C63FF);    // Neon Indigo
  static const Color secondary = Color(0xFF00BCD4);  // Neon Cyan
  static const Color accentPink = Color(0xFFEC4899);  // Hot Pink

  // Dark Mode specific
  static const Color darkBackground = Color(0xFF0A0716);
  static const Color darkSurface = Color(0xFF151124);
  static const Color darkBorder = Color(0xFF2E274A);
  static const Color darkTextPrimary = Color(0xFFF8FAFC);
  static const Color darkTextSecondary = Color(0xFF94A3B8);

  // Light Mode specific
  static const Color lightBackground = Color(0xFFF8F9FD);
  static const Color lightSurface = Color(0xFFFFFFFF);
  static const Color lightBorder = Color(0xFFE2E8F0);
  static const Color lightTextPrimary = Color(0xFF0F172A);
  static const Color lightTextSecondary = Color(0xFF64748B);

  // Glassmorphic translucent backgrounds
  static Color darkSurfaceGlass = const Color(0xFF151124).withOpacity(0.60);
  static Color lightSurfaceGlass = const Color(0xFFFFFFFF).withOpacity(0.70);
  
  static Color darkBorderGlass = const Color(0xFFFFFFFF).withOpacity(0.08);
  static Color lightBorderGlass = const Color(0xFF000000).withOpacity(0.06);
}

class AppSpacing {
  static const double xxs = 4.0;
  static const double xs = 8.0;
  static const double sm = 12.0;
  static const double md = 16.0;
  static const double lg = 24.0;
  static const double xl = 32.0;
}

class AppRadius {
  static const double badge = 30.0;
  static const double small = 12.0;
  static const double medium = 16.0;
  static const double large = 24.0;

  static BorderRadius get badgeBorder => BorderRadius.circular(badge);
  static BorderRadius get smallBorder => BorderRadius.circular(small);
  static BorderRadius get mediumBorder => BorderRadius.circular(medium);
  static BorderRadius get largeBorder => BorderRadius.circular(large);
}

class AppShadows {
  static List<BoxShadow> neonGlow(Color color) => [
        BoxShadow(
          color: color.withOpacity(0.15),
          blurRadius: 10.0,
          offset: const Offset(0, 4),
        ),
      ];

  static const List<BoxShadow> cardShadow = [
    BoxShadow(
      color: Colors.black12,
      blurRadius: 12.0,
      offset: Offset(0, 6),
    ),
  ];
}

class AppDurations {
  static const Duration hover = Duration(milliseconds: 150);
  static const Duration cardSlide = Duration(milliseconds: 300);
  static const Duration pageTransition = Duration(milliseconds: 400);
}

class AppTheme {
  static ThemeData get lightTheme {
    return ThemeData.light().copyWith(
      scaffoldBackgroundColor: AppColors.lightBackground,
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        foregroundColor: AppColors.lightTextPrimary,
        elevation: 0,
        centerTitle: false,
      ),
      colorScheme: const ColorScheme.light(
        primary: AppColors.primary,
        secondary: AppColors.secondary,
        surface: AppColors.lightSurface,
      ),
      textTheme: const TextTheme(
        displayLarge: TextStyle(
          fontSize: 32,
          fontWeight: FontWeight.w900,
          letterSpacing: -1.0,
          color: AppColors.lightTextPrimary,
        ),
        titleLarge: TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.bold,
          letterSpacing: -0.5,
          color: AppColors.lightTextPrimary,
        ),
        titleMedium: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          color: AppColors.lightTextPrimary,
        ),
        bodyLarge: TextStyle(
          fontSize: 15,
          color: AppColors.lightTextPrimary,
        ),
        bodyMedium: TextStyle(
          fontSize: 13,
          color: AppColors.lightTextSecondary,
        ),
        labelMedium: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w500,
          letterSpacing: 0.5,
          color: AppColors.lightTextSecondary,
        ),
      ),
    );
  }

  static ThemeData get darkTheme {
    return ThemeData.dark().copyWith(
      scaffoldBackgroundColor: AppColors.darkBackground,
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        foregroundColor: AppColors.darkTextPrimary,
        elevation: 0,
        centerTitle: false,
      ),
      colorScheme: const ColorScheme.dark(
        primary: AppColors.primary,
        secondary: AppColors.secondary,
        surface: AppColors.darkSurface,
      ),
      textTheme: const TextTheme(
        displayLarge: TextStyle(
          fontSize: 32,
          fontWeight: FontWeight.w900,
          letterSpacing: -1.0,
          color: AppColors.darkTextPrimary,
        ),
        titleLarge: TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.bold,
          letterSpacing: -0.5,
          color: AppColors.darkTextPrimary,
        ),
        titleMedium: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          color: AppColors.darkTextPrimary,
        ),
        bodyLarge: TextStyle(
          fontSize: 15,
          color: AppColors.darkTextPrimary,
        ),
        bodyMedium: TextStyle(
          fontSize: 13,
          color: AppColors.darkTextSecondary,
        ),
        labelMedium: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w500,
          letterSpacing: 0.5,
          color: AppColors.darkTextSecondary,
        ),
      ),
    );
  }
}

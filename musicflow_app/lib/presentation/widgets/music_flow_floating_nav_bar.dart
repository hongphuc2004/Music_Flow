import 'dart:ui';
import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

class MusicFlowFloatingNavBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;
  final List<FloatingNavBarItem> items;

  const MusicFlowFloatingNavBar({
    super.key,
    required this.currentIndex,
    required this.onTap,
    required this.items,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        0,
        AppSpacing.md,
        AppSpacing.md,
      ),
      child: ClipRRect(
        borderRadius: AppRadius.largeBorder,
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 12.0, sigmaY: 12.0),
          child: Container(
            height: 68,
            decoration: BoxDecoration(
              color: isDark
                  ? AppColors.darkSurfaceGlass
                  : AppColors.lightSurfaceGlass,
              borderRadius: AppRadius.largeBorder,
              border: Border.all(
                color: isDark
                    ? AppColors.darkBorderGlass
                    : AppColors.lightBorderGlass,
                width: 1.0,
              ),
              boxShadow: isDark
                  ? [
                      BoxShadow(
                        color: AppColors.primary.withOpacity(0.08),
                        blurRadius: 16,
                        offset: const Offset(0, 4),
                      )
                    ]
                  : [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.03),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      )
                    ],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: List.generate(items.length, (index) {
                final item = items[index];
                final isSelected = index == currentIndex;

                return Expanded(
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => onTap(index),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // Selected top neon indicator line
                        AnimatedContainer(
                          duration: AppDurations.hover,
                          height: 3,
                          width: isSelected ? 24 : 0,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [AppColors.primary, AppColors.secondary],
                            ),
                            borderRadius: BorderRadius.circular(1.5),
                            boxShadow: isSelected
                                ? [
                                    BoxShadow(
                                      color: AppColors.primary.withOpacity(0.5),
                                      blurRadius: 6,
                                      spreadRadius: 1,
                                    )
                                  ]
                                : null,
                          ),
                        ),
                        const Spacer(),
                        // Nav Icon
                        AnimatedScale(
                          scale: isSelected ? 1.15 : 1.0,
                          duration: AppDurations.hover,
                          child: Icon(
                            isSelected ? item.activeIcon : item.icon,
                            color: isSelected
                                ? (isDark ? AppColors.secondary : AppColors.primary)
                                : theme.hintColor.withOpacity(0.6),
                            size: 24,
                          ),
                        ),
                        const SizedBox(height: 4),
                        // Label text
                        Text(
                          item.label,
                          style: theme.textTheme.labelMedium?.copyWith(
                            fontSize: 10,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                            color: isSelected
                                ? (isDark ? Colors.white : AppColors.lightTextPrimary)
                                : theme.hintColor.withOpacity(0.6),
                          ),
                        ),
                        const Spacer(),
                      ],
                    ),
                  ),
                );
              }),
            ),
          ),
        ),
      ),
    );
  }
}

class FloatingNavBarItem {
  final IconData icon;
  final IconData activeIcon;
  final String label;

  const FloatingNavBarItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
  });
}

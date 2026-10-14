import 'package:flutter/material.dart';

class PremiumBadge extends StatelessWidget {
  final double fontSize;
  final EdgeInsetsGeometry padding;

  const PremiumBadge({
    super.key,
    this.fontSize = 8.5,
    this.padding = const EdgeInsets.symmetric(horizontal: 5.5, vertical: 2.0),
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: const Color(0xFFE5AC18),
        borderRadius: BorderRadius.circular(4),
        boxShadow: const [
          BoxShadow(
            color: Color(0x55E5AC18),
            blurRadius: 4,
            offset: Offset(0, 1),
          ),
        ],
      ),
      child: Text(
        'PREMIUM',
        style: TextStyle(
          color: Colors.white,
          fontSize: fontSize,
          fontWeight: FontWeight.w900,
          letterSpacing: 0.4,
          height: 1.1,
        ),
      ),
    );
  }
}

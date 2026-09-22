import 'package:flutter/material.dart';

import '../utils/money.dart';

/// Counts up to [amount] once on first build.
class AnimatedBalance extends StatelessWidget {
  const AnimatedBalance({super.key, required this.amount, required this.style});

  final double amount;
  final TextStyle style;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0, end: amount),
      duration: const Duration(milliseconds: 1500),
      curve: Curves.easeOutExpo,
      builder: (context, value, _) =>
          Text('\$${formatMoney(value, decimals: false)}', style: style),
    );
  }
}

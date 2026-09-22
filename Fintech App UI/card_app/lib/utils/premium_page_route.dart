import 'package:flutter/material.dart';

/// A soft fade-through with a whisper of scale — keeps hero flights readable.
class PremiumPageRoute<T> extends PageRouteBuilder<T> {
  PremiumPageRoute({required this.child})
    : super(
        transitionDuration: const Duration(milliseconds: 520),
        reverseTransitionDuration: const Duration(milliseconds: 420),
        pageBuilder: (_, _, _) => child,
        transitionsBuilder: (_, animation, secondaryAnimation, page) {
          final curved = CurvedAnimation(
            parent: animation,
            curve: Curves.easeOutCubic,
            reverseCurve: Curves.easeInCubic,
          );

          return FadeTransition(
            opacity: curved,
            child: ScaleTransition(
              scale: Tween<double>(begin: 0.96, end: 1).animate(curved),
              child: page,
            ),
          );
        },
      );

  final Widget child;
}

import 'package:flutter/material.dart';

/// Sweeps a soft highlight diagonally across [child] — the polish that sells a
/// freshly earned badge.
///
/// Masked with [BlendMode.srcATop] so the highlight only lands on pixels the
/// child already painted, leaving its silhouette intact.
class Shine extends StatelessWidget {
  const Shine({
    super.key,
    required this.animation,
    required this.child,
    this.width = 0.16,
    this.intensity = 0.8,
  });

  /// Drives the highlight from just off one corner to just past the other.
  final Animation<double> animation;

  /// Half-width of the highlight as a fraction of the diagonal.
  final double width;
  final double intensity;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: animation,
      builder: (context, child) {
        // Travel past both ends so the highlight enters and leaves cleanly.
        final centre = animation.value * (1 + width * 4) - width * 2;

        return ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (bounds) => LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Colors.transparent,
              Colors.white.withValues(alpha: intensity),
              Colors.transparent,
            ],
            stops: [
              (centre - width).clamp(0.0, 1.0),
              centre.clamp(0.0, 1.0),
              (centre + width).clamp(0.0, 1.0),
            ],
          ).createShader(bounds),
          child: child,
        );
      },
      child: child,
    );
  }
}

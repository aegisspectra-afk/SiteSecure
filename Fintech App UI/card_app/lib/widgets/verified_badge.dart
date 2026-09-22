import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import 'animated_check.dart';

/// The verified seal: a scalloped blue disc with a tick struck through it.
///
/// The scallops come from a sinusoid on the radius rather than a stack of
/// circles, so the shape stays smooth at any size and the bumps never seam.
class VerifiedBadge extends StatelessWidget {
  const VerifiedBadge({
    super.key,
    required this.size,
    this.color = AppColors.verified,
    this.tickColor = AppColors.white,
    this.progress = 1,
    this.outlineColor,
    this.outlineWidth = 0,
  });

  final double size;
  final Color color;
  final Color tickColor;

  /// 0 to 1 as the tick draws itself in.
  final double progress;

  /// Drawn as a larger seal behind the blue one, which is how the badge keeps
  /// its edge when it overlaps a photo.
  final Color? outlineColor;
  final double outlineWidth;

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: size,
      child: CustomPaint(
        painter: _SealPainter(
          color: color,
          outlineColor: outlineColor,
          outlineWidth: outlineWidth,
        ),
        child: Center(
          child: AnimatedCheck(
            progress: progress,
            color: tickColor,
            size: size * 0.58,
            strokeWidth: size * 0.1,
          ),
        ),
      ),
    );
  }
}

class _SealPainter extends CustomPainter {
  _SealPainter({
    required this.color,
    required this.outlineColor,
    required this.outlineWidth,
  });

  final Color color;
  final Color? outlineColor;
  final double outlineWidth;

  /// Scallops around the rim, and how deep the valleys cut.
  static const int _bumps = 11;
  static const double _depth = 0.075;

  @override
  void paint(Canvas canvas, Size size) {
    final centre = size.center(Offset.zero);
    final radius = size.width / 2;

    final outline = outlineColor;
    if (outline != null && outlineWidth > 0) {
      canvas.drawPath(_seal(centre, radius), Paint()..color = outline);
    }
    canvas.drawPath(
      _seal(centre, radius - outlineWidth),
      Paint()..color = color,
    );
  }

  Path _seal(Offset centre, double radius) {
    final path = Path();
    const steps = 240;
    for (var i = 0; i <= steps; i++) {
      final t = i / steps * 2 * math.pi;
      // Phase so a bump, not a valley, sits at the top.
      final r =
          radius * (1 - _depth + _depth * math.cos(_bumps * (t + math.pi / 2)));
      final point = centre + Offset(math.cos(t) * r, math.sin(t) * r);
      if (i == 0) {
        path.moveTo(point.dx, point.dy);
      } else {
        path.lineTo(point.dx, point.dy);
      }
    }
    return path..close();
  }

  @override
  bool shouldRepaint(_SealPainter old) =>
      old.color != color ||
      old.outlineColor != outlineColor ||
      old.outlineWidth != outlineWidth;
}

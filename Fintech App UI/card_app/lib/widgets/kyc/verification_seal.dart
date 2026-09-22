import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';
import '../animated_check.dart';

/// The payoff: counter-rotating dashed rings that collapse into a solid ring
/// while the centre disc swells and draws a tick.
///
/// Processing and success share one widget so the two states are a single
/// continuous morph — nothing is torn down and rebuilt at the moment the user
/// is watching most closely.
class VerificationSeal extends StatelessWidget {
  const VerificationSeal({
    super.key,
    required this.diameter,
    required this.spin,
    required this.progress,
    required this.success,
    required this.icon,
  });

  final double diameter;

  /// Free-running 0..1 driving the rings.
  final double spin;

  /// Share of the checks completed, drawn as an arc on the outer ring.
  final double progress;

  /// 0 while processing, 1 once verified.
  final double success;

  /// Swapped as each check completes; hidden once [success] takes over.
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    // A touch of overshoot so the disc lands with weight.
    final pop = Curves.easeOutBack.transform(success.clamp(0.0, 1.0));
    final discSize = diameter * (0.44 + 0.14 * pop);

    return SizedBox(
      width: diameter,
      height: diameter,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Positioned.fill(
            child: CustomPaint(
              painter: _SealPainter(
                spin: spin,
                progress: progress,
                success: success,
              ),
            ),
          ),
          Container(
            width: discSize,
            height: discSize,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color.lerp(
                    KycColors.elevated,
                    KycColors.accent.withValues(alpha: 0.22),
                    success,
                  )!,
                  Color.lerp(
                    KycColors.surface,
                    KycColors.accentDim.withValues(alpha: 0.30),
                    success,
                  )!,
                ],
              ),
              border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
            ),
            child: Center(
              child: success < 0.18
                  ? AnimatedSwitcher(
                      duration: const Duration(milliseconds: 420),
                      transitionBuilder: (child, animation) => FadeTransition(
                        opacity: animation,
                        child: ScaleTransition(
                          scale: Tween<double>(
                            begin: 0.6,
                            end: 1,
                          ).animate(animation),
                          child: child,
                        ),
                      ),
                      child: Icon(
                        icon,
                        key: ValueKey(icon.codePoint),
                        size: diameter * 0.16,
                        color: KycColors.accent,
                      ),
                    )
                  : AnimatedCheck(
                      // Give the disc a beat to settle before the tick starts.
                      progress: ((success - 0.18) / 0.55).clamp(0.0, 1.0),
                      color: Colors.white,
                      size: discSize * 0.72,
                      strokeWidth: discSize * 0.075,
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SealPainter extends CustomPainter {
  _SealPainter({
    required this.spin,
    required this.progress,
    required this.success,
  });

  final double spin;
  final double progress;
  final double success;

  @override
  void paint(Canvas canvas, Size size) {
    final centre = size.center(Offset.zero);
    final outer = size.width / 2 - 2;

    // Every ring belongs to the wait. Once the tick starts landing they clear
    // out, so success is the disc and the tick and nothing else.
    final fade = (1 - success * 2.4).clamp(0.0, 1.0);
    if (fade <= 0.01) return;

    _dashes(
      canvas,
      centre,
      outer - 28,
      spin * 2 * math.pi,
      32,
      0.42,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeCap = StrokeCap.round
        ..color = Colors.white.withValues(alpha: 0.16 * fade),
    );
    _dashes(
      canvas,
      centre,
      outer - 8,
      -spin * 2 * math.pi * 0.7,
      18,
      0.28,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round
        ..color = KycColors.accent.withValues(alpha: 0.30 * fade),
    );

    // How far through the checks we are, and no further — it never closes into
    // a ring of its own.
    if (progress > 0) {
      canvas.drawArc(
        Rect.fromCircle(center: centre, radius: outer - 8),
        -math.pi / 2,
        progress * 2 * math.pi,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.5
          ..strokeCap = StrokeCap.round
          ..color = KycColors.accent.withValues(alpha: 0.55 * fade),
      );
    }
  }

  void _dashes(
    Canvas canvas,
    Offset centre,
    double radius,
    double rotation,
    int count,
    double fill,
    Paint paint,
  ) {
    final step = 2 * math.pi / count;
    final rect = Rect.fromCircle(center: centre, radius: radius);
    for (var i = 0; i < count; i++) {
      canvas.drawArc(rect, rotation + i * step, step * fill, false, paint);
    }
  }

  @override
  bool shouldRepaint(_SealPainter old) =>
      old.spin != spin || old.progress != progress || old.success != success;
}

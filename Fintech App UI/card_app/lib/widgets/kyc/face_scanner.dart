import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';
import 'scan_beam.dart';

/// Circular face scanner: a ring of ticks that fill with progress, a sweep arc
/// chasing around the rim, and a beam that lights a dot mesh as it crosses the
/// face.
///
/// The mesh is the part that sells it — dots glow as a function of their
/// distance from the beam, so the light appears to wrap the face rather than
/// pass in front of it.
class FaceScanner extends StatelessWidget {
  const FaceScanner({
    super.key,
    required this.diameter,
    required this.progress,
    required this.spin,
    required this.beam,
    required this.beamOpacity,
    required this.settle,
  });

  final double diameter;

  /// Share of the rim ticks that have lit.
  final double progress;

  /// Free-running 0..1 driving the sweep arc.
  final double spin;

  /// Beam position across the disc, 0 at the top.
  final double beam;
  final double beamOpacity;

  /// Cross-fades the whole scanner into its verified colouring.
  final double settle;

  /// Gap between the outer tick ring and the face disc.
  static const double _ringInset = 20;

  @override
  Widget build(BuildContext context) {
    final discSize = diameter - _ringInset * 2;

    return SizedBox(
      width: diameter,
      height: diameter,
      child: Stack(
        alignment: Alignment.center,
        children: [
          ClipOval(
            child: SizedBox(
              width: discSize,
              height: discSize,
              child: Stack(
                children: [
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(
                          colors: [
                            Color.lerp(
                              KycColors.elevated,
                              const Color(0xFF26251F),
                              settle,
                            )!,
                            KycColors.surface,
                          ],
                        ),
                      ),
                    ),
                  ),
                  Positioned.fill(
                    child: CustomPaint(
                      painter: _FacePainter(
                        beam: beam,
                        beamActive: beamOpacity,
                        settle: settle,
                        progress: progress,
                      ),
                    ),
                  ),
                  if (beamOpacity > 0.01)
                    Positioned(
                      left: 0,
                      right: 0,
                      top: discSize * beam - 44,
                      height: 88,
                      child: Opacity(
                        opacity: beamOpacity.clamp(0.0, 1.0),
                        child: const ScanBeam(spread: 0.20),
                      ),
                    ),
                ],
              ),
            ),
          ),
          Positioned.fill(
            child: CustomPaint(
              painter: _RingPainter(
                progress: progress,
                spin: spin,
                settle: settle,
                discRadius: discSize / 2,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Head outline plus the point mesh that the beam lights up.
class _FacePainter extends CustomPainter {
  _FacePainter({
    required this.beam,
    required this.beamActive,
    required this.settle,
    required this.progress,
  });

  final double beam;
  final double beamActive;
  final double settle;
  final double progress;

  static const int _cols = 9;
  static const int _rows = 11;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final ink = Color.lerp(
      Colors.white.withValues(alpha: 0.34),
      KycColors.accent,
      settle,
    )!;

    final head = _headPath(size);
    canvas.drawPath(
      head,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.6
        ..color = ink,
    );

    // Features, drawn inside the head.
    final feature = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6
      ..strokeCap = StrokeCap.round
      ..color = ink.withValues(alpha: ink.a * 0.9);

    for (final dx in [-0.085, 0.085]) {
      canvas.drawArc(
        Rect.fromCenter(
          center: Offset(w * (0.5 + dx), h * 0.455),
          width: w * 0.085,
          height: h * 0.05,
        ),
        math.pi,
        math.pi,
        false,
        feature,
      );
    }
    canvas.drawLine(
      Offset(w * 0.5, h * 0.48),
      Offset(w * 0.5, h * 0.56),
      feature,
    );
    canvas.drawArc(
      Rect.fromCenter(
        center: Offset(w * 0.5, h * 0.615),
        width: w * 0.16,
        height: h * 0.07,
      ),
      0,
      math.pi,
      false,
      feature,
    );

    _paintMesh(canvas, size, head);
  }

  /// A stylised head: wide cranium tapering into a soft chin.
  Path _headPath(Size size) {
    final w = size.width;
    final h = size.height;
    return Path()
      ..moveTo(w * 0.5, h * 0.22)
      ..cubicTo(w * 0.73, h * 0.22, w * 0.78, h * 0.40, w * 0.76, h * 0.54)
      ..cubicTo(w * 0.74, h * 0.70, w * 0.63, h * 0.80, w * 0.5, h * 0.80)
      ..cubicTo(w * 0.37, h * 0.80, w * 0.26, h * 0.70, w * 0.24, h * 0.54)
      ..cubicTo(w * 0.22, h * 0.40, w * 0.27, h * 0.22, w * 0.5, h * 0.22)
      ..close();
  }

  void _paintMesh(Canvas canvas, Size size, Path head) {
    if (beamActive <= 0.01 && progress <= 0) return;

    final bounds = head.getBounds();
    final beamY = size.height * beam;
    // How far from the beam a dot still catches light.
    final falloff = size.height * 0.16;
    final dot = Paint();

    for (var r = 0; r < _rows; r++) {
      for (var c = 0; c < _cols; c++) {
        final p = Offset(
          bounds.left + bounds.width * (c + 0.5) / _cols,
          bounds.top + bounds.height * (r + 0.5) / _rows,
        );
        if (!head.contains(p)) continue;

        final distance = (p.dy - beamY).abs() / falloff;
        final lit = math.exp(-distance * distance) * beamActive;
        // Dots the beam has already crossed keep a faint charge.
        final held = p.dy < beamY ? 0.16 * progress : 0.06 * progress;
        final alpha = (lit + held).clamp(0.0, 1.0);
        if (alpha < 0.02) continue;

        dot.color = KycColors.accent.withValues(alpha: alpha);
        canvas.drawCircle(p, 1.1 + lit * 1.5, dot);
      }
    }
  }

  @override
  bool shouldRepaint(_FacePainter old) =>
      old.beam != beam ||
      old.beamActive != beamActive ||
      old.settle != settle ||
      old.progress != progress;
}

/// Rim ticks, the chasing sweep arc, and the ring that closes on success.
class _RingPainter extends CustomPainter {
  _RingPainter({
    required this.progress,
    required this.spin,
    required this.settle,
    required this.discRadius,
  });

  final double progress;
  final double spin;
  final double settle;
  final double discRadius;

  static const int _ticks = 64;

  @override
  void paint(Canvas canvas, Size size) {
    final centre = size.center(Offset.zero);
    final outer = size.width / 2;

    // Rim ticks, starting at twelve o'clock.
    final lit = progress * _ticks;
    for (var i = 0; i < _ticks; i++) {
      final angle = -math.pi / 2 + i * 2 * math.pi / _ticks;
      // Feather the leading tick so the ring fills smoothly, not in steps.
      final on = (lit - i).clamp(0.0, 1.0);
      final length = 5 + 6 * on;
      final direction = Offset(math.cos(angle), math.sin(angle));

      canvas.drawLine(
        centre + direction * (outer - length),
        centre + direction * outer,
        Paint()
          ..strokeWidth = 2
          ..strokeCap = StrokeCap.round
          ..color = Color.lerp(
            Colors.white.withValues(alpha: 0.13),
            KycColors.accent,
            on,
          )!,
      );
    }

    final discRect = Rect.fromCircle(center: centre, radius: discRadius);

    // Chasing arc — fades out as the scan settles.
    final chase = (1 - settle).clamp(0.0, 1.0);
    if (chase > 0.01) {
      const length = math.pi * 0.55;
      final start = spin * 2 * math.pi;
      canvas.drawArc(
        discRect,
        start,
        length,
        false,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.6
          ..strokeCap = StrokeCap.round
          ..shader = SweepGradient(
            startAngle: start,
            endAngle: start + length,
            tileMode: TileMode.decal,
            colors: [
              KycColors.accent.withValues(alpha: 0),
              KycColors.accent.withValues(alpha: 0.9 * chase),
            ],
          ).createShader(discRect),
      );
    }

    // Disc rim, closing into solid accent on success.
    canvas.drawCircle(
      centre,
      discRadius,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.4 + settle
        ..color = Color.lerp(
          Colors.white.withValues(alpha: 0.10),
          KycColors.accent,
          settle,
        )!,
    );
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.progress != progress ||
      old.spin != spin ||
      old.settle != settle ||
      old.discRadius != discRadius;
}

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';
import 'scan_beam.dart';

/// A stylised ID card with a beam running down it.
///
/// The document is painted twice — once unread, once lit — and the lit copy is
/// clipped to whatever the beam has already passed, so the card fills in
/// behind the line instead of the line merely sliding over a static picture.
class IdDocumentScanner extends StatelessWidget {
  const IdDocumentScanner({
    super.key,
    required this.width,
    required this.beam,
    required this.beamOpacity,
    required this.reveal,
    required this.verified,
    required this.bracket,
    required this.pulse,
  });

  /// Card-relative position of the beam, 0 at the top edge, 1 at the bottom.
  final double beam;
  final double beamOpacity;

  /// Share of the card that has been read.
  final double reveal;

  /// Settles the frame from neutral grey into accent once the read passes.
  final double verified;

  /// Entrance of the corner brackets.
  final double bracket;

  /// Free-running 0..1 used for the brackets' breathing.
  final double pulse;

  final double width;

  /// Gap between the card edge and the corner brackets.
  static const double inset = 18;

  /// ID-1, the passport and identity card standard.
  static const double aspect = 85.6 / 54;

  @override
  Widget build(BuildContext context) {
    final cardWidth = width - inset * 2;
    final cardHeight = cardWidth / aspect;
    final frameColor = Color.lerp(
      Colors.white.withValues(alpha: 0.30),
      KycColors.accent,
      verified,
    )!;

    return SizedBox(
      width: width,
      height: cardHeight + inset * 2,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Center(
            child: SizedBox(
              width: cardWidth,
              height: cardHeight,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: Stack(
                  children: [
                    Positioned.fill(
                      child: CustomPaint(painter: _DocumentPainter(lit: 0)),
                    ),
                    Positioned.fill(
                      child: ClipRect(
                        clipper: _TopFractionClipper(reveal),
                        child: CustomPaint(
                          painter: _DocumentPainter(lit: 1 - verified * 0.35),
                        ),
                      ),
                    ),
                    if (beamOpacity > 0.01)
                      Positioned(
                        left: 0,
                        right: 0,
                        top: cardHeight * beam - 56,
                        height: 112,
                        child: Opacity(
                          opacity: beamOpacity.clamp(0.0, 1.0),
                          child: const ScanBeam(),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
          // Sits above the card so the frame never gets clipped by it.
          Positioned.fill(
            child: CustomPaint(
              painter: _BracketPainter(
                entrance: bracket,
                color: frameColor,
                breath: verified > 0.5 ? 0 : math.sin(pulse * math.pi * 2),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Reveals the top [fraction] of the child.
class _TopFractionClipper extends CustomClipper<Rect> {
  const _TopFractionClipper(this.fraction);

  final double fraction;

  @override
  Rect getClip(Size size) =>
      Rect.fromLTWH(0, 0, size.width, size.height * fraction.clamp(0.0, 1.0));

  @override
  bool shouldReclip(_TopFractionClipper old) => old.fraction != fraction;
}

/// The card face: portrait, data lines and a machine-readable strip.
///
/// [lit] cross-fades every element from dormant grey to accent, which is what
/// gives the reveal its "data extracted" feel.
class _DocumentPainter extends CustomPainter {
  _DocumentPainter({required this.lit});

  final double lit;

  Color _ink(double alpha) => Color.lerp(
    Colors.white.withValues(alpha: alpha * 0.55),
    KycColors.accent.withValues(alpha: alpha),
    lit,
  )!;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final radius = 18 * (w / 300);

    canvas.drawRRect(
      RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(radius)),
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color.lerp(const Color(0xFF1C1C1B), const Color(0xFF34332E), lit)!,
            Color.lerp(const Color(0xFF121211), const Color(0xFF232320), lit)!,
          ],
        ).createShader(Offset.zero & size),
    );

    // Portrait.
    final photo = RRect.fromRectAndRadius(
      Rect.fromLTWH(w * 0.07, h * 0.17, w * 0.22, h * 0.52),
      Radius.circular(w * 0.022),
    );
    canvas.drawRRect(photo, Paint()..color = _ink(0.10));
    _paintAvatar(canvas, photo.outerRect);

    // Header line and data rows to the right of the portrait.
    final textLeft = w * 0.35;
    _bar(canvas, textLeft, h * 0.19, w * 0.30, h * 0.055, _ink(0.42));
    for (var i = 0; i < 3; i++) {
      _bar(
        canvas,
        textLeft,
        h * (0.34 + i * 0.13),
        w * [0.48, 0.38, 0.44][i],
        h * 0.045,
        _ink(0.22),
      );
    }

    // Machine-readable zone.
    final dash = w * 0.022;
    for (var row = 0; row < 2; row++) {
      final y = h * (0.79 + row * 0.085);
      var x = w * 0.07;
      var i = 0;
      while (x < w * 0.93) {
        // Irregular gaps keep it from reading as a dotted rule.
        final span = dash * (i % 4 == 3 ? 1.9 : 1);
        _bar(canvas, x, y, span, h * 0.032, _ink(0.26));
        x += span + dash * 0.5;
        i++;
      }
    }

    if (lit > 0) {
      // A faint inner rim sells the card as active rather than printed.
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          (Offset.zero & size).deflate(0.75),
          Radius.circular(radius),
        ),
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5
          ..color = KycColors.accent.withValues(alpha: 0.34 * lit),
      );
    }
  }

  void _paintAvatar(Canvas canvas, Rect box) {
    final paint = Paint()..color = _ink(0.28);
    final headRadius = box.width * 0.24;
    canvas.drawCircle(
      Offset(box.center.dx, box.top + box.height * 0.33),
      headRadius,
      paint,
    );
    canvas.drawPath(
      Path()..addArc(
        Rect.fromCenter(
          center: Offset(box.center.dx, box.bottom + box.height * 0.10),
          width: box.width * 0.86,
          height: box.height * 0.78,
        ),
        math.pi,
        math.pi,
      ),
      paint,
    );
  }

  void _bar(Canvas canvas, double x, double y, double w, double h, Color c) {
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(x, y, w, h),
        Radius.circular(h / 2),
      ),
      Paint()..color = c,
    );
  }

  @override
  bool shouldRepaint(_DocumentPainter old) => old.lit != lit;
}

/// Four corner brackets that frame the document, as a camera would.
class _BracketPainter extends CustomPainter {
  _BracketPainter({
    required this.entrance,
    required this.color,
    required this.breath,
  });

  final double entrance;
  final Color color;

  /// -1..1 breathing offset applied outward from the centre.
  final double breath;

  @override
  void paint(Canvas canvas, Size size) {
    if (entrance <= 0) return;

    // Brackets drift in from outside and settle onto the frame.
    final drift = (1 - entrance) * 14 + breath * 2.5;
    final rect = (Offset.zero & size).deflate(-drift);
    final arm = size.width * 0.085;
    const corner = 14.0;

    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = color.withValues(alpha: color.a * entrance);

    final path = Path();
    for (final (corner_, dx, dy) in [
      (rect.topLeft, 1.0, 1.0),
      (rect.topRight, -1.0, 1.0),
      (rect.bottomRight, -1.0, -1.0),
      (rect.bottomLeft, 1.0, -1.0),
    ]) {
      path
        ..moveTo(corner_.dx + dx * (corner + arm), corner_.dy)
        ..lineTo(corner_.dx + dx * corner, corner_.dy)
        ..quadraticBezierTo(
          corner_.dx,
          corner_.dy,
          corner_.dx,
          corner_.dy + dy * corner,
        )
        ..lineTo(corner_.dx, corner_.dy + dy * (corner + arm));
    }
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(_BracketPainter old) =>
      old.entrance != entrance || old.color != color || old.breath != breath;
}

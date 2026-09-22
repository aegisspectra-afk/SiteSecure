import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// A round rubber stamp that comes down hard on the slip: it drops in from
/// above the page, squashes on impact, settles, and leaves slightly worn ink.
class PaidStamp extends StatelessWidget {
  const PaidStamp({
    super.key,
    required this.progress,
    required this.caption,
    this.size = 88,
  });

  /// 0 (lifted, unseen) to 1 (inked and settled).
  final Animation<double> progress;

  /// Small print under PAID, e.g. the date.
  final String caption;

  final double size;

  /// Share of [progress] at which the stamp meets the paper.
  static const double impact = 0.5;

  static const Color ink = Color(0xFF1C7A53);

  /// The faces the stamp is cut in, for warming up ahead of time.
  static TextStyle word({double size = 18}) => GoogleFonts.plusJakartaSans(
    fontSize: size,
    height: 1,
    fontWeight: FontWeight.w800,
    letterSpacing: size * 0.1,
    color: ink,
  );

  static TextStyle small({double size = 7.5}) => GoogleFonts.dmMono(
    fontSize: size,
    height: 1,
    fontWeight: FontWeight.w500,
    color: ink,
  );

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: progress,
        builder: (context, child) {
          final t = progress.value;

          double scale;
          double opacity;
          if (t < impact) {
            // Falling: big and faint, closing on the paper fast.
            final fall = Curves.easeInCubic.transform(t / impact);
            scale = 2.4 - 1.4 * fall;
            opacity = 0.9 * Curves.easeOut.transform(t / impact);
          } else {
            // Landed: a quick squash under the weight, then settle.
            final after = (t - impact) / (1 - impact);
            scale = 1 - 0.06 * math.sin(math.pi * after) * (1 - after);
            opacity = 0.9;
          }

          return Opacity(
            opacity: opacity,
            child: Transform.rotate(
              angle: -0.52 + 0.30 * Curves.easeOutCubic.transform(t),
              child: Transform.scale(scale: scale, child: child),
            ),
          );
        },
        // Rasterised once; only its transform changes while it falls.
        child: RepaintBoundary(
          child: CustomPaint(
            size: Size.square(size),
            painter: _StampPainter(
              word: word(size: size * 0.2),
              small: small(size: size * 0.085),
              caption: caption,
            ),
          ),
        ),
      ),
    );
  }
}

class _StampPainter extends CustomPainter {
  _StampPainter({
    required this.word,
    required this.small,
    required this.caption,
  });

  final TextStyle word;
  final TextStyle small;
  final String caption;

  static const String _ring = 'PAYMENT RECEIVED • THANK YOU • ';

  @override
  void paint(Canvas canvas, Size size) {
    final centre = size.center(Offset.zero);
    final radius = size.shortestSide / 2;

    // One layer for all the ink, so the wear below can lift it back off.
    canvas.saveLayer(Offset.zero & size, Paint());

    final line = Paint()
      ..style = PaintingStyle.stroke
      ..color = PaidStamp.ink;
    canvas.drawCircle(centre, radius - 1.5, line..strokeWidth = 2.6);
    canvas.drawCircle(centre, radius * 0.70, line..strokeWidth = 1.1);

    _ringText(canvas, centre, radius * 0.855 - 1);

    final paid = _layout('PAID', word);
    final date = _layout(caption, small);
    const gap = 4.0;
    final top = centre.dy - (paid.height + gap + date.height) / 2;
    // Letter spacing trails the last letter too; shift back by half of it.
    final tracking = (word.letterSpacing ?? 0) / 2;
    paid.paint(canvas, Offset(centre.dx - paid.width / 2 + tracking, top));
    date.paint(
      canvas,
      Offset(centre.dx - date.width / 2, top + paid.height + gap),
    );

    // Rubber never inks evenly: knock a scatter of flecks back out.
    final random = math.Random(9);
    final wear = Paint()..blendMode = BlendMode.dstOut;
    for (var i = 0; i < 170; i++) {
      final angle = random.nextDouble() * math.pi * 2;
      final distance = math.sqrt(random.nextDouble()) * radius;
      wear.color = Color.fromRGBO(0, 0, 0, 0.25 + random.nextDouble() * 0.6);
      canvas.drawCircle(
        centre + Offset(math.cos(angle), math.sin(angle)) * distance,
        0.3 + random.nextDouble() * 0.9,
        wear,
      );
    }

    canvas.restore();
  }

  /// Sets [_ring] evenly around the full circle, letters standing outward.
  void _ringText(Canvas canvas, Offset centre, double radius) {
    final glyphs = [for (final char in _ring.split('')) _layout(char, small)];
    final total = glyphs.fold<double>(0, (sum, glyph) => sum + glyph.width);

    var angle = -math.pi / 2;
    for (final glyph in glyphs) {
      final sweep = glyph.width / total * math.pi * 2;
      canvas
        ..save()
        ..translate(centre.dx, centre.dy)
        ..rotate(angle + sweep / 2 + math.pi / 2);
      glyph.paint(canvas, Offset(-glyph.width / 2, -radius - glyph.height / 2));
      canvas.restore();
      angle += sweep;
    }
  }

  TextPainter _layout(String text, TextStyle style) => TextPainter(
    text: TextSpan(text: text, style: style),
    textDirection: TextDirection.ltr,
  )..layout();

  @override
  bool shouldRepaint(_StampPainter old) =>
      old.word != word || old.small != small || old.caption != caption;
}

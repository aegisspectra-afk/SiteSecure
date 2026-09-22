import 'dart:math' as math;
import 'dart:ui' show PointMode;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../models/order_receipt.dart';
import '../../utils/money.dart';
import 'paid_stamp.dart';

/// The printed slip: warm thermal stock with a torn foot, the order set in
/// monospace, a barcode, and a PAID stamp that lands once it is out.
class ReceiptPaper extends StatelessWidget {
  const ReceiptPaper({super.key, required this.receipt, required this.stamp});

  /// Layout width. Fixed, so the printer can cut its slot to fit and the two
  /// scale down together on small screens.
  static const double width = 300;

  static const Color stock = Color(0xFFFAF8F3);
  static const Color ink = Color(0xFF1B1A18);
  static const Color inkSoft = Color(0xFF7A776F);

  /// Depth of the saw teeth along the torn foot.
  static const double tooth = 7;

  final OrderReceipt receipt;

  /// Drives the PAID stamp; see [PaidStamp].
  final Animation<double> stamp;

  /// Fetches the slip's typefaces ahead of time, so it never feeds out in a
  /// fallback face and swaps mid-print.
  static Future<void> warmUp() async {
    try {
      await GoogleFonts.pendingFonts([
        mono(),
        mono(weight: FontWeight.w500),
        _serif(),
        PaidStamp.word(),
        PaidStamp.small(),
      ]);
    } catch (_) {
      // Offline: the slip still prints, just in the platform's default face.
    }
  }

  /// The slip's typewriter face.
  static TextStyle mono({
    double size = 11,
    FontWeight weight = FontWeight.w400,
    Color color = ink,
    double spacing = 0,
  }) => GoogleFonts.dmMono(
    fontSize: size,
    height: 1.3,
    fontWeight: weight,
    color: color,
    letterSpacing: spacing,
  );

  static TextStyle _serif() => GoogleFonts.instrumentSerif(
    fontSize: 19,
    height: 1.1,
    fontStyle: FontStyle.italic,
    color: ink,
  );

  @override
  Widget build(BuildContext context) {
    // Its own layer: the slip only ever moves as a whole, so it is painted
    // once and then just composited as it feeds, swings and falls.
    return RepaintBoundary(
      child: SizedBox(
        width: width,
        child: CustomPaint(
          painter: const _SlipShadow(),
          child: ClipPath(
            clipper: const _TornFoot(),
            child: CustomPaint(
              painter: const _Stock(),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(22, 24, 22, 18 + tooth),
                child: _Slip(receipt: receipt, stamp: stamp),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Slip extends StatelessWidget {
  const _Slip({required this.receipt, required this.stamp});

  final OrderReceipt receipt;
  final Animation<double> stamp;

  @override
  Widget build(BuildContext context) {
    final soft = ReceiptPaper.mono(size: 9.5, color: ReceiptPaper.inkSoft);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Tracking trails the last letter too; pad the front to recentre.
        const Padding(
          padding: EdgeInsets.only(left: 7),
          child: Text(
            'SLATE',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 22,
              height: 1,
              fontWeight: FontWeight.w700,
              letterSpacing: 7,
              color: ReceiptPaper.ink,
            ),
          ),
        ),
        const SizedBox(height: 7),
        Text(
          'CARD ORDER RECEIPT',
          textAlign: TextAlign.center,
          style: ReceiptPaper.mono(
            size: 9,
            color: ReceiptPaper.inkSoft,
            spacing: 2.6,
          ),
        ),
        const SizedBox(height: 18),
        const _Dashes(),
        const SizedBox(height: 11),
        _Pair('RECEIPT', receipt.number),
        _Pair('DATE', '${receipt.date} · ${receipt.time}'),
        _Pair('CARDHOLDER', receipt.tier.holder.toUpperCase()),
        const SizedBox(height: 11),
        const _Dashes(),
        const SizedBox(height: 14),
        Stack(
          clipBehavior: Clip.none,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var i = 0; i < receipt.lines.length; i++) ...[
                  if (i > 0) const SizedBox(height: 9),
                  _Item(receipt.lines[i]),
                ],
                const SizedBox(height: 16),
                const ColoredBox(
                  color: ReceiptPaper.ink,
                  child: SizedBox(height: 1.2),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    const Text(
                      'TOTAL',
                      style: TextStyle(
                        fontSize: 15,
                        height: 1.2,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.2,
                        color: ReceiptPaper.ink,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      '\$${formatMoney(receipt.total)}',
                      style: const TextStyle(
                        fontSize: 19,
                        height: 1.2,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.4,
                        color: ReceiptPaper.ink,
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                  ],
                ),
              ],
            ),
            // Slammed down across the gap between TOTAL and the figure,
            // catching the last line above it like a real hand stamp would.
            Positioned(
              right: 80,
              bottom: -22,
              child: PaidStamp(progress: stamp, caption: receipt.date),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Text('PAID BY VISA', style: soft.copyWith(letterSpacing: 0.8)),
            const Spacer(),
            Text('APPROVED', style: soft.copyWith(letterSpacing: 0.8)),
          ],
        ),
        const SizedBox(height: 16),
        const _Dashes(),
        const SizedBox(height: 16),
        SizedBox(
          height: 44,
          child: CustomPaint(painter: _Barcode(receipt.number)),
        ),
        const SizedBox(height: 7),
        Text(
          receipt.number,
          textAlign: TextAlign.center,
          style: ReceiptPaper.mono(size: 9, spacing: 3.2),
        ),
        const SizedBox(height: 14),
        Text(
          'Thank you for choosing Slate.',
          textAlign: TextAlign.center,
          style: ReceiptPaper._serif(),
        ),
      ],
    );
  }
}

class _Pair extends StatelessWidget {
  const _Pair(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.5),
      child: Row(
        children: [
          Text(
            label,
            style: ReceiptPaper.mono(
              size: 9.5,
              color: ReceiptPaper.inkSoft,
              spacing: 0.8,
            ),
          ),
          const Spacer(),
          Text(value, style: ReceiptPaper.mono(size: 10.5)),
        ],
      ),
    );
  }
}

class _Item extends StatelessWidget {
  const _Item(this.line);

  final ReceiptLine line;

  @override
  Widget build(BuildContext context) {
    final style = ReceiptPaper.mono(size: 11.5, weight: FontWeight.w500);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(line.label, style: style),
              if (line.note case final note?)
                Padding(
                  padding: const EdgeInsets.only(top: 1),
                  child: Text(
                    note,
                    style: ReceiptPaper.mono(
                      size: 9.5,
                      color: ReceiptPaper.inkSoft,
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        Text(
          line.amount == 0 ? 'FREE' : '\$${formatMoney(line.amount)}',
          style: style,
        ),
      ],
    );
  }
}

/// A perforation-style dashed rule.
class _Dashes extends StatelessWidget {
  const _Dashes();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      height: 1,
      width: double.infinity,
      child: CustomPaint(painter: _DashPainter()),
    );
  }
}

class _DashPainter extends CustomPainter {
  const _DashPainter();

  @override
  void paint(Canvas canvas, Size size) {
    const dash = 4.0;
    const gap = 3.0;
    final paint = Paint()
      ..color = ReceiptPaper.inkSoft.withValues(alpha: 0.7)
      ..strokeWidth = 1;
    for (var x = 0.0; x < size.width; x += dash + gap) {
      canvas.drawLine(
        Offset(x, 0.5),
        Offset(math.min(x + dash, size.width), 0.5),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(_DashPainter old) => false;
}

/// Bars seeded from the receipt number, so a receipt always prints the same
/// code.
class _Barcode extends CustomPainter {
  const _Barcode(this.data);

  final String data;

  @override
  void paint(Canvas canvas, Size size) {
    final seed = data.codeUnits.fold<int>(
      17,
      (hash, unit) => (hash * 31 + unit) & 0x7fffffff,
    );
    final random = math.Random(seed);

    // Alternating bar and gap widths, in modules, opening on a guard.
    final widths = <int>[1, 1, 1];
    while (widths.fold<int>(0, (sum, w) => sum + w) < 86) {
      widths.add(1 + random.nextInt(random.nextDouble() < 0.7 ? 2 : 4));
    }
    // End on a bar, then close with the guard.
    if (widths.length.isEven) widths.add(1);
    widths.addAll(const [1, 1, 1, 1]);

    final modules = widths.fold<int>(0, (sum, w) => sum + w);
    final unit = size.width / modules;
    // Crisp edges read as print; anti-aliased ones read as a render.
    final paint = Paint()
      ..color = ReceiptPaper.ink
      ..isAntiAlias = false;

    var x = 0.0;
    for (var i = 0; i < widths.length; i++) {
      final width = widths[i] * unit;
      if (i.isEven) {
        canvas.drawRect(Rect.fromLTWH(x, 0, width, size.height), paint);
      }
      x += width;
    }
  }

  @override
  bool shouldRepaint(_Barcode old) => old.data != data;
}

/// The slip's outline: square across the top where it was cut, saw-toothed
/// along the foot where it was torn.
Path _outline(Size size) {
  final teeth = (size.width / 10).round();
  final step = size.width / teeth;
  final foot = size.height - ReceiptPaper.tooth;

  final path = Path()
    ..moveTo(0, 0)
    ..lineTo(size.width, 0)
    ..lineTo(size.width, foot);
  for (var i = teeth; i > 0; i--) {
    path
      ..lineTo(step * (i - 0.5), size.height)
      ..lineTo(step * (i - 1), foot);
  }
  return path..close();
}

class _TornFoot extends CustomClipper<Path> {
  const _TornFoot();

  @override
  Path getClip(Size size) => _outline(size);

  @override
  bool shouldReclip(_TornFoot old) => false;
}

class _SlipShadow extends CustomPainter {
  const _SlipShadow();

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawShadow(_outline(size), Colors.black, 10, false);
  }

  @override
  bool shouldRepaint(_SlipShadow old) => false;
}

/// Thermal paper: warm white, edges falling away a touch as if it still
/// holds the curl of the roll, two soft creases and a scatter of fibre.
class _Stock extends CustomPainter {
  const _Stock();

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    canvas.drawRect(rect, Paint()..color = ReceiptPaper.stock);

    canvas.drawRect(
      rect,
      Paint()
        ..shader = const LinearGradient(
          colors: [
            Color(0x14000000),
            Color(0x00000000),
            Color(0x00000000),
            Color(0x12000000),
          ],
          stops: [0, 0.09, 0.9, 1],
        ).createShader(rect),
    );

    _crease(canvas, size, at: 0.31, angle: -0.035);
    _crease(canvas, size, at: 0.68, angle: 0.05);

    final random = math.Random(5);
    final dark = <Offset>[];
    final light = <Offset>[];
    final count = (size.width * size.height / 110).round();
    for (var i = 0; i < count; i++) {
      (random.nextBool() ? dark : light).add(
        Offset(
          random.nextDouble() * size.width,
          random.nextDouble() * size.height,
        ),
      );
    }
    final fleck = Paint()
      ..strokeWidth = 1.1
      ..strokeCap = StrokeCap.round;
    canvas
      ..drawPoints(
        PointMode.points,
        dark,
        fleck..color = const Color(0x0D000000),
      )
      ..drawPoints(
        PointMode.points,
        light,
        fleck..color = const Color(0x99FFFFFF),
      );
  }

  /// A fold across the slip: a shade on one side, a catch of light on the
  /// other.
  void _crease(
    Canvas canvas,
    Size size, {
    required double at,
    required double angle,
  }) {
    final band = Rect.fromLTWH(-size.width, -8, size.width * 2, 16);
    canvas
      ..save()
      ..translate(size.width / 2, size.height * at)
      ..rotate(angle)
      ..drawRect(
        band,
        Paint()
          ..shader = const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color(0x00000000),
              Color(0x08000000),
              Color(0x66FFFFFF),
              Color(0x00FFFFFF),
            ],
            stops: [0, 0.48, 0.52, 1],
          ).createShader(band),
      )
      ..restore();
  }

  @override
  bool shouldRepaint(_Stock old) => false;
}

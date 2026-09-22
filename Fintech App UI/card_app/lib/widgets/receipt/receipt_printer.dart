import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';

/// What the printer's status light shows.
enum PrinterLight { off, busy, ready }

/// A brushed-titanium receipt printer with [paper] feeding out of its slot.
///
/// Driven entirely by its numbers, so one timeline upstream keeps the
/// machine, the paper and the haptics in step.
class ReceiptPrinter extends StatelessWidget {
  const ReceiptPrinter({
    super.key,
    required this.paperWidth,
    required this.paper,
    required this.feed,
    this.tilt = 0,
    this.tear = 0,
    this.wake = 0,
    this.light = PrinterLight.off,
  });

  final double paperWidth;
  final Widget paper;

  /// 0 with the paper all inside the machine, 1 with all of it out.
  final double feed;

  /// Swing of the slip about the slot, in radians.
  final double tilt;

  /// 0..1 as the slip is torn off and drops away.
  final double tear;

  /// 0..1 across the bump as the motor catches.
  final double wake;

  final PrinterLight light;

  static const double _height = 66;

  /// Where the paper leaves the machine, down from its top.
  static const double _slotY = 47;

  /// Body either side of the paper.
  static const double _shoulder = 24;

  @override
  Widget build(BuildContext context) {
    // The slot's throat shades the paper just under it — once there is
    // paper there to shade.
    final throat = (feed * 12).clamp(0.0, 1.0) * (1 - tear);

    return SizedBox(
      width: paperWidth + _shoulder * 2,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.topCenter,
        children: [
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: _height,
            child: Transform.scale(
              scale: 1 + 0.018 * math.sin(math.pi * wake),
              child: _Body(slotWidth: paperWidth + 14, light: light),
            ),
          ),
          // Sizes the machine: the slip hangs from the slot at full length,
          // and everything above the slot line is inside the printer.
          Padding(
            padding: const EdgeInsets.only(top: _slotY),
            child: ClipRect(
              clipper: const _BelowSlot(),
              child: Opacity(
                opacity: 1 - tear,
                child: Transform.translate(
                  offset: Offset(tear * 16, tear * 380),
                  child: Transform.rotate(
                    angle: tilt + tear * 0.12,
                    alignment: Alignment.topCenter,
                    child: FractionalTranslation(
                      translation: Offset(0, feed - 1),
                      child: paper,
                    ),
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            top: _slotY,
            width: paperWidth,
            height: 16,
            child: IgnorePointer(
              child: Opacity(
                opacity: throat,
                child: const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Color(0x47000000), Color(0x00000000)],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Hides whatever is still above the slot line, and nothing else — a slip
/// being torn off is free to fall past the bottom of the machine.
class _BelowSlot extends CustomClipper<Rect> {
  const _BelowSlot();

  @override
  Rect getClip(Size size) =>
      Rect.fromLTRB(-size.width, 0, size.width * 2, size.height * 4);

  @override
  bool shouldReclip(_BelowSlot old) => false;
}

class _Body extends StatelessWidget {
  const _Body({required this.slotWidth, required this.light});

  final double slotWidth;
  final PrinterLight light;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        RepaintBoundary(
          child: CustomPaint(
            painter: _BodyPainter(
              slotWidth: slotWidth,
              slotY: ReceiptPrinter._slotY,
            ),
          ),
        ),
        Positioned(
          left: 24,
          top: 26,
          // Engraved: dark in the cut, light catching its lower lip.
          child: Text(
            'SLATE',
            style: TextStyle(
              fontSize: 8.5,
              height: 1,
              fontWeight: FontWeight.w700,
              letterSpacing: 2.8,
              color: Colors.black.withValues(alpha: 0.34),
              shadows: [
                Shadow(
                  color: Colors.white.withValues(alpha: 0.75),
                  offset: const Offset(0, 0.8),
                ),
              ],
            ),
          ),
        ),
        Positioned(right: 24, top: 27, child: _StatusLight(light: light)),
      ],
    );
  }
}

/// The shell: turned titanium with a gloss along the top, rounded ends, and
/// the dark slot the paper comes out of.
class _BodyPainter extends CustomPainter {
  const _BodyPainter({required this.slotWidth, required this.slotY});

  final double slotWidth;
  final double slotY;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final body = RRect.fromRectAndRadius(
      rect,
      Radius.circular(size.height * 0.3),
    );

    // Cast shadow: a wide soft one, and a tight one where it meets the wall.
    canvas
      ..drawRRect(
        body.shift(const Offset(0, 14)),
        Paint()
          ..color = Colors.black.withValues(alpha: 0.55)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 16),
      )
      ..drawRRect(
        body.shift(const Offset(0, 3)),
        Paint()
          ..color = Colors.black.withValues(alpha: 0.5)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3),
      );

    canvas.drawRRect(
      body,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color(0xFFF3F2EF),
            Color(0xFFDEDCD7),
            Color(0xFFC4C2BC),
            Color(0xFFA9A7A1),
          ],
          stops: [0, 0.32, 0.7, 1],
        ).createShader(rect),
    );

    // Darken both ends, so it reads as a bar of turned metal.
    canvas.drawRRect(
      body,
      Paint()
        ..shader = const LinearGradient(
          colors: [
            Color(0x29000000),
            Color(0x00000000),
            Color(0x00000000),
            Color(0x29000000),
          ],
          stops: [0, 0.1, 0.9, 1],
        ).createShader(rect),
    );

    final gloss = RRect.fromLTRBR(
      10,
      3,
      size.width - 10,
      size.height * 0.36,
      Radius.circular(size.height * 0.18),
    );
    canvas.drawRRect(
      gloss,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.white.withValues(alpha: 0.85),
            Colors.white.withValues(alpha: 0),
          ],
        ).createShader(gloss.outerRect),
    );

    // Rim light along the top edge, fading into shade underneath.
    canvas.drawRRect(
      body.deflate(0.5),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.white.withValues(alpha: 0.9),
            Colors.white.withValues(alpha: 0),
            Colors.black.withValues(alpha: 0.25),
          ],
          stops: const [0, 0.5, 1],
        ).createShader(rect),
    );

    final slot = RRect.fromRectAndRadius(
      Rect.fromCenter(
        center: Offset(size.width / 2, slotY),
        width: slotWidth,
        height: 11,
      ),
      const Radius.circular(5.5),
    );
    // Light catching the lower lip, then the dark mouth itself.
    canvas
      ..drawRRect(
        slot.shift(const Offset(0, 1.2)),
        Paint()..color = Colors.white.withValues(alpha: 0.75),
      )
      ..drawRRect(
        slot,
        Paint()
          ..shader = const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF000000), Color(0xFF1A1A19), Color(0xFF2B2A28)],
          ).createShader(slot.outerRect),
      );
  }

  @override
  bool shouldRepaint(_BodyPainter old) =>
      old.slotWidth != slotWidth || old.slotY != slotY;
}

/// A pinpoint LED: dark when idle, pulsing while it prints, steady when done.
class _StatusLight extends StatefulWidget {
  const _StatusLight({required this.light});

  final PrinterLight light;

  @override
  State<_StatusLight> createState() => _StatusLightState();
}

class _StatusLightState extends State<_StatusLight>
    with SingleTickerProviderStateMixin {
  static const Color _unlit = Color(0xFF8E8C86);

  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 380),
  );

  @override
  void initState() {
    super.initState();
    _sync();
  }

  @override
  void didUpdateWidget(_StatusLight old) {
    super.didUpdateWidget(old);
    if (old.light != widget.light) _sync();
  }

  void _sync() {
    if (widget.light == PrinterLight.busy) {
      _pulse.repeat(reverse: true);
    } else {
      _pulse.stop();
    }
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _pulse,
      builder: (context, _) {
        final lit = switch (widget.light) {
          PrinterLight.off => 0.0,
          PrinterLight.busy => 0.35 + 0.65 * _pulse.value,
          PrinterLight.ready => 1.0,
        };

        return Container(
          width: 6,
          height: 6,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Color.lerp(_unlit, AppColors.positive, lit),
            border: Border.all(
              color: Colors.black.withValues(alpha: 0.25),
              width: 0.6,
            ),
            boxShadow: [
              if (lit > 0)
                BoxShadow(
                  color: AppColors.positive.withValues(alpha: 0.55 * lit),
                  blurRadius: 6,
                  spreadRadius: 0.5,
                ),
            ],
          ),
        );
      },
    );
  }
}

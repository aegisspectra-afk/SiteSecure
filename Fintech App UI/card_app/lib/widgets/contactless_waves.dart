import 'dart:math' as math;

import 'package:flutter/material.dart';

/// The three-arc contactless payment mark, drawn so it stays crisp at any size.
class ContactlessWaves extends StatelessWidget {
  const ContactlessWaves({super.key, required this.size, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(painter: _WavePainter(color)),
    );
  }
}

class _WavePainter extends CustomPainter {
  const _WavePainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = size.width * 0.085
      ..color = color;

    // Arcs radiate from a focus just off the left edge.
    final focus = Offset(-size.width * 0.18, size.height / 2);
    const sweep = math.pi * 0.62;

    for (var i = 1; i <= 3; i++) {
      final radius = size.width * 0.30 * i;
      canvas.drawArc(
        Rect.fromCircle(center: focus, radius: radius),
        -sweep / 2,
        sweep,
        false,
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(_WavePainter oldDelegate) => oldDelegate.color != color;
}

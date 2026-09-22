import 'package:flutter/material.dart';

/// A tick that draws itself, stroke-end first.
///
/// The two legs are one contour, so [PathMetric.extractPath] carries the draw
/// straight through the corner instead of popping the second leg in whole.
class AnimatedCheck extends StatelessWidget {
  const AnimatedCheck({
    super.key,
    required this.progress,
    required this.color,
    this.size = 96,
    this.strokeWidth = 7,
  });

  final double progress;
  final Color color;
  final double size;
  final double strokeWidth;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size.square(size),
      painter: _CheckPainter(
        progress: progress.clamp(0.0, 1.0),
        color: color,
        strokeWidth: strokeWidth,
      ),
    );
  }
}

class _CheckPainter extends CustomPainter {
  _CheckPainter({
    required this.progress,
    required this.color,
    required this.strokeWidth,
  });

  final double progress;
  final Color color;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    if (progress <= 0) return;

    final path = Path()
      ..moveTo(size.width * 0.24, size.height * 0.52)
      ..lineTo(size.width * 0.43, size.height * 0.71)
      ..lineTo(size.width * 0.77, size.height * 0.31);

    final drawn = Path();
    for (final metric in path.computeMetrics()) {
      drawn.addPath(
        metric.extractPath(0, metric.length * progress),
        Offset.zero,
      );
    }

    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = color;

    canvas.drawPath(drawn, paint);
  }

  @override
  bool shouldRepaint(_CheckPainter old) =>
      old.progress != progress ||
      old.color != color ||
      old.strokeWidth != strokeWidth;
}

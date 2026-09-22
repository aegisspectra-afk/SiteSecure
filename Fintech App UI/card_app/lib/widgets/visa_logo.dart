import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// The Visa wordmark, bundled with the app and tinted to match the card face.
///
/// Call [VisaLogo.precache] before `runApp` so the artwork is decoded up front
/// and every card — including the first one on home and the one flying between
/// screens — paints it on its very first frame. Falls back to a typeset mark
/// only if the artwork has not been loaded.
class VisaLogo extends StatelessWidget {
  const VisaLogo({super.key, required this.width, required this.color});

  final double width;
  final Color color;

  /// Intrinsic ratio of the source artwork (2500 x 812).
  static const double aspectRatio = 3.08;

  static const String _asset = 'assets/images/visa.svg';

  /// Decoded once and shared by every card.
  static PictureInfo? _artwork;

  /// Decodes the bundled artwork. Safe to call more than once.
  static Future<void> precache() async {
    if (_artwork != null) return;
    try {
      _artwork = await vg.loadPicture(const SvgAssetLoader(_asset), null);
    } catch (_) {
      // Leave it unset — the typeset fallback takes over.
    }
  }

  @override
  Widget build(BuildContext context) {
    final height = width / aspectRatio;
    final artwork = _artwork;

    return SizedBox(
      width: width,
      height: height,
      child: artwork == null
          ? _TypesetVisa(height: height, color: color)
          : CustomPaint(painter: _ArtworkPainter(artwork, color)),
    );
  }
}

/// Draws the decoded artwork scaled to fit, recoloured to a single ink.
class _ArtworkPainter extends CustomPainter {
  const _ArtworkPainter(this.artwork, this.color);

  final PictureInfo artwork;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final source = artwork.size;
    if (source.isEmpty) return;

    final scale = math.min(
      size.width / source.width,
      size.height / source.height,
    );
    final dx = (size.width - source.width * scale) / 2;
    final dy = (size.height - source.height * scale) / 2;

    canvas
      ..saveLayer(
        Offset.zero & size,
        Paint()..colorFilter = ColorFilter.mode(color, BlendMode.srcIn),
      )
      ..translate(dx, dy)
      ..scale(scale)
      ..drawPicture(artwork.picture)
      ..restore();
  }

  @override
  bool shouldRepaint(_ArtworkPainter oldDelegate) =>
      oldDelegate.artwork != artwork || oldDelegate.color != color;
}

class _TypesetVisa extends StatelessWidget {
  const _TypesetVisa({required this.height, required this.color});

  final double height;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return FittedBox(
      fit: BoxFit.contain,
      child: Text(
        'VISA',
        style: TextStyle(
          fontSize: height,
          height: 1,
          fontWeight: FontWeight.w800,
          fontStyle: FontStyle.italic,
          letterSpacing: -height * 0.02,
          color: color,
        ),
      ),
    );
  }
}

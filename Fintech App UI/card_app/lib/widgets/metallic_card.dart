import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../models/card_tier.dart';
import '../theme/app_colors.dart';
import 'contactless_waves.dart';
import 'visa_logo.dart';

/// The bare metal face: gradient, brushed-steel banding, edge light and shadow.
///
/// Kept separate from [MetallicCard] for places that show the plate without
/// printing, such as the back of the card.
class MetallicSurface extends StatelessWidget {
  const MetallicSurface({
    super.key,
    required this.tier,
    this.radius = 20,
    this.shadow = true,
  });

  final CardTier tier;
  final double radius;

  /// Cast a drop shadow. Off where the plate floats on its own, such as the
  /// picker carousel.
  final bool shadow;

  @override
  Widget build(BuildContext context) {
    final corners = BorderRadius.circular(radius);

    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: corners,
        boxShadow: shadow
            ? [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.30),
                  blurRadius: 30,
                  offset: const Offset(0, 16),
                ),
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.16),
                  blurRadius: 8,
                  offset: const Offset(0, 3),
                ),
              ]
            : null,
      ),
      child: ClipRRect(
        borderRadius: corners,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Base tone. Kept to a narrow range so the face reads as one
            // continuous piece of metal rather than a painted gradient.
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: tier.face,
                  stops: const [0.0, 0.30, 0.52, 0.76, 1.0],
                ),
              ),
            ),
            // Fine anisotropic grain — what actually sells brushed metal.
            const CustomPaint(painter: _BrushedGrain()),
            // Broad, low-contrast sheen off the top-left.
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Colors.white.withValues(alpha: 0.06),
                    Colors.transparent,
                    Colors.white.withValues(alpha: 0.03),
                    Colors.transparent,
                  ],
                  stops: const [0.0, 0.38, 0.60, 1.0],
                ),
              ),
            ),
            // Gentle vignette so the plate has depth at the edges.
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment.center,
                  radius: 0.98,
                  colors: [
                    Colors.transparent,
                    Colors.black.withValues(alpha: 0.085),
                  ],
                  stops: const [0.62, 1.0],
                ),
              ),
            ),
            // Polished rim.
            DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: corners,
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.22),
                  width: 0.7,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Hairline grain running along the plate's long axis.
class _BrushedGrain extends CustomPainter {
  const _BrushedGrain();

  @override
  void paint(Canvas canvas, Size size) {
    final alongWidth = size.width >= size.height;
    final span = alongWidth ? size.height : size.width;
    final length = alongWidth ? size.width : size.height;

    // Fixed seed: the grain is part of the material, so it must not change
    // between frames.
    final random = math.Random(11);
    final paint = Paint()..strokeWidth = 1;

    for (var offset = 0.0; offset < span; offset += 1.6) {
      final line = offset + random.nextDouble();
      if (line > span) break;

      paint.color = (random.nextBool() ? Colors.white : Colors.black)
          .withValues(alpha: 0.005 + random.nextDouble() * 0.019);

      canvas.drawLine(
        alongWidth ? Offset(0, line) : Offset(line, 0),
        alongWidth ? Offset(length, line) : Offset(line, length),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(_BrushedGrain oldDelegate) => false;
}

/// A full card: metal plate plus the printed details.
///
/// When [vertical] is true the whole landscape card turns a quarter clockwise
/// (shadow included) — exactly how the portrait card reads in the picker, and
/// what lets the hero flight turn one card into the other without a seam.
class MetallicCard extends StatelessWidget {
  const MetallicCard({
    super.key,
    required this.tier,
    this.vertical = false,
    this.radius = 20,
    this.shadow = true,
  });

  final CardTier tier;
  final bool vertical;
  final double radius;
  final bool shadow;

  @override
  Widget build(BuildContext context) {
    final card = Stack(
      fit: StackFit.expand,
      children: [
        MetallicSurface(tier: tier, radius: radius, shadow: shadow),
        _CardDetails(tier: tier),
      ],
    );

    // Carries the app's text style with the card, so the printing never falls
    // back to Flutter's yellow-underlined error style mid hero flight.
    return Material(
      type: MaterialType.transparency,
      child: vertical ? RotatedBox(quarterTurns: 1, child: card) : card,
    );
  }
}

/// Printed details. Always laid out landscape — [RotatedBox] hands it swapped
/// constraints for the portrait card, so the long edge is always `maxWidth`.
class _CardDetails extends StatelessWidget {
  const _CardDetails({required this.tier});

  final CardTier tier;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final long = constraints.maxWidth;
        final pad = long * 0.058;

        return Padding(
          padding: EdgeInsets.all(pad),
          child: Stack(
            children: [
              Align(
                alignment: Alignment.topRight,
                child: Transform.rotate(
                  angle: -math.pi / 4,
                  child: ContactlessWaves(
                    size: long * 0.082,
                    color: AppColors.cardInk.withValues(alpha: 0.78),
                  ),
                ),
              ),
              Align(
                alignment: Alignment.bottomLeft,
                child: Padding(
                  // Sit on the wordmark's baseline, clear of the tier label
                  // hanging below it.
                  padding: EdgeInsets.only(bottom: long * 0.040),
                  child: Text(
                    tier.holder,
                    style: TextStyle(
                      fontSize: long * 0.033,
                      height: 1,
                      fontWeight: FontWeight.w600,
                      letterSpacing: long * 0.004,
                      color: AppColors.cardInk,
                      shadows: [
                        // A hair of etch, as if laser-marked into the metal.
                        Shadow(
                          color: Colors.white.withValues(alpha: 0.28),
                          offset: const Offset(0, 0.7),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              Align(
                alignment: Alignment.bottomRight,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    VisaLogo(width: long * 0.20, color: AppColors.cardInk),
                    SizedBox(height: long * 0.012),
                    Text(
                      tier.name,
                      style: TextStyle(
                        fontSize: long * 0.028,
                        height: 1,
                        fontWeight: FontWeight.w500,
                        letterSpacing: long * 0.0015,
                        color: AppColors.cardInk.withValues(alpha: 0.85),
                        shadows: [
                          Shadow(
                            color: Colors.white.withValues(alpha: 0.26),
                            offset: const Offset(0, 0.7),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

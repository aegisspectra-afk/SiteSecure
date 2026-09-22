import 'dart:math' as math;
import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';

import '../models/card_tier.dart';
import 'metallic_card.dart';

/// Hero for a printed card that sits landscape on one screen and portrait on
/// the next — home to picker, picker to order.
///
/// The shuttle reads each end's orientation from the size it measures, so the
/// same flight turns the card whichever way it needs, pushing or popping.
class CardHero extends StatelessWidget {
  const CardHero({super.key, required this.tier, required this.child});

  final CardTier tier;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Hero(
      tag: tier.heroTag,
      flightShuttleBuilder: (_, animation, direction, fromHero, toHero) {
        final push = direction == HeroFlightDirection.push;

        return _TurningCardFlight(
          tier: tier,
          animation: animation,
          lower: _heroSize(push ? fromHero : toHero),
          upper: _heroSize(push ? toHero : fromHero),
        );
      },
      child: child,
    );
  }
}

/// A hero's size as its flight measures it: after transforms inside its page,
/// such as the carousel's scale-down, but before the route's own transition.
Size _heroSize(BuildContext heroContext) {
  final box = heroContext.findRenderObject()! as RenderBox;
  final page = ModalRoute.of(heroContext)?.subtreeContext?.findRenderObject();
  return MatrixUtils.transformRect(
    box.getTransformTo(page),
    Offset.zero & box.size,
  ).size;
}

/// The printed card flying between two slots, turning a quarter when one is
/// portrait and the other landscape.
///
/// It is always the landscape card, grown or shrunk and rotated about the
/// flight's centre — at a portrait end that is exactly [MetallicCard] with
/// `vertical`, so the landing is seamless and nothing has to fade.
class _TurningCardFlight extends StatelessWidget {
  const _TurningCardFlight({
    required this.tier,
    required this.animation,
    required this.lower,
    required this.upper,
  });

  final CardTier tier;

  /// The upper route's animation: 0 is the card on the route beneath, 1 the
  /// card on the route above, whichever way the flight is going.
  final Animation<double> animation;

  final Size lower;
  final Size upper;

  static bool _portrait(Size size) => size.height > size.width;
  static double _long(Size size) => math.max(size.width, size.height);
  static double _short(Size size) => math.min(size.width, size.height);
  static double _turn(Size size) => _portrait(size) ? math.pi / 2 : 0;
  static double _radius(Size size) => _portrait(size) ? 22 : 20;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: animation,
      builder: (context, _) {
        final t = Curves.easeInOutCubic.transform(animation.value);
        // The card's own edges before it is turned.
        final long = lerpDouble(_long(lower), _long(upper), t)!;
        final short = lerpDouble(_short(lower), _short(upper), t)!;

        return OverflowBox(
          minWidth: long,
          maxWidth: long,
          minHeight: short,
          maxHeight: short,
          child: Transform.rotate(
            angle: lerpDouble(_turn(lower), _turn(upper), t)!,
            child: MetallicCard(
              tier: tier,
              radius: lerpDouble(_radius(lower), _radius(upper), t)!,
              shadow: false,
            ),
          ),
        );
      },
    );
  }
}

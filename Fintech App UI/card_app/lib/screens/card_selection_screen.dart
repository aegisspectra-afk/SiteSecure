import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../models/card_tier.dart';
import '../theme/app_colors.dart';
import '../utils/premium_page_route.dart';
import '../widgets/card_hero.dart';
import '../widgets/metallic_card.dart';
import 'order_confirmation_screen.dart';

class CardSelectionScreen extends StatefulWidget {
  const CardSelectionScreen({super.key});

  @override
  State<CardSelectionScreen> createState() => _CardSelectionScreenState();
}

class _CardSelectionScreenState extends State<CardSelectionScreen>
    with SingleTickerProviderStateMixin {
  static const double _viewportFraction = 0.66;

  /// One complete turn per page of scroll, carried by the card on the right
  /// of centre: it spins in as you swipe forward and out as you swipe back,
  /// while its partner slides flat. Only one card turns at a time — spinning
  /// them all by the same angle puts every card edge-on at once and the
  /// carousel blinks empty a quarter of the way through each swipe.
  ///
  /// Driven by scroll offset, so it tracks and reverses with the finger
  /// rather than replaying a canned animation.
  static const double _spinPerPage = 2 * math.pi;

  final PageController _pageController = PageController(
    viewportFraction: _viewportFraction,
  );

  late final AnimationController _entrance = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  );

  // The card itself arrives by hero flight; everything else follows it in.
  late final Animation<double> _chrome = _step(0.30, 0.80);
  late final Animation<double> _footer = _step(0.46, 1.00);

  /// Fractional page position, driven by the controller.
  double _page = 0;
  int _index = 0;

  Animation<double> _step(double begin, double end) => CurvedAnimation(
    parent: _entrance,
    curve: Interval(begin, end, curve: Curves.easeOutCubic),
  );

  @override
  void initState() {
    super.initState();
    _pageController.addListener(_onScroll);
    _entrance.forward();
  }

  void _onScroll() {
    final position = _pageController.position;
    if (!position.hasContentDimensions) return;
    setState(() => _page = _pageController.page ?? 0);
  }

  /// The centred card opens the order; a neighbour is brought to the centre
  /// first, so you always see what you are about to order.
  void _onCardTap(int index) {
    if (index == _index) {
      _openOrder(CardTier.all[index]);
      return;
    }
    _pageController.animateToPage(
      index,
      duration: const Duration(milliseconds: 560),
      curve: Curves.easeOutCubic,
    );
  }

  void _openOrder(CardTier tier) {
    // Ignore a second tap while the page is already on its way in.
    if (ModalRoute.of(context)?.isCurrent != true) return;

    HapticFeedback.mediumImpact();
    Navigator.of(
      context,
    ).push(PremiumPageRoute<void>(child: OrderConfirmationScreen(tier: tier)));
  }

  @override
  void dispose() {
    _pageController
      ..removeListener(_onScroll)
      ..dispose();
    _entrance.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final width = media.size.width;
    final tiers = CardTier.all;
    final selected = tiers[_index];

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        statusBarIconBrightness: Brightness.dark,
        statusBarBrightness: Brightness.light,
      ),
      child: Scaffold(
        backgroundColor: AppColors.scaffoldLight,
        body: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: EdgeInsets.symmetric(horizontal: width * 0.04),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: FadeTransition(
                    opacity: _chrome,
                    child: _BackButton(
                      onTap: () => Navigator.of(context).pop(),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 18),

              // Titles drift sideways with the carousel; neighbours grey out.
              FadeTransition(
                opacity: _chrome,
                child: _TitleStrip(
                  tiers: tiers,
                  page: _page,
                  spacing: width * 0.47,
                ),
              ),
              const SizedBox(height: 8),
              FadeTransition(
                opacity: _chrome,
                child: _PriceLabel(tier: selected),
              ),
              const SizedBox(height: 26),

              Expanded(
                child: PageView.builder(
                  controller: _pageController,
                  itemCount: tiers.length,
                  clipBehavior: Clip.none,
                  physics: const BouncingScrollPhysics(),
                  onPageChanged: (index) {
                    HapticFeedback.selectionClick();
                    setState(() => _index = index);
                  },
                  itemBuilder: (context, index) {
                    // Signed distance from centre, in pages.
                    final delta = _page - index;
                    final away = delta.abs().clamp(0.0, 1.0);

                    // A full turn is a no-op at every resting page, so the
                    // handoff stays continuous at both ends of the range.
                    final turning = delta <= 0 && delta >= -1;
                    final spin = turning ? delta * _spinPerPage : 0.0;
                    // Past a quarter turn we are looking at the reverse of the
                    // plate, so swap in the back face and undo the mirroring.
                    final turned =
                        (spin % _spinPerPage + _spinPerPage) % _spinPerPage;
                    final showingBack =
                        turned > math.pi / 2 && turned < 3 * math.pi / 2;

                    // Every card flies to the order page; only Platinum has a
                    // partner on home, so the other tags simply stay put there.
                    Widget face = CardHero(
                      tier: tiers[index],
                      child: MetallicCard(
                        tier: tiers[index],
                        vertical: true,
                        radius: 22,
                        shadow: false,
                      ),
                    );

                    if (showingBack) {
                      face = Transform(
                        alignment: Alignment.center,
                        transform: Matrix4.identity()..rotateY(math.pi),
                        child: MetallicSurface(
                          tier: tiers[index],
                          radius: 22,
                          shadow: false,
                        ),
                      );
                    }

                    return Center(
                      child: Transform(
                        alignment: Alignment.center,
                        transform: Matrix4.identity()
                          // Perspective first — without it the spin is a flat
                          // squash rather than a turn in depth.
                          ..setEntry(3, 2, 0.0015)
                          ..rotateY(spin)
                          ..scaleByDouble(
                            1 - 0.12 * away,
                            1 - 0.12 * away,
                            1,
                            1,
                          ),
                        child: Opacity(
                          opacity: (1 - 0.35 * away).clamp(0.0, 1.0),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 10,
                            ),
                            child: GestureDetector(
                              behavior: HitTestBehavior.opaque,
                              onTap: () => _onCardTap(index),
                              child: AspectRatio(
                                aspectRatio: 0.635,
                                child: face,
                              ),
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),

              const SizedBox(height: 22),
              FadeTransition(
                opacity: _footer,
                child: _PageDots(count: tiers.length, page: _page),
              ),
              const SizedBox(height: 24),
              Padding(
                padding: EdgeInsets.symmetric(horizontal: width * 0.055),
                child: SlideTransition(
                  position: Tween<Offset>(
                    begin: const Offset(0, 0.4),
                    end: Offset.zero,
                  ).animate(_footer),
                  child: FadeTransition(
                    opacity: _footer,
                    child: _ChooseButton(
                      tier: selected,
                      onTap: () => _openOrder(selected),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 14),
            ],
          ),
        ),
      ),
    );
  }
}

class _BackButton extends StatelessWidget {
  const _BackButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: const Padding(
        padding: EdgeInsets.all(12),
        child: Icon(
          Iconsax.arrow_left_2_copy,
          size: 24,
          color: AppColors.textPrimary,
        ),
      ),
    );
  }
}

/// Centre title in ink, neighbours sliding off in light grey.
class _TitleStrip extends StatelessWidget {
  const _TitleStrip({
    required this.tiers,
    required this.page,
    required this.spacing,
  });

  final List<CardTier> tiers;
  final double page;
  final double spacing;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 42,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          for (var i = 0; i < tiers.length; i++)
            Builder(
              builder: (context) {
                final delta = i - page;
                final away = delta.abs().clamp(0.0, 1.0);

                return Positioned.fill(
                  child: Transform.translate(
                    offset: Offset(delta * spacing, 0),
                    child: Opacity(
                      // Fades continuously with the swipe, so the outgoing
                      // tier dissolves as the incoming one resolves.
                      opacity: (1 - 0.85 * away).clamp(0.0, 1.0),
                      child: Center(
                        child: Text(
                          tiers[i].name,
                          maxLines: 1,
                          softWrap: false,
                          overflow: TextOverflow.visible,
                          style: TextStyle(
                            fontSize: 30,
                            height: 1.1,
                            fontWeight: FontWeight.w600,
                            letterSpacing: -0.8,
                            color: Color.lerp(
                              AppColors.textPrimary,
                              AppColors.textTertiary,
                              away,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
        ],
      ),
    );
  }
}

/// Swaps one label for another without the two ever overlapping.
///
/// A plain [AnimatedSwitcher] cross-fades, so mid-transition you read both
/// strings stacked on top of each other. The interval curves split the run in
/// two: the outgoing label clears out, then the incoming one arrives — rising
/// through in the same direction, so it reads as one roll rather than a
/// dissolve.
class _SwapText extends StatelessWidget {
  const _SwapText({required this.text, required this.style});

  final String text;
  final TextStyle style;

  static const Duration _duration = Duration(milliseconds: 380);

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: _duration,
      switchInCurve: const Interval(0.5, 1, curve: Curves.easeOutCubic),
      switchOutCurve: const Interval(0.5, 1, curve: Curves.easeInCubic),
      transitionBuilder: (child, animation) {
        // The outgoing child still carries the previous key.
        final incoming = child.key == ValueKey(text);

        return FadeTransition(
          opacity: animation,
          child: SlideTransition(
            position: Tween<Offset>(
              begin: Offset(0, incoming ? 0.5 : -0.5),
              end: Offset.zero,
            ).animate(animation),
            child: child,
          ),
        );
      },
      child: Text(text, key: ValueKey(text), style: style),
    );
  }
}

class _PriceLabel extends StatelessWidget {
  const _PriceLabel({required this.tier});

  final CardTier tier;

  static const double _size = 14.5;

  /// Tabular figures keep every price the same width, so the widest string
  /// below is a true measure of the space the figure needs.
  static const TextStyle _figure = TextStyle(
    fontSize: _size,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimary,
    fontFeatures: [FontFeature.tabularFigures()],
  );

  static String get _widestPrice => CardTier.all
      .map((tier) => '\$${tier.yearlyPrice}')
      .reduce((a, b) => a.length >= b.length ? a : b);

  /// Width of the widest figure, so the slot the price sits in never resizes
  /// and the unit beside it never shifts.
  double _slotWidth(BuildContext context) {
    final painter = TextPainter(
      // Text() merges the ambient style in; measuring has to do the same or
      // it sizes against the wrong font.
      text: TextSpan(
        text: _widestPrice,
        style: DefaultTextStyle.of(context).style.merge(_figure),
      ),
      textDirection: Directionality.of(context),
      textScaler: MediaQuery.textScalerOf(context),
    )..layout();

    final width = painter.width;
    painter.dispose();
    return width;
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: _slotWidth(context),
          child: _SwapText(text: '\$${tier.yearlyPrice}', style: _figure),
        ),
        // The unit never animates — it just sits there.
        const Text(
          ' / year',
          style: TextStyle(
            fontSize: _size,
            fontWeight: FontWeight.w500,
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }
}

class _PageDots extends StatelessWidget {
  const _PageDots({required this.count, required this.page});

  final int count;
  final double page;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (var i = 0; i < count; i++)
          Builder(
            builder: (context) {
              final closeness = (1 - (page - i).abs()).clamp(0.0, 1.0);

              return Container(
                margin: const EdgeInsets.symmetric(horizontal: 3.5),
                width: 6 + 12 * closeness,
                height: 6,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(3),
                  color: Color.lerp(
                    const Color(0xFFD6D5D2),
                    AppColors.textPrimary,
                    closeness,
                  ),
                ),
              );
            },
          ),
      ],
    );
  }
}

class _ChooseButton extends StatefulWidget {
  const _ChooseButton({required this.tier, required this.onTap});

  final CardTier tier;
  final VoidCallback onTap;

  @override
  State<_ChooseButton> createState() => _ChooseButtonState();
}

class _ChooseButtonState extends State<_ChooseButton> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _down = true),
      onTapUp: (_) => setState(() => _down = false),
      onTapCancel: () => setState(() => _down = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _down ? 0.97 : 1,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        child: Container(
          height: 58,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: AppColors.black,
            borderRadius: BorderRadius.circular(29),
          ),
          child: _SwapText(
            text: 'Choose ${widget.tier.name}',
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.3,
              color: AppColors.white,
            ),
          ),
        ),
      ),
    );
  }
}

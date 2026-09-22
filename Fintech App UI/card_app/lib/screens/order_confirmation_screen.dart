import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:lottie/lottie.dart';

import '../models/card_tier.dart';
import '../theme/app_colors.dart';
import '../utils/money.dart';
import '../utils/premium_page_route.dart';
import '../widgets/card_hero.dart';
import '../widgets/metallic_card.dart';
import '../widgets/pill_button.dart';
import 'order_success_screen.dart';

/// Review the chosen card and pay for it.
class OrderConfirmationScreen extends StatefulWidget {
  const OrderConfirmationScreen({super.key, required this.tier});

  final CardTier tier;

  @override
  State<OrderConfirmationScreen> createState() =>
      _OrderConfirmationScreenState();
}

class _OrderConfirmationScreenState extends State<OrderConfirmationScreen>
    with SingleTickerProviderStateMixin {
  /// How long the payment takes, from tap to the success page: the button
  /// folds up, then the loader runs at least one full loop.
  static const Duration _processing = Duration(milliseconds: 2300);

  /// The folding of the button into the loader, and back.
  static const Duration _morph = Duration(milliseconds: 460);

  late final AnimationController _entrance = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
  );

  // The card arrives by hero flight; everything else follows it in.
  late final Animation<double> _chrome = _step(0.18, 0.62);
  late final Animation<double> _summary = _step(0.34, 0.80);
  late final Animation<double> _footer = _step(0.46, 0.94);
  // Only once the card has landed, so it never trails the flight.
  late final Animation<double> _cardShadow = _step(0.55, 1.00);

  bool _placing = false;

  Animation<double> _step(double begin, double end) => CurvedAnimation(
    parent: _entrance,
    curve: Interval(begin, end, curve: Curves.easeOutCubic),
  );

  @override
  void initState() {
    super.initState();
    _entrance.forward();
    // Decode both animations now, so neither blinks in empty when its moment
    // comes.
    AssetLottie(_PaymentLoader.asset).load();
    AssetLottie(OrderSuccessScreen.animationAsset).load();
  }

  @override
  void dispose() {
    _entrance.dispose();
    super.dispose();
  }

  Future<void> _placeOrder() async {
    if (_placing) return;

    HapticFeedback.mediumImpact();
    setState(() => _placing = true);

    await Future<void>.delayed(_processing);
    if (!mounted) return;

    await Navigator.of(context).push(
      PremiumPageRoute<void>(child: OrderSuccessScreen(tier: widget.tier)),
    );
    // Done goes straight home, taking this page with it; only reset if we
    // are still showing, so the button never flickers on the way out.
    if (mounted && ModalRoute.of(context)?.isCurrent == true) {
      setState(() => _placing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final sidePad = width * 0.055;
    final tier = widget.tier;
    final price = '\$${formatMoney(tier.yearlyPrice.toDouble())}';

    // Leaving mid-payment would leave the order in limbo, so back — button or
    // gesture — waits until it has gone through.
    return PopScope(
      canPop: !_placing,
      child: AnnotatedRegion<SystemUiOverlayStyle>(
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
                      child: AnimatedOpacity(
                        opacity: _placing ? 0.25 : 1,
                        duration: const Duration(milliseconds: 240),
                        child: IgnorePointer(
                          ignoring: _placing,
                          child: _BackButton(
                            onTap: () => Navigator.of(context).maybePop(),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: SingleChildScrollView(
                    physics: const BouncingScrollPhysics(),
                    padding: EdgeInsets.fromLTRB(sidePad, 10, sidePad, 24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _Rise(
                          animation: _chrome,
                          child: const Text(
                            'Confirm order',
                            style: TextStyle(
                              fontSize: 30,
                              height: 1.1,
                              fontWeight: FontWeight.w600,
                              letterSpacing: -0.8,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        _Rise(
                          animation: _chrome,
                          child: const Text(
                            'Review your new card before you pay.',
                            style: TextStyle(
                              fontSize: 14.5,
                              fontWeight: FontWeight.w500,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ),
                        const SizedBox(height: 28),
                        AspectRatio(
                          aspectRatio: 1.586,
                          child: AnimatedBuilder(
                            animation: _cardShadow,
                            builder: (context, child) => DecoratedBox(
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: child,
                            ),
                            child: CardHero(
                              tier: tier,
                              child: MetallicCard(tier: tier, shadow: false),
                            ),
                          ),
                        ),
                        const SizedBox(height: 28),
                        _Rise(
                          animation: _summary,
                          offset: 0.12,
                          child: _Summary(
                            rows: [
                              _SummaryRow(
                                label: 'Card',
                                value: '${tier.name} metal',
                              ),
                              _SummaryRow(label: 'Annual fee', value: price),
                              const _SummaryRow(
                                label: 'Delivery',
                                value: 'Free · 5–7 days',
                              ),
                              _SummaryRow(
                                label: 'Total today',
                                value: price,
                                emphasis: true,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: EdgeInsets.fromLTRB(sidePad, 6, sidePad, 14),
                  child: _Rise(
                    animation: _footer,
                    offset: 0.4,
                    child: Column(
                      children: [
                        // The button folds into the loader right under the
                        // thumb that pressed it, so there is nowhere else to
                        // look while the payment goes through.
                        LayoutBuilder(
                          builder: (context, constraints) => AnimatedContainer(
                            duration: _morph,
                            // Hold the width until the label has cleared, so
                            // the words never crowd a shrinking pill.
                            curve: const Interval(
                              0.2,
                              1,
                              curve: Curves.easeInOutCubic,
                            ),
                            width: _placing
                                ? _PaymentLoader.pillWidth
                                : constraints.maxWidth,
                            child: PillButton(
                              onTap: _placing ? null : _placeOrder,
                              child: _Swap(
                                duration: _morph,
                                child: _placing
                                    ? const _PaymentLoader(
                                        key: ValueKey('placing'),
                                      )
                                    : Text(
                                        'Order · $price',
                                        key: const ValueKey('order'),
                                        maxLines: 1,
                                        softWrap: false,
                                      ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        _Swap(
                          duration: _morph,
                          child: _FootNote(
                            key: ValueKey(_placing),
                            icon: _placing
                                ? Iconsax.shield_tick_copy
                                : Iconsax.lock_1_copy,
                            text: _placing
                                ? 'Confirming your payment…'
                                : 'Secure payment · Cancel anytime',
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Platinum dots chasing each other — the home card's metal on the button's
/// black, so the wait still looks like the app.
class _PaymentLoader extends StatelessWidget {
  const _PaymentLoader({super.key});

  static const String asset = 'assets/images/loading.json';

  /// The folded button: just wide enough to frame the loader.
  static const double pillWidth = 132;

  /// Width over height of the animation's artboard.
  static const double _aspectRatio = 428 / 150;

  static const double _width = 88;

  @override
  Widget build(BuildContext context) {
    return Lottie.asset(
      asset,
      width: _width,
      height: _width / _aspectRatio,
      // The source is 25 fps; interpolate every display frame.
      frameRate: FrameRate.max,
      fit: BoxFit.contain,
    );
  }
}

/// Swaps one child for another without the two ever overlapping: the old one
/// clears out in the first half, the new one settles in over the second.
class _Swap extends StatelessWidget {
  const _Swap({required this.duration, required this.child});

  final Duration duration;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: duration,
      switchInCurve: const Interval(0.5, 1, curve: Curves.easeOutCubic),
      switchOutCurve: const Interval(0.5, 1, curve: Curves.easeInCubic),
      transitionBuilder: (child, animation) => FadeTransition(
        opacity: animation,
        child: ScaleTransition(
          scale: Tween<double>(begin: 0.88, end: 1).animate(animation),
          child: child,
        ),
      ),
      child: child,
    );
  }
}

class _FootNote extends StatelessWidget {
  const _FootNote({super.key, required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(icon, size: 14, color: AppColors.textSecondary),
        const SizedBox(width: 6),
        Text(
          text,
          style: const TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w500,
            color: AppColors.textSecondary,
          ),
        ),
      ],
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

/// White sheet of label / value rows split by hairlines.
class _Summary extends StatelessWidget {
  const _Summary({required this.rows});

  final List<_SummaryRow> rows;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.sheet,
        borderRadius: BorderRadius.circular(22),
      ),
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0)
              const Divider(height: 1, thickness: 1, color: AppColors.hairline),
            rows[i],
          ],
        ],
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
    this.emphasis = false,
  });

  final String label;
  final String value;

  /// The bottom line: both sides in ink, the figure a size up.
  final bool emphasis;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 14.5,
                fontWeight: emphasis ? FontWeight.w600 : FontWeight.w500,
                color: emphasis
                    ? AppColors.textPrimary
                    : AppColors.textSecondary,
              ),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: emphasis ? 17 : 14.5,
              fontWeight: FontWeight.w600,
              letterSpacing: emphasis ? -0.4 : 0,
              color: AppColors.textPrimary,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

/// Fade + lift driven by the shared entrance controller.
class _Rise extends StatelessWidget {
  const _Rise({
    required this.animation,
    required this.child,
    this.offset = 0.22,
  });

  final Animation<double> animation;
  final Widget child;
  final double offset;

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: animation,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: Offset(0, offset),
          end: Offset.zero,
        ).animate(animation),
        child: child,
      ),
    );
  }
}

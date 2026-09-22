import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:lottie/lottie.dart';

import '../models/card_tier.dart';
import '../models/order_receipt.dart';
import '../theme/app_colors.dart';
import '../utils/money.dart';
import '../utils/premium_page_route.dart';
import '../widgets/pill_button.dart';
import '../widgets/receipt/receipt_paper.dart';
import 'receipt_screen.dart';

/// The card taps a reader, the tick lands, and the order is confirmed.
class OrderSuccessScreen extends StatefulWidget {
  const OrderSuccessScreen({super.key, required this.tier});

  /// Public so the order page can decode it while the payment runs.
  static const String animationAsset = 'assets/images/Contactless.json';

  final CardTier tier;

  @override
  State<OrderSuccessScreen> createState() => _OrderSuccessScreenState();
}

class _OrderSuccessScreenState extends State<OrderSuccessScreen>
    with SingleTickerProviderStateMixin {
  /// Width over height of the animation's artboard.
  static const double _aspectRatio = 330 / 300;

  /// Share of the animation at which the card touches the reader.
  static const double _tap = 0.19;

  /// Drives the Lottie and the copy together, so the words land with the tick.
  /// The real length comes from the composition once it has loaded.
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 4),
  );

  // The tick draws over frames 20–41 of 100.
  late final Animation<double> _title = _step(0.28, 0.50);
  late final Animation<double> _body = _step(0.34, 0.56);
  late final Animation<double> _footer = _step(0.46, 0.70);

  /// Prints the animation's card in the ordered tier's metal.
  late final LottieDelegates _delegates = LottieDelegates(
    values: [
      ValueDelegate.gradientColor(const [
        'Card',
        'Face',
        'Metal',
      ], value: widget.tier.face),
      ValueDelegate.color(const [
        'Card',
        'Edge',
        'Metal',
      ], value: Color.lerp(widget.tier.face.last, AppColors.cardInk, 0.22)),
    ],
  );

  /// Issued once, so every look at the receipt shows the same number.
  late final OrderReceipt _receipt = OrderReceipt.forTier(widget.tier);

  bool _tapped = false;

  Animation<double> _step(double begin, double end) => CurvedAnimation(
    parent: _controller,
    curve: Interval(begin, end, curve: Curves.easeOutCubic),
  );

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onProgress);
    // Fetch the receipt's typefaces now, so it can print the moment it opens.
    ReceiptPaper.warmUp();
  }

  void _onProgress() {
    if (_tapped || _controller.value < _tap) return;
    _tapped = true;
    HapticFeedback.heavyImpact();
  }

  void _onLoaded(LottieComposition composition) {
    _controller.duration = composition.duration;
    // Let the page settle in before the card starts moving.
    Future<void>.delayed(const Duration(milliseconds: 260), () {
      if (mounted) _controller.forward();
    });
  }

  void _viewReceipt() {
    HapticFeedback.selectionClick();
    Navigator.of(
      context,
    ).push(PremiumPageRoute<void>(child: ReceiptScreen(receipt: _receipt)));
  }

  void _done() {
    HapticFeedback.selectionClick();
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  @override
  void dispose() {
    _controller
      ..removeListener(_onProgress)
      ..dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final sidePad = size.width * 0.055;
    final artWidth = math.min(size.width * 0.84, size.height * 0.40);
    final tier = widget.tier;

    // Paid for: going back would only offer to pay again, so back means done.
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _done();
      },
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        value: SystemUiOverlayStyle.dark.copyWith(
          statusBarIconBrightness: Brightness.dark,
          statusBarBrightness: Brightness.light,
        ),
        child: Scaffold(
          backgroundColor: AppColors.scaffoldLight,
          body: SafeArea(
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: sidePad),
              child: Column(
                children: [
                  const Spacer(flex: 2),
                  SizedBox(
                    width: artWidth,
                    height: artWidth / _aspectRatio,
                    child: Lottie.asset(
                      OrderSuccessScreen.animationAsset,
                      controller: _controller,
                      delegates: _delegates,
                      onLoaded: _onLoaded,
                      // The source is 25 fps; interpolate every display frame.
                      frameRate: FrameRate.max,
                      fit: BoxFit.contain,
                    ),
                  ),
                  const SizedBox(height: 18),
                  _Rise(
                    animation: _title,
                    child: const Text(
                      'Order placed',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 30,
                        height: 1.1,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.8,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  _Rise(
                    animation: _body,
                    child: Text(
                      'Your ${tier.name} card is on its way.\n'
                      'We’ll let you know the moment it ships.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 14.5,
                        height: 1.45,
                        fontWeight: FontWeight.w500,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 26),
                  _Rise(
                    animation: _body,
                    offset: 0.12,
                    child: _Receipt(
                      rows: [
                        (
                          'Paid',
                          '\$${formatMoney(tier.yearlyPrice.toDouble())}',
                        ),
                        ('Arrives', '5–7 business days'),
                      ],
                    ),
                  ),
                  const Spacer(flex: 3),
                  _Rise(
                    animation: _footer,
                    offset: 0.4,
                    child: Column(
                      children: [
                        PillButton(
                          onTap: _viewReceipt,
                          color: AppColors.sheet,
                          foregroundColor: AppColors.textPrimary,
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Iconsax.receipt_2_1_copy, size: 19),
                              SizedBox(width: 8),
                              Text('View receipt'),
                            ],
                          ),
                        ),
                        const SizedBox(height: 10),
                        PillButton(onTap: _done, child: const Text('Done')),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Receipt extends StatelessWidget {
  const _Receipt({required this.rows});

  final List<(String, String)> rows;

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
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 15),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      rows[i].$1,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w500,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                  Text(
                    rows[i].$2,
                    style: const TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Fade + lift driven by the animation's own clock.
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

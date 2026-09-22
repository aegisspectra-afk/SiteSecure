import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../models/order_receipt.dart';
import '../theme/app_colors.dart';
import '../widgets/pill_button.dart';
import '../widgets/receipt/paid_stamp.dart';
import '../widgets/receipt/receipt_paper.dart';
import '../widgets/receipt/receipt_printer.dart';

const Color _backdrop = Color(0xFF0B0B0A);
const Color _glow = Color(0xFF282723);

/// The order's receipt, printed live: the machine powers up, feeds the slip
/// out a line at a time, cuts it, and stamps it paid.
class ReceiptScreen extends StatefulWidget {
  const ReceiptScreen({super.key, required this.receipt});

  final OrderReceipt receipt;

  @override
  State<ReceiptScreen> createState() => _ReceiptScreenState();
}

class _ReceiptScreenState extends State<ReceiptScreen>
    with TickerProviderStateMixin {
  // The whole print is one timeline, in milliseconds, so the machine, the
  // paper, the stamp and the haptics can never drift apart.
  static const int _wakeAt = 560;
  static const int _feedAt = 920;
  static const int _cutAt = 3920;
  static const int _stampAt = 4150;
  static const int _stampFor = 700;
  static const int _readyAt = 4750;
  static const int _end = 5450;

  late final AnimationController _print = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: _end),
  );

  /// Tearing the slip off to print another.
  late final AnimationController _tear = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 520),
  );

  late final Animation<double> _intro = _step(0, 640, Curves.easeOutCubic);
  late final Animation<double> _wake = _step(_wakeAt, _wakeAt + 340);
  late final Animation<double> _feed = _step(
    _feedAt,
    _cutAt,
    const _LineFeed(),
  );
  late final Animation<double> _settle = _step(_cutAt, _end);
  late final Animation<double> _stamp = _step(_stampAt, _stampAt + _stampFor);

  // Gravity: slow to let go, then gone.
  late final Animation<double> _fall = CurvedAnimation(
    parent: _tear,
    curve: Curves.easeInCubic,
  );

  bool _ready = false;

  // Haptic cues already played on this pass.
  bool _woke = false;
  bool _cut = false;
  bool _stamped = false;
  int _nextTick = 0;

  Animation<double> _step(int from, int to, [Curve curve = Curves.linear]) =>
      CurvedAnimation(
        parent: _print,
        curve: Interval(from / _end, to / _end, curve: curve),
      );

  @override
  void initState() {
    super.initState();
    _print.addListener(_onTick);
    // Bring the machine in straight away, but hold the paper until its
    // typefaces are in, so the slip never feeds out in a fallback font. The
    // light keeps blinking meanwhile, so the wait reads as warming up.
    _print.animateTo(_feedAt / _end);
    ReceiptPaper.warmUp()
        .timeout(const Duration(milliseconds: 1600), onTimeout: () {})
        .then((_) {
          if (mounted) _print.forward();
        });
  }

  @override
  void dispose() {
    _print
      ..removeListener(_onTick)
      ..dispose();
    _tear.dispose();
    super.dispose();
  }

  void _onTick() {
    final ms = _print.value * _end;

    if (!_woke && ms >= _wakeAt) {
      _woke = true;
      HapticFeedback.mediumImpact();
    }
    // A soft click every other line, like a stepper motor pulling paper.
    if (ms >= _feedAt && ms < _cutAt) {
      final line = _LineFeed.lineAt((ms - _feedAt) / (_cutAt - _feedAt));
      if (line >= _nextTick) {
        _nextTick = line + 2;
        HapticFeedback.selectionClick();
      }
    }
    if (!_cut && ms >= _cutAt) {
      _cut = true;
      HapticFeedback.lightImpact();
    }
    if (!_stamped && ms >= _stampAt + _stampFor * PaidStamp.impact) {
      _stamped = true;
      HapticFeedback.heavyImpact();
    }
    if (!_ready && ms >= _readyAt) setState(() => _ready = true);
  }

  /// Tears the slip off, lets it drop, and prints a fresh one.
  Future<void> _reprint() async {
    if (!_ready) return;
    HapticFeedback.lightImpact();
    setState(() => _ready = false);

    await _tear.forward(from: 0);
    if (!mounted) return;

    _cut = false;
    _stamped = false;
    _nextTick = 0;
    // Both land on the same frame: the fallen slip is gone and the new one
    // is still inside the machine, so nothing visibly snaps back.
    _tear.value = 0;
    _print
      ..value = _feedAt / _end
      ..forward();
  }

  /// The slip's swing about the slot: a faint drift while it feeds, then a
  /// damped sway once the cutter lets it go. Exactly zero at rest, so the
  /// printed text is never resampled through a stray rotation.
  double _tilt() {
    final feed = _feed.value;
    final settle = _settle.value;
    final drift = feed > 0 && feed < 1
        ? 0.005 * math.sin(feed * math.pi * 3) * feed
        : 0.0;
    final sway = settle > 0 && settle < 1
        ? 0.03 *
              (1 - settle) *
              math.exp(-4 * settle) *
              math.sin(settle * math.pi * 5)
        : 0.0;
    return drift + sway;
  }

  Widget _machine(Widget paper) {
    final ms = _print.value * _end;
    final intro = _intro.value;

    return Opacity(
      opacity: intro,
      child: Transform.translate(
        offset: Offset(0, -28 * (1 - intro)),
        child: ReceiptPrinter(
          paperWidth: ReceiptPaper.width,
          paper: paper,
          feed: _feed.value,
          tilt: _tilt(),
          tear: _fall.value,
          wake: _wake.value,
          light: ms < _wakeAt
              ? PrinterLight.off
              : ms < _cutAt
              ? PrinterLight.busy
              : PrinterLight.ready,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final sidePad = width * 0.055;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
      ),
      child: Scaffold(
        backgroundColor: _backdrop,
        body: DecoratedBox(
          // A pool of light where the printer hangs, for the metal and the
          // slip to catch.
          decoration: const BoxDecoration(
            gradient: RadialGradient(
              center: Alignment(0, -0.45),
              radius: 0.95,
              colors: [_glow, _backdrop],
            ),
          ),
          child: SafeArea(
            child: Column(
              children: [
                FadeTransition(
                  opacity: _intro,
                  child: _TopBar(
                    inset: width * 0.04,
                    onBack: () => Navigator.of(context).maybePop(),
                  ),
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                    child: Center(
                      // Machine and slip shrink as one on short screens.
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: Alignment.topCenter,
                        child: AnimatedBuilder(
                          animation: Listenable.merge([_print, _tear]),
                          builder: (context, child) => _machine(child!),
                          // Built once: the slip only ever moves as a whole.
                          child: ReceiptPaper(
                            receipt: widget.receipt,
                            stamp: _stamp,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                Padding(
                  padding: EdgeInsets.fromLTRB(sidePad, 6, sidePad, 14),
                  child: FadeTransition(
                    opacity: _intro,
                    // Fixed height, so the swap never nudges the machine.
                    child: SizedBox(
                      height: 58,
                      child: _Swap(
                        duration: const Duration(milliseconds: 460),
                        child: _ready
                            ? _Actions(
                                key: const ValueKey('actions'),
                                onReprint: _reprint,
                                onDone: () => Navigator.of(context).maybePop(),
                              )
                            : const _Status(key: ValueKey('status')),
                      ),
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

/// Paper drawn through a line at a time: an easy start and stop overall,
/// with a small surge on every line, the way a stepper motor pulls it.
class _LineFeed extends Curve {
  const _LineFeed();

  static const int lines = 26;

  /// How much of the per-line surge shows through the overall glide.
  static const double _bite = 0.35;

  /// The line under the print head at [t] of the feed.
  static int lineAt(double t) =>
      (Curves.easeInOutSine.transform(t.clamp(0.0, 1.0)) * lines).floor();

  @override
  double transformInternal(double t) {
    final glide = Curves.easeInOutSine.transform(t);
    final line = (glide * lines).floor();
    final within = glide * lines - line;
    final stepped = (line + within * within * (3 - 2 * within)) / lines;
    return glide + (stepped - glide) * _bite;
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.inset, required this.onBack});

  final double inset;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 52,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: Padding(
              padding: EdgeInsets.only(left: inset),
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: onBack,
                child: const Padding(
                  padding: EdgeInsets.all(12),
                  child: Icon(
                    Iconsax.arrow_left_2_copy,
                    size: 24,
                    color: AppColors.white,
                  ),
                ),
              ),
            ),
          ),
          const Text(
            'Receipt',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.2,
              color: AppColors.white,
            ),
          ),
        ],
      ),
    );
  }
}

class _Status extends StatelessWidget {
  const _Status({super.key});

  @override
  Widget build(BuildContext context) {
    return const Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Iconsax.printer_copy, size: 15, color: AppColors.textOnDarkMuted),
        SizedBox(width: 8),
        Text(
          'Printing your receipt…',
          style: TextStyle(
            fontSize: 13.5,
            fontWeight: FontWeight.w500,
            color: AppColors.textOnDarkMuted,
          ),
        ),
      ],
    );
  }
}

class _Actions extends StatelessWidget {
  const _Actions({super.key, required this.onReprint, required this.onDone});

  final VoidCallback onReprint;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: PillButton(
            onTap: onReprint,
            color: AppColors.darkCircle,
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Iconsax.printer_copy, size: 19),
                SizedBox(width: 8),
                Text('Print again'),
              ],
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: PillButton(
            onTap: onDone,
            color: AppColors.white,
            foregroundColor: AppColors.textPrimary,
            child: const Text('Done'),
          ),
        ),
      ],
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

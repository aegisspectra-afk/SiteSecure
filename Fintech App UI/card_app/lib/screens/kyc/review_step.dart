import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../../theme/app_colors.dart';
import '../../widgets/kyc/kyc_button.dart';
import '../../widgets/kyc/kyc_layout.dart';
import '../../widgets/kyc/shine.dart';
import '../../widgets/kyc/verification_seal.dart';
import '../../widgets/verified_badge.dart';

/// One security check and the point in the run at which it lands.
class _Check {
  const _Check(this.label, this.icon, this.at);

  final String label;
  final IconData icon;
  final double at;
}

/// Step four: the checks run, then the seal turns into a tick.
///
/// Processing and success live on one page on purpose — the ring the user has
/// been watching is the same object that becomes the checkmark.
class ReviewStep extends StatefulWidget {
  const ReviewStep({
    super.key,
    required this.active,
    required this.name,
    required this.onVerified,
    required this.onFinish,
  });

  final bool active;
  final String name;

  /// Fired as the tick lands, so the flow can complete its progress meter.
  final VoidCallback onVerified;
  final VoidCallback onFinish;

  @override
  State<ReviewStep> createState() => _ReviewStepState();
}

class _ReviewStepState extends State<ReviewStep> with TickerProviderStateMixin {
  static const List<_Check> _checks = [
    _Check('Document authenticity', Iconsax.personalcard, 0.20),
    _Check('Biometric face match', Iconsax.scanning, 0.44),
    _Check('Liveness confirmed', Iconsax.security_user, 0.66),
    _Check('Watchlist screening', Iconsax.shield_search, 0.88),
  ];

  static const double _rowHeight = 54;
  static const double _rowGap = 9;

  /// The block below the seal is held at the checklist's full height so the
  /// seal does not shift when the shorter summary replaces it.
  static const double _blockHeight = _rowHeight * 4 + _rowGap * 3;

  /// The gaps and copy sitting between the seal and the checklist.
  static const double _copyHeight = 140;

  late final AnimationController _entrance = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );

  late final AnimationController _run = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 4200),
  );

  late final AnimationController _success = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1900),
  );

  late final AnimationController _spin = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 3000),
  )..repeat();

  int _landed = 0;
  bool _announced = false;

  @override
  void initState() {
    super.initState();
    if (widget.active) _begin();
    _run
      ..addListener(_onRunProgress)
      ..addStatusListener(_onRunStatus);
    _success.addListener(_onSuccessProgress);
  }

  @override
  void didUpdateWidget(ReviewStep old) {
    super.didUpdateWidget(old);
    if (widget.active && !old.active) _begin();
  }

  @override
  void dispose() {
    _entrance.dispose();
    _run.dispose();
    _success.dispose();
    _spin.dispose();
    super.dispose();
  }

  void _begin() {
    _entrance.forward();
    // Let the page finish arriving before the checks start ticking over.
    Future<void>.delayed(const Duration(milliseconds: 420), () {
      if (mounted) _run.forward();
    });
  }

  void _onRunProgress() {
    final landed = _checks.where((check) => _run.value >= check.at).length;
    if (landed == _landed) return;
    setState(() => _landed = landed);
    HapticFeedback.selectionClick();
  }

  void _onRunStatus(AnimationStatus status) {
    if (status != AnimationStatus.completed) return;
    HapticFeedback.heavyImpact();
    _success.forward();
  }

  void _onSuccessProgress() {
    // Hand the badge to the profile as the tick finishes drawing, not before.
    if (_announced || _success.value < 0.55) return;
    _announced = true;
    HapticFeedback.mediumImpact();
    widget.onVerified();
  }

  IconData get _currentIcon =>
      _checks[math.min(_landed, _checks.length - 1)].icon;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: LayoutBuilder(
            builder: (context, constraints) {
              // The seal gives up height first; the checklist below it has a
              // fixed cost that cannot be squeezed.
              final diameter = math.max(
                120.0,
                math.min(
                  constraints.maxWidth * 0.56,
                  constraints.maxHeight - _blockHeight - _copyHeight,
                ),
              );

              return FittedBox(
                fit: BoxFit.scaleDown,
                child: SizedBox(
                  width: constraints.maxWidth,
                  child: AnimatedBuilder(
                    animation: Listenable.merge([_run, _success, _spin]),
                    builder: (context, _) {
                      final success = _success.value;
                      final verified = success > 0.5;

                      return Column(
                        mainAxisSize: MainAxisSize.min,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          VerificationSeal(
                            diameter: diameter,
                            spin: _spin.value,
                            progress: _run.value,
                            success: success,
                            icon: _currentIcon,
                          ),
                          const SizedBox(height: 32),
                          _Heading(
                            verified: verified,
                            name: widget.name,
                            shine: _success,
                          ),
                          const SizedBox(height: 26),
                          SizedBox(
                            height: _blockHeight,
                            child: AnimatedSwitcher(
                              duration: const Duration(milliseconds: 460),
                              switchInCurve: kycSwitchIn,
                              switchOutCurve: kycSwitchOut,
                              child: verified
                                  ? _VerifiedSummary(
                                      key: const ValueKey('summary'),
                                      name: widget.name,
                                      shine: _success,
                                    )
                                  : Column(
                                      key: const ValueKey('checks'),
                                      children: [
                                        for (
                                          var i = 0;
                                          i < _checks.length;
                                          i++
                                        ) ...[
                                          if (i > 0)
                                            const SizedBox(height: _rowGap),
                                          _CheckRow(
                                            check: _checks[i],
                                            done: i < _landed,
                                            running: i == _landed,
                                            spin: _spin.value,
                                            height: _rowHeight,
                                          ),
                                        ],
                                      ],
                                    ),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ),
              );
            },
          ),
        ),
        AnimatedBuilder(
          animation: _success,
          builder: (context, child) {
            final success = _success.value;
            return KycRise(
              parent: _entrance,
              begin: 0.4,
              end: 1,
              offset: 0.3,
              child: AnimatedOpacity(
                opacity: success > 0.6 ? 1 : 0,
                duration: const Duration(milliseconds: 360),
                child: IgnorePointer(
                  ignoring: success <= 0.6,
                  child: KycButton(
                    label: 'Back to profile',
                    icon: Iconsax.arrow_right_3_copy,
                    onTap: () {
                      HapticFeedback.mediumImpact();
                      widget.onFinish();
                    },
                  ),
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading({
    required this.verified,
    required this.name,
    required this.shine,
  });

  final bool verified;
  final String name;
  final Animation<double> shine;

  @override
  Widget build(BuildContext context) {
    final title = Text(
      verified ? 'Identity verified' : 'Verifying your identity',
      key: ValueKey(verified),
      textAlign: TextAlign.center,
      style: TextStyle(
        fontSize: verified ? 28 : 24,
        fontWeight: FontWeight.w600,
        letterSpacing: -1,
        color: AppColors.white,
      ),
    );

    return Column(
      children: [
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 460),
          switchInCurve: kycSwitchIn,
          switchOutCurve: kycSwitchOut,
          transitionBuilder: (child, animation) => FadeTransition(
            opacity: animation,
            child: ScaleTransition(
              scale: Tween<double>(begin: 0.9, end: 1).animate(animation),
              child: child,
            ),
          ),
          child: verified ? Shine(animation: shine, child: title) : title,
        ),
        const SizedBox(height: 8),
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 460),
          switchInCurve: kycSwitchIn,
          switchOutCurve: kycSwitchOut,
          child: Text(
            verified
                ? 'Your account is fully unlocked.'
                : 'This usually takes a few seconds.',
            key: ValueKey(verified),
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 14.5,
              fontWeight: FontWeight.w500,
              color: KycColors.inkMuted,
            ),
          ),
        ),
      ],
    );
  }
}

/// One line of the security checklist: a spinner that becomes a tick.
class _CheckRow extends StatelessWidget {
  const _CheckRow({
    required this.check,
    required this.done,
    required this.running,
    required this.spin,
    required this.height,
  });

  final _Check check;
  final bool done;
  final bool running;
  final double spin;
  final double height;

  @override
  Widget build(BuildContext context) {
    return AnimatedOpacity(
      opacity: done || running ? 1 : 0.35,
      duration: const Duration(milliseconds: 320),
      child: Container(
        height: height,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          color: done
              ? KycColors.accent.withValues(alpha: 0.07)
              : KycColors.elevated,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: done
                ? KycColors.accent.withValues(alpha: 0.30)
                : KycColors.hairline,
          ),
        ),
        child: Row(
          children: [
            SizedBox(
              width: 22,
              height: 22,
              child: done
                  ? TweenAnimationBuilder<double>(
                      tween: Tween<double>(begin: 0, end: 1),
                      duration: const Duration(milliseconds: 380),
                      curve: Curves.easeOutBack,
                      builder: (context, t, child) =>
                          Transform.scale(scale: t, child: child),
                      child: const Icon(
                        Iconsax.tick_circle,
                        size: 22,
                        color: KycColors.accent,
                      ),
                    )
                  : CustomPaint(
                      painter: _SpinnerPainter(spin: spin, active: running),
                    ),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: AnimatedDefaultTextStyle(
                duration: const Duration(milliseconds: 320),
                // Merged, not replaced: a bare TextStyle here would drop the
                // app's typeface back to the platform default.
                style: DefaultTextStyle.of(context).style.merge(
                  TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.2,
                    color: done ? AppColors.white : KycColors.inkMuted,
                  ),
                ),
                child: Text(check.label),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SpinnerPainter extends CustomPainter {
  _SpinnerPainter({required this.spin, required this.active});

  final double spin;
  final bool active;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromCircle(
      center: size.center(Offset.zero),
      radius: size.width / 2 - 1.5,
    );
    canvas.drawCircle(
      rect.center,
      rect.width / 2,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..color = Colors.white.withValues(alpha: 0.10),
    );
    if (!active) return;

    canvas.drawArc(
      rect,
      spin * 2 * math.pi,
      math.pi * 0.6,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeCap = StrokeCap.round
        ..color = KycColors.accent,
    );
  }

  @override
  bool shouldRepaint(_SpinnerPainter old) =>
      old.spin != spin || old.active != active;
}

/// What the user walks away with: their name, and the tier it unlocked.
class _VerifiedSummary extends StatelessWidget {
  const _VerifiedSummary({super.key, required this.name, required this.shine});

  final String name;
  final Animation<double> shine;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.start,
      children: [
        Shine(
          animation: shine,
          intensity: 0.35,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
            decoration: BoxDecoration(
              color: KycColors.accent.withValues(alpha: 0.07),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: KycColors.accent.withValues(alpha: 0.30),
              ),
            ),
            child: Row(
              children: [
                const VerifiedBadge(size: 28),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name.isEmpty ? 'Verified account' : name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 15.5,
                          fontWeight: FontWeight.w600,
                          letterSpacing: -0.3,
                          color: AppColors.white,
                        ),
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'Tier 3 · Full access',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: KycColors.accent,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        const Text(
          'Transfer limits raised · Card ordering unlocked',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w500,
            color: KycColors.inkMuted,
          ),
        ),
      ],
    );
  }
}

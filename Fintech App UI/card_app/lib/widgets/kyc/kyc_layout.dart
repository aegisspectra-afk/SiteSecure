import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';

/// Curves that make an [AnimatedSwitcher] hand over rather than cross-fade.
///
/// The outgoing child clears the frame over the first half and the incoming one
/// arrives over the second, so two lines of status text are never legible on
/// top of each other.
const Curve kycSwitchIn = Interval(0.45, 1, curve: Curves.easeOut);
const Curve kycSwitchOut = Interval(0.55, 1, curve: Curves.easeIn);

/// Fade + lift keyed off a shared entrance controller, so a step's heading,
/// body and action arrive in sequence rather than all at once.
class KycRise extends StatelessWidget {
  const KycRise({
    super.key,
    required this.parent,
    required this.begin,
    required this.end,
    required this.child,
    this.offset = 0.18,
  });

  final Animation<double> parent;
  final double begin;
  final double end;
  final double offset;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final animation = CurvedAnimation(
      parent: parent,
      curve: Interval(begin, end, curve: Curves.easeOutCubic),
    );

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

/// Common furniture for a verification step: heading, a body that takes the
/// slack, and a pinned action.
class KycStepLayout extends StatelessWidget {
  const KycStepLayout({
    super.key,
    required this.entrance,
    required this.title,
    required this.subtitle,
    required this.body,
    this.footer,
  });

  final Animation<double> entrance;
  final String title;
  final String subtitle;
  final Widget body;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KycRise(
          parent: entrance,
          begin: 0,
          end: 0.5,
          child: Text(
            title,
            style: const TextStyle(
              fontSize: 27,
              height: 1.15,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.9,
              color: AppColors.white,
            ),
          ),
        ),
        const SizedBox(height: 8),
        KycRise(
          parent: entrance,
          begin: 0.08,
          end: 0.58,
          child: Text(
            subtitle,
            style: const TextStyle(
              fontSize: 14.5,
              height: 1.45,
              fontWeight: FontWeight.w500,
              color: KycColors.inkMuted,
            ),
          ),
        ),
        Expanded(
          child: KycRise(
            parent: entrance,
            begin: 0.18,
            end: 0.78,
            offset: 0.08,
            child: body,
          ),
        ),
        if (footer != null)
          KycRise(
            parent: entrance,
            begin: 0.34,
            end: 0.95,
            offset: 0.30,
            child: footer!,
          ),
      ],
    );
  }
}

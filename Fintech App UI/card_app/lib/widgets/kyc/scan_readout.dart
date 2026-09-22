import 'package:flutter/material.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../../theme/app_colors.dart';
import 'kyc_layout.dart';

/// The live count and status line under a scanner.
///
/// Shared by the document and face steps so both read out identically — the
/// number is tabular so it never jitters as it climbs.
class ScanReadout extends StatelessWidget {
  const ScanReadout({
    super.key,
    required this.percent,
    required this.status,
    required this.scanning,
    required this.verified,
  });

  final double percent;
  final String status;
  final bool scanning;
  final double verified;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SizedBox(
          height: 46,
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 360),
            switchInCurve: kycSwitchIn,
            switchOutCurve: kycSwitchOut,
            child: verified > 0.6
                ? const Row(
                    key: ValueKey('done'),
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Iconsax.tick_circle,
                        size: 26,
                        color: KycColors.accent,
                      ),
                      SizedBox(width: 9),
                      Text(
                        'Verified',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w600,
                          letterSpacing: -0.8,
                          color: KycColors.accent,
                        ),
                      ),
                    ],
                  )
                : Text(
                    '${percent.round()}%',
                    key: const ValueKey('percent'),
                    style: TextStyle(
                      fontSize: 38,
                      height: 1,
                      fontWeight: FontWeight.w600,
                      letterSpacing: -1.6,
                      fontFeatures: const [FontFeature.tabularFigures()],
                      color: scanning
                          ? AppColors.white
                          : Colors.white.withValues(alpha: 0.25),
                    ),
                  ),
          ),
        ),
        const SizedBox(height: 10),
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 360),
          switchInCurve: kycSwitchIn,
          switchOutCurve: kycSwitchOut,
          transitionBuilder: (child, animation) => FadeTransition(
            opacity: animation,
            child: SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(0, 0.4),
                end: Offset.zero,
              ).animate(animation),
              child: child,
            ),
          ),
          child: Text(
            status,
            key: ValueKey(status),
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w500,
              color: KycColors.inkMuted,
            ),
          ),
        ),
      ],
    );
  }
}

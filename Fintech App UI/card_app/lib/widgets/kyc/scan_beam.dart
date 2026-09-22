import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';

/// A band of light with a hot core line through its middle.
///
/// Symmetric top to bottom so the same widget reads correctly whether the
/// sweep is running down the subject or back up it. The falloff is two stacked
/// gradients rather than a shadow, which keeps the edge crisp on black.
class ScanBeam extends StatelessWidget {
  const ScanBeam({super.key, this.coreWidth = 2, this.spread = 0.22});

  final double coreWidth;

  /// Peak alpha of the outer halo.
  final double spread;

  @override
  Widget build(BuildContext context) {
    return Stack(
      alignment: Alignment.center,
      children: [
        _Halo(alpha: spread, heightFactor: 1),
        _Halo(alpha: spread * 1.6, heightFactor: 0.22),
        SizedBox(
          height: coreWidth,
          child: ColoredBox(color: Colors.white.withValues(alpha: 0.95)),
        ),
      ],
    );
  }
}

class _Halo extends StatelessWidget {
  const _Halo({required this.alpha, required this.heightFactor});

  final double alpha;
  final double heightFactor;

  @override
  Widget build(BuildContext context) {
    return FractionallySizedBox(
      heightFactor: heightFactor,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              KycColors.accent.withValues(alpha: 0),
              KycColors.accent.withValues(alpha: alpha),
              KycColors.accent.withValues(alpha: 0),
            ],
          ),
        ),
        child: const SizedBox.expand(),
      ),
    );
  }
}

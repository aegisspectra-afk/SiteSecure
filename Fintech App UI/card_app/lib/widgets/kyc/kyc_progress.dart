import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';
import 'kyc_layout.dart';

/// Segmented step meter for the verification flow.
///
/// Each segment fills in place rather than one bar sliding across, so the user
/// can see both how far along they are and how many stops are left.
class KycProgress extends StatelessWidget {
  const KycProgress({
    super.key,
    required this.step,
    required this.labels,
    this.complete = false,
  });

  /// Zero-based index of the step being shown.
  final int step;
  final List<String> labels;

  /// Fills every segment regardless of [step] — used once verification lands.
  final bool complete;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            for (var i = 0; i < labels.length; i++) ...[
              if (i > 0) const SizedBox(width: 6),
              Expanded(child: _Segment(filled: complete || i <= step)),
            ],
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Text(
              complete
                  ? '${labels.length} of ${labels.length}'
                  : '${step + 1} of ${labels.length}',
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: KycColors.inkMuted,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _Segment extends StatelessWidget {
  const _Segment({required this.filled});

  final bool filled;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 4,
      decoration: BoxDecoration(
        color: KycColors.hairline,
        borderRadius: BorderRadius.circular(2),
      ),
      child: TweenAnimationBuilder<double>(
        tween: Tween<double>(begin: 0, end: filled ? 1 : 0),
        duration: const Duration(milliseconds: 520),
        curve: Curves.easeOutCubic,
        builder: (context, t, _) => FractionallySizedBox(
          alignment: Alignment.centerLeft,
          widthFactor: t,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: KycColors.accent,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        ),
      ),
    );
  }
}

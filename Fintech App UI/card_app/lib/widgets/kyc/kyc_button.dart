import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';

/// Primary action for the dark flow. Fades between live and inert rather than
/// snapping, so a form completing itself feels like the button waking up.
class KycButton extends StatefulWidget {
  const KycButton({
    super.key,
    required this.label,
    required this.onTap,
    this.icon,
  });

  final String label;
  final IconData? icon;

  /// A null callback holds the button inert.
  final VoidCallback? onTap;

  @override
  State<KycButton> createState() => _KycButtonState();
}

class _KycButtonState extends State<KycButton> {
  bool _down = false;

  void _press(bool down) {
    if (widget.onTap == null || _down == down) return;
    setState(() => _down = down);
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onTap != null;

    return GestureDetector(
      onTapDown: (_) => _press(true),
      onTapUp: (_) => _press(false),
      onTapCancel: () => _press(false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _down ? 0.97 : 1,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 320),
          curve: Curves.easeOut,
          height: 58,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: enabled ? AppColors.white : KycColors.elevated,
            borderRadius: BorderRadius.circular(29),
            border: Border.all(
              color: enabled ? Colors.transparent : KycColors.hairline,
            ),
          ),
          child: AnimatedDefaultTextStyle(
            duration: const Duration(milliseconds: 320),
            // Merged, not replaced: a bare TextStyle here would drop the app's
            // typeface back to the platform default.
            style: DefaultTextStyle.of(context).style.merge(
              TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                letterSpacing: -0.3,
                color: enabled ? AppColors.black : KycColors.inkMuted,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(widget.label),
                if (widget.icon != null) ...[
                  const SizedBox(width: 8),
                  Icon(
                    widget.icon,
                    size: 17,
                    color: enabled ? AppColors.black : KycColors.inkMuted,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

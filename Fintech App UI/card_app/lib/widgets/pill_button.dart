import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

/// The app's primary action: a black pill that gives a little under the thumb.
///
/// Pass a null [onTap] to hold it inert, e.g. while an action is in flight.
class PillButton extends StatefulWidget {
  const PillButton({
    super.key,
    required this.onTap,
    required this.child,
    this.color = AppColors.black,
    this.foregroundColor = AppColors.white,
  });

  final VoidCallback? onTap;
  final Widget child;

  /// Fill, and the label and icons on it. Black on white by default; flip
  /// them on dark pages.
  final Color color;
  final Color foregroundColor;

  @override
  State<PillButton> createState() => _PillButtonState();
}

class _PillButtonState extends State<PillButton> {
  bool _down = false;

  void _press(bool down) {
    if (widget.onTap == null || _down == down) return;
    setState(() => _down = down);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => _press(true),
      onTapUp: (_) => _press(false),
      onTapCancel: () => _press(false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _down ? 0.97 : 1,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        child: Container(
          height: 58,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: widget.color,
            borderRadius: BorderRadius.circular(29),
          ),
          child: IconTheme.merge(
            data: IconThemeData(color: widget.foregroundColor, size: 20),
            child: DefaultTextStyle.merge(
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                letterSpacing: -0.3,
                color: widget.foregroundColor,
              ),
              child: widget.child,
            ),
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../theme/app_colors.dart';

/// A dark form field that lights its border on focus.
class KycField extends StatefulWidget {
  const KycField({
    super.key,
    required this.label,
    required this.hint,
    required this.controller,
    this.keyboardType,
    this.inputFormatters,
    this.textCapitalization = TextCapitalization.none,
  });

  final String label;
  final String hint;
  final TextEditingController controller;
  final TextInputType? keyboardType;
  final List<TextInputFormatter>? inputFormatters;
  final TextCapitalization textCapitalization;

  @override
  State<KycField> createState() => _KycFieldState();
}

class _KycFieldState extends State<KycField> {
  final FocusNode _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final focused = _focus.hasFocus;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AnimatedDefaultTextStyle(
          duration: const Duration(milliseconds: 220),
          // Merged, not replaced: a bare TextStyle here would drop the app's
          // typeface back to the platform default.
          style: DefaultTextStyle.of(context).style.merge(
            TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.1,
              color: focused ? KycColors.accent : KycColors.inkMuted,
            ),
          ),
          child: Text(widget.label),
        ),
        const SizedBox(height: 8),
        AnimatedContainer(
          duration: const Duration(milliseconds: 240),
          curve: Curves.easeOut,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: KycColors.field,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: focused
                  ? KycColors.accent.withValues(alpha: 0.65)
                  : KycColors.hairline,
              width: focused ? 1.5 : 1,
            ),
          ),
          child: TextField(
            controller: widget.controller,
            focusNode: _focus,
            keyboardType: widget.keyboardType,
            inputFormatters: widget.inputFormatters,
            textCapitalization: widget.textCapitalization,
            cursorColor: KycColors.accent,
            cursorRadius: const Radius.circular(2),
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.2,
              color: AppColors.white,
            ),
            decoration: InputDecoration(
              border: InputBorder.none,
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(vertical: 17),
              hintText: widget.hint,
              hintStyle: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w500,
                color: Colors.white.withValues(alpha: 0.22),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// A field that opens a picker instead of a keyboard. Matches [KycField]'s
/// box so a tapped row and a typed row sit on the same line.
class KycPickerField extends StatelessWidget {
  const KycPickerField({
    super.key,
    required this.label,
    required this.hint,
    required this.value,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final String hint;

  /// Null until the user has picked, which is when the hint shows instead.
  final String? value;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final filled = value != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.1,
            color: KycColors.inkMuted,
          ),
        ),
        const SizedBox(height: 8),
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () {
            HapticFeedback.selectionClick();
            onTap();
          },
          child: Container(
            height: 56,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: KycColors.field,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: KycColors.hairline),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    value ?? hint,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: filled ? FontWeight.w600 : FontWeight.w500,
                      letterSpacing: -0.2,
                      color: filled
                          ? AppColors.white
                          : Colors.white.withValues(alpha: 0.22),
                    ),
                  ),
                ),
                Icon(icon, size: 18, color: KycColors.inkMuted),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// Segmented selector with a pill that glides to the chosen option.
class KycSegmented extends StatelessWidget {
  const KycSegmented({
    super.key,
    required this.label,
    required this.options,
    required this.selected,
    required this.onChanged,
  });

  final String label;
  final List<String> options;
  final int selected;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.1,
            color: KycColors.inkMuted,
          ),
        ),
        const SizedBox(height: 8),
        // The track is measured from the inside, so the pill can never be
        // sized off the padding and border it sits within.
        Container(
          height: 52,
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: KycColors.field,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: KycColors.hairline),
          ),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final slot = constraints.maxWidth / options.length;

              return Stack(
                children: [
                  AnimatedPositioned(
                    duration: const Duration(milliseconds: 380),
                    curve: Curves.easeOutCubic,
                    left: slot * selected,
                    width: slot,
                    top: 0,
                    bottom: 0,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: KycColors.accent.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: KycColors.accent.withValues(alpha: 0.45),
                        ),
                      ),
                    ),
                  ),
                  Row(
                    children: [
                      for (var i = 0; i < options.length; i++)
                        SizedBox(
                          width: slot,
                          child: GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTap: () {
                              if (i == selected) return;
                              HapticFeedback.selectionClick();
                              onChanged(i);
                            },
                            child: Center(
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                ),
                                child: AnimatedDefaultTextStyle(
                                  duration: const Duration(milliseconds: 240),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: DefaultTextStyle.of(context).style
                                      .merge(
                                        TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600,
                                          letterSpacing: -0.2,
                                          color: i == selected
                                              ? KycColors.accent
                                              : KycColors.inkMuted,
                                        ),
                                      ),
                                  child: Text(options[i]),
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }
}

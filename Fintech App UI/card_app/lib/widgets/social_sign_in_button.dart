import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../theme/app_colors.dart';

/// Third-party sign-in providers, each with its official mark.
enum SocialProvider {
  facebook('Facebook', 'assets/images/social/facebook.svg', 26),
  google('Google', 'assets/images/social/google.svg', 23),
  apple('Apple', 'assets/images/social/apple.svg', 24);

  const SocialProvider(this.label, this.asset, this.logoSize);

  final String label;
  final String asset;

  /// Marks fill their artboards differently; sized so they read as equals.
  final double logoSize;
}

/// A white disc carrying a provider's logo that sinks a little when pressed.
class SocialSignInButton extends StatefulWidget {
  const SocialSignInButton({
    super.key,
    required this.provider,
    required this.onTap,
  });

  static const double size = 58;

  final SocialProvider provider;
  final VoidCallback onTap;

  @override
  State<SocialSignInButton> createState() => _SocialSignInButtonState();
}

class _SocialSignInButtonState extends State<SocialSignInButton> {
  bool _down = false;

  void _press(bool down) {
    if (_down == down) return;
    setState(() => _down = down);
  }

  @override
  Widget build(BuildContext context) {
    final provider = widget.provider;

    return Semantics(
      button: true,
      label: 'Continue with ${provider.label}',
      child: GestureDetector(
        onTapDown: (_) => _press(true),
        onTapUp: (_) => _press(false),
        onTapCancel: () => _press(false),
        onTap: widget.onTap,
        child: AnimatedScale(
          scale: _down ? 0.9 : 1,
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            width: SocialSignInButton.size,
            height: SocialSignInButton.size,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.white,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: _down ? 0.02 : 0.05),
                  blurRadius: _down ? 6 : 14,
                  offset: Offset(0, _down ? 2 : 6),
                ),
              ],
            ),
            child: SvgPicture.asset(
              provider.asset,
              width: provider.logoSize,
              height: provider.logoSize,
              excludeFromSemantics: true,
            ),
          ),
        ),
      ),
    );
  }
}

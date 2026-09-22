import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../theme/app_colors.dart';

class NavDestination {
  const NavDestination(this.icon, this.activeIcon, this.label);

  final IconData icon;
  final IconData activeIcon;
  final String label;
}

/// Floating black pill with a white puck that glides to the active item.
class AppBottomNav extends StatelessWidget {
  const AppBottomNav({
    super.key,
    required this.currentIndex,
    required this.onChanged,
  });

  final int currentIndex;
  final ValueChanged<int> onChanged;

  static const double height = 68;
  static const double _puck = 60;

  /// The puck is inset by the same amount on every side of the pill, so at the
  /// first and last destination it sits concentric in the rounded end rather
  /// than drifting toward the middle.
  static const double _inset = (height - _puck) / 2;

  /// One slot per destination, each exactly the puck's width — any slack here
  /// would offset the puck from the pill's edge.
  static const double _slot = _puck;

  /// `_copy` names are the linear set; the plain names are the bold set.
  static const List<NavDestination> destinations = [
    NavDestination(Iconsax.home_2_copy, Iconsax.home_2, 'Home'),
    NavDestination(
      Iconsax.arrow_swap_horizontal_copy,
      Iconsax.arrow_swap_horizontal,
      'Transfers',
    ),
    NavDestination(Iconsax.card_copy, Iconsax.card, 'Cards'),
    NavDestination(Iconsax.user_copy, Iconsax.user, 'Profile'),
  ];

  @override
  Widget build(BuildContext context) {
    const count = 4;

    return Container(
      height: height,
      width: _slot * count + _inset * 2,
      padding: const EdgeInsets.symmetric(horizontal: _inset),
      decoration: BoxDecoration(
        color: AppColors.darkSurface,
        borderRadius: BorderRadius.circular(height / 2),
      ),
      child: Stack(
        children: [
          // Positioned off the same slot metrics as the icons, so the puck
          // lands exactly concentric with the active one.
          AnimatedPositioned(
            duration: const Duration(milliseconds: 440),
            curve: Curves.easeOutCubic,
            left: _slot * currentIndex,
            top: _inset,
            width: _puck,
            height: _puck,
            child: const DecoratedBox(
              decoration: BoxDecoration(
                color: AppColors.white,
                shape: BoxShape.circle,
              ),
            ),
          ),
          Positioned.fill(
            child: Row(
              children: [
                for (var i = 0; i < count; i++)
                  _NavItem(
                    destination: destinations[i],
                    width: _slot,
                    selected: i == currentIndex,
                    onTap: () {
                      if (i == currentIndex) return;
                      HapticFeedback.selectionClick();
                      onChanged(i);
                    },
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.destination,
    required this.width,
    required this.selected,
    required this.onTap,
  });

  final NavDestination destination;
  final double width;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      child: Semantics(
        button: true,
        selected: selected,
        label: destination.label,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: onTap,
          child: Center(
            // A small lift as the puck arrives.
            child: TweenAnimationBuilder<double>(
              tween: Tween<double>(begin: 1, end: selected ? 1.08 : 1),
              duration: const Duration(milliseconds: 440),
              curve: Curves.easeOutBack,
              builder: (context, scale, child) =>
                  Transform.scale(scale: scale, child: child),
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 260),
                child: Icon(
                  selected ? destination.activeIcon : destination.icon,
                  key: ValueKey(selected),
                  size: 24,
                  color: selected
                      ? AppColors.textPrimary
                      : Colors.white.withValues(alpha: 0.65),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

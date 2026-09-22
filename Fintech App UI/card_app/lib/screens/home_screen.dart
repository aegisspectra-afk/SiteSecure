import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../models/card_tier.dart';
import '../models/transaction_item.dart';
import '../theme/app_colors.dart';
import '../utils/premium_page_route.dart';
import '../widgets/animated_balance.dart';
import '../widgets/app_bottom_nav.dart';
import '../widgets/metallic_card.dart';
import '../widgets/transaction_tile.dart';
import 'card_selection_screen.dart';
import 'profile_view.dart';

/// App shell. Owns the bottom bar and cross-fades the page behind it, so the
/// bar never rebuilds or slides off when the tab changes.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  static const int _profileTab = 3;

  int _navIndex = 0;

  /// Held here, not in the profile page, so it survives a trip to another tab.
  bool _verified = false;

  void _onNavChanged(int index) => setState(() => _navIndex = index);

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
      ),
      child: Scaffold(
        backgroundColor: AppColors.white,
        body: Stack(
          children: [
            Positioned.fill(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 420),
                child: _navIndex == _profileTab
                    ? ProfileView(
                        key: const ValueKey('profile'),
                        verified: _verified,
                        onVerified: () => setState(() => _verified = true),
                      )
                    : const _HomeView(key: ValueKey('home')),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: media.padding.bottom > 0 ? media.padding.bottom - 2 : 18,
              child: Center(
                child: AppBottomNav(
                  currentIndex: _navIndex,
                  onChanged: _onNavChanged,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HomeView extends StatefulWidget {
  const _HomeView({super.key});

  @override
  State<_HomeView> createState() => _HomeViewState();
}

class _HomeViewState extends State<_HomeView>
    with SingleTickerProviderStateMixin {
  static const double _balance = 22000;

  late final AnimationController _entrance = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1250),
  );

  late final Animation<double> _greeting = _step(0.00, 0.42);
  late final Animation<double> _balanceBlock = _step(0.10, 0.52);
  late final Animation<double> _card = _step(0.20, 0.68);
  late final Animation<double> _sheet = _step(0.34, 0.86);

  bool _cardPressed = false;

  Animation<double> _step(double begin, double end) => CurvedAnimation(
    parent: _entrance,
    curve: Interval(begin, end, curve: Curves.easeOutCubic),
  );

  @override
  void initState() {
    super.initState();
    _entrance.forward();
  }

  @override
  void dispose() {
    _entrance.dispose();
    super.dispose();
  }

  void _openCardPicker() {
    HapticFeedback.lightImpact();
    Navigator.of(
      context,
    ).push(PremiumPageRoute<void>(child: const CardSelectionScreen()));
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final width = media.size.width;
    final sidePad = width * 0.055;
    // Track the card's natural ratio, but never let it crowd the sheet out
    // on short screens.
    final cardHeight = (width * 0.565).clamp(0.0, media.size.height * 0.30);

    return Column(
      children: [
        // Dark header panel, curved where it meets the list.
        Container(
          width: double.infinity,
          padding: EdgeInsets.fromLTRB(
            sidePad,
            media.padding.top + 6,
            sidePad,
            24,
          ),
          decoration: const BoxDecoration(
            color: AppColors.black,
            borderRadius: BorderRadius.vertical(bottom: Radius.circular(32)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Rise(animation: _greeting, child: const _Greeting()),
              const SizedBox(height: 26),
              _Rise(
                animation: _balanceBlock,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Available balance',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: AppColors.textOnDarkMuted,
                      ),
                    ),
                    const SizedBox(height: 6),
                    AnimatedBalance(
                      amount: _balance,
                      style: const TextStyle(
                        fontSize: 38,
                        height: 1.1,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -1.4,
                        color: AppColors.white,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              _Rise(
                animation: _card,
                offset: 0.30,
                child: GestureDetector(
                  onTap: _openCardPicker,
                  onTapDown: (_) => setState(() => _cardPressed = true),
                  onTapUp: (_) => setState(() => _cardPressed = false),
                  onTapCancel: () => setState(() => _cardPressed = false),
                  child: AnimatedScale(
                    scale: _cardPressed ? 0.97 : 1,
                    duration: const Duration(milliseconds: 220),
                    curve: Curves.easeOut,
                    child: SizedBox(
                      height: cardHeight,
                      width: double.infinity,
                      child: Hero(
                        // No shuttle here: the picker's own shuttle
                        // turns the card both ways.
                        tag: CardTier.all.first.heroTag,
                        child: MetallicCard(tier: CardTier.all.first),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: _Rise(
            animation: _sheet,
            offset: 0.12,
            child: _TransactionSheet(sidePad: sidePad),
          ),
        ),
      ],
    );
  }
}

class _Greeting extends StatelessWidget {
  const _Greeting();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Expanded(
          child: Text(
            'Hello DailyFlutterUI',
            style: TextStyle(
              fontSize: 27,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.7,
              color: AppColors.white,
            ),
          ),
        ),
        const _CircleAction(icon: Iconsax.search_normal_1_copy),
        const SizedBox(width: 10),
        const _CircleAction(icon: Iconsax.add_copy),
      ],
    );
  }
}

class _CircleAction extends StatefulWidget {
  const _CircleAction({required this.icon});

  final IconData icon;

  @override
  State<_CircleAction> createState() => _CircleActionState();
}

class _CircleActionState extends State<_CircleAction> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _down = true),
      onTapUp: (_) => setState(() => _down = false),
      onTapCancel: () => setState(() => _down = false),
      onTap: HapticFeedback.selectionClick,
      child: AnimatedScale(
        scale: _down ? 0.9 : 1,
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
        child: Container(
          width: 46,
          height: 46,
          decoration: const BoxDecoration(
            color: AppColors.darkCircle,
            shape: BoxShape.circle,
          ),
          child: Icon(widget.icon, size: 20, color: AppColors.white),
        ),
      ),
    );
  }
}

class _TransactionSheet extends StatelessWidget {
  const _TransactionSheet({required this.sidePad});

  final double sidePad;

  @override
  Widget build(BuildContext context) {
    final items = TransactionItem.recent;

    return ColoredBox(
      color: AppColors.sheet,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(sidePad, 24, sidePad, 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const Expanded(
                  child: Text(
                    'Recent transactions',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w600,
                      letterSpacing: -0.4,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
                GestureDetector(
                  onTap: HapticFeedback.selectionClick,
                  child: const Text(
                    'See all',
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w500,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.separated(
              padding: EdgeInsets.fromLTRB(
                sidePad,
                6,
                sidePad,
                AppBottomNav.height + 46,
              ),
              physics: const BouncingScrollPhysics(
                parent: AlwaysScrollableScrollPhysics(),
              ),
              itemCount: items.length,
              separatorBuilder: (_, _) => const Divider(
                height: 1,
                thickness: 1,
                color: AppColors.hairline,
              ),
              itemBuilder: (context, index) => _StaggeredRow(
                index: index,
                child: TransactionTile(item: items[index]),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Fades and lifts each row in turn as the list first appears.
class _StaggeredRow extends StatefulWidget {
  const _StaggeredRow({required this.index, required this.child});

  final int index;
  final Widget child;

  @override
  State<_StaggeredRow> createState() => _StaggeredRowState();
}

class _StaggeredRowState extends State<_StaggeredRow>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 520),
  );

  late final Animation<double> _curve = CurvedAnimation(
    parent: _controller,
    curve: Curves.easeOutCubic,
  );

  @override
  void initState() {
    super.initState();
    Future<void>.delayed(Duration(milliseconds: 420 + widget.index * 80), () {
      if (mounted) _controller.forward();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _curve,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.35),
          end: Offset.zero,
        ).animate(_curve),
        child: widget.child,
      ),
    );
  }
}

/// Fade + lift driven by a shared entrance controller.
class _Rise extends StatelessWidget {
  const _Rise({
    required this.animation,
    required this.child,
    this.offset = 0.22,
  });

  final Animation<double> animation;
  final Widget child;
  final double offset;

  @override
  Widget build(BuildContext context) {
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

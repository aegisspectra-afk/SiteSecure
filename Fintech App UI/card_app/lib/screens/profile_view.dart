import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../theme/app_colors.dart';
import '../widgets/app_bottom_nav.dart';
import '../widgets/kyc/kyc_layout.dart';
import '../widgets/kyc/shine.dart';
import '../widgets/verified_badge.dart';
import 'kyc/kyc_flow_screen.dart';

/// Account page, and the door into identity verification.
///
/// A page rather than a route: the shell keeps the bottom bar on screen and
/// cross-fades between this and Home.
class ProfileView extends StatefulWidget {
  const ProfileView({
    super.key,
    required this.verified,
    required this.onVerified,
  });

  /// Owned by the shell so it survives a trip to another tab.
  final bool verified;
  final VoidCallback onVerified;

  @override
  State<ProfileView> createState() => _ProfileViewState();
}

class _ProfileViewState extends State<ProfileView>
    with TickerProviderStateMixin {
  late final AnimationController _entrance = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..forward();

  /// Drives everything the badge brings with it: the ring drawing itself, the
  /// tick landing, and the shine crossing both.
  late final AnimationController _celebrate = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1500),
  );

  @override
  void initState() {
    super.initState();
    // Coming back to an already-verified account shows the settled state, not
    // a replay of the reveal.
    if (widget.verified) _celebrate.value = 1;
  }

  @override
  void didUpdateWidget(ProfileView old) {
    super.didUpdateWidget(old);
    if (widget.verified && !old.verified) {
      HapticFeedback.heavyImpact();
      _celebrate.forward();
    }
  }

  @override
  void dispose() {
    _entrance.dispose();
    _celebrate.dispose();
    super.dispose();
  }

  Future<void> _openVerification() async {
    HapticFeedback.mediumImpact();
    final verified = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(builder: (context) => const KycFlowScreen()),
    );
    if (!mounted || verified != true || widget.verified) return;

    // Let the flow finish leaving before the badge lands.
    await Future<void>.delayed(const Duration(milliseconds: 220));
    if (mounted) widget.onVerified();
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final sidePad = media.size.width * 0.055;

    return Column(
      children: [
        _Rise(
          animation: _step(0, 0.55),
          child: _Header(
            sidePad: sidePad,
            topPad: media.padding.top,
            celebrate: _celebrate,
            verified: widget.verified,
          ),
        ),
        Expanded(
          child: ListView(
            padding: EdgeInsets.fromLTRB(
              sidePad,
              24,
              sidePad,
              AppBottomNav.height + 46,
            ),
            physics: const BouncingScrollPhysics(
              parent: AlwaysScrollableScrollPhysics(),
            ),
            children: [
              _Rise(
                animation: _step(0.14, 0.68),
                child: AnimatedSize(
                  duration: const Duration(milliseconds: 460),
                  curve: Curves.easeOutCubic,
                  alignment: Alignment.topCenter,
                  child: widget.verified
                      ? _VerifiedBanner(celebrate: _celebrate)
                      : _VerifyCard(onTap: _openVerification),
                ),
              ),
              const SizedBox(height: 28),
              for (var i = 0; i < _menu.length; i++)
                _Rise(
                  animation: _step(0.24 + i * 0.05, 0.76 + i * 0.04),
                  child: _MenuRow(item: _menu[i], last: i == _menu.length - 1),
                ),
              const SizedBox(height: 26),
              _Rise(animation: _step(0.5, 1), child: const _SignOut()),
            ],
          ),
        ),
      ],
    );
  }

  Animation<double> _step(double begin, double end) => CurvedAnimation(
    parent: _entrance,
    curve: Interval(
      begin.clamp(0.0, 1.0),
      end.clamp(0.0, 1.0),
      curve: Curves.easeOutCubic,
    ),
  );

  static const List<_MenuItem> _menu = [
    _MenuItem(Iconsax.profile_circle, 'Personal details'),
    _MenuItem(Iconsax.lock_1, 'Security'),
    _MenuItem(Iconsax.card, 'Payment methods'),
    _MenuItem(Iconsax.notification, 'Notifications'),
    _MenuItem(Iconsax.message_question, 'Help centre'),
  ];
}

class _Header extends StatelessWidget {
  const _Header({
    required this.sidePad,
    required this.topPad,
    required this.celebrate,
    required this.verified,
  });

  final double sidePad;
  final double topPad;
  final Animation<double> celebrate;
  final bool verified;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(sidePad, topPad + 6, sidePad, 30),
      decoration: const BoxDecoration(
        color: AppColors.black,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(32)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Profile',
                  style: TextStyle(
                    fontSize: 27,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.7,
                    color: AppColors.white,
                  ),
                ),
              ),
              const _CircleAction(icon: Iconsax.setting_2),
            ],
          ),
          const SizedBox(height: 24),
          ProfileAvatar(celebrate: celebrate, verified: verified),
          const SizedBox(height: 14),
          const Text(
            'DailyFlutterUI',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.5,
              color: AppColors.white,
            ),
          ),
          const SizedBox(height: 3),
          const Text(
            'hello@dailyflutterui.com',
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w500,
              color: AppColors.textOnDarkMuted,
            ),
          ),
          const SizedBox(height: 16),
          _StatusChip(verified: verified, celebrate: celebrate),
        ],
      ),
    );
  }
}

/// The account photo, ringed by a band that draws itself in titanium the
/// moment verification lands, with the blue seal stamped at its corner.
class ProfileAvatar extends StatelessWidget {
  const ProfileAvatar({
    super.key,
    required this.celebrate,
    required this.verified,
    this.size = 86,
  });

  final Animation<double> celebrate;
  final bool verified;
  final double size;

  static const String asset = 'assets/images/profile.png';

  /// Decodes the photo before `runApp`, so the avatar is never an empty ring
  /// on its first frame. Safe to call more than once.
  static Future<void> precache() {
    final completer = Completer<void>();
    final stream = const AssetImage(asset).resolve(ImageConfiguration.empty);

    late final ImageStreamListener listener;
    void done() {
      stream.removeListener(listener);
      if (!completer.isCompleted) completer.complete();
    }

    // Errors resolve too — a missing photo should not hold up launch.
    listener = ImageStreamListener((_, _) => done(), onError: (_, _) => done());
    stream.addListener(listener);
    return completer.future;
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: celebrate,
      builder: (context, _) {
        final t = verified
            ? Curves.easeOutCubic.transform(celebrate.value)
            : 0.0;

        return SizedBox(
          width: size + 24,
          height: size + 24,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Positioned.fill(
                child: CustomPaint(painter: _AvatarRingPainter(progress: t)),
              ),
              // Metal sits under the photo, so a slow decode shows a filled
              // disc rather than a hole in the ring.
              Container(
                width: size,
                height: size,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFFBBB7B0), Color(0xFF908C86)],
                  ),
                ),
                child: ClipOval(child: Image.asset(asset, fit: BoxFit.cover)),
              ),
              if (t > 0.01)
                Positioned(
                  right: 3,
                  bottom: 5,
                  child: Transform.scale(
                    // Lands late and overshoots, so the tick reads as a stamp.
                    scale: Curves.easeOutBack.transform(
                      ((t - 0.45) / 0.55).clamp(0.0, 1.0),
                    ),
                    child: Shine(
                      animation: celebrate,
                      child: VerifiedBadge(
                        size: 32,
                        // Struck in the header's own black so the seal keeps
                        // its edge where it overlaps the photo.
                        outlineColor: AppColors.black,
                        outlineWidth: 2.5,
                        progress: ((t - 0.55) / 0.45).clamp(0.0, 1.0),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _AvatarRingPainter extends CustomPainter {
  _AvatarRingPainter({required this.progress});

  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final centre = size.center(Offset.zero);
    final rect = Rect.fromCircle(center: centre, radius: size.width / 2 - 2);

    // Dormant ring: dashes, fading out as the titanium band takes over.
    const dashes = 34;
    const step = 2 * math.pi / dashes;
    final dormant = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.8
      ..strokeCap = StrokeCap.round
      ..color = Colors.white.withValues(alpha: 0.16 * (1 - progress));
    for (var i = 0; i < dashes; i++) {
      canvas.drawArc(rect, i * step, step * 0.45, false, dormant);
    }

    if (progress <= 0) return;

    canvas.drawArc(
      rect,
      -math.pi / 2,
      progress * 2 * math.pi,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.4
        ..strokeCap = StrokeCap.round
        ..shader = SweepGradient(
          startAngle: -math.pi / 2,
          endAngle: 3 * math.pi / 2,
          colors: const [
            KycColors.accentDim,
            KycColors.accent,
            AppColors.white,
            KycColors.accent,
          ],
          transform: const GradientRotation(-math.pi / 2),
        ).createShader(rect),
    );
  }

  @override
  bool shouldRepaint(_AvatarRingPainter old) => old.progress != progress;
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.verified, required this.celebrate});

  final bool verified;
  final Animation<double> celebrate;

  @override
  Widget build(BuildContext context) {
    final tone = verified ? AppColors.verified : KycColors.pending;
    final chip = Container(
      key: ValueKey(verified),
      padding: const EdgeInsets.fromLTRB(12, 7, 15, 7),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: tone.withValues(alpha: 0.32)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (verified)
            const VerifiedBadge(size: 16)
          else
            Icon(Iconsax.info_circle, size: 15, color: tone),
          const SizedBox(width: 7),
          Text(
            verified ? 'Identity verified' : 'Identity not verified',
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.1,
              color: tone,
            ),
          ),
        ],
      ),
    );

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 520),
      switchInCurve: kycSwitchIn,
      switchOutCurve: kycSwitchOut,
      transitionBuilder: (child, animation) => FadeTransition(
        opacity: animation,
        child: ScaleTransition(
          scale: Tween<double>(begin: 0.88, end: 1).animate(
            CurvedAnimation(parent: animation, curve: Curves.easeOutBack),
          ),
          child: child,
        ),
      ),
      child: verified ? Shine(animation: celebrate, child: chip) : chip,
    );
  }
}

/// The call to action: one dark card, one line of why, one chevron.
class _VerifyCard extends StatefulWidget {
  const _VerifyCard({required this.onTap});

  final VoidCallback onTap;

  @override
  State<_VerifyCard> createState() => _VerifyCardState();
}

class _VerifyCardState extends State<_VerifyCard> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _down = true),
      onTapUp: (_) => setState(() => _down = false),
      onTapCancel: () => setState(() => _down = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _down ? 0.975 : 1,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: AppColors.black,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.07),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Iconsax.shield_tick,
                  size: 21,
                  color: KycColors.accent,
                ),
              ),
              const SizedBox(width: 14),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Verify your identity',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.4,
                        color: AppColors.white,
                      ),
                    ),
                    SizedBox(height: 3),
                    Text(
                      'Unlock higher limits',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: KycColors.inkMuted,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Iconsax.arrow_right_3_copy,
                size: 18,
                color: KycColors.inkMuted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// What replaces the call to action once the badge is earned.
class _VerifiedBanner extends StatelessWidget {
  const _VerifiedBanner({required this.celebrate});

  final Animation<double> celebrate;

  @override
  Widget build(BuildContext context) {
    return Shine(
      animation: celebrate,
      intensity: 0.22,
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: AppColors.black,
          borderRadius: BorderRadius.circular(24),
        ),
        child: Row(
          children: [
            const VerifiedBadge(size: 44),
            const SizedBox(width: 14),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Identity verified',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      letterSpacing: -0.4,
                      color: AppColors.white,
                    ),
                  ),
                  SizedBox(height: 3),
                  Text(
                    'Tier 3 · Full access unlocked',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: KycColors.inkMuted,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MenuItem {
  const _MenuItem(this.icon, this.title);

  final IconData icon;
  final String title;
}

class _MenuRow extends StatefulWidget {
  const _MenuRow({required this.item, required this.last});

  final _MenuItem item;
  final bool last;

  @override
  State<_MenuRow> createState() => _MenuRowState();
}

class _MenuRowState extends State<_MenuRow> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _down = true),
      onTapUp: (_) => setState(() => _down = false),
      onTapCancel: () => setState(() => _down = false),
      onTap: HapticFeedback.selectionClick,
      child: AnimatedScale(
        scale: _down ? 0.985 : 1,
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
        child: Container(
          height: 60,
          decoration: BoxDecoration(
            border: widget.last
                ? null
                : const Border(bottom: BorderSide(color: AppColors.hairline)),
          ),
          child: Row(
            children: [
              Icon(widget.item.icon, size: 20, color: AppColors.textPrimary),
              const SizedBox(width: 16),
              Expanded(
                child: Text(
                  widget.item.title,
                  style: const TextStyle(
                    fontSize: 15.5,
                    fontWeight: FontWeight.w500,
                    letterSpacing: -0.3,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              const Icon(
                Iconsax.arrow_right_3_copy,
                size: 16,
                color: AppColors.textTertiary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SignOut extends StatelessWidget {
  const _SignOut();

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: HapticFeedback.selectionClick,
      child: const Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Iconsax.logout, size: 17, color: AppColors.negative),
          SizedBox(width: 9),
          Text(
            'Log out',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.3,
              color: AppColors.negative,
            ),
          ),
        ],
      ),
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

/// Fade + lift driven by the shared entrance controller.
class _Rise extends StatelessWidget {
  const _Rise({required this.animation, required this.child});

  final Animation<double> animation;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: animation,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.18),
          end: Offset.zero,
        ).animate(animation),
        child: child,
      ),
    );
  }
}

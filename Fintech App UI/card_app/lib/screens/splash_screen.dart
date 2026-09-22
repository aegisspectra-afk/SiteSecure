import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_colors.dart';
import 'login_screen.dart';

/// Title and description fade in, hold, then slip off to the right before login.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  /// Change these two lines to rebrand.
  static const String appName = 'SLATE';
  static const String description = 'All your cards in one place';

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2200),
  );

  // The description trails the title slightly on the way in and on the way out.
  late final Animation<double> _titleIn = _step(0.00, 0.25, Curves.easeOut);
  late final Animation<double> _descIn = _step(0.08, 0.33, Curves.easeOut);
  late final Animation<double> _titleOut = _step(
    0.78,
    0.96,
    Curves.easeInCubic,
  );
  late final Animation<double> _descOut = _step(0.82, 1.00, Curves.easeInCubic);

  Animation<double> _step(double from, double to, Curve curve) =>
      CurvedAnimation(
        parent: _controller,
        curve: Interval(from, to, curve: curve),
      );

  @override
  void initState() {
    super.initState();
    _controller
      ..addStatusListener(_handleStatus)
      ..forward();
  }

  void _handleStatus(AnimationStatus status) {
    if (status != AnimationStatus.completed || !mounted) return;

    // Replace, so the splash cannot be reached by going back. A hard cut: the
    // splash ends on bare black and login opens on the same black, which it
    // then lifts away itself.
    Navigator.of(context).pushReplacement(
      PageRouteBuilder<void>(
        transitionDuration: Duration.zero,
        reverseTransitionDuration: Duration.zero,
        pageBuilder: (_, _, _) => const LoginScreen(),
      ),
    );
  }

  @override
  void dispose() {
    _controller.removeStatusListener(_handleStatus);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // How far the text travels right as it leaves.
    final exitDistance = MediaQuery.sizeOf(context).width * 0.35;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
      ),
      child: Scaffold(
        backgroundColor: AppColors.black,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _SplashLine(
                enter: _titleIn,
                exit: _titleOut,
                exitDistance: exitDistance,
                child: const Text(
                  SplashScreen.appName,
                  style: TextStyle(
                    fontSize: 30,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 6,
                    color: AppColors.white,
                  ),
                ),
              ),
              const SizedBox(height: 10),
              _SplashLine(
                enter: _descIn,
                exit: _descOut,
                exitDistance: exitDistance,
                child: const Text(
                  SplashScreen.description,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textOnDarkMuted,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// One line of splash text: fades up into place, then fades out while
/// accelerating off to the right.
class _SplashLine extends StatelessWidget {
  const _SplashLine({
    required this.enter,
    required this.exit,
    required this.exitDistance,
    required this.child,
  });

  final Animation<double> enter;
  final Animation<double> exit;
  final double exitDistance;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge([enter, exit]),
      builder: (context, child) => Opacity(
        opacity: (enter.value * (1 - exit.value)).clamp(0.0, 1.0),
        child: Transform.translate(
          offset: Offset(exitDistance * exit.value, 12 * (1 - enter.value)),
          child: child,
        ),
      ),
      child: child,
    );
  }
}

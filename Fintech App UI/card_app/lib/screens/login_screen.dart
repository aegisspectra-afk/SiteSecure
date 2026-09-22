import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:lottie/lottie.dart';

import '../theme/app_colors.dart';
import '../utils/premium_page_route.dart';
import '../widgets/pill_button.dart';
import '../widgets/social_sign_in_button.dart';
import 'home_screen.dart';
import 'splash_screen.dart';

/// Picks up exactly where the splash leaves off — on solid black. The black
/// lifts once into a curved header and the form rises in underneath. Once
/// signed in, the header drops back down over the page and home opens out of
/// the black.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  /// Curtain, brand and form, start to finish.
  static const Duration entrance = Duration(milliseconds: 1700);

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with TickerProviderStateMixin {
  static const Duration _processing = Duration(milliseconds: 1400);
  static const Duration _morph = Duration(milliseconds: 420);
  static const Duration _shake = Duration(milliseconds: 480);
  static const Duration _coverDuration = Duration(milliseconds: 680);

  late final AnimationController _entrance = AnimationController(
    vsync: this,
    duration: LoginScreen.entrance,
  );

  /// Drops the header over the whole page once sign-in succeeds.
  late final AnimationController _cover = AnimationController(
    vsync: this,
    duration: _coverDuration,
  );

  late final AnimationController _emailShake = AnimationController(
    vsync: this,
    duration: _shake,
  );
  late final AnimationController _passwordShake = AnimationController(
    vsync: this,
    duration: _shake,
  );

  late final Animation<double> _header = _step(0, 0.60, Curves.linear);
  late final Animation<double> _brand = _step(0.28, 0.72);
  late final Animation<double> _title = _step(0.40, 0.74);
  late final Animation<double> _emailField = _step(0.45, 0.79);
  late final Animation<double> _passwordField = _step(0.50, 0.84);
  late final Animation<double> _action = _step(0.56, 0.90);
  late final Animation<double> _divider = _step(
    0.62,
    0.94,
    Curves.easeInOutCubic,
  );
  late final List<Animation<double>> _socials = [
    for (var i = 0; i < SocialProvider.values.length; i++)
      _step(0.66 + i * 0.05, 0.90 + i * 0.05, Curves.easeOutBack),
  ];
  late final Animation<double> _footer = _step(0.80, 1.00);

  /// Slow off the mark, fast through the middle, soft as it lands.
  late final Animation<double> _covering = CurvedAnimation(
    parent: _cover,
    curve: const Cubic(0.7, 0, 0.3, 1),
  );

  final _scroll = ScrollController();

  final _email = TextEditingController();
  final _password = TextEditingController();
  final _emailFocus = FocusNode();
  final _passwordFocus = FocusNode();

  bool _obscured = true;
  bool _emailInvalid = false;
  bool _passwordInvalid = false;
  bool _signingIn = false;

  Animation<double> _step(
    double begin,
    double end, [
    Curve curve = Curves.easeOutCubic,
  ]) => CurvedAnimation(
    parent: _entrance,
    curve: Interval(begin, end, curve: curve),
  );

  @override
  void initState() {
    super.initState();
    _entrance.forward();
    // Decode the loader now so it is ready the instant the button folds.
    AssetLottie(_SignInLoader.asset).load();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) _entrance.value = 1;
  }

  @override
  void dispose() {
    _entrance.dispose();
    _cover.dispose();
    _scroll.dispose();
    _emailShake.dispose();
    _passwordShake.dispose();
    _email.dispose();
    _password.dispose();
    _emailFocus.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  static bool _isEmail(String value) =>
      RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(value.trim());

  Future<void> _signIn() async {
    if (_signingIn) return;

    final emailOk = _isEmail(_email.text);
    final passwordOk = _password.text.isNotEmpty;
    if (!emailOk || !passwordOk) {
      HapticFeedback.heavyImpact();
      setState(() {
        _emailInvalid = !emailOk;
        _passwordInvalid = !passwordOk;
      });
      if (!emailOk) _emailShake.forward(from: 0);
      if (!passwordOk) _passwordShake.forward(from: 0);
      return;
    }

    FocusScope.of(context).unfocus();
    HapticFeedback.mediumImpact();
    setState(() => _signingIn = true);

    await Future<void>.delayed(_processing);
    if (!mounted) return;

    HapticFeedback.lightImpact();
    if (MediaQuery.disableAnimationsOf(context)) {
      _cover.value = 1;
    } else {
      await _cover.forward();
    }
    if (!mounted) return;

    Navigator.of(
      context,
    ).pushReplacement(PremiumPageRoute<void>(child: const HomeScreen()));
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final width = media.size.width;
    final sidePad = width * 0.06;
    final headerDepth = (media.size.height * 0.30).clamp(236.0, 300.0);

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
      ),
      child: GestureDetector(
        onTap: () => FocusScope.of(context).unfocus(),
        child: Scaffold(
          backgroundColor: AppColors.scaffoldLight,
          body: CustomScrollView(
            controller: _scroll,
            // Clamped, so pulling down never peels the header off the top.
            physics: const ClampingScrollPhysics(),
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            slivers: [
              SliverFillRemaining(
                hasScrollBody: false,
                child: Stack(
                  // The curtain starts below the fold, outside its own box.
                  clipBehavior: Clip.none,
                  children: [
                    // Sinks back a touch as the black comes down over it.
                    AnimatedBuilder(
                      animation: _covering,
                      builder: (context, child) => Transform.scale(
                        scale: 1 - 0.05 * _covering.value,
                        alignment: Alignment.topCenter,
                        child: child,
                      ),
                      child: Padding(
                        padding: EdgeInsets.fromLTRB(
                          sidePad,
                          headerDepth + 16,
                          sidePad,
                          math.max(media.padding.bottom, 16),
                        ),
                        child: _buildForm(width - sidePad * 2),
                      ),
                    ),
                    Positioned(
                      top: 0,
                      left: 0,
                      right: 0,
                      height: headerDepth,
                      child: IgnorePointer(
                        child: RepaintBoundary(
                          child: CustomPaint(
                            painter: _HeaderPainter(
                              lift: _header,
                              cover: _covering,
                              scroll: _scroll,
                              viewportHeight: media.size.height,
                              topInset: media.padding.top,
                            ),
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      top: media.padding.top + 34,
                      left: sidePad,
                      right: sidePad,
                      child: IgnorePointer(
                        child: _Brand(entrance: _brand, exit: _covering),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildForm(double formWidth) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Rise(
          animation: _title,
          child: const Text(
            'Login',
            style: TextStyle(
              fontSize: 30,
              height: 1.15,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.9,
              color: AppColors.textPrimary,
            ),
          ),
        ),
        const SizedBox(height: 22),
        _Rise(
          animation: _emailField,
          child: _Shake(
            animation: _emailShake,
            child: _Field(
              label: 'Email',
              hint: 'Enter your email',
              controller: _email,
              focusNode: _emailFocus,
              invalid: _emailInvalid,
              errorText: 'Enter a valid email address',
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.email],
              onChanged: (_) {
                if (_emailInvalid) setState(() => _emailInvalid = false);
              },
              onSubmitted: (_) => _passwordFocus.requestFocus(),
            ),
          ),
        ),
        const SizedBox(height: 16),
        _Rise(
          animation: _passwordField,
          child: _Shake(
            animation: _passwordShake,
            child: _Field(
              label: 'Password',
              hint: '••••••••',
              controller: _password,
              focusNode: _passwordFocus,
              invalid: _passwordInvalid,
              errorText: 'Enter your password',
              obscureText: _obscured,
              textInputAction: TextInputAction.done,
              autofillHints: const [AutofillHints.password],
              onChanged: (_) {
                if (_passwordInvalid) setState(() => _passwordInvalid = false);
              },
              onSubmitted: (_) => _signIn(),
              trailing: _VisibilityToggle(
                obscured: _obscured,
                onTap: () {
                  HapticFeedback.selectionClick();
                  setState(() => _obscured = !_obscured);
                },
              ),
            ),
          ),
        ),
        _Rise(
          animation: _action,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Align(
                alignment: Alignment.centerRight,
                child: _TextLink(
                  label: 'Forgot password?',
                  padding: const EdgeInsets.fromLTRB(12, 12, 0, 12),
                  onTap: HapticFeedback.selectionClick,
                ),
              ),
              const SizedBox(height: 6),
              // The button folds into the loader right under the thumb that
              // pressed it.
              Center(
                child: AnimatedContainer(
                  duration: _morph,
                  curve: const Interval(0.2, 1, curve: Curves.easeInOutCubic),
                  width: _signingIn ? _SignInLoader.pillWidth : formWidth,
                  child: PillButton(
                    onTap: _signingIn ? null : _signIn,
                    child: AnimatedSwitcher(
                      duration: _morph,
                      switchInCurve: const Interval(
                        0.5,
                        1,
                        curve: Curves.easeOutCubic,
                      ),
                      switchOutCurve: const Interval(
                        0.5,
                        1,
                        curve: Curves.easeInCubic,
                      ),
                      transitionBuilder: (child, animation) => FadeTransition(
                        opacity: animation,
                        child: ScaleTransition(
                          scale: Tween<double>(
                            begin: 0.88,
                            end: 1,
                          ).animate(animation),
                          child: child,
                        ),
                      ),
                      child: _signingIn
                          ? const _SignInLoader(key: ValueKey('loading'))
                          : const Text(
                              'Login',
                              key: ValueKey('login'),
                              maxLines: 1,
                              softWrap: false,
                            ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 28),
        _OrDivider(animation: _divider),
        const SizedBox(height: 22),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (var i = 0; i < SocialProvider.values.length; i++) ...[
              if (i > 0) const SizedBox(width: 20),
              _Pop(
                animation: _socials[i],
                child: SocialSignInButton(
                  provider: SocialProvider.values[i],
                  onTap: HapticFeedback.selectionClick,
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 32),
        const Spacer(),
        _Rise(
          animation: _footer,
          offset: 0.6,
          // Wraps rather than overflows on narrow screens or large text.
          child: Wrap(
            alignment: WrapAlignment.center,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              const Text(
                "Don't have an account?",
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textSecondary,
                ),
              ),
              _TextLink(
                label: 'Sign up',
                padding: const EdgeInsets.fromLTRB(5, 10, 8, 10),
                onTap: HapticFeedback.selectionClick,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Paints the black header with one sweeping edge: deepest a third of the way
/// across, rising steeply to the right.
///
/// On entry the edge starts below the fold, so the screen opens on the
/// splash's black, then lifts once into place. [cover] runs it the other way:
/// the edge drops past the bottom of the screen, middle first.
class _HeaderPainter extends CustomPainter {
  _HeaderPainter({
    required this.lift,
    required this.cover,
    required this.scroll,
    required this.viewportHeight,
    required this.topInset,
  }) : super(repaint: Listenable.merge([lift, cover]));

  final Animation<double> lift;
  final Animation<double> cover;

  /// The header scrolls with the form, so covering the screen means reaching
  /// however far the page has been scrolled, too.
  final ScrollController scroll;
  final double viewportHeight;
  final double topInset;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final d = size.height;
    // Where the edge meets the right side at rest: always below the status bar.
    final rightEdge = math.max(topInset + 18, d * 0.28);

    final scrolled = scroll.hasClients ? scroll.offset : 0.0;
    final t = lift.value;
    final c = cover.value;
    final offset =
        (1 - Curves.fastEaseInToSlowEaseOut.transform(t)) *
            (viewportHeight - rightEdge + 8) +
        c * (viewportHeight + scrolled - rightEdge + 8);

    // The middle trails the sides on the way up, then settles; on the way
    // down it leads, and the sides catch up as it lands.
    final sag =
        math.sin(1.6 * math.pi * t) * math.pow(1 - t, 1.5) * 120 +
        math.sin(math.pi * c) * 150;

    final path = Path()
      ..moveTo(0, 0)
      ..lineTo(0, d * 0.80 + offset)
      ..cubicTo(
        w * 0.38,
        d * 1.18 + offset + sag,
        w * 0.72,
        d * 0.95 + offset + sag * 0.6,
        w,
        rightEdge + offset,
      )
      ..lineTo(w, 0)
      ..close();

    canvas.drawPath(path, Paint()..color = AppColors.black);
  }

  @override
  bool shouldRepaint(_HeaderPainter oldDelegate) =>
      oldDelegate.lift != lift ||
      oldDelegate.cover != cover ||
      oldDelegate.scroll != scroll ||
      oldDelegate.viewportHeight != viewportHeight ||
      oldDelegate.topInset != topInset;
}

/// Wordmark and greeting: slide in from the left, then lift away as the
/// header covers the page.
class _Brand extends StatelessWidget {
  const _Brand({required this.entrance, required this.exit});

  final Animation<double> entrance;
  final Animation<double> exit;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge([entrance, exit]),
      builder: (context, child) => Opacity(
        opacity: (1 - exit.value * 1.6).clamp(0.0, 1.0),
        child: Transform.translate(
          offset: Offset(0, -18 * exit.value),
          child: _content(entrance.value),
        ),
      ),
    );
  }

  Widget _content(double e) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Enters from the left, where the splash wordmark left to the right.
        Opacity(
          opacity: e,
          child: Transform.translate(
            offset: Offset(-36 * (1 - e), 0),
            child: const Text(
              SplashScreen.appName,
              style: TextStyle(
                fontSize: 30,
                height: 1.1,
                fontWeight: FontWeight.w600,
                letterSpacing: 6,
                color: AppColors.white,
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Opacity(
          opacity: Curves.easeIn.transform(e),
          child: Transform.translate(
            offset: Offset(-20 * (1 - e), 0),
            child: const Text(
              'Welcome back! Log in to continue.',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: AppColors.textOnDarkMuted,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Labelled input: a white well that draws a black rim when focused and a
/// red one when its value is rejected.
class _Field extends StatefulWidget {
  const _Field({
    required this.label,
    required this.hint,
    required this.controller,
    required this.focusNode,
    required this.invalid,
    required this.errorText,
    this.obscureText = false,
    this.keyboardType,
    this.textInputAction,
    this.autofillHints,
    this.onChanged,
    this.onSubmitted,
    this.trailing,
  });

  final String label;
  final String hint;
  final TextEditingController controller;
  final FocusNode focusNode;
  final bool invalid;
  final String errorText;
  final bool obscureText;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final Iterable<String>? autofillHints;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final Widget? trailing;

  @override
  State<_Field> createState() => _FieldState();
}

class _FieldState extends State<_Field> {
  static const Duration _ease = Duration(milliseconds: 240);

  @override
  void initState() {
    super.initState();
    widget.focusNode.addListener(_onFocus);
  }

  @override
  void dispose() {
    widget.focusNode.removeListener(_onFocus);
    super.dispose();
  }

  void _onFocus() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final focused = widget.focusNode.hasFocus;
    final rim = widget.invalid
        ? AppColors.negative
        : focused
        ? AppColors.black
        : Colors.transparent;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AnimatedDefaultTextStyle(
          duration: _ease,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            letterSpacing: -0.2,
            color: widget.invalid ? AppColors.negative : AppColors.textPrimary,
          ),
          child: Text(widget.label),
        ),
        const SizedBox(height: 8),
        GestureDetector(
          onTap: widget.focusNode.requestFocus,
          child: AnimatedContainer(
            duration: _ease,
            curve: Curves.easeOutCubic,
            height: 54,
            decoration: BoxDecoration(
              color: AppColors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: rim, width: 1.4),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: focused ? 0.08 : 0.03),
                  blurRadius: focused ? 20 : 8,
                  offset: Offset(0, focused ? 8 : 2),
                ),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: widget.controller,
                    focusNode: widget.focusNode,
                    obscureText: widget.obscureText,
                    obscuringCharacter: '•',
                    keyboardType: widget.keyboardType,
                    textInputAction: widget.textInputAction,
                    autofillHints: widget.autofillHints,
                    autocorrect: false,
                    enableSuggestions: !widget.obscureText,
                    onChanged: widget.onChanged,
                    onSubmitted: widget.onSubmitted,
                    cursorColor: AppColors.black,
                    cursorWidth: 1.6,
                    cursorRadius: const Radius.circular(2),
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                      letterSpacing: -0.2,
                      color: AppColors.textPrimary,
                    ),
                    decoration: InputDecoration(
                      isCollapsed: true,
                      border: InputBorder.none,
                      hintText: widget.hint,
                      hintStyle: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w400,
                        color: AppColors.textTertiary,
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                      ),
                    ),
                  ),
                ),
                ?widget.trailing,
              ],
            ),
          ),
        ),
        AnimatedSize(
          duration: _ease,
          curve: Curves.easeOutCubic,
          alignment: Alignment.topLeft,
          child: widget.invalid
              ? Padding(
                  padding: const EdgeInsets.only(top: 6, left: 2),
                  child: Text(
                    widget.errorText,
                    style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w500,
                      color: AppColors.negative,
                    ),
                  ),
                )
              : const SizedBox(width: double.infinity),
        ),
      ],
    );
  }
}

/// Eye that blinks between open and shut as the password is shown or hidden.
class _VisibilityToggle extends StatelessWidget {
  const _VisibilityToggle({required this.obscured, required this.onTap});

  final bool obscured;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: obscured ? 'Show password' : 'Hide password',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: SizedBox(
          width: 50,
          height: 54,
          child: Center(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 260),
              // Squashes vertically, like an eyelid.
              transitionBuilder: (child, animation) => AnimatedBuilder(
                animation: animation,
                builder: (context, child) => Opacity(
                  opacity: animation.value,
                  child: Transform.scale(
                    scaleX: 1,
                    scaleY: animation.value,
                    child: child,
                  ),
                ),
                child: child,
              ),
              child: Icon(
                obscured ? Iconsax.eye_slash_copy : Iconsax.eye_copy,
                key: ValueKey(obscured),
                size: 20,
                color: AppColors.textSecondary,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Text that dims under the thumb.
class _TextLink extends StatefulWidget {
  const _TextLink({
    required this.label,
    required this.onTap,
    this.padding = EdgeInsets.zero,
  });

  final String label;
  final VoidCallback onTap;
  final EdgeInsets padding;

  @override
  State<_TextLink> createState() => _TextLinkState();
}

class _TextLinkState extends State<_TextLink> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _down = true),
      onTapUp: (_) => setState(() => _down = false),
      onTapCancel: () => setState(() => _down = false),
      onTap: widget.onTap,
      child: Padding(
        padding: widget.padding,
        child: AnimatedOpacity(
          opacity: _down ? 0.45 : 1,
          duration: const Duration(milliseconds: 150),
          child: Text(
            widget.label,
            style: const TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.1,
              color: AppColors.textPrimary,
            ),
          ),
        ),
      ),
    );
  }
}

/// Hairlines that draw outward from the word between them.
class _OrDivider extends AnimatedWidget {
  const _OrDivider({required Animation<double> animation})
    : super(listenable: animation);

  @override
  Widget build(BuildContext context) {
    final value = (listenable as Animation<double>).value;
    final line = Container(
      height: 1,
      color: AppColors.textTertiary.withValues(alpha: 0.55),
    );

    return Row(
      children: [
        Expanded(
          child: Transform.scale(
            scaleX: value,
            alignment: Alignment.centerRight,
            child: line,
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Opacity(
            opacity: value,
            child: const Text(
              'Or',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: AppColors.textSecondary,
              ),
            ),
          ),
        ),
        Expanded(
          child: Transform.scale(
            scaleX: value,
            alignment: Alignment.centerLeft,
            child: line,
          ),
        ),
      ],
    );
  }
}

/// Knocks its child side to side, dying away — a head-shake for bad input.
class _Shake extends AnimatedWidget {
  const _Shake({required Animation<double> animation, required this.child})
    : super(listenable: animation);

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final t = (listenable as Animation<double>).value;
    return Transform.translate(
      offset: Offset(math.sin(t * math.pi * 5) * 9 * (1 - t), 0),
      child: child,
    );
  }
}

/// Springs its child up from small, overshooting a touch.
class _Pop extends AnimatedWidget {
  const _Pop({required Animation<double> animation, required this.child})
    : super(listenable: animation);

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final value = (listenable as Animation<double>).value;
    return Opacity(
      opacity: value.clamp(0.0, 1.0),
      child: Transform.scale(scale: 0.4 + 0.6 * value, child: child),
    );
  }
}

/// Fade + lift driven by the shared entrance controller.
class _Rise extends StatelessWidget {
  const _Rise({
    required this.animation,
    required this.child,
    this.offset = 0.35,
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

/// Platinum dots chasing each other on the folded black button.
class _SignInLoader extends StatelessWidget {
  const _SignInLoader({super.key});

  static const String asset = 'assets/images/loading.json';

  /// The folded button: just wide enough to frame the loader.
  static const double pillWidth = 132;

  /// Width over height of the animation's artboard.
  static const double _aspectRatio = 428 / 150;

  static const double _width = 88;

  @override
  Widget build(BuildContext context) {
    return Lottie.asset(
      asset,
      width: _width,
      height: _width / _aspectRatio,
      frameRate: FrameRate.max,
      fit: BoxFit.contain,
    );
  }
}

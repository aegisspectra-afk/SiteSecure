import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../../theme/app_colors.dart';
import '../../widgets/kyc/kyc_progress.dart';
import 'document_scan_step.dart';
import 'face_scan_step.dart';
import 'personal_info_step.dart';
import 'review_step.dart';

class KycDraft {
  const KycDraft({
    required this.name,
    required this.dateOfBirth,
    required this.documentType,
    required this.documentNumber,
  });

  final String name;
  final String dateOfBirth;
  final String documentType;
  final String documentNumber;
}

class KycFlowScreen extends StatefulWidget {
  const KycFlowScreen({super.key});

  static const List<String> stepLabels = [
    'Your details',
    'Document',
    'Face check',
    'Review',
  ];

  @override
  State<KycFlowScreen> createState() => _KycFlowScreenState();
}

class _KycFlowScreenState extends State<KycFlowScreen> {
  final PageController _pages = PageController();

  int _step = 0;
  bool _verified = false;
  KycDraft? _draft;

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  void _goTo(int step) {
    if (!mounted || step == _step) return;
    FocusScope.of(context).unfocus();
    HapticFeedback.lightImpact();
    setState(() => _step = step);
    _pages.animateToPage(
      step,
      duration: const Duration(milliseconds: 560),
      curve: Curves.easeInOutCubicEmphasized,
    );
  }

  void _close() {
    HapticFeedback.selectionClick();
    Navigator.of(context).pop(_verified);
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final sidePad = media.size.width * 0.055;
    // The pages can't be popped back into once the seal has landed.
    final canGoBack = _step > 0 && _step < 3;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
      ),
      child: Scaffold(
        backgroundColor: KycColors.surface,
        resizeToAvoidBottomInset: false,
        body: Column(
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(
                sidePad,
                media.padding.top + 8,
                sidePad,
                0,
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      _HeaderButton(
                        icon: canGoBack
                            ? Iconsax.arrow_left_2
                            : Iconsax.close_circle,
                        onTap: canGoBack ? () => _goTo(_step - 1) : _close,
                      ),
                    ],
                  ),
                  const SizedBox(height: 22),
                  KycProgress(
                    step: _step,
                    labels: KycFlowScreen.stepLabels,
                    complete: _verified,
                  ),
                ],
              ),
            ),
            Expanded(
              child: PageView(
                controller: _pages,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  for (var i = 0; i < 4; i++)
                    _PageShift(
                      controller: _pages,
                      index: i,
                      child: Padding(
                        padding: EdgeInsets.fromLTRB(
                          sidePad,
                          26,
                          sidePad,
                          media.padding.bottom + 18,
                        ),
                        child: _stepAt(i),
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

  Widget _stepAt(int index) {
    switch (index) {
      case 0:
        return PersonalInfoStep(
          active: _step == 0,
          onSubmit: (draft) {
            _draft = draft;
            _goTo(1);
          },
        );
      case 1:
        return DocumentScanStep(
          active: _step == 1,
          documentType: _draft?.documentType ?? 'Passport',
          onDone: () => _goTo(2),
        );
      case 2:
        return FaceScanStep(active: _step == 2, onDone: () => _goTo(3));
      default:
        return ReviewStep(
          active: _step == 3,
          name: _draft?.name ?? '',
          onVerified: () {
            if (mounted) setState(() => _verified = true);
          },
          onFinish: () => Navigator.of(context).pop(true),
        );
    }
  }
}

/// Holds each page back to a fraction of the [PageView]'s travel and fades it,
/// so pages cross over each other instead of sliding in lockstep.
class _PageShift extends StatelessWidget {
  const _PageShift({
    required this.controller,
    required this.index,
    required this.child,
  });

  final PageController controller;
  final int index;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;

    return AnimatedBuilder(
      animation: controller,
      builder: (context, child) {
        var delta = 0.0;
        if (controller.hasClients && controller.position.haveDimensions) {
          delta = (controller.page ?? index.toDouble()) - index;
        }
        final t = delta.clamp(-1.0, 1.0);

        return Opacity(
          opacity: (1 - t.abs() * 1.35).clamp(0.0, 1.0),
          child: Transform.translate(
            offset: Offset(t * width * 0.38, 0),
            child: Transform.scale(scale: 1 - t.abs() * 0.05, child: child),
          ),
        );
      },
      child: child,
    );
  }
}

class _HeaderButton extends StatelessWidget {
  const _HeaderButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: KycColors.elevated,
          shape: BoxShape.circle,
          border: Border.all(color: KycColors.hairline),
        ),
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 260),
          child: Icon(
            icon,
            key: ValueKey(icon.codePoint),
            size: 19,
            color: AppColors.white,
          ),
        ),
      ),
    );
  }
}
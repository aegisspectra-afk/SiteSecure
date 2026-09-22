import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../../widgets/kyc/id_document_scanner.dart';
import '../../widgets/kyc/kyc_button.dart';
import '../../widgets/kyc/kyc_layout.dart';
import '../../widgets/kyc/scan_readout.dart';

/// Step two: the beam runs down the document, back up it, and the frame turns.
class DocumentScanStep extends StatefulWidget {
  const DocumentScanStep({
    super.key,
    required this.active,
    required this.documentType,
    required this.onDone,
  });

  final bool active;
  final String documentType;
  final VoidCallback onDone;

  @override
  State<DocumentScanStep> createState() => _DocumentScanStepState();
}

class _DocumentScanStepState extends State<DocumentScanStep>
    with TickerProviderStateMixin {
  // Phase boundaries of the scan, as fractions of [_scan].
  static const double _downStart = 0.08;
  static const double _downEnd = 0.50;
  static const double _upEnd = 0.74;
  static const double _beamOut = 0.82;

  /// Height kept clear beneath the card for the percentage and status line.
  static const double _readoutHeight = 130;

  late final AnimationController _entrance = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
  );

  late final AnimationController _scan = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 3800),
  );

  /// Free-running; only drives the brackets' breathing.
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2400),
  )..repeat();

  bool _scanning = false;
  int _lastTick = 0;

  @override
  void initState() {
    super.initState();
    if (widget.active) _entrance.forward();
    _scan
      ..addListener(_onScanProgress)
      ..addStatusListener(_onScanStatus);
  }

  @override
  void didUpdateWidget(DocumentScanStep old) {
    super.didUpdateWidget(old);
    if (widget.active && !old.active) _entrance.forward();
  }

  @override
  void dispose() {
    _entrance.dispose();
    _scan.dispose();
    _pulse.dispose();
    super.dispose();
  }

  /// A tap of feedback every quarter read — the beam gains a physical weight.
  void _onScanProgress() {
    final tick = (_percent / 25).floor();
    if (tick == _lastTick) return;
    _lastTick = tick;
    if (tick > 0 && tick < 4) HapticFeedback.selectionClick();
  }

  Future<void> _onScanStatus(AnimationStatus status) async {
    if (status != AnimationStatus.completed) return;
    HapticFeedback.heavyImpact();
    await Future<void>.delayed(const Duration(milliseconds: 700));
    if (mounted) widget.onDone();
  }

  void _start() {
    HapticFeedback.mediumImpact();
    setState(() => _scanning = true);
    _scan.forward();
  }

  double get _percent =>
      ((_scan.value - _downStart) / (_beamOut - _downStart)).clamp(0.0, 1.0) *
      100;

  /// Beam position down the card, 0 at the top edge.
  double get _beam {
    final t = _scan.value;
    if (t <= _downEnd) {
      return Curves.easeInOut.transform(
        ((t - _downStart) / (_downEnd - _downStart)).clamp(0.0, 1.0),
      );
    }
    return 1 -
        Curves.easeInOut.transform(
          ((t - _downEnd) / (_upEnd - _downEnd)).clamp(0.0, 1.0),
        );
  }

  /// Monotonic: only the downward pass reads the card, so the lit copy never
  /// retreats when the beam runs back up.
  double get _reveal => _scanning
      ? Curves.easeInOut.transform(
          ((_scan.value - _downStart) / (_downEnd - _downStart)).clamp(
            0.0,
            1.0,
          ),
        )
      : 0;

  double get _beamOpacity {
    if (!_scanning) return 0;
    final t = _scan.value;
    if (t < _downStart) return (t / _downStart).clamp(0.0, 1.0);
    if (t < _upEnd) return 1;
    return 1 - ((t - _upEnd) / (_beamOut - _upEnd)).clamp(0.0, 1.0);
  }

  double get _verified =>
      ((_scan.value - _beamOut) / (1 - _beamOut)).clamp(0.0, 1.0);

  String get _status {
    if (!_scanning) return 'Place the document inside the frame';
    final t = _scan.value;
    if (t < 0.18) return 'Detecting document edges';
    if (t < _downEnd) return 'Reading printed data';
    if (t < _upEnd) return 'Checking security features';
    if (t < 1) return 'Validating authenticity';
    return 'Document verified';
  }

  @override
  Widget build(BuildContext context) {
    return KycStepLayout(
      entrance: _entrance,
      title: 'Scan your ${widget.documentType.toLowerCase()}',
      subtitle:
          'Lay it flat on a dark surface and keep it still while we read it.',
      body: LayoutBuilder(
        builder: (context, constraints) {
          // Size the card off whatever height is left after the readout, so a
          // short screen shrinks the document rather than clipping it.
          final widthForHeight =
              (constraints.maxHeight -
                      _readoutHeight -
                      IdDocumentScanner.inset * 2) *
                  IdDocumentScanner.aspect +
              IdDocumentScanner.inset * 2;
          final width = math.max(
            180.0,
            math.min(constraints.maxWidth, widthForHeight),
          );

          return FittedBox(
            fit: BoxFit.scaleDown,
            child: SizedBox(
              width: constraints.maxWidth,
              child: AnimatedBuilder(
                animation: Listenable.merge([_scan, _pulse]),
                builder: (context, _) => Column(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    IdDocumentScanner(
                      width: width,
                      beam: _beam,
                      beamOpacity: _beamOpacity,
                      reveal: _reveal,
                      verified: _verified,
                      bracket: 1,
                      pulse: _pulse.value,
                    ),
                    const SizedBox(height: 34),
                    ScanReadout(
                      percent: _percent,
                      status: _status,
                      scanning: _scanning,
                      verified: _verified,
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
      footer: AnimatedBuilder(
        animation: _scan,
        builder: (context, _) => AnimatedOpacity(
          opacity: _scanning ? 0 : 1,
          duration: const Duration(milliseconds: 300),
          child: IgnorePointer(
            ignoring: _scanning,
            child: KycButton(
              label: 'Start scan',
              icon: Iconsax.scan,
              onTap: _scanning ? null : _start,
            ),
          ),
        ),
      ),
    );
  }
}

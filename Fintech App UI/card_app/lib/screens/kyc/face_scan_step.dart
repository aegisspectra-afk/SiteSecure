import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../../widgets/kyc/face_scanner.dart';
import '../../widgets/kyc/kyc_button.dart';
import '../../widgets/kyc/kyc_layout.dart';
import '../../widgets/kyc/scan_readout.dart';

/// Step three: the ring fills while the beam sweeps the face three times.
class FaceScanStep extends StatefulWidget {
  const FaceScanStep({super.key, required this.active, required this.onDone});

  final bool active;
  final VoidCallback onDone;

  @override
  State<FaceScanStep> createState() => _FaceScanStepState();
}

class _FaceScanStepState extends State<FaceScanStep>
    with TickerProviderStateMixin {
  static const double _scanStart = 0.06;
  static const double _scanEnd = 0.84;
  static const double _beamOut = 0.90;

  /// Height kept clear beneath the circle for the percentage and status line.
  static const double _readoutHeight = 160;

  /// Passes the beam makes over the face before the ring closes.
  static const int _sweeps = 3;

  late final AnimationController _entrance = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
  );

  late final AnimationController _scan = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 4400),
  );

  /// Free-running; drives the arc chasing round the rim.
  late final AnimationController _spin = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2600),
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
  void didUpdateWidget(FaceScanStep old) {
    super.didUpdateWidget(old);
    if (widget.active && !old.active) _entrance.forward();
  }

  @override
  void dispose() {
    _entrance.dispose();
    _scan.dispose();
    _spin.dispose();
    super.dispose();
  }

  void _onScanProgress() {
    final tick = (_progress * 4).floor();
    if (tick == _lastTick) return;
    _lastTick = tick;
    if (tick > 0 && tick < 4) HapticFeedback.selectionClick();
  }

  Future<void> _onScanStatus(AnimationStatus status) async {
    if (status != AnimationStatus.completed) return;
    HapticFeedback.heavyImpact();
    await Future<void>.delayed(const Duration(milliseconds: 750));
    if (mounted) widget.onDone();
  }

  void _start() {
    HapticFeedback.mediumImpact();
    setState(() => _scanning = true);
    _scan.forward();
  }

  /// Share of the rim that has filled.
  double get _progress => !_scanning
      ? 0
      : Curves.easeInOutSine.transform(
          ((_scan.value - _scanStart) / (_scanEnd - _scanStart)).clamp(
            0.0,
            1.0,
          ),
        );

  /// Triangle wave: the beam runs down and back up, [_sweeps] times over.
  double get _beam {
    final raw = ((_scan.value - _scanStart) / (_scanEnd - _scanStart)).clamp(
      0.0,
      1.0,
    );
    final phase = raw * _sweeps * 2;
    final leg = phase % 2;
    return Curves.easeInOutSine.transform(leg <= 1 ? leg : 2 - leg);
  }

  double get _beamOpacity {
    if (!_scanning) return 0;
    final t = _scan.value;
    if (t < _scanStart) return (t / _scanStart).clamp(0.0, 1.0);
    if (t < _scanEnd) return 1;
    return 1 - ((t - _scanEnd) / (_beamOut - _scanEnd)).clamp(0.0, 1.0);
  }

  double get _settle =>
      ((_scan.value - _scanEnd) / (1 - _scanEnd)).clamp(0.0, 1.0);

  String get _status {
    if (!_scanning) return 'Centre your face in the circle';
    final p = _progress;
    if (_settle > 0.6) return 'Face verified';
    if (p < 0.22) return 'Hold still';
    if (p < 0.48) return 'Mapping facial geometry';
    if (p < 0.72) return 'Checking for liveness';
    return 'Matching against your document';
  }

  @override
  Widget build(BuildContext context) {
    return KycStepLayout(
      entrance: _entrance,
      title: 'Face verification',
      subtitle: 'A quick liveness check confirms the document belongs to you.',
      body: LayoutBuilder(
        builder: (context, constraints) {
          // Take the width the design asks for, unless the height left after
          // the readout is the tighter of the two.
          final diameter = math.max(
            140.0,
            math.min(
              constraints.maxWidth * 0.70,
              constraints.maxHeight - _readoutHeight,
            ),
          );

          return FittedBox(
            fit: BoxFit.scaleDown,
            child: SizedBox(
              width: constraints.maxWidth,
              child: AnimatedBuilder(
                animation: Listenable.merge([_scan, _spin]),
                builder: (context, _) => Column(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    FaceScanner(
                      diameter: diameter,
                      progress: _progress,
                      spin: _spin.value,
                      beam: _beam,
                      beamOpacity: _beamOpacity,
                      settle: _settle,
                    ),
                    const SizedBox(height: 30),
                    ScanReadout(
                      percent: _progress * 100,
                      status: _status,
                      scanning: _scanning,
                      verified: _settle,
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
              label: 'Begin face check',
              icon: Iconsax.scanning,
              onTap: _scanning ? null : _start,
            ),
          ),
        ),
      ),
    );
  }
}

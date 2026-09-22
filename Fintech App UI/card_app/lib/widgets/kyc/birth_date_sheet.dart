import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../theme/app_colors.dart';
import 'kyc_button.dart';

/// Opens the day / month / year picker and resolves to the chosen date, or
/// null if the sheet is dismissed.
Future<DateTime?> showBirthDateSheet(
  BuildContext context, {
  DateTime? initial,
}) {
  return showModalBottomSheet<DateTime>(
    context: context,
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withValues(alpha: 0.62),
    isScrollControlled: true,
    builder: (context) => _BirthDateSheet(initial: initial),
  );
}

class _BirthDateSheet extends StatefulWidget {
  const _BirthDateSheet({this.initial});

  final DateTime? initial;

  /// Nobody under this age can be verified, so the year wheel stops there.
  static const int minimumAge = 18;
  static const int maximumAge = 100;

  @override
  State<_BirthDateSheet> createState() => _BirthDateSheetState();
}

class _BirthDateSheetState extends State<_BirthDateSheet> {
  static const List<String> _months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  static const double _itemExtent = 46;

  late final int _latestYear = DateTime.now().year - _BirthDateSheet.minimumAge;
  late final int _earliestYear =
      DateTime.now().year - _BirthDateSheet.maximumAge;

  late int _day;
  late int _month;
  late int _year;

  late final FixedExtentScrollController _dayWheel;
  late final FixedExtentScrollController _monthWheel;
  late final FixedExtentScrollController _yearWheel;

  @override
  void initState() {
    super.initState();
    final start = widget.initial ?? DateTime(_latestYear - 12, 1, 1);
    _day = start.day;
    _month = start.month;
    _year = start.year.clamp(_earliestYear, _latestYear);

    _dayWheel = FixedExtentScrollController(initialItem: _day - 1);
    _monthWheel = FixedExtentScrollController(initialItem: _month - 1);
    _yearWheel = FixedExtentScrollController(initialItem: _latestYear - _year);
  }

  @override
  void dispose() {
    _dayWheel.dispose();
    _monthWheel.dispose();
    _yearWheel.dispose();
    super.dispose();
  }

  /// Day zero of the next month is the last day of this one.
  int get _daysInMonth => DateTime(_year, _month + 1, 0).day;

  /// Keeps the day wheel honest when the month it sits in gets shorter —
  /// picking 31 then switching to February should land on the 28th, not throw.
  void _clampDay() {
    final days = _daysInMonth;
    if (_day <= days) return;
    _day = days;
    _dayWheel.animateToItem(
      days - 1,
      duration: const Duration(milliseconds: 240),
      curve: Curves.easeOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: KycColors.elevated,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        border: Border(
          top: BorderSide(color: KycColors.hairline),
          left: BorderSide(color: KycColors.hairline),
          right: BorderSide(color: KycColors.hairline),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            Container(
              width: 38,
              height: 4,
              decoration: BoxDecoration(
                color: KycColors.hairline,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 18),
            const Text(
              'Date of birth',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w600,
                letterSpacing: -0.4,
                color: AppColors.white,
              ),
            ),
            const SizedBox(height: 18),
            SizedBox(
              height: _itemExtent * 5,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // The band that marks the selected row.
                  Container(
                    height: _itemExtent,
                    margin: const EdgeInsets.symmetric(horizontal: 20),
                    decoration: BoxDecoration(
                      color: KycColors.field,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: KycColors.hairline),
                    ),
                  ),
                  // Grouped rather than spread edge to edge, so the three
                  // columns read as one date.
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 52),
                    child: Row(
                      children: [
                        Expanded(
                          flex: 3,
                          child: _Wheel(
                            controller: _dayWheel,
                            count: _daysInMonth,
                            selected: _day - 1,
                            labelAt: (i) => '${i + 1}'.padLeft(2, '0'),
                            onChanged: (i) => setState(() => _day = i + 1),
                          ),
                        ),
                        Expanded(
                          flex: 4,
                          child: _Wheel(
                            controller: _monthWheel,
                            count: 12,
                            selected: _month - 1,
                            labelAt: (i) => _months[i],
                            onChanged: (i) => setState(() {
                              _month = i + 1;
                              _clampDay();
                            }),
                          ),
                        ),
                        Expanded(
                          flex: 4,
                          child: _Wheel(
                            controller: _yearWheel,
                            count: _latestYear - _earliestYear + 1,
                            selected: _latestYear - _year,
                            labelAt: (i) => '${_latestYear - i}',
                            onChanged: (i) => setState(() {
                              _year = _latestYear - i;
                              _clampDay();
                            }),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
              child: KycButton(
                label: 'Confirm',
                onTap: () {
                  HapticFeedback.mediumImpact();
                  Navigator.of(context).pop(DateTime(_year, _month, _day));
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Wheel extends StatelessWidget {
  const _Wheel({
    required this.controller,
    required this.count,
    required this.selected,
    required this.labelAt,
    required this.onChanged,
  });

  final FixedExtentScrollController controller;
  final int count;
  final int selected;
  final String Function(int index) labelAt;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return ListWheelScrollView.useDelegate(
      controller: controller,
      itemExtent: _BirthDateSheetState._itemExtent,
      physics: const FixedExtentScrollPhysics(),
      diameterRatio: 1.7,
      perspective: 0.003,
      overAndUnderCenterOpacity: 0.45,
      onSelectedItemChanged: (index) {
        HapticFeedback.selectionClick();
        onChanged(index);
      },
      childDelegate: ListWheelChildBuilderDelegate(
        childCount: count,
        builder: (context, index) => Center(
          child: Text(
            labelAt(index),
            style: TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.3,
              color: index == selected ? AppColors.white : KycColors.inkMuted,
            ),
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import '../../theme/app_colors.dart';
import '../../widgets/kyc/birth_date_sheet.dart';
import '../../widgets/kyc/kyc_button.dart';
import '../../widgets/kyc/kyc_field.dart';
import '../../widgets/kyc/kyc_layout.dart';
import 'kyc_flow_screen.dart';

/// Step one: the details we check the document against.
class PersonalInfoStep extends StatefulWidget {
  const PersonalInfoStep({
    super.key,
    required this.active,
    required this.onSubmit,
  });

  final bool active;
  final ValueChanged<KycDraft> onSubmit;

  @override
  State<PersonalInfoStep> createState() => _PersonalInfoStepState();
}

class _PersonalInfoStepState extends State<PersonalInfoStep>
    with SingleTickerProviderStateMixin {
  static const List<String> _documentTypes = ['Passport', 'National ID'];

  late final AnimationController _entrance = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
  );

  // Pre-filled from the account so the first field is a confirmation, not a
  // chore; everything else the user supplies.
  final TextEditingController _name = TextEditingController(
    text: 'DailyFlutterUI',
  );
  final TextEditingController _documentNumber = TextEditingController();

  DateTime? _birthDate;
  int _documentType = 0;

  @override
  void initState() {
    super.initState();
    if (widget.active) _entrance.forward();
    for (final controller in [_name, _documentNumber]) {
      controller.addListener(() => setState(() {}));
    }
  }

  @override
  void didUpdateWidget(PersonalInfoStep old) {
    super.didUpdateWidget(old);
    if (widget.active && !old.active) _entrance.forward();
  }

  @override
  void dispose() {
    _entrance.dispose();
    _name.dispose();
    _documentNumber.dispose();
    super.dispose();
  }

  bool get _complete =>
      _name.text.trim().length > 2 &&
      _birthDate != null &&
      _documentNumber.text.trim().length >= 6;

  String? get _birthDateLabel {
    final date = _birthDate;
    if (date == null) return null;
    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    return '$day / $month / ${date.year}';
  }

  Future<void> _pickBirthDate() async {
    final picked = await showBirthDateSheet(context, initial: _birthDate);
    if (picked == null || !mounted) return;
    setState(() => _birthDate = picked);
  }

  void _submit() {
    HapticFeedback.mediumImpact();
    widget.onSubmit(
      KycDraft(
        name: _name.text.trim(),
        dateOfBirth: _birthDateLabel ?? '',
        documentType: _documentTypes[_documentType],
        documentNumber: _documentNumber.text.trim().toUpperCase(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return KycStepLayout(
      entrance: _entrance,
      title: 'Your details',
      subtitle:
          'Enter them exactly as they appear on the document you are about to scan.',
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(
          parent: AlwaysScrollableScrollPhysics(),
        ),
        padding: EdgeInsets.only(
          top: 26,
          // Keep the action clear of the keyboard as fields take focus.
          bottom: MediaQuery.viewInsetsOf(context).bottom + 12,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            KycField(
              label: 'FULL LEGAL NAME',
              hint: 'As printed on your document',
              controller: _name,
              textCapitalization: TextCapitalization.words,
            ),
            const SizedBox(height: 18),
            KycPickerField(
              label: 'DATE OF BIRTH',
              hint: 'DD / MM / YYYY',
              value: _birthDateLabel,
              icon: Iconsax.calendar_1,
              onTap: _pickBirthDate,
            ),
            const SizedBox(height: 18),
            KycSegmented(
              label: 'DOCUMENT TYPE',
              options: _documentTypes,
              selected: _documentType,
              onChanged: (value) => setState(() => _documentType = value),
            ),
            const SizedBox(height: 18),
            KycField(
              label: 'DOCUMENT NUMBER',
              hint: _documentType == 0 ? 'A12345678' : '990101-14-5678',
              controller: _documentNumber,
              textCapitalization: TextCapitalization.characters,
            ),
            const SizedBox(height: 28),
            KycButton(
              label: 'Continue',
              icon: Iconsax.arrow_right_3_copy,
              onTap: _complete ? _submit : null,
            ),
            const SizedBox(height: 14),
            const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Iconsax.shield_tick, size: 13, color: KycColors.inkMuted),
                SizedBox(width: 6),
                Flexible(
                  child: Text(
                    'Your data is encrypted end to end',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: KycColors.inkMuted,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

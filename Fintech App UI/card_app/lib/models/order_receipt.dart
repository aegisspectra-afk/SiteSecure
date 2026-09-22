import 'card_tier.dart';

/// One priced line on a receipt. A zero [amount] prints as FREE.
class ReceiptLine {
  const ReceiptLine(this.label, this.amount, {this.note});

  final String label;
  final double amount;

  /// A smaller second line under the label, e.g. how the fee is billed.
  final String? note;
}

/// Everything the printed receipt for a card order shows.
class OrderReceipt {
  const OrderReceipt({
    required this.tier,
    required this.number,
    required this.issuedAt,
    required this.lines,
  });

  /// The receipt for ordering [tier], issued at [issuedAt] or now.
  factory OrderReceipt.forTier(CardTier tier, {DateTime? issuedAt}) {
    final at = issuedAt ?? DateTime.now();
    final serial = (at.millisecondsSinceEpoch ~/ 1000 % 10000)
        .toString()
        .padLeft(4, '0');

    return OrderReceipt(
      tier: tier,
      number:
          'SL-${_two(at.year % 100)}${_two(at.month)}${_two(at.day)}-$serial',
      issuedAt: at,
      lines: [
        ReceiptLine(
          '${tier.name} metal card',
          tier.yearlyPrice.toDouble(),
          note: 'Annual fee · billed yearly',
        ),
        const ReceiptLine('Card issuance', 0),
        const ReceiptLine('Delivery · 5–7 days', 0),
      ],
    );
  }

  final CardTier tier;
  final String number;
  final DateTime issuedAt;
  final List<ReceiptLine> lines;

  double get total => lines.fold(0, (sum, line) => sum + line.amount);

  /// e.g. `19 SEP 2026`.
  String get date =>
      '${_two(issuedAt.day)} ${_months[issuedAt.month - 1]} ${issuedAt.year}';

  /// 24-hour, e.g. `16:07`.
  String get time => '${_two(issuedAt.hour)}:${_two(issuedAt.minute)}';

  static const List<String> _months = [
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', //
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
  ];
}

String _two(int value) => value.toString().padLeft(2, '0');

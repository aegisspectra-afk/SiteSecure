import 'package:flutter/widgets.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

/// A row in the "Recent transactions" list.
class TransactionItem {
  const TransactionItem({
    required this.title,
    required this.time,
    required this.amount,
    required this.icon,
    this.incoming = false,
    this.iconTurns = 0,
  });

  final String title;
  final String time;
  final double amount;
  final IconData icon;
  final bool incoming;

  /// Rotation applied to [icon], in turns (0.125 == 45 degrees).
  final double iconTurns;

  static const List<TransactionItem> recent = [
    TransactionItem(
      title: 'Transfer',
      time: '4:07pm',
      amount: 1050,
      icon: Iconsax.arrow_up_3_copy,
      iconTurns: 0.125,
    ),
    TransactionItem(
      title: 'Top up',
      time: '12:07pm',
      amount: 2400,
      icon: Iconsax.add_copy,
      incoming: true,
    ),
    TransactionItem(
      title: 'Conversion',
      time: '4:07pm',
      amount: 950,
      icon: Iconsax.arrow_swap_horizontal_copy,
    ),
    TransactionItem(
      title: 'Transfer',
      time: '4:07pm',
      amount: 1050,
      icon: Iconsax.arrow_up_3_copy,
      iconTurns: 0.125,
    ),
    TransactionItem(
      title: 'Top up',
      time: '9:12am',
      amount: 1200,
      icon: Iconsax.add_copy,
      incoming: true,
    ),
    TransactionItem(
      title: 'Conversion',
      time: '11:30am',
      amount: 430,
      icon: Iconsax.arrow_swap_horizontal_copy,
    ),
  ];
}

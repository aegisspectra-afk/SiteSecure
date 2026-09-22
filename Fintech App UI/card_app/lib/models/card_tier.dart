import 'package:flutter/material.dart';

/// A metallic card product shown on the home screen and in the picker.
class CardTier {
  const CardTier({
    required this.name,
    required this.yearlyPrice,
    required this.holder,
    required this.face,
  });

  final String name;
  final int yearlyPrice;
  final String holder;

  /// Layered metal tones, sampled top-left to bottom-right.
  final List<Color> face;

  String get heroTag => 'card-$name';

  static const List<CardTier> all = [
    CardTier(
      name: 'Platinum',
      yearlyPrice: 199,
      holder: 'DailyFlutterUI',
      face: [
        Color(0xFFBBB7B0),
        Color(0xFFB1ADA6),
        Color(0xFFAAA69F),
        Color(0xFFAEAAA3),
        Color(0xFFA5A19A),
      ],
    ),
    CardTier(
      name: 'Silver',
      yearlyPrice: 99,
      holder: 'DailyFlutterUI',
      face: [
        Color(0xFFC1C5C6),
        Color(0xFFB5B9BA),
        Color(0xFFADB1B2),
        Color(0xFFB1B5B6),
        Color(0xFFA6AAAB),
      ],
    ),
    CardTier(
      name: 'Gold',
      yearlyPrice: 349,
      holder: 'DailyFlutterUI',
      face: [
        Color(0xFFD9C69C),
        Color(0xFFCDB88C),
        Color(0xFFC5AF80),
        Color(0xFFC9B486),
        Color(0xFFBCA575),
      ],
    ),
  ];
}

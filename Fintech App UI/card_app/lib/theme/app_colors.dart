import 'package:flutter/material.dart';

/// Palette sampled from the reference design.
class AppColors {
  const AppColors._();

  // Dark surfaces
  static const Color black = Color(0xFF000000);
  static const Color darkSurface = Color(0xFF0A0A0A);
  static const Color darkCircle = Color(0xFF1C1C1E);

  // Light surfaces
  static const Color white = Color(0xFFFFFFFF);
  static const Color scaffoldLight = Color(0xFFF6F5F3);
  static const Color sheet = Color(0xFFFFFFFF);

  // Text
  static const Color textPrimary = Color(0xFF0B0B0B);
  static const Color textSecondary = Color(0xFF8A8A8E);
  static const Color textTertiary = Color(0xFFC2C1BE);
  static const Color textOnDarkMuted = Color(0xFF9B9BA1);

  // Lines
  static const Color hairline = Color(0xFFEDEDED);
  static const Color cardOutline = Color(0xFFE7E7E5);

  // Accents
  static const Color positive = Color(0xFF12B76A);
  static const Color negative = Color(0xFFE5484D);

  /// Ink used on top of the metallic card faces.
  static const Color cardInk = Color(0xFF1F1D1A);

  /// The verified seal's blue — deliberately the only colour outside the
  /// black-and-titanium set, so the badge is the thing the eye lands on.
  static const Color verified = Color(0xFF4A9EDA);
}

/// Surfaces and accents for the identity verification flow, which runs on
/// black with brushed titanium as its only accent.
class KycColors {
  const KycColors._();

  /// Brushed titanium. Light enough to read as a scan line against black,
  /// neutral enough that the flow never picks up a colour cast.
  static const Color accent = Color(0xFFD2CEC7);
  static const Color accentDim = Color(0xFF6B6862);

  /// The not-yet-verified state — a step down from titanium, never amber.
  static const Color pending = Color(0xFF78766F);

  static const Color surface = Color(0xFF080808);
  static const Color elevated = Color(0xFF151514);
  static const Color field = Color(0xFF191918);
  static const Color hairline = Color(0xFF2A2A28);
  static const Color inkMuted = Color(0xFF8C8A85);
}

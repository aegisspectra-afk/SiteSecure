/// Formats [value] with thousand separators, e.g. `22000` -> `22,000`.
String formatMoney(double value, {bool decimals = true}) {
  final text = value.abs().toStringAsFixed(decimals ? 2 : 0);
  final parts = text.split('.');
  final whole = parts.first;
  final buffer = StringBuffer();

  for (var i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 == 0) buffer.write(',');
    buffer.write(whole[i]);
  }

  return parts.length > 1
      ? '${buffer.toString()}.${parts[1]}'
      : buffer.toString();
}

import 'package:flutter/material.dart';

import 'screens/profile_view.dart';
import 'screens/splash_screen.dart';
import 'theme/app_theme.dart';
import 'widgets/visa_logo.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Future.wait([VisaLogo.precache(), ProfileAvatar.precache()]);
  runApp(const CardApp());
}

class CardApp extends StatelessWidget {
  const CardApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Slate',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      home: const SplashScreen(),
    );
  }
}

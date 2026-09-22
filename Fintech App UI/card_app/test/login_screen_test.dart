import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import 'package:card_app/screens/home_screen.dart';
import 'package:card_app/screens/login_screen.dart';
import 'package:card_app/widgets/social_sign_in_button.dart';

void main() {
  Future<void> pumpLogin(WidgetTester tester) async {
    tester.view
      ..physicalSize = const Size(1290, 2796)
      ..devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(const MaterialApp(home: LoginScreen()));
    // The header keeps swelling forever, so step past the entrance instead of
    // waiting for it to settle.
    await tester.pump(LoginScreen.entrance + const Duration(milliseconds: 100));
  }

  Finder field(int index) => find.byType(TextField).at(index);

  testWidgets('shows the form, providers and sign-up link', (tester) async {
    await pumpLogin(tester);

    expect(find.text('Login'), findsNWidgets(2));
    expect(find.text('Email'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);
    expect(find.text('Forgot password?'), findsOneWidget);
    expect(find.text('Sign up'), findsOneWidget);
    expect(find.byType(SocialSignInButton), findsNWidgets(3));
    expect(tester.takeException(), isNull);
  });

  testWidgets('rejects empty input and stays put', (tester) async {
    await pumpLogin(tester);

    await tester.tap(find.text('Login').last);
    await tester.pump(const Duration(milliseconds: 600));

    expect(find.text('Enter a valid email address'), findsOneWidget);
    expect(find.text('Enter your password'), findsOneWidget);
    expect(find.byType(HomeScreen), findsNothing);

    // Typing clears the complaint for that field only.
    await tester.enterText(field(0), 'me@slate.app');
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Enter a valid email address'), findsNothing);
    expect(find.text('Enter your password'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('eye toggles password visibility', (tester) async {
    await pumpLogin(tester);

    bool obscured() => tester.widget<TextField>(field(1)).obscureText;

    expect(obscured(), isTrue);
    await tester.tap(find.byIcon(Iconsax.eye_slash_copy));
    await tester.pump(const Duration(milliseconds: 300));
    expect(obscured(), isFalse);
    expect(tester.takeException(), isNull);
  });

  testWidgets('valid credentials fold the button, cover the page, go home', (
    tester,
  ) async {
    await pumpLogin(tester);

    await tester.enterText(field(0), 'me@slate.app');
    await tester.enterText(field(1), 'secret');
    await tester.tap(find.text('Login').last);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump();

    // Mid-flight the label has handed over to the loader.
    expect(find.text('Login'), findsOneWidget);

    // Loading done: the header is on its way down, and home waits for it.
    await tester.pump(const Duration(milliseconds: 1000));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.byType(LoginScreen), findsOneWidget);
    expect(find.byType(HomeScreen), findsNothing);

    for (var i = 0; i < 30; i++) {
      await tester.pump(const Duration(milliseconds: 150));
    }

    expect(find.byType(HomeScreen), findsOneWidget);
    expect(find.byType(LoginScreen), findsNothing);
    expect(tester.takeException(), isNull);
  });
}

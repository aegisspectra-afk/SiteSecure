import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import 'package:card_app/screens/kyc/kyc_flow_screen.dart';
import 'package:card_app/screens/home_screen.dart';
import 'package:card_app/widgets/app_bottom_nav.dart';
import 'package:card_app/widgets/kyc/face_scanner.dart';
import 'package:card_app/widgets/kyc/id_document_scanner.dart';
import 'package:card_app/widgets/kyc/verification_seal.dart';

void main() {
  /// Several controllers in the flow repeat forever, so nothing here can use
  /// `pumpAndSettle` — every wait is an explicit run of frames.
  ///
  /// The frames have to be real ones: a single long pump renders once, which
  /// leaves any animation started part-way through the elapsed time sitting at
  /// zero rather than carrying the flow to the next step.
  Future<void> step(WidgetTester tester, int milliseconds) async {
    const frame = Duration(milliseconds: 32);
    for (
      var elapsed = 0;
      elapsed < milliseconds;
      elapsed += frame.inMilliseconds
    ) {
      await tester.pump(frame);
    }
  }

  /// A tap needs a frame of its own before time is advanced: pushing a route
  /// parks it offstage until the navigator's post-frame callback runs.
  Future<void> tap(WidgetTester tester, Finder finder) async {
    await tester.tap(finder);
    await tester.pump();
  }

  /// Enters through the shell and switches to the Profile tab, which is how
  /// the page is actually reached.
  Future<void> pumpProfile(WidgetTester tester) async {
    tester.view
      ..physicalSize = const Size(1290, 2796)
      ..devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(const MaterialApp(home: HomeScreen()));
    await step(tester, 1400);
    await tap(tester, find.byIcon(Iconsax.user_copy));
    await step(tester, 900);
  }

  testWidgets('profile starts unverified and offers verification', (
    tester,
  ) async {
    await pumpProfile(tester);

    expect(find.text('Identity not verified'), findsOneWidget);
    expect(find.text('Verify your identity'), findsOneWidget);
    expect(find.text('Personal details'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('the whole flow runs and the profile comes back verified', (
    tester,
  ) async {
    await pumpProfile(tester);

    await tap(tester, find.text('Verify your identity'));
    await step(tester, 800);
    expect(find.byType(KycFlowScreen), findsOneWidget);

    // Step one: the action stays inert until every field is filled.
    expect(find.text('Your details'), findsWidgets);
    await tap(tester, find.text('DD / MM / YYYY'));
    await step(tester, 600);
    expect(find.text('Date of birth'), findsOneWidget);
    await tap(tester, find.text('Confirm'));
    await step(tester, 600);
    expect(find.textContaining(' / 01 / '), findsOneWidget);

    await tester.enterText(find.byType(TextField).at(1), 'A12345678');
    await step(tester, 100);

    // On short screens the action sits below the fold of the form.
    await tester.ensureVisible(find.text('Continue'));
    await tester.pump();
    await tap(tester, find.text('Continue'));
    await step(tester, 800);

    // Step two: the document scan drives itself to done.
    expect(find.byType(IdDocumentScanner), findsOneWidget);
    await tap(tester, find.text('Start scan'));
    await step(tester, 3800);
    expect(find.text('Document verified'), findsOneWidget);
    await step(tester, 1500);

    // Step three: the face check.
    expect(find.byType(FaceScanner), findsOneWidget);
    await tap(tester, find.text('Begin face check'));
    await step(tester, 4400);
    expect(find.text('Face verified'), findsOneWidget);
    await step(tester, 1500);

    // Step four: checks run, then the seal turns into a tick.
    expect(find.byType(VerificationSeal), findsOneWidget);
    await step(tester, 500);
    await step(tester, 4200);
    expect(find.text('Watchlist screening'), findsOneWidget);
    await step(tester, 1900);
    expect(find.text('Identity verified'), findsOneWidget);

    await tap(tester, find.text('Back to profile'));
    await step(tester, 900);
    await step(tester, 1800);

    expect(find.byType(KycFlowScreen), findsNothing);
    expect(find.text('Identity verified'), findsWidgets);
    expect(find.text('Identity not verified'), findsNothing);
    expect(find.text('Tier 3 · Full access unlocked'), findsOneWidget);

    // The bar never left, and the badge survives a trip to another tab.
    expect(find.byType(AppBottomNav), findsOneWidget);
    await tap(tester, find.byIcon(Iconsax.home_2_copy));
    await step(tester, 900);
    expect(find.byType(AppBottomNav), findsOneWidget);
    await tap(tester, find.byIcon(Iconsax.user_copy));
    await step(tester, 900);
    expect(find.text('Identity verified'), findsWidgets);
    expect(tester.takeException(), isNull);
  });
}

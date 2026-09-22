import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';

import 'package:card_app/main.dart';
import 'package:card_app/models/card_tier.dart';
import 'package:card_app/screens/splash_screen.dart';
import 'package:card_app/widgets/app_bottom_nav.dart';
import 'package:card_app/widgets/metallic_card.dart';

/// Rows schedule themselves with `Future.delayed`, so advance a fixed number
/// of frames rather than relying on `pumpAndSettle`.
Future<void> settle(WidgetTester tester) async {
  for (var i = 0; i < 12; i++) {
    await tester.pump(const Duration(milliseconds: 150));
  }
}

void main() {
  setUp(() {
    // Reference device: a 6.9" phone.
    TestWidgetsFlutterBinding.ensureInitialized();
  });

  /// Boots the app and runs the splash through to the home screen.
  Future<void> pumpApp(WidgetTester tester) async {
    tester.view
      ..physicalSize = const Size(1290, 2796)
      ..devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(const CardApp());

    for (var i = 0; i < 60; i++) {
      if (find.text('Hello DailyFlutterUI').evaluate().isNotEmpty) break;
      await tester.pump(const Duration(milliseconds: 150));
    }
    await settle(tester);
  }

  testWidgets('splash names the app, then flies the card into home', (
    tester,
  ) async {
    tester.view
      ..physicalSize = const Size(1290, 2796)
      ..devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(const CardApp());
    await tester.pump();

    expect(find.byType(SplashScreen), findsOneWidget);
    expect(find.text('Hello DailyFlutterUI'), findsNothing);

    double brandOpacity() => tester
        .widget<Opacity>(
          find
              .ancestor(
                of: find.text(SplashScreen.appName),
                matching: find.byType(Opacity),
              )
              .first,
        )
        .opacity;

    // The card's printing and the wordmark are both held back at the start.
    expect(
      tester.widget<MetallicCard>(find.byType(MetallicCard)).contentOpacity,
      lessThan(0.01),
    );
    expect(brandOpacity(), lessThan(0.01));
    expect(find.text(SplashScreen.tagline), findsOneWidget);

    // Mid-sequence the wordmark is fully up and the card is printed.
    await tester.pump(SplashScreen.duration * 0.85);
    expect(brandOpacity(), greaterThan(0.9));
    expect(
      tester.widget<MetallicCard>(find.byType(MetallicCard)).contentOpacity,
      greaterThan(0.9),
    );

    // Run on to just before the handoff; the brand bows out first.
    await tester.pump(SplashScreen.duration * 0.13);
    expect(brandOpacity(), lessThan(0.9));
    final onSplash = tester.getRect(find.byType(MetallicCard));

    // Cross into the handoff and sample the card mid-flight.
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(SplashScreen.handoff ~/ 3);
    final inFlight = tester.getRect(find.byType(MetallicCard));

    await tester.pump(SplashScreen.handoff);
    await settle(tester);
    final onHome = tester.getRect(find.byType(MetallicCard));

    // The card travels between the two layouts instead of cutting or fading:
    // mid-flight it is somewhere strictly between them.
    expect(onHome.width, isNot(closeTo(onSplash.width, 1)));
    expect(
      inFlight.width,
      inInclusiveRange(
        math.min(onSplash.width, onHome.width) + 1,
        math.max(onSplash.width, onHome.width) - 1,
      ),
      reason: 'the card should be in flight, not snapped to either layout',
    );
    expect(
      onHome.top,
      lessThan(onSplash.top),
      reason: 'home seats the card above the splash centre',
    );
    expect(
      inFlight.top,
      inInclusiveRange(onHome.top + 1, onSplash.top - 1),
      reason: 'the card should be travelling upward into place',
    );

    expect(find.text('Hello DailyFlutterUI'), findsOneWidget);
    expect(
      find.byType(SplashScreen),
      findsNothing,
      reason: 'the splash must be replaced, not stacked under home',
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('home shows greeting, counted balance and transactions', (
    tester,
  ) async {
    await pumpApp(tester);

    expect(find.text('Hello DailyFlutterUI'), findsOneWidget);
    expect(find.text('Available balance'), findsOneWidget);
    expect(find.text('\$22,000'), findsOneWidget);
    expect(find.text('Recent transactions'), findsOneWidget);
    expect(find.text('+\$2,400.00'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('bottom nav moves the puck between destinations', (tester) async {
    await pumpApp(tester);

    final nav = find.byType(AppBottomNav);
    expect(nav, findsOneWidget);
    expect(tester.widget<AppBottomNav>(nav).currentIndex, 0);

    await tester.tap(
      find.descendant(of: nav, matching: find.byType(Icon)).at(2),
    );
    await settle(tester);

    expect(tester.widget<AppBottomNav>(nav).currentIndex, 2);
    expect(tester.takeException(), isNull);
  });

  testWidgets('nav puck stays concentric with the active icon', (tester) async {
    await pumpApp(tester);

    final nav = find.byType(AppBottomNav);
    final puck = find.descendant(
      of: nav,
      matching: find.byType(AnimatedPositioned),
    );
    final icons = find.descendant(of: nav, matching: find.byType(Icon));

    for (final index in [0, 2, 1, 3]) {
      if (index != tester.widget<AppBottomNav>(nav).currentIndex) {
        await tester.tap(icons.at(index));
        await settle(tester);
      }

      final puckCentre = tester.getCenter(puck);
      final iconCentre = tester.getCenter(icons.at(index));
      expect(
        puckCentre.dx,
        closeTo(iconCentre.dx, 0.5),
        reason: 'puck not horizontally centred on destination $index',
      );
      expect(
        puckCentre.dy,
        closeTo(iconCentre.dy, 0.5),
        reason: 'puck not vertically centred on destination $index',
      );
    }

    expect(tester.takeException(), isNull);
  });

  testWidgets('nav puck is inset equally on every side of the pill', (
    tester,
  ) async {
    await pumpApp(tester);

    final nav = find.byType(AppBottomNav);
    final puck = find.descendant(
      of: nav,
      matching: find.byType(AnimatedPositioned),
    );
    final icons = find.descendant(of: nav, matching: find.byType(Icon));

    for (final index in [0, 3]) {
      if (index != tester.widget<AppBottomNav>(nav).currentIndex) {
        await tester.tap(icons.at(index));
        await settle(tester);
      }

      final pill = tester.getRect(nav);
      final circle = tester.getRect(puck);

      final top = circle.top - pill.top;
      final bottom = pill.bottom - circle.bottom;
      expect(
        top,
        closeTo(bottom, 0.01),
        reason: 'destination $index: uneven vertical inset',
      );

      // At the ends the puck sits in a rounded cap, so its gap to that edge
      // has to match the vertical inset or it reads as off-centre.
      final edge = index == 0
          ? circle.left - pill.left
          : pill.right - circle.right;
      expect(
        edge,
        closeTo(top, 0.01),
        reason: 'destination $index: side inset does not match top/bottom',
      );
    }

    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'tapping the card opens the picker and the carousel switches tier',
    (tester) async {
      await pumpApp(tester);

      await tester.tap(find.byType(MetallicCard).first);
      await settle(tester);

      expect(find.text('Choose Platinum'), findsOneWidget);
      expect(find.textContaining('\$199', findRichText: true), findsOneWidget);
      expect(tester.takeException(), isNull);

      // Swipe to the next card in the carousel.
      await tester.drag(find.byType(PageView), const Offset(-400, 0));
      await settle(tester);

      expect(find.text('Choose Silver'), findsOneWidget);
      expect(find.textContaining('\$99', findRichText: true), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('picker cards are shadowless, and one card turns at a time', (
    tester,
  ) async {
    await pumpApp(tester);
    await tester.tap(find.byType(MetallicCard).first);
    await settle(tester);

    final cards = tester.widgetList<MetallicCard>(find.byType(MetallicCard));
    expect(cards, isNotEmpty);
    expect(
      cards.every((card) => !card.shadow),
      isTrue,
      reason: 'picker cards must not cast a shadow',
    );

    double widthOf(int i) {
      final card = find.byType(MetallicCard).at(i);
      return tester.getTopRight(card).dx - tester.getTopLeft(card).dx;
    }

    double skewOf(int i) {
      final card = find.byType(MetallicCard).at(i);
      final left = tester.getBottomLeft(card).dy - tester.getTopLeft(card).dy;
      final right =
          tester.getBottomRight(card).dy - tester.getTopRight(card).dy;
      return (left - right).abs();
    }

    final flatWidth = widthOf(0);
    expect(
      skewOf(0),
      lessThan(0.5),
      reason: 'the centred card should sit flat to the viewer',
    );

    final gesture = await tester.startGesture(
      tester.getCenter(find.byType(PageView)),
    );
    await gesture.moveBy(const Offset(-60, 0));
    await tester.pump();

    // A card turning in perspective foreshortens; one held flat does not.
    expect(
      widthOf(1),
      lessThan(flatWidth * 0.6),
      reason: 'the incoming card should turn as it arrives',
    );
    expect(
      widthOf(0),
      greaterThan(flatWidth * 0.85),
      reason:
          'the outgoing card must stay solid, or the carousel blinks '
          'empty mid-swipe',
    );

    await gesture.up();
    await settle(tester);
    expect(tester.takeException(), isNull);
  });

  testWidgets('the centred card sits symmetrically on every page', (
    tester,
  ) async {
    await pumpApp(tester);
    await tester.tap(find.byType(MetallicCard).first);
    await settle(tester);

    final screen = tester.getSize(find.byType(PageView)).width;

    ({double left, double right}) edgesOf(Finder card) =>
        (left: tester.getTopLeft(card).dx, right: tester.getTopRight(card).dx);

    Finder centredCard() {
      final cards = find.byType(MetallicCard);
      final count = tester.widgetList(cards).length;
      var best = 0;
      var bestDistance = double.infinity;
      for (var i = 0; i < count; i++) {
        final edges = edgesOf(cards.at(i));
        final distance = ((edges.left + edges.right) / 2 - screen / 2).abs();
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i;
        }
      }
      return cards.at(best);
    }

    for (var page = 0; page < CardTier.all.length; page++) {
      if (page > 0) {
        await tester.drag(find.byType(PageView), const Offset(-400, 0));
        await settle(tester);
      }

      final edges = edgesOf(centredCard());
      expect(
        edges.left,
        closeTo(screen - edges.right, 0.5),
        reason: 'page $page: card not centred between the screen edges',
      );
    }

    // On Silver both neighbours are on screen: each must show the same sliver.
    await tester.drag(find.byType(PageView), const Offset(400, 0));
    await settle(tester);

    final cards = find.byType(MetallicCard);
    expect(tester.widgetList(cards), hasLength(3));
    final leftSliver = edgesOf(cards.at(0)).right;
    final rightSliver = screen - edgesOf(cards.at(2)).left;
    expect(
      leftSliver,
      closeTo(rightSliver, 0.5),
      reason: 'neighbouring cards must peek by the same amount',
    );
    expect(leftSliver, greaterThan(0));

    expect(tester.takeException(), isNull);
  });

  testWidgets('the button label hands over instead of cross-fading', (
    tester,
  ) async {
    await pumpApp(tester);
    await tester.tap(find.byType(MetallicCard).first);
    await settle(tester);

    expect(find.text('Choose Platinum'), findsOneWidget);

    // Opacity of every 'Choose …' label currently in the tree. Mid-swap both
    // are mounted; only one should be readable at a time.
    List<double> labelOpacities() {
      final labels = find.textContaining('Choose');
      return [
        for (var i = 0; i < tester.widgetList(labels).length; i++)
          tester
              .widget<FadeTransition>(
                find
                    .ancestor(
                      of: labels.at(i),
                      matching: find.byType(FadeTransition),
                    )
                    .first,
              )
              .opacity
              .value,
      ];
    }

    await tester.drag(find.byType(PageView), const Offset(-400, 0));
    await tester.pump();

    var overlapped = false;
    var sawSwap = false;
    for (var i = 0; i < 30; i++) {
      await tester.pump(const Duration(milliseconds: 25));
      final readable = labelOpacities().where((o) => o > 0.15).length;
      if (labelOpacities().length > 1) sawSwap = true;
      if (readable > 1) overlapped = true;
    }

    expect(sawSwap, isTrue, reason: 'the label never actually changed');
    expect(
      overlapped,
      isFalse,
      reason:
          'both labels were readable at once — the swap cross-fades '
          'instead of handing over',
    );
    expect(find.text('Choose Silver'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('back returns to home', (tester) async {
    await pumpApp(tester);

    await tester.tap(find.byType(MetallicCard).first);
    await settle(tester);
    expect(find.text('Choose Platinum'), findsOneWidget);

    await tester.tap(find.byIcon(Iconsax.arrow_left_2_copy));
    await settle(tester);

    expect(find.text('Hello DailyFlutterUI'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

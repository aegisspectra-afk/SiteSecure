# SETTINGS-3C — PROFILE-LED PREMIUM SETTINGS REDESIGN

## DESIGN GOVERNANCE

Before implementation, read and follow:

- `Docs/design/SITE-SECURE-UI-DESIGN-RULES.md`
- `Docs/design/SITE-SECURE-UI-REVIEW-CHECKLIST.md`

These documents are the SITE SECURE design source of truth.

If any external reference or prior task conflicts with them:
**SITE SECURE rules win.**

Dark mode remains first-class and must not be weakened.

Settings density for this task: **Comfortable** (calm premium forms — not consumer-sparse, not dense-admin tables on the hub).

---

STATUS:
SETTINGS-3A AUDIT = COMPLETE
SETTINGS-3B INTEGRITY = COMPLETE

MODE:
UI / UX IMPLEMENTATION

GOAL

Redesign the Settings experience to follow the visual grammar of the supplied mobile Profile / Edit Profile reference,
while keeping SITE SECURE architecture, permissions, routes, dark mode, RTL, and Bottom Nav intact.

This is a visual / information-architecture redesign.
Do NOT create speculative settings.
Do NOT change core backend architecture.

==================================================
NON-NEGOTIABLES
==================================================

1. SITE SECURE remains dark-first / dark-premium with full light-mode support.
2. Do NOT switch to light-first.
3. Existing Bottom Nav is frozen and must remain unchanged.
4. Existing Settings routes remain where practical.
5. Existing RBAC remains source of truth.
6. Do not add unsupported settings.
7. Do not reintroduce inactive / fake settings removed in SETTINGS-3B.
8. RTL is first-class.
9. Follow SITE SECURE UI Design Rules + Review Checklist (see DESIGN GOVERNANCE).

==================================================
1. NEW SETTINGS MENTAL MODEL
==================================================

Turn `/app/settings` into a profile-led Settings Hub.

Mobile reference behavior:

Top:
- page title: הגדרות
- large circular avatar
- full name
- email
- role
- workspace name
- primary CTA: עריכת פרופיל

Below:
grouped list rows with:
- icon
- label
- chevron
- thin separators
- generous but controlled spacing

No giant cards.
No dashboard-style metrics.
No dense admin table look.

==================================================
2. FINAL SETTINGS IA
==================================================

Use this structure:

פרופיל וחשבון
- פרופיל אישי
- מראה
- אבטחה

סביבת עבודה
- כללי
- פרטי חברה ומיתוג

מסחרי
- הצעות מחיר
- מספור
- תבניות מסמכים

תפעול
- אתרים
- התראות

צוות וגישה
- צוות
- תפקידים והרשאות
- יומן ביקורת

מתקדם
- הגדרות מערכת

Only show rows allowed by real permissions.

Do not show inaccessible rows disabled.
Hide them.

==================================================
3. NEW PROFILE PAGE
==================================================

Add:

/app/settings/profile

Use existing capabilities only:

- profiles.full_name
- profiles.phone
- profiles.locale if useful
- auth email read-only
- existing avatar metadata
- PATCH /me

Do NOT add:
- birthday
- gender
- username
- new avatar upload backend
- personal timezone if model does not support it

==================================================
4. PROFILE PAGE VISUAL
==================================================

Match the reference grammar:

Header:
←
עריכת פרופיל

Center:
large circular avatar
small edit affordance

Below:
name
email

Then fields:

שם מלא
טלפון
אימייל (read-only)
תפקיד (read-only)
סביבת עבודה (read-only)

Use real product fields only.

Bottom:
full-width primary save button

Save states:
- unchanged
- dirty
- saving
- success
- failure

==================================================
5. AVATAR
==================================================

Move avatar out of General into Profile.

Keep current avatar implementation.

Present as:
תמונת פרופיל

Do not use gender-first copy.

Use neutral labels / visual selection.

Keep current persistence:
Supabase user metadata + local cache.

Do not implement photo upload in this checkpoint.

==================================================
6. APPEARANCE
==================================================

Keep existing Appearance route and behavior.

Appearance is personal/device-level.

Place under:
פרופיל וחשבון

Do not change theme persistence.

Do not touch dark-mode architecture.

==================================================
7. SECURITY
==================================================

Keep current Security page honest.

Place under:
פרופיל וחשבון

Show only real capabilities:
- current security signals
- password recovery/reset link
- real audit/security information

Do not add MFA/session management UI unless backend exists.

==================================================
8. GENERAL PAGE
==================================================

After avatar move, General becomes workspace-only.

Sections:

סביבת עבודה
- workspace name
- timezone

פיננסים
- VAT
- currency

No personal avatar.

Keep currency read-only ILS.

==================================================
9. COMPANY / BRANDING
==================================================

Keep functionality.

Restyle into reference-inspired form language:

- clean sections
- compact fields
- restrained borders
- controlled content width
- clear save CTA
- no giant cards

==================================================
10. COMMERCIAL SETTINGS
==================================================

Keep SETTINGS-3B behavior intact.

Quotes:
- validity default
- payment terms
- show VAT
- notes

Numbering:
- quote prefix active
- unused prefixes remain non-active / informational only

PDF templates:
keep template studio functionality.

Do not simplify away real power.

==================================================
11. OPERATIONS
==================================================

Sites:
keep active enforced requirements only.

Notifications:
keep current honesty state.
Do not reintroduce inactive toggles.

==================================================
12. TEAM & ACCESS
==================================================

Team:
keep members / invites / roles / revoke / reissue behavior.

Roles:
keep current permission matrix functionality.

Audit:
keep existing audit page.

Restyle shells/navigation only where needed.

Do not turn these into mobile-style forms if table/list density is more appropriate.

==================================================
13. ADVANCED / SYSTEM
==================================================

Keep System minimal.

If current page is mostly meta/support:
style as compact operator/meta page.

Do not inflate with fake controls.

==================================================
14. MOBILE DESIGN
==================================================

At 430 / 390 / 360:

Settings landing should look like a native settings/profile hub:

- centered profile identity
- full-width Edit Profile button
- grouped rows
- icon + label + chevron
- 52–56px row height
- subtle dividers
- no horizontal overflow
- Bottom Nav clearance preserved

When entering a section:
show a clean dedicated page, not the whole settings hub above it.

==================================================
15. DESKTOP DESIGN
==================================================

Do NOT stretch the mobile hub across desktop.

Desktop:

[ settings rail ] [ content panel ]

Rail top:
compact profile block:
- avatar
- name
- role/workspace
- Edit Profile

Below:
grouped navigation.

Content panel:
max-width controlled
roughly 720–820px where appropriate.

Use dense premium form layout.

==================================================
16. TABLET
==================================================

Verify:
1032
1024
900
850
768

Do not let rail + content become cramped.

Use existing breakpoint strategy where possible.

Below suitable breakpoint:
switch to mobile-style navigation/select/list.

==================================================
17. VISUAL GRAMMAR
==================================================

Adapt from reference:

- circular profile avatar
- clean hierarchy
- thin separators
- rounded inputs ~14–16px
- strong primary CTA
- restrained border contrast
- calm spacing
- compact section titles
- no oversized cards
- no excessive shadows
- no gradients
- no glow

Use SITE SECURE tokens.

Dark mode must remain premium and first-class.

==================================================
18. RTL / LTR
==================================================

RTL shell.

LTR isolation for:
- email
- timezone
- URLs
- technical IDs
- numeric codes

Do not mirror technical values incorrectly.

==================================================
19. ROLE BEHAVIOR
==================================================

Owner/Admin:
see all permitted workspace settings

Manager:
see permitted Team/Security + personal settings

Sales/Technician/Viewer:
personal Profile / Appearance where allowed
no workspace management surfaces

Use real authz.

==================================================
20. ACCESSIBILITY
==================================================

Verify:

- focus state
- keyboard navigation
- row hit targets >=44px
- labels bound to fields
- selected nav state
- avatar selection accessible
- save error/success visible
- contrast in dark/light

==================================================
21. DO NOT TOUCH
==================================================

Do not modify:

- Bottom Nav
- Quote Builder
- pricing
- Infrastructure
- Platform Admin
- main Dashboard
- auth architecture
- RLS
- billing
- notification delivery backend
- dark mode strategy
- design tokens / theme provider / palette (unless a proven a11y defect is explicitly in scope)

==================================================
22. QA
==================================================

Verify:

Roles:
- Owner
- Manager
- Technician
- Viewer

Flows:
- Settings landing
- Profile edit/save
- avatar change
- Appearance
- General save
- Company save
- Quotes save
- Numbering
- Team
- Security
- Audit

Viewports:
- 1440
- 1032
- 1024
- 900
- 850
- 768
- 430
- 390
- 360

Themes:
- dark
- light

Also:
- RTL
- no localhost links
- no overflow
- Bottom Nav untouched
- typecheck
- build

==================================================
FINAL REPORT
==================================================

Return:

# SETTINGS-3C PROFILE-LED PREMIUM REDESIGN REPORT

1. Files changed
2. Settings landing redesign
3. Profile route
4. Profile data used
5. Avatar move
6. Appearance placement
7. Security placement
8. General cleanup
9. Company/branding result
10. Commercial settings result
11. Operations result
12. Team/access result
13. Advanced/system result
14. Desktop
15. Tablet
16. Mobile
17. Dark mode
18. Light mode
19. RTL
20. Accessibility
21. Role visibility
22. Save UX
23. Tests
24. Typecheck
25. Build
26. Remaining gaps
27. SITE SECURE UI Review Checklist result (pass/fail per bold item)

Then STOP.

Do not start SETTINGS-3D automatically.

---

## Before finalizing

Run the SITE SECURE UI Review Checklist before finalizing.

Checklist path: `Docs/design/SITE-SECURE-UI-REVIEW-CHECKLIST.md`

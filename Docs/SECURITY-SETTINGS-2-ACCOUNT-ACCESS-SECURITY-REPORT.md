# SECURITY-SETTINGS-2 ACCOUNT & ACCESS SECURITY REPORT

Date: 2026-09-30  
Area: `/app/settings/security`

## 1. Existing page issues

- Read as a technical security diagnostics dump (Supabase Auth / JWT / `authorize()` / RLS as primary copy).
- Weak password recovery affordance (explanatory text, not a clear action).
- No user-facing “how am I protected / what access do I have / how do I recover” hierarchy.
- Implementation honesty mixed into the main reading path (“הסתרת כפתור אינה אבטחה”).

## 2. New page hierarchy

1. Header — **אבטחה** + lead about account access, workspace permissions, recovery  
2. **מצב אבטחה** — compact status rows  
3. **החשבון שלי** — email / role / workspace + password reset action  
4. **גישה והרשאות** — role description + gated roles/audit links  
5. **הגנות מערכת** — user-facing protections + expandable **מידע טכני**

## 3. Security status section

Rows (icon + title + body + chip):

| Row | Typical chip |
|---|---|
| אימות כניסה | תקין |
| הרשאות וגישה | תקין |
| בידוד סביבת עבודה | תקין |
| יומן ביקורת | זמין (if healthy + `audit.view`) / מוגבל (`not_in_plan`) / תקין |
| סשנים ומכשירים | לא זמין כרגע |
| אימות דו-שלבי | לא זמין כרגע |

`api_security` remains an API signal but is **not** shown as a primary status row (covered under system protections). No fake green for MFA/sessions.

## 4. Account section

Shows only real session data:

- email (`dir="ltr"` / `ltr-meta`)
- current role
- current workspace name  

No invented last-login.

## 5. Password recovery

Action card:

- Title: איפוס סיסמה  
- Body: secure email link copy  
- CTA → `/forgot-password`  

Not framed as in-app password change. No second reset flow.

## 6. Access/permissions section

- Current role label + plain-language `rbacRoleDescriptions`  
- Workspace name  
- CTA **ניהול תפקידים והרשאות** → `/app/settings/roles` only when `roles.manage`

## 7. Audit integration

- Status row always present with honest chip  
- CTA **יומן ביקורת** → `/app/settings/audit` only when `audit.view`  
- Plan-limited → chip **מוגבל**, no misleading “available” CTA

## 8. System protection copy

User-facing bullets only:

- גישה מבודדת לפי סביבת עבודה  
- הרשאות נאכפות בצד השרת  
- גישה ל־API מוגנת  
- מסמכים וקבצים מוגנים לפי הרשאות (backed by `documents.*` grants)

## 9. Unsupported-feature handling

Option A: compact status rows with **לא זמין כרגע** for sessions + MFA.  
No toggles, no “coming soon” marketing blocks.

## 10. Technical-copy cleanup

Primary surface no longer leads with JWT / `authorize()` / RLS / button-hiding honesty.  
Technical line lives behind **מידע טכני**: `Server-side authorization + Row Level Security (RLS).`

## 11. Role visibility

| Role | Security route (`settings.general` \| `workspace.edit`) | Roles CTA | Audit CTA |
|---|---|---|---|
| Owner / Admin | yes | yes (when granted) | yes (when granted) |
| Manager | yes (`settings.general`) | no | no (no `audit.view` in default grants) |
| Sales / Technician / Viewer | route hidden / forbidden (only `settings.view`) | n/a | n/a |

Gating unchanged from existing Settings IA (no catalog/auth changes).

## 12. Desktop

Settings rail unchanged. Content max-width ~46rem. Stacked sections, compact status list, thin borders, no KPI dashboard look.

## 13. Mobile

Stacked account grid → 3-col from 640px. Password CTA full-width on small screens, ≥44px target. Status chips wrap. Bottom Nav untouched.

## 14. Dark/Light

Token-only surfaces (`--color-bg-1`, `--color-border`, `--color-fg*`, `--color-action`). No gradients/glow. Status tones via shared `Status` (label + tone, not color-only).

## 15. RTL

RTL shell preserved. Email + technical metadata use `ltr-meta` + `dir="ltr"`.

## 16. Accessibility

- Section headings with `aria-labelledby`  
- Tech toggle `aria-expanded`  
- Focus-visible on CTA/links/toggle  
- Status chips include text labels  
- Loading + error states retained  

## 17. Files changed

- `apps/web/src/routes/app/settings/security.tsx` — Account & Access Security Center UI  
- `apps/web/src/i18n/he.ts` — user-facing security copy  
- `apps/web/src/styles.css` — `.settings-security*` styles  
- `apps/api/app/routers/team.py` — user-facing signal labels/details; MFA/sessions `not_built`  
- `apps/web/tests/security-settings-2.test.tsx` — hierarchy, honesty, permission gating  
- `apps/web/tests/settings-expansion.test.ts` — copy honesty assertions updated  
- `apps/web/scripts/security_settings_2_qa.mjs` — viewport capture helper  

## 18. Tests

- `vitest` `tests/security-settings-2.test.tsx` — **4/4 passed**
- `vitest` `tests/settings-expansion.test.ts` — **passed** (including security honesty)
- Playwright live QA (`Docs/security-settings-2-qa/report.json`):
  - hierarchy / password CTA / email / RTL / no JWT·authorize·RLS primary — **pass**
  - viewports 1440 / 1032 / 768 / 390 / 360 × dark/light — **no horizontal overflow**
  - owner roles + audit links present
  - MFA/sessions chip language **לא זמין כרגע** present

## 19. Typecheck

`npm run typecheck -w @site-secure/web` currently fails on **pre-existing** unrelated `src/` and `tests/` errors (customers directory, command palette, account-avatar, etc.).  
**No errors** in `security.tsx` / security-settings-2 test.

## 20. Build

`npm run build -w @site-secure/web` — **succeeded**.

## 21. Remaining security UX gaps

- MFA / session-device management still not product features (honest “לא זמין כרגע” only).  
- No in-app password change (recovery via `/forgot-password` only).  
- No last-login / login history (not available server-side).  
- Sales / Technician / Viewer cannot open this route today (`settings.view` only) — personal account recovery lives elsewhere (forgot-password / account menu) unless product later opens a personal-only security surface.  
- Audit “זמין” chip requires both plan feature + `audit.view`; managers without audit still see status honesty without a CTA.

---

## SITE SECURE UI Review Checklist (sign-off)

| Item | Result |
|---|---|
| Area touched | `/app/settings/security` Account & Access Security |
| Themes checked (dark / light) | Yes — Playwright captures both |
| Breakpoints checked | 1440 / 1032 / 768 / 390 / 360 — no overflow |
| RTL checked | Yes (`dir=rtl`, email/tech `ltr-meta`) |
| Dark mode preserved | Yes |
| Bottom Nav untouched | Yes |
| Role permissions respected | Roles/audit CTAs gated; route gate unchanged |
| No giant cards / gradients / glow | Yes |
| Focus-visible / ≥44px CTA | Yes |
| Reviewer / agent | Auto (Composer) |
| Date | 2026-09-30 |

**Checklist fail items:** none for this scoped change. Pre-existing repo typecheck debt outside this page remains.

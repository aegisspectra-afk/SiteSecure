# BETA-ADMIN-4 PREMIUM OPERATIONS COMMAND CENTER REPORT

**Date:** 2026-09-30  
**Scope:** `/admin` dashboard presentation only (no backend / IA / permissions rewrite)  
**Visual QA:** `Docs/beta-admin-4-visual-qa/`  
**UI rules:** `Docs/design/SITE-SECURE-UI-DESIGN-RULES.md` + Review Checklist run before finalize

---

## 1. Existing dashboard issues

- Flat visual weight: metrics, lists, system deploy block, and attention competed equally
- Invitation dump and raw activity event names dominated the page
- No operational filter (scope/time); QA/test noise mixed with real beta signal
- System health strip mixed deploy metadata into primary attention
- Request-ID guidance was a large instructional block with no utility control
- Funnel was invitation-only and buried under equal-weight metric cards

## 2. New information hierarchy

1. Platform health strip (honest connected / לא מחובר)
2. Attention Center (grouped, severity-ranked)
3. Beta value funnel (supported stages only)
4. Beta Snapshot (operational counts)
5. Beta workspaces + invitation health + feedback + activity
6. System details + Request-ID investigation (utility tier)

Desktop grid: dominant main column (attention → funnel → workspaces) + supporting rail (snapshot → invites → feedback → activity).

## 3. Header / actions

- Title: **Founding Beta Operations**
- Short operational subtitle
- Primary CTA: **צרף Founding Technician** (opens existing onboard panel)
- Utilities: רענון · הזמנות · פידבק
- Compact density; no hero

## 4. Platform status strip

Signals: API · Web · Auth · Backup · Invite flow · Quote flow  

Live honesty:
- API → תקין when summary succeeds (`system.api_ok`)
- Web / Auth / Backup / Invite / Quote → **לא מחובר** (API returns `unknown` / `unavailable`; no fake green)
- Optional metadata (API version, web build) when present
- No “נבדק לאחרונה” (no real probe timestamp in datasource)

## 5. Attention Center

- Primary panel “דורש תשומת לב”
- Groups by `kind` + `severity` (e.g. repeated expired invites collapsed)
- Severity chips: קריטי / גבוה / דורש פעולה / מידע
- Top ≤7 groups; CTA פתח + צפה בכל
- Empty: “No active issues” / אין כרגע פריטים שדורשים טיפול

## 6. Beta funnel

Supported live stages only (from `summary.funnel`):
Workspace created → Owner invites → Accepted → Pending  

Explicit note: customer / quote stages **not connected**. No invented conversion metrics. Horizontal progress strip with LTR stage order for clarity.

## 7. Beta snapshot

Compact operational metrics:
- active beta workspaces
- beta participants / founding technicians
- pending invitations
- workspaces awaiting owner (derived from cards)
- open feedback  

No vanity duplicates of the full funnel.

## 8. Workspace panel

Card-table hybrid rows: name · status · owner · members · pending invites · latest created activity · פתח  
No metadata walls. Value milestones (customer/quote) omitted — not in `AdminBetaWorkspaceCard`.

## 9. Invitation health

Summary: pending / accepted / expired / revoked  
Compact pending list (filtered), not full history.  
Row: email · workspace · role · age · classification · הנפק מחדש / בטל / פתח  
Full history remains `/admin/invitations`.

## 10. Feedback panel

Open count (API) + high-severity count (filtered list)  
Recent real-beta-leaning rows; `is_beta === false` grouped under collapsible QA label  
Empty: “No real beta feedback”  
CTA: כל הפידבק

## 11. Activity grouping

Machine spam (`workspace_beta_*` / `*updated`) grouped by action+hour with ×N and time range  
Human-readable titles; raw action name as secondary metadata

## 12. System metadata

Collapsed **פרטי מערכת**: Environment · Web version · API version · Git SHA  
Not competing with operational issues

## 13. Request-ID utility

**חקירת תקלה** with input + copy  
Honest copy: אין חיפוש לוגים מובנה — השתמשו ב־Request ID בלוגי ה־API.

## 14. QA/Test noise handling

- Soft email heuristic (`qa_probe`, `sitesecure.test`, etc.) labeled **חשוד כ־QA (אימייל)** — not claimed as official classifier
- Default scope: בטא אמיתי (hides suspected QA in presentation)
- Alternate: כולל QA / Test
- Unclassified = **לא מסווג**
- Classifier limitation called out in filter note
- Historical data not deleted

## 15. Data honesty checks

| Claim | Result |
|---|---|
| Fake health green | No — only API green when `api_ok` |
| Fake last-checked | No timestamp shown |
| Fake quote funnel | Stages absent + note |
| Silent QA classification | No — labeled + limited |
| Fabricated attention | No — grouped from API attention |

## 16. Desktop result

1440 / 1280: command-center two-column grid, status strip 6-up, attention dominant. PASS (no overflow).

## 17. Tablet result

1032: two-column retained, denser. 768: stacked/two-tier panels, status 3-up. PASS.

## 18. Mobile result

430 / 390 / 360: single column, ≥44px touch targets on primary actions, no horizontal overflow. PASS.

## 19. Dark/Light

Dark first-class; light verified at 1440. Tokens only (`--color-*`, existing radii). No neon/glass/glow KPI cards.

## 20. RTL

Hebrew layout RTL; emails / IDs / SHA / Request ID / funnel progression use LTR isolation where needed.

## 21. Accessibility

- Semantic `h1`/`h2`, radiogroup filters, focus-visible on controls
- Status text + tone (not color-only)
- Touch min-heights on primary/util actions
- `prefers-reduced-motion` respected for micro transitions
- Empty states text-first (no oversized illustrations)

## 22. Performance

Still a **single** `adminSummary()` React Query fetch (no request storm). Filters/grouping are client-side presentation only. No new polling.

## 23. Files changed

- `apps/web/src/routes/admin/index.tsx` — composition + FT onboard wiring
- `apps/web/src/components/admin/OpsCommandCenter.tsx` — command center UI
- `apps/web/src/lib/admin-ops-center.ts` — grouping/filter/honesty helpers
- `apps/web/src/lib/admin-ops-center.test.ts` — unit tests
- `apps/web/src/i18n/he.ts` — new ops-center strings
- `apps/web/src/styles.css` — `.admin-cc-*` styles
- `apps/web/scripts/beta_admin_4_visual_qa.mjs` — visual QA harness
- `Docs/beta-admin-4-visual-qa/*` — screenshots + `report.json`

## 24. Tests

`npx vitest run src/lib/admin-ops-center.test.ts` → **5 passed**

## 25. Typecheck

`tsc` has pre-existing repo errors unrelated to admin. **No admin-ops / OpsCommandCenter / admin/index type errors.**

## 26. Build

`npm run web:build` → **PASS**

## 27. Remaining admin UX gaps

- Workspace “פתח” still routes to org list (no deep-link detail route in scope)
- Invitation recipient display name not in API card (email only)
- Activity importance ranking still light (grouping only)
- FT onboard panel sits below the command center rather than modal overlay

## 28. Remaining datasource gaps

- Web / Auth / Backup / Invite / Quote health probes not connected
- No reliable real-vs-QA classifier (email heuristic only)
- Quote / customer / site funnel stages not in summary
- Workspace value milestones (first customer / quote sent) not on cards
- No built-in log search for Request ID
- No “last checked” health timestamps

---

**STOP.** Do not start BETA-ADMIN-5.

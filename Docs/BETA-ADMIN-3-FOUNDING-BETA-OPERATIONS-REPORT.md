# BETA-ADMIN-3 FOUNDING BETA OPERATIONS REPORT

**Date:** 2026-09-28  
**Scope:** Transform `/admin` into Founding Beta Operations Center using existing data  
**STOP:** No analytics / PostHog / monitoring stack added  

---

## 1. Files changed

| File | Change |
|------|--------|
| `apps/api/app/routers/admin.py` | Extended `GET /api/v1/admin/summary` with beta ops metrics, funnel, attention, pending invites, beta workspaces, open feedback, recent activity, honest system block |
| `packages/api-client/src/index.ts` | Extended `AdminSummary` + related card types |
| `apps/web/src/routes/admin/route.tsx` | Nav regroup: תפעול + מתקדם; document title ops center |
| `apps/web/src/routes/admin/index.tsx` | Full Founding Beta Operations dashboard + FT onboarding CTA |
| `apps/web/src/i18n/he.ts` | Ops terminology + new strings; `ארגונים` → `סביבות עבודה` |
| `apps/web/src/lib/app-version.ts` | Safe `WEB_BUILD` metadata (`version`, `mode`, optional `VITE_GIT_SHA`) |
| `apps/web/src/styles.css` | `admin-ops` shell + dense ops-center styles |
| `apps/api/tests/test_beta_admin_ops_summary.py` | Unit test: ops payload, attention kinds, no token leakage |
| `Docs/beta-admin-3-ops-qa/report.json` | Viewport / live probe results |

## 2. Navigation changes

**Primary (תפעול):**
- לוח תפעול → `/admin`
- סביבות עבודה → `/admin/organizations`
- הזמנות → `/admin/invitations`
- משתמשים → `/admin/users`
- פידבק → `/admin/feedback`
- Audit → `/admin/audit`

**Advanced (מתקדם):**
- תוכנית בטא → `/admin/beta`
- Badges → `/admin/badges`
- דגלי יכולת → `/admin/flags`

No pages deleted.

## 3. Terminology changes

UI standardized on **סביבות עבודה** (nav, org list empty/error/search, beta org labels, FT flow).  
English/technical names remain in logs/metadata/`role_key`/`app_env`.

## 4. Dashboard hierarchy

1. Header — SITE SECURE / Platform Admin / Founding Beta Operations  
2. Primary CTA — צרף Founding Technician  
3. מצב המערכת + גרסת מערכת  
4. דורש תשומת לב  
5. Operational metrics + funnel + cohort labels  
6. בריאות הזמנות (pending list)  
7. סביבות בטא  
8. פידבק פתוח  
9. פעילות אחרונה  
10. Request-ID guidance (+ errors gap note)

## 5. Primary onboarding CTA

Strongest action on the page: **צרף Founding Technician** — expands inline compact flow.

## 6. Founding Technician onboarding flow

Reuses existing APIs only:
1. Workspace name + Owner email  
2. `POST /api/v1/admin/organizations` (`is_beta: true`)  
3. `POST /api/v1/admin/invitations` (`role_key: owner`)  
4. Show invite link (`window.location.origin/invite/{token}`) — Copy / Open / Done  

Partial failure: workspace id retained; invite retry without creating another workspace.  
Token shown only at creation/reissue time.

## 7. Beta metrics (real data)

From single summary endpoint:
- סביבות בטא פעילות  
- Founding Technicians פעילים  
- הזמנות ממתינות  
- הזמנות שפגו / בוטלו  
- פידבק פתוח  
- הצטרפו ב־7 ימים האחרונים  

Live probe (local): 2 / 11 / 53 / 188 / 7 / 287.

## 8. Onboarding funnel

Reliable stages only:
- beta_workspaces  
- owner_invites  
- owner_accepted  
- owner_pending  

**Not shown:** invite_opened (not tracked), customer/quote stages (not wired here).

## 9. Attention queue

Derived from real state:
- Owner invite pending ≥ 24h  
- Invite expired  
- Beta workspace with no members / no owner  
- Open feedback severity high/blocker  

Each item links to invitations / organizations / feedback.

## 10. Invitation health

Counts: pending / accepted / expired / revoked.  
Recent pending cards: email, workspace, role, age, status.  
Actions: Reissue / Revoke (existing APIs). No stored-token reveal.

## 11. Beta workspace list

Compact cards (≤12): name, status, members, owner flag, pending invites, created.  
Link to סביבות עבודה list.

## 12. Feedback operations

Open feedback prioritized (blocker/high then newest).  
CTA: כל הפידבק → `/admin/feedback`.

## 13. Recent activity

From `platform_admin_events` (existing).  
Shows timestamp, action, summary metadata (name/email/id) — no tokens.

## 14. System readiness/status

| Row | Status source |
|-----|---------------|
| API | `api_ok` when summary succeeds |
| Web | `לא מחובר` (version shown in deploy block only) |
| Auth | `לא מחובר` (no live Supabase health probe) |
| Backup | `לא מחובר` — “Backup status לא מחובר לקונסולה” |
| Invite flow | `לא מחובר` |
| Quote flow | `לא מחובר` |

No hardcoded green health.

## 15. Deployment/version data

- Environment: `settings.app_env`  
- Web version: `WEB_BUILD.version` (`0.1.6-beta`)  
- API version: `v1`  
- Git SHA: only if `VITE_GIT_SHA` injected — else “לא זמין”  
- Deployed timestamp: not available — omitted  

## 16. Backup status handling

Not connected. Explicit disconnected copy. No filesystem paths exposed.

## 17. Request-ID/error operations

Operator guidance to search Render logs by `X-Request-Id`.  
**שגיאות אחרונות:** documented gap — no structured error store; not built.

## 18. Data/API changes

Single extended `GET /api/v1/admin/summary` (batched limited selects, no new event system).  
Legacy keys retained for compat (`organizations`, `beta_organizations`, …).

## 19. Security review

- Platform-admin gate unchanged (`require_platform_admin`)  
- Owner denied covered by existing tests (403)  
- Summary pending invites omit tokens  
- Invite plaintext token only on create/reissue response  
- No service-role / secrets / customer document content on dashboard  

## 20. localhost/origin audit

Admin nav/links are router-relative (`/admin/...`).  
Invite URLs use `window.location.origin`.  
No hardcoded localhost/127.0.0.1 in admin routes.

## 21. 1440 result

**PASS** — sidebar flex, mobile nav hidden, 6 metric cols, no document overflow.

## 22. 1032 result

**PASS** — sidebar flex, 6 metric cols, no overflow.

## 23. 768 result

**PASS** — sidebar hidden, mobile nav flex, 3 metric cols, no overflow.

## 24. 390 result

**PASS** — compact cards, 2 metric cols, no page overflow (mobile nav scrolls internally).

## 25. 360 result

**PASS** — same as 390; CTA + attention + zones present; no page overflow.

## 26. RTL

**PASS** — `dir=rtl` on document; Hebrew copy throughout ops center.

## 27. Tests

- `tests/test_beta_admin_ops_summary.py` — **PASS** (ops shape, attention, no token)  
- `tests/test_beta_admin_invitations.py` — **PASS** (includes owner 403 on summary)  
- `tests/test_api_foundation.py` — **PASS** (unauthenticated summary 401)  
- Live browser: platform admin dashboard loads with real counts  

## 28. Typecheck

Admin-touched files: **no TS errors**.  
Workspace `tsc --noEmit` still fails on **pre-existing** unrelated test/app drift (quotes/customers/nav) outside this checkpoint.

## 29. Build

`vite build` — **PASS** (✓ built).  
Full `npm run build -w @site-secure/web` still fails on the same pre-existing trailing `tsc` suite (not introduced by BETA-ADMIN-3).

## 30. Remaining operational gaps

1. Auth / Invite / Quote / Web **health probes** not connected → shown as לא מחובר  
2. Backup metadata not queryable from app  
3. Git SHA / deploy timestamp not injected in current build pipeline  
4. `invite_opened` and deeper funnel (customer/quote) not recorded  
5. Structured **שגיאות אחרונות** / request-id log explorer not built  
6. Last meaningful workspace activity beyond membership/invite counts not modeled  
7. Open feedback count per workspace not on compact cards (would need extra join cost)  
8. Attention queue can be noisy with historical QA expired invites / telemetry probes  

---

**STOP.** No analytics integration, PostHog, or monitoring stack started.

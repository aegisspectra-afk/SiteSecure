# Founding Technician Product Experience — Real-User Readiness

**Date:** 2026-09-24  
**Mode:** AUDIT → FIX → BROWSER VERIFY  
**Test users:** `ft.product.e3588aa5@sitesecure.test` (assigned work + badge), `ft.empty.e3588aa5@sitesecure.test` (empty Today)  
**Role:** `technician` · **Recognition:** `founding_technician` badge (not an authz role)  
**Workspace:** `FT Product e3588aa5` (`f9ad7663-…`) · empty: `FT Empty e3588aa5`  
**QA artifacts:** `Docs/founding-technician-product-experience-qa/`

---

## 1. Technician route inventory

| Surface | Nav visible? | Classification | Notes |
|---|---|---|---|
| `/app/today` | Yes (home) | **WORKS** | Field Today; primary landing |
| `/app/tasks` | Yes (משימות) | **WORKS** | Lightweight to-dos; not calendar |
| `/app/jobs` | Yes | **WORKS** | Assigned-only scope; field lead copy |
| `/app/jobs/:id` (FieldJob) | Via Today/Jobs | **WORKS** | Core field workspace |
| `/app/customers` | Yes | **PARTIAL** | Operational CRM view; manager tabs may be thin |
| `/app/sites` | Yes (תיקי אתר) | **PARTIAL** | Site dossier usable; still dossier-shaped |
| `/app/knowledge` | Yes (מודיעין טכני) | **EMPTY-BUT-VALID** / thin | Keep; useful when content exists |
| `/app/service` | **Hidden** (field) | Deferred | Service Call V1 not ready — nav hidden for field home |
| `/app/warranties` | Hidden (field) | Deferred | Partial product — not in technician nav |
| `/app/projects` | Hidden | AUTHZ DENIED / N/A | Hidden for field; server still authoritative |
| `/app/quotes`, `/app/leads`, `/app/catalog` | Hidden | AUTHZ DENIED CORRECTLY | No quotes.view for technician |
| `/app/dashboard` | Redirect → today | NOT RELEVANT | `homeVariant=today` |
| `/app/settings` | Hidden | AUTHZ DENIED CORRECTLY | No workspace.edit for technician |
| Profile (account menu) | Sidebar + topbar | **WORKS** | Name, email, role, badge, theme, logout |
| Feedback FAB | Always | **WORKS** | Categories simplified |
| `/admin` | No | AUTHZ DENIED CORRECTLY | 403 API + UI deny |

---

## 2. Navigation before / after

**Before (field technician):** Today, Tasks, Customers, Jobs, Sites, **Service**, Knowledge — felt like trimmed manager app; Service unfinished; badge missing from sidebar; Today loading used manager command-center skeleton.

**After:**
- Field groups: סביבת עבודה (היום, משימות) · מכירות ולקוחות (לקוחות) · עבודת שטח (עבודות, תיקי אתר, מודיעין טכני)
- **Service / Warranties / Projects / Settings / Quotes / Leads / Catalog** hidden for `homeVariant=today`
- Sidebar forwards `recognitionBadges` → **טכנאי מייסד** under name
- Tasks labeled משימות (not לוח שנה)

Role-aware presentation only — server `authorize()` unchanged.

---

## 3. Golden journey

| Step | Result |
|---|---|
| Login as FT technician | PASS |
| Landing `/app/today` | PASS |
| Badge visible (sidebar + profile) | PASS |
| Assigned job on Today | PASS |
| Open Job (פתיחת העבודה) | PASS |
| Customer / Site context | PASS |
| Lifecycle action (הגעה לאתר → …) | PASS |
| Continue FieldJob | PASS |
| Jobs list (assigned framing) | PASS |
| Feedback categories | PASS |
| Profile (role + badge) | PASS |
| Logout | SKIPPED_IN_QA (menu present; not re-run after session) |
| Empty technician Today | PASS |
| Authz: quotes 403, admin 403, admin UI deny | PASS |

---

## 4. Today

- Unscheduled assigned jobs included on day board (API `_today_jobs`).
- Cards: number, status, site, customer, address, schedule or “ללא שעה”, primary **פתיחת העבודה**, secondary navigate + next lifecycle.
- Loading: `FieldTodaySkeleton` (not manager KPI skeleton).
- Empty: «אין לך עבודות משויכות כרגע» + calm body copy.

## 5. Jobs

- Field lead: «העבודות ששובצו אליך…»
- Assignment filter hidden for field home.
- Empty body field-specific; error + retry retained.
- No manager-wide visibility expansion.

## 6. FieldJob

- WHO / WHERE / WHAT / STATE / NEXT gated by status + `can()`.
- `GET /jobs/{id}` now enriches `customer_name` / `site_name`.
- Address: accept legacy `line1` in `formatAddressLine`.
- Priority chip only when not `normal`.
- Error + retry on job load failure.

## 7–8. Customer / Site

- Technician has `crm.view` / `sites.view` — names + phone usable on FieldJob.
- Full Customer 360 / Site dossier remain manager-shaped → **PARTIAL**; no authz expansion.
- FieldJob + Today carry operational context without requiring dossier.

## 9. Service

- Existing `/app/service` still works for managers.
- **Hidden from technician field navigation** until Service Call V1.

## 10. Tasks

- Kept with truthful label משימות; not presented as calendar.

## 11. Knowledge

- Kept; thin but reachable.

## 12. Warranties

- Hidden from field nav (partial product).

## 13. Profile

- Account menu: full name, email, role (טכנאי), Founding Technician badge, theme, logout.
- Avatar is static illustration — no fake edit control.

## 14. Founding Technician badge

- Hebrew **טכנאי מייסד**; EN title via `FOUNDING TECHNICIAN`.
- Surfaces: sidebar identity, account popover.
- Does not grant permissions (`role_key` remains `technician`).

## 15. Feedback

- FAB: שליחת משוב  
- Categories: בעיה · לא ברור לי · חסר לי משהו · רעיון לשיפור  
- Auto-attaches route, workspace, user, role, app version in body metadata.

## 16. Empty / loading / error

| Surface | Loading | Empty | Error |
|---|---|---|---|
| Today | FieldTodaySkeleton | Calm Hebrew empty | ErrorState + retry |
| Jobs | text loading | Field empty copy | ErrorState + retry |
| FieldJob | loading label | n/a | ErrorState + retry |
| Feedback | — | empty my-reports | inline error |

## 17. Mobile (390 / 360)

- No horizontal overflow on FieldJob.
- Primary CTA reachable; bottom nav intact; Feedback FAB accessible.
- Screenshots: `A-*-390`, `C-*-390/360`, `F-technician-nav-390`, `B-*-390`.

## 18. RTL

- Hebrew UI consistent; LTR for job numbers / times via `ltr-meta` / `dir=ltr`.
- No status keys as primary labels.

## 19. Authz regression

| Check | Result |
|---|---|
| `GET …/quotes` | 403 |
| `GET /admin/summary` | 403 |
| `/admin` UI | Denied |
| Badge ≠ permission | Confirmed (`role_key=technician`) |
| Settings / users hidden | Yes |

## 20. Fixes made

1. Sidebar: forward `recognitionBadges` to `UserAccountMenu`
2. Field nav: hide Service (and keep Warranties/Projects/Settings/Quotes hidden)
3. `FieldTodaySkeleton` for Today loading
4. Today primary CTA = פתיחת העבודה; lifecycle secondary
5. Jobs field lead / empty / hide assignment filter (prior + verified)
6. Feedback categories Hebrew simplification (prior + verified)
7. `GET /jobs/{id}` enrich customer/site names
8. Address `line1` legacy support
9. FieldJob: address line, name fallbacks, error retry, non-normal priority only
10. Today empty copy for assigned-none
11. Dashboard include unscheduled assigned jobs (prior)
12. Tests: foundation nav, workspace-header Hebrew tenure, address line1

## 21. Remaining capability gaps

1. Customer/Site dossier still manager-oriented for technicians  
2. Service Call V1 absent (nav correctly hidden)  
3. Knowledge thin until content seeded  

## 22. Intentionally deferred

- Service Call V1, Warranty V1, avatar upload, calendar, authz expansion, migrations, Quote/pricing/System Design, `job_lifecycle.py`

## 23. Test results

| Suite | Result |
|---|---|
| Web unit (`vitest`) | **456 passed** |
| API focused (`test_dashboard`, `test_dispatch_ops`) | **27 passed** |
| `tsc` / production build | **PASS** (`vite build && tsc --noEmit`) |
| Browser QA script | **PASS** (see `report.json`) |

## 24. Launch recommendation

**YES — ready for first real Founding Technician** in a dedicated single-workspace invite, with manager assigning Jobs and Platform Admin granting the recognition badge.

Operator path remains: invite `technician` → badge on `/admin/users` → assign Job → technician uses Today → FieldJob → Feedback.

---

## Screenshots

See `Docs/founding-technician-product-experience-qa/`:

- A Today with work (1440 / 1440-dark / 390)
- B Today empty (1440 / 390)
- C FieldJob (1440 / 390 / 360)
- D Profile badge
- E Feedback
- F Technician navigation
- jobs-field-1440
- `report.json`

# SITE SECURE: דוח בריאות מוצר (Audit)

- **תאריך:** 2026-11-13
- **מאגר שנבדק:** `C:\ssq`. זה clone של הענף `ss-quote-core-s1-s2`, ‏HEAD `92daf1b`.
- **סביבה:** Supabase מקומי (docker `site-secure-v2`). לא נשלחה אף פנייה לענן.
- **אופן העבודה:** קריאה בלבד. לא שוניתי קוד, לא נמחק אף קובץ ולא נעשה commit. הקובץ היחיד שנוצר הוא הדוח הזה.

מקרא:
- "אומת": הרצתי או שאילתתי בעצמי.
- "סריקה": נמצא בסריקה סטטית של הקוד ולא הורץ.
- "לא ודאי": לא הצלחתי לקבוע.

---

## 1. Git

| | |
|---|---|
| ענף נוכחי | `ss-quote-core-s1-s2` |
| שינויים שלא נשמרו ב-`C:\ssq` | רק `apps/web/src/routeTree.gen.ts`. השינוי הוא בסופי שורות בלבד (LF במקום CRLF), שהגנרטור של TanStack Router מייצר כש-Vite רץ. אין שינוי בתוכן. |
| המאגר ב-OneDrive (`C:\ssv1`, אותו ענף) | נמצא ב-`7d1ce3f`, ‏**8 commits מאחורי** `C:\ssq`. אין בו שינויים במעקב, ויש בו 72 קבצים שאינם במעקב (zip, תמונות, קבצי `_mig_ssp_*.sql`, סקריפטים ב-`tmp/`). |
| push | לא בוצע. אין remote שעודכן. |

**20 ה-commits האחרונים** (מ-`git log --oneline -20`):

```
92daf1b Let customers sign on phones, send quotes with advisories, and stop offering revise after approval.
644e2de Default quotes to 30 days, require the owner's payment terms at setup, and let sales see a quote's customer.
a3e1905 Add the optional-lines Apply migration to the stage-E order and rollback.
0f85b19 Show the customer the server's discount breakdown and optional lines, and keep CCTV options optional.
aa2d2b7 Show only server quote totals in the builder and stop rewriting ₪ line discounts as percent.
be9af19 Sign Apply confirmations with the service secret only and keep design linkage server-owned.
24b5458 Lock quote money, lifecycle and versions to the API; refuse revising approved quotes.
eef46ec Refuse hosted Supabase targets in dev and test unless explicitly allowed.
7d1ce3f Raise customer CSV import to 2,000 rows and explain blocked asset deletes.
54aa15f Walk solo users through four setup steps and show plan quotas without payment.
39faf56 Add customer CSV import guards and scoped task/equipment delete.
75b4fd3 Limit assigned-scope task export to the technician's own assignee rows.
a6c34bf Recreate the API client when the package gains methods so the bell can load.
92d6b21 Note that the unused CRM table drop needs a COUNT and backup before cloud.
0ce28b6 Restore CCTV equipment-intent helpers so e2 looks up semantic roles.
4accd1b Add a domain registry so free-build stays a picker input method, not an engine.
7a231a8 Add in-app notifications and scope technician task export.
251871c Add SITE SECURE CSV export for quotes, customers, and tasks.
cac7d61 Close Site Secure stage A: Hebrew chrome, jobs/reports nav, and DASH-4 today queue.
20a3518 Fix quote scope optional exclusion and align stale quote wizard tests.
```

---

## 2. מבנה

| תיקייה | תפקיד |
|---|---|
| `apps/web` | אפליקציית React, ‏Vite ו-TanStack Router (RTL, עברית) |
| `apps/web/src/routes/` | נתיבי קבצים. ציבוריים: `login`, `register`, `forgot-password`, `reset-password`, `verify-email`, `onboarding`, `invite/$token`, `q/$token`, `public/`, `portal/*`, `legal/`. המעטפת המאומתת היא `routes/app/*`, ומחוץ לה יש גם `platform/`, `admin/`, `ssp/`, `unit/`, `demo/`, `dev/`. |
| `apps/web/src/routes/app/` | `dashboard`, `today`, `analytics`, `catalog`, `customers/`, `leads/`, `quotes/` (index, new, `$quoteId`, `$quoteId/preview`), `projects/`, `jobs/`, `tasks/`, `sites/`, `service/`, `warranties/`, `knowledge/`, `settings/*` (15 עמודים), וגם `ssp/*`, `fleet/*`, `workforce/*` (מוצרים נפרדים) ו-`platform-path/*` |
| `apps/web/src/components/` | רכיבי המעטפת (`AppShell`, `AppSidebar`, `CommandPalette`, `Onboarding*`) ותיקיות לפי תחום: `quotes/` (`QuoteBuilder`, `cpq/`, `document/`, `workspace/`), `dashboard/`, `customers/`, `leads/`, `projects/`, `jobs/`, `field/`, `sites/`, `settings/`, `catalog/`, `ssp/`, `fleet/` ועוד |
| `apps/web/src/lib/` | לוגיקת הלקוח: ניווט (`app-nav.ts`), סשן (`session.tsx`), הרשאות (`can.ts`), `quote-*`, `cctv-*`, `dashboard-*` |
| `apps/web/src/i18n/he.ts` | כל הטקסט בעברית |
| `apps/web/tests/` | בדיקות Vitest (132 קבצים) |
| `apps/api/app/main.py` | יוצר את אפליקציית FastAPI וטוען את הראוטרים |
| `apps/api/app/routers/` | 44 קבצי ראוטר. 40 מהם טעונים; לא טעונים: `ipam`, `connections`, `customer_portal`, וגם `fleet_shared`, שהוא helper |
| `apps/api/app/authz/` | מנוע ההרשאות: `engine`, `guard` (`require`), `scope`, `limits`, `usage` |
| `apps/api/app/pricing.py` | חישוב הכסף היחיד: `recalculate` |
| `apps/api/app/quote_*.py`, `quote_rules/` | snapshot, חתימה, טוקנים, PDF ‏(fpdf2), כללי שליחה |
| `apps/api/app/system_designs/`, `cctv_recommend/`, `cctv_sizing/` | מנוע CCTV ו-Apply להצעה |
| `apps/api/app/documents/` | פרופיל החברה, לוגו, תשתית מסמכים |
| `apps/api/app/ssp/`, `workforce/` | מוצרים נפרדים (SSP, ‏Workforce) |
| `apps/api/tests/` | בדיקות pytest, יחידה ו-live מול Supabase מקומי |
| `packages/api-client` | לקוח API עם טיפוסים |
| `packages/authz` | `catalog.json`: תפקידים והרשאות, משותף ל-API ולאתר |
| `packages/ui`, `packages/design-system` | ספריית רכיבים וטוקנים |
| `supabase/migrations/` | 115 מיגרציות (נספח א') |
| `Docs/`, `AEGIS_MASTER_AUDIT.md` | מסמכי מוצר וביקורת |
| `tmp/` | סקריפטי עזר מקומיים ו-rollback (חלקם במעקב), ‏`SS_STAGE_E_CHECKLIST.md`, ‏`ss_golden_path_browser.py` |

---

## 3. בנייה ובדיקות (כל השלבים אומתו בהרצה)

הפקודות רצו מ-`C:\ssq`. ‏pytest רץ מול Supabase מקומי.

| שלב | פקודה | תוצאה |
|---|---|---|
| install | `npm ci` | ✅ עבר (33 שניות) |
| build | `vite build --mode production` (apps/web) | ✅ עבר (18.6 שניות). יש אזהרה על chunk גדול. |
| typecheck | `tsc -p tsconfig.json --noEmit` (apps/web) | ❌ **20 שגיאות** (פירוט בהמשך) |
| lint (web) | `eslint src tests` | ❌ **15 שגיאות** (פירוט בהמשך) |
| lint (api) | `ruff check app tests` | ❌ **366 ממצאים** (258 מהם ב-`app/`) |
| tests (web) | `vitest run` | ❌ **13 נכשלו, 873 עברו** (סה"כ 886, ב-5 קבצים) |
| tests (api) | `pytest` | ✅ **965 עברו, 106 דולגו, 0 נכשלו** |

### שגיאות typecheck (20)

| קובץ:שורה | שגיאה |
|---|---|
| `src/components/admin/OpsCommandCenter.tsx:418`, `:457` | TS2741/TS2345: חסר `search` בקישור ל-`/admin/organizations` |
| `src/components/dashboard/ActiveWork.tsx:17` | TS2345: הערך `string \| null \| undefined` מועבר לפרמטר מסוג `string \| null` |
| `src/components/dashboard/AnalyticsWorkspace.tsx:140` | TS2322: הרכיב לא מגדיר את ה-prop `showExpandLink` |
| `src/lib/account-avatar.ts:57`, `:58`, `:60` | TS2322/TS2345: ערך מסוג `unknown` מוקצה ל-`"man" \| "woman"` |
| `src/routes/app/ssp/index.tsx:235`, `:582` ‏· `ssp/offices.tsx:525`, `:650` | TS2741: חסר `search` בקישור ל-`/app/ssp/assignments` |
| `src/routes/app/ssp/submissions.index.tsx:142` | TS18049: `row.submitted_by` עלול להיות null |
| `tests/attention-dash3.test.tsx:114`, `:172` | הבדיקה ניגשת ל-`tone`, שלא קיים, ומעבירה prop בשם `readOnly`, שלא קיים |
| `tests/domain-registry.test.ts:58` | אי-התאמה ב-`system_type` של `SystemRecommendation` |
| `tests/invite-accept.test.ts:2` | TS2305: `resolveAuthDestination` כבר לא מיוצא מ-`auth-routes` |
| `tests/quote-structural-stage-separation.test.tsx:49` | ה-fixture לא תואם לטיפוס `QuoteItemOut[]` |
| `tests/warranty-detail.test.tsx:73`, `:117` ‏· `warranty-studio.test.tsx:111` | `component` לא קיים על `Route`; מחרוזת מועברת במקום מספר |

### שגיאות lint (15)

- `react-hooks/exhaustive-deps`: הגדרת הכלל לא נמצאה, כלומר ה-plugin לא רשום בקונפיג. מופיע ב-`CatalogImportWizard.tsx:199`, `:265`, ‏`CctvComponentPicker.tsx:152`, ‏`SystemBuilderDrawer.tsx:409`.
- משתנים שלא בשימוש:
  - `QuoteBuilder.tsx`: ‏`MoreHorizontal` (18), ‏`projectToast` (193), ‏`termsOpen` (213), ‏`primaryCta` (1031)
  - `QuoteMobileSheet.tsx:75` ‏(`event`), ‏`cctv-sizing/hdd.ts:156` ‏(`reasons`)
  - `tests/quote-builder.test.tsx:152`, ‏`quote-section-name-field.test.tsx:3`, ‏`site-assets-inf1a.test.tsx:2`
- `prefer-const`: `QuoteBuilder.tsx:1268` ‏(`addedRoles`), ‏`quote-pricing.ts:137` ‏(`tgt`).

### ruff (api)
מרביתם שאלות סגנון שאפשר לתקן אוטומטית:
- `I001` (81)
- `UP017` (60)
- `FURB167` (40)
- `PIE807` (19)
- `F401` (18)

ממצא בעל משמעות: **`S110` try-except-pass (26)**. מדובר בחריגות שנבלעות בלי לוג.

### בדיקות Vitest שנכשלו (13, כולן ישנות ומוכרות)
- `src/lib/admin-ops-center.test.ts`: 1
- `tests/attention-dash3.test.tsx`: 6. חלק מהן נכשלות גם ב-typecheck, כלומר הבדיקה לא עודכנה אחרי שינוי ה-API של הרכיב.
- `tests/dashboard-tablet-breakpoint.test.tsx`: 1
- `tests/invite-accept.test.ts`: 3. הבדיקה מייבאת את `resolveAuthDestination`, שהוסר.
- `tests/legal.test.tsx`: 2

### בדיקות pytest שדולגו (106)
אלה בעיקר בדיקות live שמשתמשות במשתמשי בדיקה קבועים (`ss.phase3.*` ועוד) שלא קיימים ב-DB המקומי. הבדיקה מדלגת כשה-password grant נכשל. **לכן הכיסוי של בדיקות ה-live הוותיקות נמוך מכפי שהמספר 965 מרמז.** בדיקות ה-live של הצעות המחיר מ-S2 (`test_ss_s2_quote_lockdown_live.py`, ‏18 בדיקות) יוצרות לעצמן משתמשים, ולכן הן כן רצות.

### אין CI
התיקייה `.github/workflows` לא קיימת. אף אחת מהבדיקות לא נאכפת אוטומטית.

---

## 4. Database (אומת מול ה-DB המקומי)

- **מיגרציות:** יש 115 קבצים ב-`supabase/migrations/`, ‏113 מהם הוחלו מקומית. **שתיים לא הוחלו:**
  - `20261023140000_ssp_unit_login`, ‏SSP
  - `20261031193159_drop_unused_customer_notes_activities`, ממתינה לגיבוי ולספירת שורות לפי `tmp/SS_STAGE_E_CHECKLIST.md`

  הרשימה המלאה לפי סדר בנספח א'.
- **מה הוחל בענן:** לא ודאי. לא פניתי לענן. לפי `tmp/SS_STAGE_E_CHECKLIST.md`, לפחות 6 מיגרציות לא הוחלו שם, כולל `20261107120000` (נעילת הכסף) ו-`20261108100000`.
- **טבלאות:** יש 126 טבלאות ב-`public`. הטבלה המלאה בנספח ב'.
- **RLS:** מופעל ב-**כל** 126 הטבלאות. אין טבלה בלי RLS.
- **טבלאות עם RLS ובלי אף policy (6):** `customer_portal_access`, `customer_portal_invite`, `idempotency_keys`, `platform_admin_events`, `portal_login_events`, `quote_public_access`. בפועל רק service_role ניגש אליהן, וזה נראה מכוון.
- **`tenant_id`:** אין בשום טבלה. העמודה המשמשת כ-tenant היא `workspace_id`.
- **טבלאות בלי `workspace_id` (16):**
  - קטלוגים גלובליים: `capabilities`, `features`, `feature_flags`, `permissions`, `plans`, `plan_capabilities`, `plan_features`, `plan_limits`, `roles`, `role_permissions`, `workforce_rule_packs`
  - ישויות שהן עצמן ה-tenant או המשתמש: `workspaces`, `profiles`
  - אירועים ופורטל: `customer_portal_invite`, `portal_login_events`, `platform_admin_events`

  כולן נראות סבירות.
- **הרשאות anon:**
  - ל-`anon` יש הרשאות INSERT/UPDATE/DELETE על **44 טבלאות**. אלה ברירות המחדל של Supabase, והמיגרציה `0024_grants.sql` מבטלת אותן רק לטבלאות שהיו קיימות באותו זמן. RLS הוא המחסום היחיד.
  - **שלוש policies חלות על `public` במקום על `authenticated`:** ‏`quote_items_write`, ‏`quote_sections_write`, ‏`quotes_update`. אלה ה-policies מ-S2 (`20261107120000`). התנאים שלהן דורשים משתמש מחובר, כך שלא נמצאה דליפה, אבל זו חריגה מהקונבנציה.
- **פונקציות SECURITY DEFINER:** ‏49 מהן ניתנות להרצה על ידי `anon`. ל-22 מהן אין בגוף הפונקציה שום בדיקה של זהות הקורא. רובן פונקציות trigger, שאי אפשר לקרוא להן ישירות. החמורות מפורטות בבעיה #1 בפרק 8.

---

## 5. אבטחה

### הרשאה ו-workspace לכל endpoint
המקור: סריקה סטטית של כל הראוטרים הטעונים. הסקריפט נמצא ב-`C:\Users\shimd\AppData\Local\Temp\claude\a2e2cabcfd1c3f04\cb7a4096-1dfb-4084-b67d-e990fe085f31\scratchpad\scan.py`.

| קטגוריה | מספר |
|---|---|
| נתיבים טעונים | 386 (ב-40 ראוטרים) |
| עם `require` / `authorize` / `require_platform_admin` | 339 |
| בדיקת חברות בלבד (`load_authz_context`) | 16. כולם תקינים, חוץ משני ממצאי SSP |
| בלי בדיקת הרשאה מפורשת | 31: ‏20 ציבוריים לפי hash של טוקן, 2 health, 9 נתיבי auth או "המשתמש עצמו". כולם נבדקו ונמצאו תקינים. |
| נתיבים עם `{workspace_id}` | 294 |
| קריאות service client | 205. ל-46 מהן אין סינון `workspace_id`, ומתוכן 38 לא ציבוריות. כולן נבדקו: admin מאחורי `require_platform_admin`, טבלאות גלובליות, או מזהים שנוצרו באותה בקשה. חריג אחד מופיע למטה. |

- **הצעות מחיר:** כל 17 נקודות הקצה שכותבות דרך `_quote_writer` טוענות קודם את ההצעה תחת RLS (מזהה + workspace), ואחר כך מריצות `require`. לכולן יש בדיקת cross-workspace live (אומת: 965 עברו).
- **מגבלת הסריקה:** הסריקה מזהה שבדיקה *קיימת*. היא לא מוודאת שהבדיקה רצה לפני הגישה בכל ענף. את 339 הנתיבים לא בדקתי אחד-אחד.
- **ממצאי SSP (סריקה; לא חלק מ-SITE SECURE אבל חמורים):**
  - `ssp_org.py:400` ‏(`assign_member`): patrol manager יכול לשנות membership של org_admin או של חבר במחלקה אחרת.
  - `ssp_users.py:449-468`: כשהמחלקה null, בדיקת המחלקה מדולגת.
  - הממצא שאומת: `ssp_memberships_write` (בעיה #2).
- **`ssp_users.py:507`:** מעדכן את `profiles` הגלובלי (שם וטלפון). מנהל ב-workspace אחד משנה פרטים של משתמש שמופיע גם ב-workspace אחר. חומרה נמוכה; לא ודאי אם זה מכוון.

### מחירים: מחושבים בשרת או מתקבלים מהלקוח?
**מחושבים בשרת.** אומת בקוד ובבדיקות.
- כל הסכומים, ה-`line_net`, העלות והמרווח מחושבים ב-`pricing.recalculate` ‏(`apps/api/app/pricing.py`) ונכתבים דרך `_persist_totals` ‏(`routers/quotes.py`).
- מודלי הבקשה (`QuoteCreate`, `QuotePatch`, `QuoteItemIn`, `QuoteItemPatch`) מוגדרים עם `extra="forbid"` ואין בהם שדות סכום. `patch_quote` דוחה בנוסף מפתחות של סכום.
- ב-DB (מקומי): מ-`20261107120000`, ל-`authenticated` אין הרשאת כתיבה לעמודות הכסף ומחזור החיים, וה-RPC של Apply זמין ל-service_role בלבד.
- בממשק, הבונה מציג רק סכומים מהשרת (`aa2d2b7`).

**נקודות פתוחות:**
- שורה חופשית (בלי `product_id`) מקבלת כל `unit_price` בלי הרשאת override. זה כנראה מכוון; לא ודאי.
- כשאין `list_price` ב-snapshot של הקטלוג, בדיקת ה-override מדולגת (`quotes.py`, ‏patch_item).
- חישוב כסף מחוץ ל-pricing:
  - `routers/catalog.py:653`, `:655` ו-`catalog_import/engine.py:378`, `:380` עושים `round(float)`. זה לא ROUND_HALF_UP, ויכול לסטות באגורה.
  - `quotes.py` (סכום KPI) ו-`dashboard.py:509`, `:613` סוכמים float, אבל לתצוגה בלבד.

---

## 6. מודולים

| מודול | מצב | הסבר | קבצים |
|---|---|---|---|
| Auth | ✅ | כניסה, הרשמה, אימות מייל, שכחתי סיסמה, הזמנה. **3 בדיקות invite-accept נכשלות** (הן מייבאות פונקציה שהוסרה), ולכן הכיסוי של הפניות invite לא אמין. | `routes/{login,register,verify-email,forgot-password,reset-password,invite/$token}.tsx`, `routers/auth.py`, `routers/workspaces.py` |
| Workspace | 🟡 | יצירה, onboarding בחמישה צעדים, 15 עמודי הגדרות, צוות, תוכנית. אין חיוב (`lib/billing-honesty.ts`: ‏`PAYMENT_PROCESSING_ENABLED = false`). | `routes/onboarding.tsx`, `routes/app/settings/*`, `routers/{workspaces,workspace_settings,team}.py` |
| CRM (לידים) | 🟠 | יש טבלת לידים, פרופיל ותזמון ביקור. **אין pipeline או kanban ללידים**; ה-pipeline היחיד הוא של הצעות המחיר בדשבורד. | `routes/app/leads/*`, `routers/ops_modules.py` (`/leads`) |
| Customers | 🟡 | CRUD, אנשי קשר, ייבוא CSV (עד 2,000), ייצוא. **אין בעלות על לקוח**, ולכן sales (scope ‏owned) לא יכול לפתוח שום כרטיס לקוח ב-CRM. **פורטל הלקוח שבור**: נתיבי ה-web חיים, אבל ה-router לא טעון. | `routes/app/customers/*`, `routers/customers.py`, `routes/portal/*` |
| Quote Builder | ✅ | מחזור החיים המלא עבר בדפדפן כ-owner וכ-sales (`tmp/ss_golden_path_browser.py`). כסף בשרת, נעילת DB, אופציונליות, CCTV Apply, PDF, קישור ציבורי עם חתימה. מגבלה: מנוע רק ל-CCTV (`lib/system-builder.ts:9`). **הנעילה לא הוחלה בענן.** | `routes/app/quotes/*`, `routes/q/$token.tsx`, `routers/{quotes,quote_cpq,public_quotes,system_designs,cctv}.py`, `pricing.py` |
| Projects | 🟡 | פרויקט מהצעה, workspace לפרויקט, פריטים מתוכננים, יצירת נכסים מותקנים. **לא נבדק בדפדפן בסבב הזה** (דורש בחירת אתר). | `routes/app/projects/*`, `routers/ops_modules.py`, `project_from_quote.py` |
| Jobs / Field Ops | 🟡 | רשימת עבודות, עבודת שטח (בדרך, הגיע, התחיל, סיים, צ'קליסט), Today לטכנאי, משימות. "יומן" הוא בפועל רשימת משימות; **אין לוח שיבוץ (dispatch)**. ל-service calls אין עמוד פרטים. | `routes/app/{jobs,today,tasks,service}/*`, `routers/jobs.py`, `job_lifecycle.py` |
| Site File | 🟠 | תיק אתר, נכסים, מסמכים. **רשת/IPAM וטופולוגיה כבויות**: הראוטרים `ipam` ו-`connections` לא טעונים, והפאנלים לא מיובאים. | `routes/app/sites/*`, `components/sites/SiteDossier.tsx`, `routers/{sites,systems,documents}.py` |
| Dashboard | ✅ | לוח בקרה, Requires Attention, pipeline הצעות, Analytics. **6 בדיקות attention-dash3 נכשלות**, כי הבדיקה לא עודכנה לרכיב. | `routes/app/{dashboard,analytics}.tsx`, `components/dashboard/*`, `routers/dashboard.py` |

---

## 7. מסמכי TASK ומעקב

אין קבצי `TASK*`, ‏ROADMAP או BACKLOG. המעקב מפוזר במסמכים הבאים:

| מסמך | מה מסומן כגמור | נכון לפי הקוד? |
|---|---|---|
| `AEGIS_MASTER_AUDIT.md` (2026-10-24, "קנוני") | T0-2b (הסרת IPAM מהנכס), T0-3, T1-1, T1-2, T2-2 (עריכה/מחיקה של אנשי קשר), T2-3, T4-1 | **נכון** ל-T2-2 (`customers.py:692`, `:722`) ול-T0-2b (אין קריאות `/ipam` ב-web). T2-3 לא ודאי. |
| `AEGIS_MASTER_AUDIT.md`: פערים "פתוחים" | SITE-001 (אין GET/PATCH לאחריות), SITE-003 (אין Jobs בתפריט), DATA-004 (נכסים מותקנים לא מחוברים) | **מיושן.** כל השלושה כבר קיימים: `ops_modules.py:1247`, `:1269`; ‏`app-nav.ts:245`; ‏`ops_modules.py:603` |
| `Docs/SITE-SECURE-PRODUCT-COMPLETION-PLAN.md` (2026-09-28) | Project workspace, ‏`/app/jobs`, ‏J1 (Approve→Project→Job→Complete), ‏"אין P0 פתוחים" | J1 ו-Project→Job: **נכון** (`ops_modules.py:386`, `:427`, ‏`jobs.py:314`). "אין P0 פתוחים": **לא נכון**, סותר את `BETA_GATE.md` ואת AEGIS. |
| `Docs/SITE-SECURE-MASTER-PROJECT-BASELINE.md` (2026-09-28) | Customers COMPLETE, הצעות שלבים 1–4, Send/Public/PDF, ‏Revise, ‏CCTV, ‏"PRODUCTION VERIFIED" | הצעות: **נכון**. Customers: **חלקי** (טבלאות notes/activities ריקות, ומיגרציית מחיקה ממתינה). "יומן": **לא נכון** (זו רשימת משימות). "PRODUCTION VERIFIED": **מיושן**, הענן מאחורי הקוד. |
| `Docs/BETA_GATE.md` (2026-09-22) | שום דבר לא מסומן | — |
| `Docs/engineering-audit-2026-10-02/AUDIT_FINDINGS.md` | — | AUDIT-001 (ראוטרים לא טעונים) ו-AUDIT-004 (`founding_technician` בקטלוג) **עדיין פתוחים**. |
| `tmp/SS_STAGE_E_CHECKLIST.md` (2026-11-08) | שום דבר לא מסומן (חסום עד אישור הבעלים) | המיגרציות וה-rollback קיימים ונכונים. |

---

## 8. 10 הבעיות החמורות, לפי סדר חומרה

1. **🔴 קריטי: פונקציות SECURITY DEFINER פתוחות ל-`anon` ול-`authenticated` בלי בדיקת קורא** (אומת ב-DB המקומי).
   - `admin_provision_workspace(p_name, p_plan_key)` יוצרת workspace עם כל תוכנית, כולל 'business'.
   - `seed_workspace_defaults`, `seed_workspace_roles` ו-`seed_workspace_pdf_templates` מקבלות כל `workspace_id`.
   - `next_code` ו-`auth_feature` מקבלות `workspace_id` בלי בדיקת חברות.
   - **הסיבה:** המיגרציות מבטלות הרשאות רק `FROM PUBLIC`, אבל ב-Supabase ל-`anon` ול-`authenticated` יש הרשאת EXECUTE מפורשת. ה-ACL המקומי: `anon=X authenticated=X`. ראו `20260928112000_beta_admin_invitations.sql:57`, ‏`0025_workspace_defaults.sql:102`.
   - **ענן:** לא ודאי, אבל סביר שזהה.
2. **🔴 קריטי (SSP): כל חבר יכול להפוך את עצמו ל-org_admin** (אומת ב-DB).
   - `ssp_memberships_write` מוגדרת `FOR ALL USING auth_is_member(workspace_id)`, ול-`authenticated` יש UPDATE על `product_role`.
   - המקור: `20261019220000`. אף מיגרציה מאוחרת לא מחליפה את ה-policy.
3. **🟠 גבוה: הענן מאחורי הקוד.**
   - לפחות 6 מיגרציות לא הוחלו בענן, כולל נעילת הכסף `20261107120000`. לכן כל פרצות ה-PostgREST שנסגרו מקומית עדיין פתוחות בכל סביבת ענן.
   - בנוסף, ניקוי משתמשי הבדיקה שנוצרו בעבר בענן עדיין ממתין לבעלים.
4. **🟠 גבוה: פורטל הלקוח שבור.** הנתיבים `routes/portal/*` חיים ונגישים, וה-API client קורא ל-`/api/v1/portal/*`. אבל `customer_portal.py` לא טעון ב-`main.py`, ולכן הקריאות מחזירות 404. ההגדרה היא Phase 2, אבל ה-UI חשוף.
5. **🟠 גבוה: אין CI, ושערי האיכות אדומים.**
   - typecheck ‏(20), ‏eslint ‏(15, כולל plugin של react-hooks שלא נטען), ‏ruff ‏(366), ‏vitest ‏(13 כשלים ישנים).
   - שום דבר לא נאכף לפני merge.
6. **🟠 גבוה: בדיקות מיושנות מסתירות רגרסיות.**
   - `invite-accept.test.ts` מייבא פונקציה שהוסרה. `attention-dash3.test.tsx` בודק API שהשתנה.
   - 106 בדיקות live דולגו, כי משתמשי הבדיקה הקבועים לא קיימים.
   - **בפועל אין כיסוי** להפניות invite, לתור Attention ולחלק גדול מבדיקות ה-live הוותיקות (tenant isolation, entitlements, ‏quota).
7. **🟡 בינוני (SSP, סריקה): הסלמת הרשאות של patrol manager.** ‏`ssp_org.py:400` ‏(assign_member) ו-`ssp_users.py:449-468` (כשהמחלקה null).
8. **🟡 בינוני: ללקוחות אין בעלות.**
   - sales (scope ‏owned ב-`packages/authz/catalog.json`) לא יכול לפתוח אף כרטיס לקוח ב-CRM, גם לא כזה שיצר.
   - בהצעות זה עקוף בעזרת `customer_summary` (`644e2de`). ב-CRM עצמו זו שאלת מוצר פתוחה.
9. **🟡 בינוני: הגנת עומק ב-DB.**
   - ל-`anon` יש הרשאות כתיבה ל-44 טבלאות, ו-RLS הוא המחסום היחיד.
   - שלוש ה-policies של S2 חלות על `public` במקום על `authenticated`.
   - `founding_technician` עדיין בקטלוג ההרשאות (AUDIT-004, ‏SEC-004).
10. **🟡 בינוני: פערי מוצר מול "פיילוט מלא".**
    - אין לוח שיבוץ או יומן אמיתי.
    - אין pipeline ללידים.
    - אין עמוד פרטים ל-service call.
    - רשת וטופולוגיה בתיק האתר כבויות.
    - חישוב כסף ב-float בתמחור מרוכז ובייבוא קטלוג (`catalog.py:653`, ‏`catalog_import/engine.py:378`).
    - 26 מקרים של `try/except: pass` ב-API.

---

## נספח א': כל המיגרציות לפי הסדר (115 קבצים)

המקור: `supabase/migrations/` מול `supabase_migrations.schema_migrations` ב-DB המקומי.

| # | קובץ | הוחל מקומית |
|---|---|---|
| 1 | `0001_extensions.sql` | כן |
| 2 | `0002_updated_at.sql` | כן |
| 3 | `0003_profiles.sql` | כן |
| 4 | `0004_workspaces.sql` | כן |
| 5 | `0005_rbac.sql` | כן |
| 6 | `0006_memberships.sql` | כן |
| 7 | `0007_auth_helpers.sql` | כן |
| 8 | `0008_features_plans.sql` | כן |
| 9 | `0009_assignments.sql` | כן |
| 10 | `0010_customers.sql` | כן |
| 11 | `0011_sites.sql` | כן |
| 12 | `0012_systems.sql` | כן |
| 13 | `0013_documents.sql` | כן |
| 14 | `0014_leads.sql` | כן |
| 15 | `0015_catalog.sql` | כן |
| 16 | `0016_quotes.sql` | כן |
| 17 | `0017_projects_jobs.sql` | כן |
| 18 | `0018_service.sql` | כן |
| 19 | `0019_warranties.sql` | כן |
| 20 | `0020_tasks_ops.sql` | כן |
| 21 | `0021_notifications.sql` | כן |
| 22 | `0022_audit.sql` | כן |
| 23 | `0023_storage.sql` | כן |
| 24 | `0024_grants.sql` | כן |
| 25 | `0025_workspace_defaults.sql` | כן |
| 26 | `0026_realtime.sql` | כן |
| 27 | `0027_invitations_rpc.sql` | כן |
| 28 | `0028_entitlements_rpc.sql` | כן |
| 29 | `0029_documents_update.sql` | כן |
| 30 | `0030_foundation_directory_audit.sql` | כן |
| 31 | `0031_plan_storage_limits.sql` | כן |
| 32 | `0032_projects_source_quote_unique.sql` | כן |
| 33 | `0033_leads_opportunity.sql` | כן |
| 34 | `0034_cpq_phase2.sql` | כן |
| 35 | `0035_workspace_business_type.sql` | כן |
| 36 | `0036_beta_feedback.sql` | כן |
| 37 | `0037_backfill_document_byte_size.sql` | כן |
| 38 | `0038_plan_quota_limits.sql` | כן |
| 39 | `0039_invite_accept_enforcement.sql` | כן |
| 40 | `0040_hard_quota_enforcement.sql` | כן |
| 41 | `0041_entitlements_effective_overrides.sql` | כן |
| 42 | `0042_platform_admin_bootstrap_hygiene.sql` | כן |
| 43 | `0043_settings_rbac_pdf_templates.sql` | כן |
| 44 | `0044_company_document_system.sql` | כן |
| 45 | `0045_pdf_template_archived.sql` | כן |
| 46 | `0046_auth_contract_technician_scope.sql` | כן |
| 47 | `0047_technician_commercial_isolation.sql` | כן |
| 48 | `0048_v3_plan_labels_free_pro_enterprise.sql` | כן |
| 49 | `0049_technician_seed_grants_nonempty.sql` | כן |
| 50 | `0050_v3_capabilities_registry.sql` | כן |
| 51 | `0051_job_dispatch_lifecycle.sql` | כן |
| 52 | `0052_assignment_history.sql` | כן |
| 53 | `0053_service_call_numbers.sql` | כן |
| 54 | `0054_system_designs.sql` | כן |
| 55 | `0055_system_design_apply_owned.sql` | כן |
| 56 | `0056_system_design_equipment_intent.sql` | כן |
| 57 | `20260816125639_quote_cpq_revenue_loop.sql` | כן |
| 58 | `20260816131758_quote_template_lines.sql` | כן |
| 59 | `20260826220000_catalog_hierarchy_product_fields.sql` | כן |
| 60 | `20260905155735_catalog_import_commit_rpc.sql` | כן |
| 61 | `20260905162000_restore_catalog_hierarchy_seed_no_products.sql` | כן |
| 62 | `20260905163318_catalog_import_commit_remove_test_force_fail.sql` | כן |
| 63 | `20260908200000_profiles_recognition_badges.sql` | כן |
| 64 | `20260908205910_platform_admin_beta_participants_events.sql` | כן |
| 65 | `20260908210000_retire_founding_technician_role.sql` | כן |
| 66 | `20260924191046_saas_phase1_member_technician_quotas.sql` | כן |
| 67 | `20260926213103_customer_portal_foundation.sql` | כן |
| 68 | `20260927105100_warranties_installed_equipment.sql` | כן |
| 69 | `20260927131000_warranty_policy.sql` | כן |
| 70 | `20260927131100_warranty_policy_columns.sql` | כן |
| 71 | `20260927205033_quote_items_cost_column_lockdown.sql` | כן |
| 72 | `20260927210000_quote_items_cost_column_lockdown_v2.sql` | כן |
| 73 | `20260927220000_quote_items_is_optional.sql` | כן |
| 74 | `20260927220100_quote_items_cost_visibility_note.sql` | כן |
| 75 | `20260928093515_projects_source_quote_version.sql` | כן |
| 76 | `20260928094533_project_planned_items.sql` | כן |
| 77 | `20260928095836_equipment_asset_foundation.sql` | כן |
| 78 | `20260928103052_site_network_ipam_foundation.sql` | כן |
| 79 | `20260928104509_asset_connections_topology.sql` | כן |
| 80 | `20260928110328_asset_lifecycle_inf1d_enum.sql` | כן |
| 81 | `20260928110329_asset_lifecycle_inf1d_service_docs.sql` | כן |
| 82 | `20260928112000_beta_admin_invitations.sql` | כן |
| 83 | `20260928113000_beta_admin_invite_occupancy_public_peek.sql` | כן |
| 84 | `20260928114500_beta_admin2_team_invitations_rls.sql` | כן |
| 85 | `20260930194000_archive_admin_views.sql` | כן |
| 86 | `20260930210000_profile_user_archive.sql` | כן |
| 87 | `20261003012314_catalog_general_accessories_category.sql` | כן |
| 88 | `20261006120000_fleetmaster.sql` | כן |
| 89 | `20261019140000_ssp_digital_forms_v1.sql` | כן |
| 90 | `20261019160000_ssp_forms_hardening.sql` | כן |
| 91 | `20261019180000_atomic_solo_workspace_product_defaults.sql` | כן |
| 92 | `20261019220000_ssp_organization_core.sql` | כן |
| 93 | `20261019230000_ssp_operations_core.sql` | כן |
| 94 | `20261019240000_ssp_ops_workflow_c2.sql` | כן |
| 95 | `20261020120000_ssp_sites_and_form_assignments.sql` | כן |
| 96 | `20261020140000_ssp_site_activation.sql` | כן |
| 97 | `20261020160000_ssp_site_user_join.sql` | כן |
| 98 | `20261020180000_workforce_intelligence_foundation.sql` | כן |
| 99 | `20261020190000_workforce_member_role_and_provision.sql` | כן |
| 100 | `20261020200000_workforce_rls_least_privilege.sql` | כן |
| 101 | `20261020210000_workforce_shifts_stage3.sql` | כן |
| 102 | `20261021120000_workforce_stage4b_staffing.sql` | כן |
| 103 | `20261021150000_workforce_l1_rule_catalog.sql` | כן |
| 104 | `20261021180000_workforce_l2_shifts_api_only.sql` | כן |
| 105 | `20261021190000_workforce_portal_own_shifts.sql` | כן |
| 106 | `20261022100000_ssp_memberships_rls_no_recursion.sql` | כן |
| 107 | `20261022120000_ssp_sites_office_code.sql` | כן |
| 108 | `20261023140000_ssp_unit_login.sql` | **לא** |
| 109 | `20261031112121_quote_contact_search_indexes.sql` | כן |
| 110 | `20261031120000_warranty_public_token_hash.sql` | כן |
| 111 | `20261031121000_quote_public_access_required_ttl.sql` | כן |
| 112 | `20261031122000_storage_rls_documents_signed_only.sql` | כן |
| 113 | `20261031193159_drop_unused_customer_notes_activities.sql` | **לא** |
| 114 | `20261107120000_ss_quote_money_lockdown.sql` | כן |
| 115 | `20261108100000_ss_apply_optional_lines.sql` | כן |

## נספח ב': טבלאות ב-public (126)

"מדיניות" = מספר ה-policies ב-`pg_policies`. מצב ה-DB המקומי; הענן לא נבדק.

| טבלה | RLS | FORCE | workspace_id | tenant_id | מדיניות |
|---|---|---|---|---|---|
| `accounting_documents` | כן | כן | כן | לא | 2 |
| `after_action_reports` | כן | כן | כן | לא | 2 |
| `asset_connections` | כן | כן | כן | לא | 4 |
| `assignments` | כן | כן | כן | לא | 4 |
| `audit_logs` | כן | כן | כן | לא | 1 |
| `beta_participants` | כן | לא | כן | לא | 1 |
| `capabilities` | כן | כן | לא | לא | 1 |
| `checklist_template_items` | כן | כן | כן | לא | 2 |
| `checklist_templates` | כן | כן | כן | לא | 2 |
| `customer_contacts` | כן | כן | כן | לא | 4 |
| `customer_portal_access` | כן | כן | כן | לא | 0 |
| `customer_portal_invite` | כן | כן | לא | לא | 0 |
| `customers` | כן | כן | כן | לא | 4 |
| `department_memberships` | כן | כן | כן | לא | 2 |
| `departments` | כן | כן | כן | לא | 4 |
| `documents` | כן | כן | כן | לא | 4 |
| `equipment` | כן | כן | כן | לא | 4 |
| `feature_flags` | כן | כן | לא | לא | 1 |
| `features` | כן | כן | לא | לא | 1 |
| `feedback_reports` | כן | כן | כן | לא | 3 |
| `fleet_assignments` | כן | כן | כן | לא | 2 |
| `fleet_maintenance` | כן | כן | כן | לא | 2 |
| `fleet_mileage_logs` | כן | כן | כן | לא | 2 |
| `fleet_schedules` | כן | כן | כן | לא | 2 |
| `fleet_vehicle_equipment` | כן | כן | כן | לא | 2 |
| `fleet_vehicles` | כן | כן | כן | לא | 4 |
| `generated_documents` | כן | כן | כן | לא | 2 |
| `idempotency_keys` | כן | כן | כן | לא | 0 |
| `invitations` | כן | כן | כן | לא | 1 |
| `job_checklist_items` | כן | כן | כן | לא | 2 |
| `jobs` | כן | כן | כן | לא | 4 |
| `knowledge_articles` | כן | כן | כן | לא | 2 |
| `leads` | כן | כן | כן | לא | 4 |
| `notification_preferences` | כן | כן | כן | לא | 2 |
| `notifications` | כן | כן | כן | לא | 3 |
| `pdf_document_templates` | כן | כן | כן | לא | 2 |
| `permissions` | כן | כן | לא | לא | 1 |
| `plan_capabilities` | כן | כן | לא | לא | 1 |
| `plan_features` | כן | כן | לא | לא | 1 |
| `plan_limits` | כן | כן | לא | לא | 1 |
| `plans` | כן | כן | לא | לא | 1 |
| `platform_admin_events` | כן | לא | לא | לא | 0 |
| `portal_login_events` | כן | כן | לא | לא | 0 |
| `product_categories` | כן | כן | כן | לא | 2 |
| `products` | כן | כן | כן | לא | 2 |
| `profiles` | כן | כן | לא | לא | 3 |
| `project_planned_items` | כן | כן | כן | לא | 4 |
| `projects` | כן | כן | כן | לא | 4 |
| `quote_events` | כן | כן | כן | לא | 2 |
| `quote_items` | כן | כן | כן | לא | 2 |
| `quote_package_items` | כן | כן | כן | לא | 2 |
| `quote_packages` | כן | כן | כן | לא | 2 |
| `quote_public_access` | כן | כן | כן | לא | 0 |
| `quote_sections` | כן | כן | כן | לא | 2 |
| `quote_template_items` | כן | כן | כן | לא | 2 |
| `quote_templates` | כן | כן | כן | לא | 2 |
| `quote_versions` | כן | כן | כן | לא | 2 |
| `quotes` | כן | כן | כן | לא | 4 |
| `role_permissions` | כן | כן | לא | לא | 1 |
| `roles` | כן | כן | לא | לא | 1 |
| `service_calls` | כן | כן | כן | לא | 4 |
| `service_contracts` | כן | כן | כן | לא | 2 |
| `site_ip_addresses` | כן | כן | כן | לא | 4 |
| `site_networks` | כן | כן | כן | לא | 4 |
| `site_readiness` | כן | כן | כן | לא | 2 |
| `site_timeline_events` | כן | כן | כן | לא | 2 |
| `site_vlans` | כן | כן | כן | לא | 4 |
| `site_zones` | כן | כן | כן | לא | 4 |
| `sites` | כן | כן | כן | לא | 4 |
| `ssp_checkpoint_scans` | כן | כן | כן | לא | 2 |
| `ssp_checkpoints` | כן | כן | כן | לא | 2 |
| `ssp_companies` | כן | כן | כן | לא | 3 |
| `ssp_departments` | כן | כן | כן | לא | 2 |
| `ssp_event_actions` | כן | כן | כן | לא | 2 |
| `ssp_events` | כן | כן | כן | לא | 2 |
| `ssp_form_assignments` | כן | כן | כן | לא | 3 |
| `ssp_form_distribution_targets` | כן | כן | כן | לא | 2 |
| `ssp_form_distributions` | כן | כן | כן | לא | 2 |
| `ssp_form_site_assignment_targets` | כן | כן | כן | לא | 2 |
| `ssp_form_site_assignments` | כן | כן | כן | לא | 2 |
| `ssp_form_submissions` | כן | כן | כן | לא | 1 |
| `ssp_form_versions` | כן | כן | כן | לא | 3 |
| `ssp_forms` | כן | כן | כן | לא | 3 |
| `ssp_memberships` | כן | כן | כן | לא | 2 |
| `ssp_org_units` | כן | כן | כן | לא | 2 |
| `ssp_patrol_run_assignees` | כן | כן | כן | לא | 2 |
| `ssp_patrol_runs` | כן | כן | כן | לא | 2 |
| `ssp_patrol_stops` | כן | כן | כן | לא | 2 |
| `ssp_patrols` | כן | כן | כן | לא | 2 |
| `ssp_site_activation_codes` | כן | כן | כן | לא | 1 |
| `ssp_site_device_sessions` | כן | כן | כן | לא | 1 |
| `ssp_site_devices` | כן | כן | כן | לא | 1 |
| `ssp_site_enrollments` | כן | כן | כן | לא | 1 |
| `ssp_site_members` | כן | כן | כן | לא | 2 |
| `ssp_sites` | כן | כן | כן | לא | 2 |
| `ssp_unit_login_codes` | כן | כן | כן | לא | 1 |
| `ssp_unit_sessions` | כן | כן | כן | לא | 1 |
| `subscriptions` | כן | כן | כן | לא | 1 |
| `system_design_components` | כן | כן | כן | לא | 2 |
| `system_designs` | כן | כן | כן | לא | 4 |
| `systems` | כן | כן | כן | לא | 4 |
| `tasks` | כן | כן | כן | לא | 4 |
| `warranties` | כן | כן | כן | לא | 4 |
| `workforce_coverage_requirements` | כן | כן | כן | לא | 4 |
| `workforce_employees` | כן | כן | כן | לא | 1 |
| `workforce_employment_profiles` | כן | כן | כן | לא | 3 |
| `workforce_legal_instruments` | כן | כן | כן | לא | 3 |
| `workforce_memberships` | כן | כן | כן | לא | 1 |
| `workforce_position_requirements` | כן | כן | כן | לא | 4 |
| `workforce_positions` | כן | כן | כן | לא | 4 |
| `workforce_qualifications` | כן | כן | כן | לא | 4 |
| `workforce_regions` | כן | כן | כן | לא | 4 |
| `workforce_rule_packs` | כן | כן | לא | לא | 1 |
| `workforce_rules` | כן | כן | כן | לא | 3 |
| `workforce_schedule_policies` | כן | כן | כן | לא | 4 |
| `workforce_shift_slots` | כן | כן | כן | לא | 4 |
| `workforce_shifts` | כן | כן | כן | לא | 4 |
| `workforce_sites` | כן | כן | כן | לא | 4 |
| `workforce_time_off` | כן | כן | כן | לא | 4 |
| `workforce_workspace_packs` | כן | כן | כן | לא | 3 |
| `workspace_counters` | כן | כן | כן | לא | 1 |
| `workspace_feature_overrides` | כן | כן | כן | לא | 1 |
| `workspace_memberships` | כן | כן | כן | לא | 4 |
| `workspace_roles` | כן | כן | כן | לא | 2 |
| `workspace_settings` | כן | כן | כן | לא | 2 |
| `workspaces` | כן | כן | לא | לא | 2 |

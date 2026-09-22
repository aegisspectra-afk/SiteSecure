# SITE SECURE — מסמך מוצר אחיד מלא

**מטרה:** מסמך **אחד בלבד** — סטטוס, איך זה עובד, כל המסכים, כל ה-API, כל הטבלאות והעמודות, כל ההרשאות, כל הקבצים.
**תאריך:** 2026-09-13
**גרסת Web חיה:** `0.1.6-beta`
**מקור אמת:** הקוד החי בריפו
**פריסה:** Web → Vercel · API → Render · DB/Auth/Storage → Supabase

אין מסמך משני. הכל כאן.

רענון המלאי האוטומטי מתוך הקוד (מייצר וממזג חזרה לקובץ זה):
```bash
python apps/api/scripts/_generate_full_inventory_md.py
```

> לא נכלל במסמך: גוף כל פונקציה, `node_modules`, build artifacts, `_backup_vault`, סודות `.env`.

---

# חלק א׳ — מה המוצר ומה הסטטוס

## א.0 לקרוא ב־30 שניות

SITE SECURE היא **מערכת הפעלה לחברות אבטחה** (CCTV / אזעקה / בקרת כניסה):

```
לקוח → ליד → הצעת מחיר → אישור → פרויקט → אתר → עבודה/שירות → אחריות
```

| שכבה | מצב |
|------|------|
| ליבה מסחרית (Auth, CRM, הצעות, קטלוג, אתרים) | **חזקה / חיה** |
| תפעול שטח (פרויקטים, jobs, הקצאות, שירות) | **קיים אבל דק** |
| סיורים / ברקודים / סידורים / מפות | **לא קיים כמוצר** — רק תיעוד V3 |
| מובייל מקורי / Offline מלא / Stripe | **לא קיים** |

## א.1 מה שביקשת במפורש

| נושא | מצב | מה קיים | מתי (V3) |
|------|-----|---------|----------|
| סידורי עבודה | **לא קיים** | מפתחות `workforce.*` בלבד | Phase 4 |
| מפות | **לא קיים** | אפס קוד מפות | עם Field/Patrol |
| הקצאת משימות / שיגור | **חלקי** | `assign` על job → `assignments` | Phase 2 העמקה |
| סיורים + ברקודים | **רק בתיעוד** | capability `inspections.patrol_checkpoints` | Phase 3 |

## א.2 אגדת סטטוסים

| סטטוס | משמעות |
|--------|--------|
| **עובד** | API + Web + DB — זרימה לשימוש |
| **חלקי** | סכמה/UI בסיסי; חסר עומק או שימוש |
| **רק בתיעוד** | מפרט/capability — בלי מסכים/טבלאות מוצר |
| **לא קיים** | אין מימוש משמעותי |

## א.3 מפת כל המודולים

### ליבה מסחרית — חזקה

| דומיין | סטטוס | מה עובד | מה חסר |
|--------|--------|---------|--------|
| Auth / Workspaces / RBAC / הזמנות | עובד | התחברות, סשן, סביבה, הזמנות, הרשאות, מכסות | פעמון התראות; Stripe |
| CRM | עובד | לקוחות, אנשי קשר, לידים | 360 עמוק יותר |
| הצעות / CPQ / קטלוג / PDF | עובד | בנייה, שליחה, פורטל, אישור, PDF, ייבוא | תשלומים |
| תיקי אתר / מסמכים / תמונות | עובד | CRUD, העלאות, תיק אתר | מערכות/ציוד כמעט לא בשימוש |
| CCTV recommend | עובד | מנוע שרת + שילוב בהצעה | — |
| Admin / Beta / Feedback | עובד | פלטפורמה מלאה | — |
| לוח בקרה / היום | עובד | משרד + שטח | בלי מפה |

### תפעול — דק

| דומיין | סטטוס | מה עובד | מה חסר |
|--------|--------|---------|--------|
| מערכות / ציוד | חלקי | API + סכמה | שימוש חי נמוך |
| פרויקטים / jobs / צ׳קליסט | חלקי | CRUD, start/complete, assign | לוח שיגור, חתימה, FSM מלא |
| שירות / אחריות | חלקי | רשימה+יצירה | חוזי שירות = טבלה בלבד |
| משימות / «יומן» | חלקי | רשימה ב־`/app/tasks` | אין לוח שנה אמיתי |
| התראות | חלקי | טבלאות + העדפות | אין פעמון/API רשימה |
| בילינג | חלקי | תוכניות+מכסות | אין Stripe |

### עתיד V3 — לא בנוי

| דומיין | סטטוס | שלב |
|--------|--------|------|
| סידורים / משמרות | לא קיים | Phase 4 |
| מפות | לא קיים | — |
| סיורים / ברקודים | רק בתיעוד | Phase 3 |
| Inspections / Findings / CA | רק בתיעוד | Phase 3 |
| Mobile / Offline | רק בתיעוד | — |
| מלאי | לא קיים | V2 Phase 11 |
| SITE AI | תיעוד/דגל | Phase 5 |
| Twin / Cyber | נדחה | מחוץ ל־V3 הקרוב |

## א.4 סדר V3 הנעול

| Phase | מיקוד |
|-------|--------|
| 1 | Capabilities, Person, Evidence, Events (חוזים) |
| 2 | Field Service עומק |
| **3** | **Inspections + Patrol (סיורים/ברקודים)** |
| **4** | **Workforce (סידורים)** |
| 5 | SITE AI |

---

# חלק ב׳ — איך הכל עובד (ארכיטקטורה)

## ב.1 סטאק

```
Browser (RTL SPA)
   │  Supabase Auth (JWT)
   │  VITE_API_URL
   ▼
FastAPI (apps/api)
   │  authorize() + catalog
   │  PostgREST כ־user JWT (RLS)
   ▼
Supabase Postgres + Storage + Auth
```

| שכבה | טכנולוגיה |
|------|-----------|
| Web | Vite · React 19 · TanStack Router/Query · Supabase JS |
| API | FastAPI · Python 3.12 · httpx · fpdf2 |
| DB | Supabase Postgres + RLS |
| Auth | Supabase Auth (email/password) |
| Storage | 5 buckets פרטיים |
| Authz משותף | `packages/authz/catalog.json` |

## ב.2 מונורפו — מה יש בתיקיות

### `apps/`

| נתיב | תפקיד |
|------|--------|
| `apps/web` | SPA — הקליינט היחיד החי |
| `apps/api` | FastAPI — לוגיקה עסקית, PDF, הרשאות, חתימות storage |

**אין `apps/mobile`.**

### `packages/`

| נתיב | תפקיד |
|------|--------|
| `packages/authz` | קטלוג הרשאות/תוכניות משותף |
| `packages/api-client` | לקוח HTTP מטיפוס ל־API |
| `packages/design-system` | טוקנים |
| `packages/ui` | רכיבי UI |
| `packages/types` | טיפוסי DB (stub / generated) |

## ב.3 זרימת התחברות (Auth → Session → Workspace → Authorize)

```
1. משתמש מתחבר ב־/login (Supabase Auth) → JWT בדפדפן
2. SessionProvider קורא GET /api/v1/auth/session
3. API מחזיר: פרופיל + memberships + features + permissions
4. אם אין workspace → /onboarding (יצירת סביבה)
5. אם יש → /app (Today או Dashboard לפי תפקיד)
6. כל קריאת API: Bearer JWT + workspace_id בנתיב
7. load_authz_context → authorize(action) → PostgREST תחת RLS
```

| שלב | קבצים מרכזיים |
|-----|----------------|
| לקוח Supabase | `apps/web/src/lib/supabase.ts` |
| סשן | `apps/web/src/lib/session.tsx` |
| ניתוב אחרי Auth | `apps/web/src/lib/auth-routes.ts` |
| שערי `/app` | `apps/web/src/routes/app/route.tsx` |
| Session API | `apps/api/app/routers/auth.py` |
| JWT / deps | `apps/api/app/deps.py` |
| מנוע הרשאות | `apps/api/app/authz/guard.py` + `engine` |
| קטלוג | `packages/authz/catalog.json` |
| הקצאות שטח | טבלת `assignments` + scope ב־authz |
| Platform admin | `profiles.is_platform_admin` + `/admin` |

**סביבה פעילה:** בדרך כלל `memberships[0]` (עם העדפת `last_workspace_id`) — אין switcher מלא.

**כלל אבטחה:** הסתרה בניווט (`can()`) היא UX בלבד. האכיפה האמיתית = `authorize()` + RLS.

---

# חלק ג׳ — כל המסכים (Web Routes)

מקור: `apps/web/src/routeTree.gen.ts` · ניווט: `apps/web/src/lib/app-nav.ts`

## ג.1 ציבורי / Auth

| נתיב | תפקיד |
|------|--------|
| `/` | דף שיווקי / Public Home |
| `/login` | התחברות |
| `/register` | הרשמה |
| `/forgot-password` | איפוס סיסמה — בקשה |
| `/reset-password` | איפוס סיסמה — הגדרה |
| `/verify-email` | אימות אימייל |
| `/onboarding` | יצירת workspace ראשון |
| `/invite/$token` | קבלת הזמנה |
| `/q/$token` | קיצור להצעה ציבורית |
| `/public/quotes/$token` | פורטל לקוח — צפייה/אישור/דחייה |
| `/legal/` · `/legal/$slug` | מסמכים משפטיים |
| `/dev/ui` | גלריית UI לפיתוח (לא מוצר) |

## ג.2 אפליקציה (`/app`)

| נתיב | תפקיד |
|------|--------|
| `/app` | Shell + אימות |
| `/app/` | הפניה ל־Today או Dashboard |
| `/app/dashboard` | לוח בקרה משרדי |
| `/app/today` | לוח «היום» לשטח |
| `/app/customers/` · `/$customerId` | לקוחות |
| `/app/leads/` · `/$leadId` | לידים |
| `/app/quotes/` · `/new` · `/$quoteId` · `/preview` | הצעות + CPQ |
| `/app/catalog` | קטלוג מוצרים |
| `/app/projects/` · `/$projectId` | פרויקטים |
| `/app/jobs/$jobId` | עבודת שטח |
| `/app/sites/` · `/$siteId` | תיקי אתר |
| `/app/service/` | קריאות שירות |
| `/app/warranties/` | אחריות |
| `/app/tasks/` | משימות («יומן ומשימות») |
| `/app/knowledge/` | מאמרי ידע |
| `/app/settings/*` | הגדרות (ראה למטה) |

### הגדרות

| נתיב | תפקיד |
|------|--------|
| `/app/settings/` | מרכז הגדרות |
| `…/appearance` | מראה |
| `…/company` | פרופיל חברה / לוגו |
| `…/users` | צוות + שימוש |
| `…/roles` | תפקידים והרשאות |
| `…/security` | מרכז אבטחה |
| `…/audit` | יומן ביקורת |
| `…/notifications` | העדפות התראות |
| `…/numbering` | מספור מסמכים |
| `…/quotes` | ברירות מחדל להצעות |
| `…/sites` | העדפות אתרים |
| `…/pdf-templates` | תבניות PDF |
| `…/system` | מידע מערכת / תוכנית |

## ג.3 Platform Admin (`/admin`)

| נתיב | תפקיד |
|------|--------|
| `/admin/` | סיכום |
| `/admin/organizations` | ארגונים/סביבות |
| `/admin/users` | משתמשים |
| `/admin/badges` | תגיות הכרה |
| `/admin/beta` | משתתפי בטא |
| `/admin/feedback` | פידבק |
| `/admin/flags` | Feature flags |
| `/admin/audit` | ביקורת פלטפורמה |

## ג.4 ניווט שמוצג למשתמש

**Desktop:** סקירה · מכירות · תפעול · הגדרות  
**Mobile bottom:** בית · לקוחות · עבודה · משימות · עוד  

**לא בניווט:** סיורים, מפות, סידורים, מלאי, בילינג, AI, מובייל.

---

# חלק ד׳ — כל ה־API

הרכבה: `apps/api/app/main.py`  
רוב הנתיבים: `/api/v1/workspaces/{workspace_id}/…`

## ד.1 בריאות / Auth / Workspaces

| Router | נתיבים עיקריים |
|--------|----------------|
| `health` | `GET /health`, `GET /api/v1/health` |
| `auth` | `GET /auth/session`, `PATCH /me`, `GET /authz/catalog` |
| `workspaces` | `POST/GET/PATCH /workspaces…`, הזמנות peek/accept |
| `workspace_settings` | settings, company-profile+logo, roles, pdf-templates |
| `team` | members, usage, audit, security |

## ד.2 CRM / אתרים / מסמכים

| Router | נתיבים |
|--------|--------|
| `customers` | customers CRUD + contacts |
| `sites` | sites CRUD |
| `systems` | systems + equipment |
| `documents` | list, uploads, complete, signed url |

## ד.3 תפעול

| Router | נתיבים |
|--------|--------|
| `jobs` | jobs CRUD, start, complete, **assign**, checklist |
| `ops_modules` | leads, projects (+from-quote), service-calls, warranties, tasks, knowledge |
| `dashboard` | `GET /dashboard` |
| `search` | `GET /search` |

## ד.4 הצעות / קטלוג / CCTV

| Router | נתיבים |
|--------|--------|
| `quotes` | CRUD, items, send, revise, share, duplicate, preview… |
| `quote_cpq` | sections, packages, templates, margin, versions, events, pdf/document |
| `public_quotes` | `GET/approve/reject/pdf` לפי token |
| `catalog` + `catalog_import` | מוצרים, קטגוריות, תבניות, ייבוא |
| `cctv` | `POST /cctv/recommend` |

## ד.5 פלטפורמה

| Router | נתיבים |
|--------|--------|
| `admin` | orgs, users, badges, beta, audit, feedback, flags |
| `feedback` | feedback + feature-flags ללקוח |
| `telemetry` | `POST /client-error` |

## ד.6 מה שאין ב־API

אין routers ל: **patrol**, **shifts/roster**, **maps**, **notifications inbox**, **Stripe**, **הנפקת חשבוניות**.

---

# חלק ה׳ — מסד נתונים (טבלאות לפי דומיין)

מקור: `supabase/migrations/`

### זהות / סביבה / RBAC
`profiles` · `workspaces` · `workspace_counters` · `workspace_settings` · `roles` · `permissions` · `role_permissions` · `workspace_memberships` · `invitations` · `workspace_roles` · `assignments`

### תוכניות / יכולות
`features` · `plans` · `plan_features` · `plan_limits` · `subscriptions` · `workspace_feature_overrides` · `capabilities` · `plan_capabilities`

### CRM
`customers` · `customer_contacts` · `customer_notes` · `customer_activities` · `leads`

### אתרים / נכסים / ראיות
`sites` · `site_zones` · `site_timeline_events` · `systems` · `equipment` · `documents` · `site_readiness` · `after_action_reports`

### קטלוג / הצעות / CPQ
`product_categories` · `products` · `quote_templates` · `quote_template_items` · `quotes` · `quote_items` · `quote_events` · `quote_versions` · `quote_public_access` · `quote_sections` · `quote_packages` · `quote_package_items` · `pdf_document_templates` · `generated_documents` · `accounting_documents`

### תפעול שטח
`projects` · `jobs` · `service_calls` · `service_contracts` · `warranties` · `tasks` · `checklist_templates` · `checklist_template_items` · `job_checklist_items` · `knowledge_articles`

### התראות / ביקורת / פלטפורמה
`notifications` · `notification_preferences` · `audit_logs` · `idempotency_keys` · `feedback_reports` · `feature_flags` · `platform_admin_events` · `beta_participants`

### טבלאות עם מוצר דק / בלי UI מלא
`service_contracts` · `notifications` (בלי פעמון) · `accounting_documents` · `site_zones` / `site_timeline_events` · `site_readiness` · `after_action_reports` · `customer_notes` / `customer_activities` (שימוש מוגבל)

---

# חלק ו׳ — Storage

מיגרציה: `0023_storage.sql` — כל ה־buckets **פרטיים**, נתיב `{workspace_id}/…`

| Bucket | שימוש |
|--------|--------|
| `photos` | תמונות שטח |
| `documents` | מסמכים |
| `signatures` | חתימות (גם אישור הצעה) |
| `branding` | לוגו חברה |
| `exports` | ייצוא PDF |

**פרוטוקול העלאה:** כוונת upload חתומה → PUT מהלקוח → `POST …/documents/{id}/complete`.

---

# חלק ז׳ — זרימות קצה־אל־קצה שעובדות

| זרימה | איך זה רץ |
|-------|-----------|
| **הצעת מחיר מלאה** | בניית הצעה → שליחה/שיתוף → `/q/$token` → פורטל לקוח → אישור/דחייה (+חתימה) → PDF |
| **עבודת שטח** | Today/Dashboard → job → start/complete → checklist → assign לטכנאי |
| **הזמנת משתמש** | הגדרות צוות → הזמנה → `/invite/$token` → accept |
| **מסמכי אתר** | תיק אתר → upload → complete → URL חתום |
| **ליד → הצעה → פרויקט** | ליד → הצעה → `POST /projects/from-quote` |
| **Onboarding** | הרשמה → session → יצירת workspace |
| **CCTV** | `POST /cctv/recommend` → שורות בהצעה |
| **Platform admin** | `/admin/*` |

**לא E2E מוצר מלא:** חוזי שירות, פעמון התראות, חשבוניות, לוח שיגור, סיורים, סידורים, מפות.

---

# חלק ח׳ — פריסה וסביבה

## ח.1 משטחי פריסה

| משטח | מה רץ | קונפיג |
|------|--------|--------|
| **Vercel** | Web SPA | `vercel.json` · `VITE_*` בלבד |
| **Render** | FastAPI Docker | `render.yaml` · `deploy/Dockerfile.api` · שירות `site-secure-api-staging` |
| **Supabase** | Auth + DB + Storage | `supabase/migrations/*` |
| מקומי | Vite `:5173` + API `:8000` | `.env` / `.env.local` |

**חוק:** `SUPABASE_SERVICE_ROLE_KEY` **רק ב־API** — לעולם לא ב־Vercel.

## ח.2 משתני סביבה (מ־`.env.example`)

| משתנה | איפה |
|--------|------|
| `SUPABASE_URL` · `SUPABASE_ANON_KEY` | משותף |
| `SUPABASE_SERVICE_ROLE_KEY` | API בלבד |
| `API_PUBLIC_URL` · `WEB_PUBLIC_URL` · `APP_ENV` · `CORS_EXTRA_ORIGINS` | API |
| `VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY` · `VITE_API_URL` | Web (build-time) |
| `EXPO_PUBLIC_*` | מובייל עתידי — אין אפליקציה |

נוספים בקוד: `LOG_LEVEL`, `AUTHZ_CATALOG_PATH` (Docker: `/src/packages/authz/catalog.json`).

## ח.3 כתובות חיצוניות (בטא)

| שירות | URL |
|--------|-----|
| Web | `https://site-secure-umber.vercel.app` |
| API | `https://site-secure-api-staging.onrender.com` |

---

# חלק ט׳ — מה קיים בסכמה אבל בלי מוצר מלא

| ישות | למה זה מבלבל |
|------|----------------|
| `notifications` | יש טבלה + מסך העדפות — אין inbox |
| `service_contracts` | יש טבלה — אין API/UI |
| `accounting_documents` | יסוד — אין הנפקה מוצרית |
| `capabilities` (V3) | registry — אין UI עמודים לפי pillar |
| Features בקטלוג (`inventory`, `ai`, `finance`) | מופיעים בקטלוג — לא בניווט החי |
| `EXPO_PUBLIC_*` ב־env | מוכנים — אין `apps/mobile` |

---

# חלק י׳ — איך לקרוא את שאר התיעוד

| אם אתה רוצה… | לך ל… |
|--------------|--------|
| **המסמך האחיד (הכל בקובץ זה)** | `Docs/PRODUCT_STATUS_UNIFIED.md` |
| החלטות V3 נעולות | `Docs/architecture/V3-PHASE0-DECISION-MEMO.md` |
| מפרט Phase 1 | `Docs/architecture/V3-PHASE1-TECHNICAL-SPEC.md` |
| פערי מוכנות | `Docs/architecture/V3-READINESS-AUDIT.md` |
| רואדמאפ V2 | `Docs/architecture/V2-ROADMAP.md` |
| IA יעד | `Docs/architecture/V2-IA.md` (**טבלת סטטוס שם עלולה להיות ישנה**) |
| מובייל (שאיפה) | `Docs/architecture/V2-MOBILE.md` |
| Offline | `Docs/mobile/V2-OFFLINE-SYNC.md` |
| Vercel | `Docs/operations/VERCEL.md` |
| Staging | `Docs/operations/STAGING.md` (**חלקים ישנים — להעדיף קוד**) |
| ניווט חי | `apps/web/src/lib/app-nav.ts` |
| API mount | `apps/api/app/main.py` |

---

# חלק י״א — סיכום מנהלים

```
COMMERCIAL CORE     ████████████  עובד
OPERATIONAL CORE    ██████░░░░░░  חלקי
V3 (סיורים/סידורים) ░░░░░░░░░░░░  תיעוד בלבד
MAPS                ░░░░░░░░░░░░  לא קיים
MOBILE NATIVE       ░░░░░░░░░░░░  לא קיים
STRIPE / INVOICES   ██░░░░░░░░░░  מכסות כן · תשלום לא
```

**המוצר היום = מכירות + תיק אתר + שטח בסיסי.**  
**סיורים / סידורים / מפות = תוכנית V3 — עדיין לא בוצעו.**

---

## כללי עדכון

1. מודול חדש נשלח → עדכן סטטוס בחלק א׳ + נתיבים/API בחלקים ג׳–ד׳  
2. אל תוסיף «Coming Soon» לניווט בלי מוצר אמיתי  
3. במחלוקת תיעוד ישן מול קוד — **הקוד מנצח**  
4. עדכן את תאריך המסמך בראש הקובץ  
5. אחרי שינויי קוד גדולים — הרץ `python apps/api/scripts/_generate_full_inventory_md.py` לרענון הנספחים

---

# נספחים — מלאי מלא מהקוד

## 1. Authz catalog — תפקידים

- `owner` — בעלים
- `administrator` — מנהל מערכת
- `manager` — מנהל
- `sales` — מכירות
- `technician` — טכנאי
- `viewer` — צפייה בלבד

## 2. Authz catalog — כל ההרשאות (71)

| key | label_he |
|-----|----------|
| `dashboard.view` |  |
| `calendar.view` |  |
| `calendar.edit` |  |
| `settings.view` |  |
| `settings.general` |  |
| `settings.branding` |  |
| `workspace.edit` |  |
| `workspace.billing` |  |
| `workspace.delete` |  |
| `users.view` |  |
| `users.invite` |  |
| `users.manage` |  |
| `roles.manage` |  |
| `audit.view` |  |
| `crm.view` |  |
| `crm.create` |  |
| `crm.edit` |  |
| `crm.delete` |  |
| `crm.export` |  |
| `leads.view` |  |
| `leads.create` |  |
| `leads.edit` |  |
| `leads.delete` |  |
| `leads.assign` |  |
| `quotes.view` |  |
| `quotes.create` |  |
| `quotes.edit` |  |
| `quotes.delete` |  |
| `quotes.send` |  |
| `quotes.approve` |  |
| `quotes.export` |  |
| `quotes.view_cost` |  |
| `quotes.override_price` |  |
| `catalog.view` |  |
| `catalog.edit` |  |
| `projects.view` |  |
| `projects.create` |  |
| `projects.edit` |  |
| `projects.close` |  |
| `projects.delete` |  |
| `jobs.view` |  |
| `jobs.create` |  |
| `jobs.assign` |  |
| `jobs.start` |  |
| `jobs.complete` |  |
| `jobs.cancel` |  |
| `service.view` |  |
| `service.create` |  |
| `service.edit` |  |
| `service.close` |  |
| `service.assign` |  |
| `sites.view` |  |
| `sites.create` |  |
| `sites.edit` |  |
| `sites.delete` |  |
| `systems.view` |  |
| `systems.edit` |  |
| `documents.view` |  |
| `documents.upload` |  |
| `documents.delete` |  |
| `inventory.view` |  |
| `inventory.edit` |  |
| `finance.view` |  |
| `finance.edit` |  |
| `reports.view` |  |
| `reports.export` |  |
| `reports.financial` |  |
| `warranties.view` |  |
| `warranties.issue` |  |
| `knowledge.view` |  |
| `knowledge.edit` |  |

## 3. Authz catalog — features

- `core`
- `crm`
- `sales`
- `catalog`
- `quotes`
- `projects`
- `service`
- `settings`
- `inventory`
- `finance`
- `accounting_documents`
- `reports`
- `automation`
- `team`
- `audit`
- `api`
- `ai`
- `branches`

## 4. Authz catalog — grants לפי תפקיד

### `owner` → `*` (הכל)

### `administrator` (69)
- `dashboard.view`
- `calendar.view`
- `calendar.edit`
- `settings.view`
- `settings.general`
- `settings.branding`
- `workspace.edit`
- `users.view`
- `users.invite`
- `users.manage`
- `roles.manage`
- `audit.view`
- `crm.view`
- `crm.create`
- `crm.edit`
- `crm.delete`
- `crm.export`
- `leads.view`
- `leads.create`
- `leads.edit`
- `leads.delete`
- `leads.assign`
- `quotes.view`
- `quotes.create`
- `quotes.edit`
- `quotes.delete`
- `quotes.send`
- `quotes.approve`
- `quotes.export`
- `quotes.view_cost`
- `quotes.override_price`
- `catalog.view`
- `catalog.edit`
- `projects.view`
- `projects.create`
- `projects.edit`
- `projects.close`
- `projects.delete`
- `jobs.view`
- `jobs.create`
- `jobs.assign`
- `jobs.start`
- `jobs.complete`
- `jobs.cancel`
- `service.view`
- `service.create`
- `service.edit`
- `service.close`
- `service.assign`
- `sites.view`
- `sites.create`
- `sites.edit`
- `sites.delete`
- `systems.view`
- `systems.edit`
- `documents.view`
- `documents.upload`
- `documents.delete`
- `inventory.view`
- `inventory.edit`
- `finance.view`
- `finance.edit`
- `reports.view`
- `reports.export`
- `reports.financial`
- `warranties.view`
- `warranties.issue`
- `knowledge.view`
- `knowledge.edit`

### `manager` (59)
- `dashboard.view`
- `calendar.view`
- `calendar.edit`
- `settings.view`
- `settings.general`
- `users.view`
- `crm.view`
- `crm.create`
- `crm.edit`
- `crm.delete`
- `crm.export`
- `leads.view`
- `leads.create`
- `leads.edit`
- `leads.delete`
- `leads.assign`
- `quotes.view`
- `quotes.create`
- `quotes.edit`
- `quotes.delete`
- `quotes.send`
- `quotes.approve`
- `quotes.export`
- `quotes.view_cost`
- `quotes.override_price`
- `catalog.view`
- `catalog.edit`
- `projects.view`
- `projects.create`
- `projects.edit`
- `projects.close`
- `jobs.view`
- `jobs.create`
- `jobs.assign`
- `jobs.start`
- `jobs.complete`
- `jobs.cancel`
- `service.view`
- `service.create`
- `service.edit`
- `service.close`
- `service.assign`
- `sites.view`
- `sites.create`
- `sites.edit`
- `systems.view`
- `systems.edit`
- `documents.view`
- `documents.upload`
- `documents.delete`
- `inventory.view`
- `inventory.edit`
- `finance.view`
- `reports.view`
- `reports.export`
- `warranties.view`
- `warranties.issue`
- `knowledge.view`
- `knowledge.edit`

### `sales` (27)
- `dashboard.view`
- `calendar.view`
- `calendar.edit`
- `settings.view`
- `crm.view`
- `crm.create`
- `crm.edit`
- `leads.view`
- `leads.create`
- `leads.edit`
- `leads.assign`
- `quotes.view`
- `quotes.create`
- `quotes.edit`
- `quotes.send`
- `quotes.approve`
- `quotes.export`
- `catalog.view`
- `projects.view`
- `jobs.view`
- `service.view`
- `sites.view`
- `systems.view`
- `documents.view`
- `documents.upload`
- `warranties.view`
- `knowledge.view`

### `technician` (22)
- `dashboard.view`
- `calendar.view`
- `calendar.edit`
- `settings.view`
- `crm.view`
- `projects.view`
- `jobs.view`
- `jobs.start`
- `jobs.complete`
- `service.view`
- `service.create`
- `service.edit`
- `service.close`
- `sites.view`
- `sites.edit`
- `systems.view`
- `systems.edit`
- `documents.view`
- `documents.upload`
- `warranties.view`
- `warranties.issue`
- `knowledge.view`

### `viewer` (16)
- `dashboard.view`
- `calendar.view`
- `settings.view`
- `crm.view`
- `leads.view`
- `quotes.view`
- `catalog.view`
- `projects.view`
- `jobs.view`
- `service.view`
- `sites.view`
- `systems.view`
- `documents.view`
- `warranties.view`
- `knowledge.view`
- `reports.view`

## 5. Authz catalog — plans

- `solo`
- `business`
- `enterprise`

---

## 6. API — כל ה־endpoints

| router | method | path |
|--------|--------|------|
| `admin.py` | GET | `/api/v1/admin/summary` |
| `admin.py` | GET | `/api/v1/admin/organizations` |
| `admin.py` | PATCH | `/api/v1/admin/organizations/{workspace_id}` |
| `admin.py` | GET | `/api/v1/admin/users` |
| `admin.py` | PATCH | `/api/v1/admin/users/{user_id}/badges` |
| `admin.py` | GET | `/api/v1/admin/beta/participants` |
| `admin.py` | PATCH | `/api/v1/admin/users/{user_id}/beta` |
| `admin.py` | GET | `/api/v1/admin/audit` |
| `admin.py` | GET | `/api/v1/admin/feedback` |
| `admin.py` | PATCH | `/api/v1/admin/feedback/{report_id}` |
| `admin.py` | GET | `/api/v1/admin/feature-flags` |
| `admin.py` | PATCH | `/api/v1/admin/feature-flags/{flag_id}` |
| `auth.py` | GET | `/api/v1/auth/session` |
| `auth.py` | PATCH | `/api/v1/me` |
| `auth.py` | GET | `/api/v1/authz/catalog` |
| `catalog.py` | GET | `/api/v1/workspaces/{workspace_id}/catalog/categories` |
| `catalog.py` | GET | `/api/v1/workspaces/{workspace_id}/catalog/products` |
| `catalog.py` | GET | `/api/v1/workspaces/{workspace_id}/catalog/products/{product_id}` |
| `catalog.py` | POST | `/api/v1/workspaces/{workspace_id}/catalog/products` |
| `catalog.py` | PATCH | `/api/v1/workspaces/{workspace_id}/catalog/products/{product_id}` |
| `catalog.py` | POST | `/api/v1/workspaces/{workspace_id}/catalog/ensure-defaults` |
| `catalog.py` | POST | `/api/v1/workspaces/{workspace_id}/catalog/products/bulk-pricing` |
| `catalog.py` | GET | `/api/v1/workspaces/{workspace_id}/catalog/templates` |
| `catalog_import.py` | GET | `/api/v1/workspaces/{workspace_id}/catalog/import/targets` |
| `catalog_import.py` | GET | `/api/v1/workspaces/{workspace_id}/catalog/import/template` |
| `catalog_import.py` | POST | `/api/v1/workspaces/{workspace_id}/catalog/import/parse` |
| `catalog_import.py` | POST | `/api/v1/workspaces/{workspace_id}/catalog/import/preview` |
| `catalog_import.py` | POST | `/api/v1/workspaces/{workspace_id}/catalog/import/commit` |
| `cctv.py` | POST | `/api/v1/workspaces/{workspace_id}/cctv/recommend` |
| `customers.py` | GET | `/api/v1/workspaces/{workspace_id}/customers` |
| `customers.py` | POST | `/api/v1/workspaces/{workspace_id}/customers` |
| `customers.py` | GET | `/api/v1/workspaces/{workspace_id}/customers/{customer_id}` |
| `customers.py` | PATCH | `/api/v1/workspaces/{workspace_id}/customers/{customer_id}` |
| `customers.py` | DELETE | `/api/v1/workspaces/{workspace_id}/customers/{customer_id}` |
| `customers.py` | GET | `/api/v1/workspaces/{workspace_id}/customers/{customer_id}/contacts` |
| `customers.py` | POST | `/api/v1/workspaces/{workspace_id}/customers/{customer_id}/contacts` |
| `dashboard.py` | GET | `/api/v1/workspaces/{workspace_id}/dashboard` |
| `documents.py` | GET | `/api/v1/workspaces/{workspace_id}/documents` |
| `documents.py` | POST | `/api/v1/workspaces/{workspace_id}/documents/uploads` |
| `documents.py` | POST | `/api/v1/workspaces/{workspace_id}/documents/{document_id}/complete` |
| `documents.py` | GET | `/api/v1/workspaces/{workspace_id}/documents/{document_id}/url` |
| `feedback.py` | GET | `/api/v1/feedback` |
| `feedback.py` | POST | `/api/v1/feedback` |
| `feedback.py` | GET | `/api/v1/feature-flags` |
| `health.py` | GET | `/health` |
| `health.py` | GET | `/api/v1/health` |
| `jobs.py` | GET | `/api/v1/workspaces/{workspace_id}/jobs` |
| `jobs.py` | POST | `/api/v1/workspaces/{workspace_id}/jobs` |
| `jobs.py` | GET | `/api/v1/workspaces/{workspace_id}/jobs/{job_id}` |
| `jobs.py` | PATCH | `/api/v1/workspaces/{workspace_id}/jobs/{job_id}` |
| `jobs.py` | POST | `/api/v1/workspaces/{workspace_id}/jobs/{job_id}/start` |
| `jobs.py` | POST | `/api/v1/workspaces/{workspace_id}/jobs/{job_id}/complete` |
| `jobs.py` | POST | `/api/v1/workspaces/{workspace_id}/jobs/{job_id}/assign` |
| `jobs.py` | GET | `/api/v1/workspaces/{workspace_id}/jobs/{job_id}/checklist` |
| `jobs.py` | POST | `/api/v1/workspaces/{workspace_id}/jobs/{job_id}/checklist` |
| `jobs.py` | PATCH | `/api/v1/workspaces/{workspace_id}/jobs/{job_id}/checklist/{item_id}` |
| `ops_modules.py` | GET | `/api/v1/workspaces/{workspace_id}/leads` |
| `ops_modules.py` | POST | `/api/v1/workspaces/{workspace_id}/leads` |
| `ops_modules.py` | GET | `/api/v1/workspaces/{workspace_id}/leads/{lead_id}` |
| `ops_modules.py` | PATCH | `/api/v1/workspaces/{workspace_id}/leads/{lead_id}` |
| `ops_modules.py` | GET | `/api/v1/workspaces/{workspace_id}/projects` |
| `ops_modules.py` | POST | `/api/v1/workspaces/{workspace_id}/projects` |
| `ops_modules.py` | POST | `/api/v1/workspaces/{workspace_id}/projects/from-quote` |
| `ops_modules.py` | GET | `/api/v1/workspaces/{workspace_id}/projects/{project_id}` |
| `ops_modules.py` | PATCH | `/api/v1/workspaces/{workspace_id}/projects/{project_id}` |
| `ops_modules.py` | GET | `/api/v1/workspaces/{workspace_id}/service-calls` |
| `ops_modules.py` | POST | `/api/v1/workspaces/{workspace_id}/service-calls` |
| `ops_modules.py` | PATCH | `/api/v1/workspaces/{workspace_id}/service-calls/{call_id}` |
| `ops_modules.py` | GET | `/api/v1/workspaces/{workspace_id}/warranties` |
| `ops_modules.py` | POST | `/api/v1/workspaces/{workspace_id}/warranties` |
| `ops_modules.py` | GET | `/api/v1/workspaces/{workspace_id}/tasks` |
| `ops_modules.py` | POST | `/api/v1/workspaces/{workspace_id}/tasks` |
| `ops_modules.py` | PATCH | `/api/v1/workspaces/{workspace_id}/tasks/{task_id}` |
| `ops_modules.py` | GET | `/api/v1/workspaces/{workspace_id}/knowledge` |
| `ops_modules.py` | POST | `/api/v1/workspaces/{workspace_id}/knowledge` |
| `ops_modules.py` | PATCH | `/api/v1/workspaces/{workspace_id}/knowledge/{article_id}` |
| `public_quotes.py` | GET | `/api/v1/public/quotes/{token}` |
| `public_quotes.py` | GET | `/api/v1/public/quotes/{token}/pdf` |
| `public_quotes.py` | POST | `/api/v1/public/quotes/{token}/approve` |
| `public_quotes.py` | POST | `/api/v1/public/quotes/{token}/reject` |
| `quote_cpq.py` | GET | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/sections` |
| `quote_cpq.py` | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/sections` |
| `quote_cpq.py` | PATCH | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/sections/{section_id}` |
| `quote_cpq.py` | DELETE | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/sections/{section_id}` |
| `quote_cpq.py` | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/sections/{section_id}/duplicate` |
| `quote_cpq.py` | GET | `/api/v1/workspaces/{workspace_id}/catalog/packages` |
| `quote_cpq.py` | POST | `/api/v1/workspaces/{workspace_id}/catalog/packages` |
| `quote_cpq.py` | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/apply-package` |
| `quote_cpq.py` | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/save-as-package` |
| `quote_cpq.py` | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/save-as-template` |
| `quote_cpq.py` | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/margin-override` |
| `quote_cpq.py` | GET | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/versions` |
| `quote_cpq.py` | GET | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/versions/compare` |
| `quote_cpq.py` | GET | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/events` |
| `quote_cpq.py` | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/events` |
| `quote_cpq.py` | GET | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/document` |
| `quote_cpq.py` | GET | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/pdf` |
| `quotes.py` | GET | `/api/v1/workspaces/{workspace_id}/quotes` |
| `quotes.py` | POST | `/api/v1/workspaces/{workspace_id}/quotes` |
| `quotes.py` | GET | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}` |
| `quotes.py` | PATCH | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}` |
| `quotes.py` | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/items` |
| `quotes.py` | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/apply-template` |
| `quotes.py` | PATCH | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/items/{item_id}` |
| `quotes.py` | DELETE | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/items/{item_id}` |
| `quotes.py` | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/recalculate` |
| `quotes.py` | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/send` |
| `quotes.py` | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/revise` |
| `quotes.py` | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/share` |
| `quotes.py` | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/revoke-link` |
| `quotes.py` | DELETE | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}` |
| `quotes.py` | POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/duplicate` |
| `quotes.py` | GET | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/preview` |
| `search.py` | GET | `/api/v1/workspaces/{workspace_id}/search` |
| `sites.py` | GET | `/api/v1/workspaces/{workspace_id}/sites` |
| `sites.py` | POST | `/api/v1/workspaces/{workspace_id}/sites` |
| `sites.py` | GET | `/api/v1/workspaces/{workspace_id}/sites/{site_id}` |
| `sites.py` | PATCH | `/api/v1/workspaces/{workspace_id}/sites/{site_id}` |
| `sites.py` | DELETE | `/api/v1/workspaces/{workspace_id}/sites/{site_id}` |
| `systems.py` | GET | `/api/v1/workspaces/{workspace_id}/systems` |
| `systems.py` | POST | `/api/v1/workspaces/{workspace_id}/systems` |
| `systems.py` | PATCH | `/api/v1/workspaces/{workspace_id}/systems/{system_id}` |
| `systems.py` | GET | `/api/v1/workspaces/{workspace_id}/equipment` |
| `systems.py` | POST | `/api/v1/workspaces/{workspace_id}/equipment` |
| `systems.py` | PATCH | `/api/v1/workspaces/{workspace_id}/equipment/{equipment_id}` |
| `team.py` | GET | `/api/v1/workspaces/{workspace_id}/members` |
| `team.py` | GET | `/api/v1/workspaces/{workspace_id}/usage` |
| `team.py` | PATCH | `/api/v1/workspaces/{workspace_id}/members/{member_id}` |
| `team.py` | GET | `/api/v1/workspaces/{workspace_id}/audit` |
| `team.py` | GET | `/api/v1/workspaces/{workspace_id}/security` |
| `telemetry.py` | POST | `/api/v1/telemetry/client-error` |
| `workspace_settings.py` | GET | `/api/v1/workspaces/{workspace_id}/settings` |
| `workspace_settings.py` | PATCH | `/api/v1/workspaces/{workspace_id}/settings` |
| `workspace_settings.py` | GET | `/api/v1/workspaces/{workspace_id}/company-profile` |
| `workspace_settings.py` | POST | `/api/v1/workspaces/{workspace_id}/company-profile/logo-upload` |
| `workspace_settings.py` | POST | `/api/v1/workspaces/{workspace_id}/company-profile/logo-complete` |
| `workspace_settings.py` | POST | `/api/v1/workspaces/{workspace_id}/company-profile/document-preview` |
| `workspace_settings.py` | GET | `/api/v1/workspaces/{workspace_id}/roles` |
| `workspace_settings.py` | POST | `/api/v1/workspaces/{workspace_id}/roles` |
| `workspace_settings.py` | PATCH | `/api/v1/workspaces/{workspace_id}/roles/{role_id}` |
| `workspace_settings.py` | GET | `/api/v1/workspaces/{workspace_id}/pdf-templates` |
| `workspace_settings.py` | POST | `/api/v1/workspaces/{workspace_id}/pdf-templates` |
| `workspace_settings.py` | PATCH | `/api/v1/workspaces/{workspace_id}/pdf-templates/{template_id}` |
| `workspace_settings.py` | POST | `/api/v1/workspaces/{workspace_id}/pdf-templates/{template_id}/duplicate` |
| `workspace_settings.py` | POST | `/api/v1/workspaces/{workspace_id}/pdf-templates/{template_id}/preview` |
| `workspaces.py` | POST | `/api/v1/workspaces` |
| `workspaces.py` | GET | `/api/v1/workspaces/{workspace_id}` |
| `workspaces.py` | PATCH | `/api/v1/workspaces/{workspace_id}` |
| `workspaces.py` | POST | `/api/v1/workspaces/{workspace_id}/invitations` |
| `workspaces.py` | GET | `/api/v1/workspaces/{workspace_id}/invitations` |
| `workspaces.py` | GET | `/api/v1/invitations/peek` |
| `workspaces.py` | POST | `/api/v1/invitations/accept` |

---

## 7. Web — כל קבצי ה־routes

- `apps/web/src/routes/__root.tsx`
- `apps/web/src/routes/admin/audit.tsx`
- `apps/web/src/routes/admin/badges.tsx`
- `apps/web/src/routes/admin/beta.tsx`
- `apps/web/src/routes/admin/feedback.tsx`
- `apps/web/src/routes/admin/flags.tsx`
- `apps/web/src/routes/admin/index.tsx`
- `apps/web/src/routes/admin/organizations.tsx`
- `apps/web/src/routes/admin/route.tsx`
- `apps/web/src/routes/admin/users.tsx`
- `apps/web/src/routes/app/catalog.tsx`
- `apps/web/src/routes/app/customers/$customerId.tsx`
- `apps/web/src/routes/app/customers/index.tsx`
- `apps/web/src/routes/app/dashboard.tsx`
- `apps/web/src/routes/app/index.tsx`
- `apps/web/src/routes/app/jobs/$jobId.tsx`
- `apps/web/src/routes/app/knowledge/index.tsx`
- `apps/web/src/routes/app/leads/$leadId.tsx`
- `apps/web/src/routes/app/leads/index.tsx`
- `apps/web/src/routes/app/projects/$projectId.tsx`
- `apps/web/src/routes/app/projects/index.tsx`
- `apps/web/src/routes/app/quotes/$quoteId.preview.tsx`
- `apps/web/src/routes/app/quotes/$quoteId.tsx`
- `apps/web/src/routes/app/quotes/index.tsx`
- `apps/web/src/routes/app/quotes/new.tsx`
- `apps/web/src/routes/app/route.tsx`
- `apps/web/src/routes/app/service/index.tsx`
- `apps/web/src/routes/app/settings/appearance.tsx`
- `apps/web/src/routes/app/settings/audit.tsx`
- `apps/web/src/routes/app/settings/company.tsx`
- `apps/web/src/routes/app/settings/index.tsx`
- `apps/web/src/routes/app/settings/notifications.tsx`
- `apps/web/src/routes/app/settings/numbering.tsx`
- `apps/web/src/routes/app/settings/pdf-templates.tsx`
- `apps/web/src/routes/app/settings/quotes.tsx`
- `apps/web/src/routes/app/settings/roles.tsx`
- `apps/web/src/routes/app/settings/route.tsx`
- `apps/web/src/routes/app/settings/security.tsx`
- `apps/web/src/routes/app/settings/sites.tsx`
- `apps/web/src/routes/app/settings/system.tsx`
- `apps/web/src/routes/app/settings/users.tsx`
- `apps/web/src/routes/app/sites/$siteId.tsx`
- `apps/web/src/routes/app/sites/index.tsx`
- `apps/web/src/routes/app/tasks/index.tsx`
- `apps/web/src/routes/app/today.tsx`
- `apps/web/src/routes/app/warranties/index.tsx`
- `apps/web/src/routes/dev/ui.tsx`
- `apps/web/src/routes/forgot-password.tsx`
- `apps/web/src/routes/index.tsx`
- `apps/web/src/routes/invite/$token.tsx`
- `apps/web/src/routes/legal/$slug.tsx`
- `apps/web/src/routes/legal/index.tsx`
- `apps/web/src/routes/login.tsx`
- `apps/web/src/routes/onboarding.tsx`
- `apps/web/src/routes/public/quotes/$token.tsx`
- `apps/web/src/routes/q/$token.tsx`
- `apps/web/src/routes/register.tsx`
- `apps/web/src/routes/reset-password.tsx`
- `apps/web/src/routes/verify-email.tsx`

---

## 8. Web — כל הקומפוננטות

- `apps/web/src/components/AppBottomNav.tsx`
- `apps/web/src/components/AppErrorBoundary.tsx`
- `apps/web/src/components/AppShell.tsx`
- `apps/web/src/components/AppSidebar.tsx`
- `apps/web/src/components/auth/AuthBrandPanel.tsx`
- `apps/web/src/components/auth/AuthExperience.tsx`
- `apps/web/src/components/auth/AuthField.tsx`
- `apps/web/src/components/auth/AuthFooter.tsx`
- `apps/web/src/components/auth/AuthForm.tsx`
- `apps/web/src/components/auth/AuthHeader.tsx`
- `apps/web/src/components/auth/AuthHydrateError.tsx`
- `apps/web/src/components/auth/AuthLaunchScreen.tsx`
- `apps/web/src/components/auth/AuthLayout.tsx`
- `apps/web/src/components/auth/AuthProductFlow.tsx`
- `apps/web/src/components/auth/AuthStepRail.tsx`
- `apps/web/src/components/auth/AuthTrust.tsx`
- `apps/web/src/components/auth/PasswordField.tsx`
- `apps/web/src/components/auth/PasswordStrength.tsx`
- `apps/web/src/components/AuthLayout.tsx`
- `apps/web/src/components/BetaBadge.tsx`
- `apps/web/src/components/Can.tsx`
- `apps/web/src/components/catalog/CatalogBulkPricing.tsx`
- `apps/web/src/components/catalog/CatalogImportWizard.tsx`
- `apps/web/src/components/CommandPalette.tsx`
- `apps/web/src/components/customers/CustomerActionMenu.tsx`
- `apps/web/src/components/customers/CustomerDirectory.tsx`
- `apps/web/src/components/customers/CustomerProfile.tsx`
- `apps/web/src/components/dashboard/ActivationCard.tsx`
- `apps/web/src/components/dashboard/ActiveWork.tsx`
- `apps/web/src/components/dashboard/ActivityList.tsx`
- `apps/web/src/components/dashboard/AttentionList.tsx`
- `apps/web/src/components/dashboard/BusinessHealth.tsx`
- `apps/web/src/components/dashboard/BusinessSnapshot.tsx`
- `apps/web/src/components/dashboard/CommandStatus.tsx`
- `apps/web/src/components/dashboard/CommercialPulse.tsx`
- `apps/web/src/components/dashboard/CommercialPulseChart.tsx`
- `apps/web/src/components/dashboard/DashboardCommandHeader.tsx`
- `apps/web/src/components/dashboard/DashboardCreateMenu.tsx`
- `apps/web/src/components/dashboard/DashboardCreateProjectDialog.tsx`
- `apps/web/src/components/dashboard/DashboardFreshness.tsx`
- `apps/web/src/components/dashboard/DashboardKpiRow.tsx`
- `apps/web/src/components/dashboard/DashboardSignalStrip.tsx`
- `apps/web/src/components/dashboard/DashboardSkeleton.tsx`
- `apps/web/src/components/dashboard/LeadsAttention.tsx`
- `apps/web/src/components/dashboard/NextBestAction.tsx`
- `apps/web/src/components/dashboard/OpsDashboard.tsx`
- `apps/web/src/components/dashboard/OpsHero.tsx`
- `apps/web/src/components/dashboard/QuotePipeline.tsx`
- `apps/web/src/components/dashboard/RecentQuotes.tsx`
- `apps/web/src/components/dashboard/RingMetric.tsx`
- `apps/web/src/components/dashboard/SalesSnapshot.tsx`
- `apps/web/src/components/dashboard/SecurityStatus.tsx`
- `apps/web/src/components/dashboard/TodayHome.tsx`
- `apps/web/src/components/dashboard/TodayList.tsx`
- `apps/web/src/components/dashboard/UsageSnapshot.tsx`
- `apps/web/src/components/dashboard/UsageThresholdBanner.tsx`
- `apps/web/src/components/dashboard/UxRings.tsx`
- `apps/web/src/components/dashboard/WorkspaceSetup.tsx`
- `apps/web/src/components/FeedbackCenter.tsx`
- `apps/web/src/components/field/FieldJob.tsx`
- `apps/web/src/components/FoundingTechnicianBadge.tsx`
- `apps/web/src/components/HeaderPopover.tsx`
- `apps/web/src/components/leads/LeadProfile.tsx`
- `apps/web/src/components/leads/NewLeadSheet.tsx`
- `apps/web/src/components/leads/ScheduleVisitSheet.tsx`
- `apps/web/src/components/LoginForm.tsx`
- `apps/web/src/components/lottie/LottieAnimation.tsx`
- `apps/web/src/components/MobileMoreSheet.tsx`
- `apps/web/src/components/MobileNavSheet.tsx`
- `apps/web/src/components/MobileWorkSheet.tsx`
- `apps/web/src/components/modules/ModuleKit.tsx`
- `apps/web/src/components/NavIcon.tsx`
- `apps/web/src/components/OnboardingForm.tsx`
- `apps/web/src/components/pdf/PdfDocumentPreview.tsx`
- `apps/web/src/components/public/LegalDocument.tsx`
- `apps/web/src/components/public/LegalNav.tsx`
- `apps/web/src/components/public/PublicChrome.tsx`
- `apps/web/src/components/public/PublicHome.tsx`
- `apps/web/src/components/public/PublicSurfaces.tsx`
- `apps/web/src/components/quotes/cpq/LeadRequirementsCard.tsx`
- `apps/web/src/components/quotes/cpq/QuoteAuditStrip.tsx`
- `apps/web/src/components/quotes/cpq/QuoteLineRow.tsx`
- `apps/web/src/components/quotes/cpq/QuoteLinesPanel.tsx`
- `apps/web/src/components/quotes/cpq/QuoteQuickAdd.tsx`
- `apps/web/src/components/quotes/cpq/QuoteSectionNameField.tsx`
- `apps/web/src/components/quotes/cpq/QuoteSummaryAside.tsx`
- `apps/web/src/components/quotes/cpq/RevisionComparePanel.tsx`
- `apps/web/src/components/quotes/cpq/SystemBuilderDrawer.tsx`
- `apps/web/src/components/quotes/cpq/SystemPickerModal.tsx`
- `apps/web/src/components/quotes/cpq/TemplateApplyModal.tsx`
- `apps/web/src/components/quotes/cpq/TemplateFastPath.tsx`
- `apps/web/src/components/quotes/CreateQuoteDialog.tsx`
- `apps/web/src/components/quotes/CustomerNewQuoteButton.tsx`
- `apps/web/src/components/quotes/document/QuoteDocument.tsx`
- `apps/web/src/components/quotes/NewQuoteButton.tsx`
- `apps/web/src/components/quotes/quote-creation/CustomerCreateFlow.tsx`
- `apps/web/src/components/quotes/quote-creation/CustomerSelector.tsx`
- `apps/web/src/components/quotes/quote-creation/NewQuoteDialog.tsx`
- `apps/web/src/components/quotes/quote-creation/QuoteContextCard.tsx`
- `apps/web/src/components/quotes/quote-creation/QuoteFlowSheet.tsx`
- `apps/web/src/components/quotes/quote-creation/QuoteStartOptions.tsx`
- `apps/web/src/components/quotes/QuoteBuilder.tsx`
- `apps/web/src/components/quotes/QuoteCustomerView.tsx`
- `apps/web/src/components/quotes/QuoteShareDialog.tsx`
- `apps/web/src/components/quotes/QuotesWorkspace.tsx`
- `apps/web/src/components/quotes/SendQuoteConfirm.tsx`
- `apps/web/src/components/quotes/SignaturePad.tsx`
- `apps/web/src/components/quotes/workspace/QuoteContextBar.tsx`
- `apps/web/src/components/quotes/workspace/QuoteHeader.tsx`
- `apps/web/src/components/quotes/workspace/QuoteLifecycleBanner.tsx`
- `apps/web/src/components/quotes/workspace/QuoteMobileActionsBar.tsx`
- `apps/web/src/components/quotes/workspace/QuoteMobileAddMenu.tsx`
- `apps/web/src/components/quotes/workspace/QuoteMobileSheet.tsx`
- `apps/web/src/components/quotes/workspace/QuoteSaveIndicator.tsx`
- `apps/web/src/components/quotes/workspace/QuoteSidebar.tsx`
- `apps/web/src/components/quotes/workspace/QuoteSidebarPanel.tsx`
- `apps/web/src/components/quotes/workspace/QuoteStepper.tsx`
- `apps/web/src/components/quotes/workspace/UnifiedReadiness.tsx`
- `apps/web/src/components/RegisterForm.tsx`
- `apps/web/src/components/settings/RequirePermission.tsx`
- `apps/web/src/components/settings/SettingsShell.tsx`
- `apps/web/src/components/sites/SiteDossier.tsx`
- `apps/web/src/components/ThemePicker.tsx`
- `apps/web/src/components/UserAccountMenu.tsx`
- `apps/web/src/components/VerifyEmailPanel.tsx`
- `apps/web/src/components/workflow/NextActionDialog.tsx`
- `apps/web/src/components/workflow/ProjectFromQuoteDialog.tsx`
- `apps/web/src/components/WorkspaceSystemStatus.tsx`
- `apps/web/src/components/auth/index.ts`
- `apps/web/src/components/lottie/index.ts`
- `apps/web/src/components/lottie/lottie-registry.ts`
- `apps/web/src/components/public/useReducedMotion.ts`
- `apps/web/src/components/quotes/quote-creation/index.ts`
- `apps/web/src/components/quotes/workspace/types.ts`

---

## 9. Web — lib / i18n / hooks

- `apps/web/src/lib/activation.ts`
- `apps/web/src/lib/address.ts`
- `apps/web/src/lib/app-nav.ts`
- `apps/web/src/lib/app-version.ts`
- `apps/web/src/lib/attention-queue.ts`
- `apps/web/src/lib/auth-errors.ts`
- `apps/web/src/lib/auth-launch.ts`
- `apps/web/src/lib/auth-motion.ts`
- `apps/web/src/lib/auth-redirect.ts`
- `apps/web/src/lib/auth-routes.ts`
- `apps/web/src/lib/can.ts`
- `apps/web/src/lib/catalog-technical.ts`
- `apps/web/src/lib/cctv-build-requirements.ts`
- `apps/web/src/lib/cctv-recommend-copy.ts`
- `apps/web/src/lib/cctv-recommend-projection.ts`
- `apps/web/src/lib/cctv-recommend-types.ts`
- `apps/web/src/lib/cctv-sizing/bitrate-defaults.ts`
- `apps/web/src/lib/cctv-sizing/engine.ts`
- `apps/web/src/lib/cctv-sizing/hdd.ts`
- `apps/web/src/lib/cctv-sizing/index.ts`
- `apps/web/src/lib/cctv-sizing/infrastructure.ts`
- `apps/web/src/lib/cctv-sizing/poe.ts`
- `apps/web/src/lib/cctv-sizing/recorder.ts`
- `apps/web/src/lib/cctv-sizing/storage.ts`
- `apps/web/src/lib/cctv-sizing/types.ts`
- `apps/web/src/lib/cctv-sizing/validate.ts`
- `apps/web/src/lib/clipboard.ts`
- `apps/web/src/lib/customer-directory.ts`
- `apps/web/src/lib/customer-profile.ts`
- `apps/web/src/lib/dashboard-kpi.ts`
- `apps/web/src/lib/dashboard-maturity.ts`
- `apps/web/src/lib/document-meta.ts`
- `apps/web/src/lib/download-blob.ts`
- `apps/web/src/lib/greeting.ts`
- `apps/web/src/lib/home.ts`
- `apps/web/src/lib/leads.ts`
- `apps/web/src/lib/new-lead.ts`
- `apps/web/src/lib/next-best-action.ts`
- `apps/web/src/lib/password-strength.ts`
- `apps/web/src/lib/pdf-preview.ts`
- `apps/web/src/lib/pdf-template-config.ts`
- `apps/web/src/lib/pdf-templates-demo.ts`
- `apps/web/src/lib/pdfjs.ts`
- `apps/web/src/lib/plan-quota.ts`
- `apps/web/src/lib/public-api-url.ts`
- `apps/web/src/lib/quote-builder.ts`
- `apps/web/src/lib/quote-cpq.ts`
- `apps/web/src/lib/quote-lifecycle.ts`
- `apps/web/src/lib/quote-line-edit.ts`
- `apps/web/src/lib/quote-live-document.ts`
- `apps/web/src/lib/quote-readiness.ts`
- `apps/web/src/lib/quote-recipient-phone.ts`
- `apps/web/src/lib/quote-whatsapp-share.ts`
- `apps/web/src/lib/quote-workspace.ts`
- `apps/web/src/lib/quotes.ts`
- `apps/web/src/lib/relative-age.ts`
- `apps/web/src/lib/remember-device.ts`
- `apps/web/src/lib/role-catalog.ts`
- `apps/web/src/lib/session.tsx`
- `apps/web/src/lib/settings-rbac-demo.ts`
- `apps/web/src/lib/supabase.ts`
- `apps/web/src/lib/system-builder.ts`
- `apps/web/src/lib/system-section.ts`
- `apps/web/src/lib/theme.ts`
- `apps/web/src/lib/use-online-status.ts`
- `apps/web/src/lib/use-reduced-motion.ts`
- `apps/web/src/lib/use-theme.ts`
- `apps/web/src/lib/ux-metrics.ts`
- `apps/web/src/lib/workflow-context.ts`
- `apps/web/src/lib/workspace-header.ts`
- `apps/web/src/lib/workspace-prefs.ts`
- `apps/web/src/lib/workspace-setup.ts`
- `apps/web/src/i18n/he.ts`
- `apps/web/src/i18n/legal-he.ts`
- `apps/web/src/i18n/public-he.ts`

---

## 10. API — כל מודולי Python תחת app/

- `apps/api/app/__init__.py`
- `apps/api/app/audit.py`
- `apps/api/app/authz/__init__.py`
- `apps/api/app/authz/catalog.py`
- `apps/api/app/authz/engine.py`
- `apps/api/app/authz/guard.py`
- `apps/api/app/authz/limits.py`
- `apps/api/app/authz/scope.py`
- `apps/api/app/authz/types.py`
- `apps/api/app/authz/usage.py`
- `apps/api/app/catalog_attrs.py`
- `apps/api/app/catalog_import/__init__.py`
- `apps/api/app/catalog_import/engine.py`
- `apps/api/app/catalog_import/mapping.py`
- `apps/api/app/catalog_import/normalize.py`
- `apps/api/app/catalog_import/parse.py`
- `apps/api/app/catalog_import/session.py`
- `apps/api/app/catalog_import/template.py`
- `apps/api/app/cctv_recommend/__init__.py`
- `apps/api/app/cctv_sizing/__init__.py`
- `apps/api/app/config.py`
- `apps/api/app/dashboard.py`
- `apps/api/app/deps.py`
- `apps/api/app/documents/__init__.py`
- `apps/api/app/documents/accounting.py`
- `apps/api/app/documents/company_profile.py`
- `apps/api/app/documents/context.py`
- `apps/api/app/documents/formatters.py`
- `apps/api/app/documents/invoice_foundation.py`
- `apps/api/app/documents/logo.py`
- `apps/api/app/documents/types.py`
- `apps/api/app/errors.py`
- `apps/api/app/http_supabase.py`
- `apps/api/app/idempotency.py`
- `apps/api/app/identity.py`
- `apps/api/app/main.py`
- `apps/api/app/pagination.py`
- `apps/api/app/pdf_response.py`
- `apps/api/app/pdf_template_sample.py`
- `apps/api/app/platform.py`
- `apps/api/app/pricing.py`
- `apps/api/app/project_from_quote.py`
- `apps/api/app/quote_pdf.py`
- `apps/api/app/quote_rules/__init__.py`
- `apps/api/app/quote_signature.py`
- `apps/api/app/quote_snapshot.py`
- `apps/api/app/quote_tokens.py`
- `apps/api/app/quote_validation.py`
- `apps/api/app/rest.py`
- `apps/api/app/routers/admin.py`
- `apps/api/app/routers/auth.py`
- `apps/api/app/routers/catalog.py`
- `apps/api/app/routers/catalog_import.py`
- `apps/api/app/routers/cctv.py`
- `apps/api/app/routers/customers.py`
- `apps/api/app/routers/dashboard.py`
- `apps/api/app/routers/documents.py`
- `apps/api/app/routers/feedback.py`
- `apps/api/app/routers/health.py`
- `apps/api/app/routers/jobs.py`
- `apps/api/app/routers/ops_modules.py`
- `apps/api/app/routers/public_quotes.py`
- `apps/api/app/routers/quote_cpq.py`
- `apps/api/app/routers/quotes.py`
- `apps/api/app/routers/search.py`
- `apps/api/app/routers/sites.py`
- `apps/api/app/routers/systems.py`
- `apps/api/app/routers/team.py`
- `apps/api/app/routers/telemetry.py`
- `apps/api/app/routers/workspace_settings.py`
- `apps/api/app/routers/workspaces.py`
- `apps/api/app/supabase_service.py`
- `apps/api/app/supabase_user.py`
- `apps/api/app/workspace_rbac.py`

---

## 11. Database — כל הטבלאות והעמודות (מ־CREATE TABLE)

**סה״כ טבלאות שחולצו:** 65

### `accounting_documents`
מיגרציה: `0044_company_document_system.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- document_type — text NOT NULL
- status — text NOT NULL DEFAULT 'draft'
- provider_key — text
- external_document_id — text
- document_number — text
- issued_at — timestamptz
- allocation_number — text
- allocation_status — text
- allocation_requested_at — timestamptz
- allocation_provider — text
- allocation_error — text
- company_snapshot — jsonb NOT NULL DEFAULT '{}'::jsonb
- customer_id — uuid REFERENCES public.customers (id) ON DELETE SET NULL
- site_id — uuid REFERENCES public.sites (id) ON DELETE SET NULL
- quote_id — uuid REFERENCES public.quotes (id) ON DELETE SET NULL
- project_id — uuid REFERENCES public.projects (id) ON DELETE SET NULL
- generated_document_id — uuid REFERENCES public.generated_documents (id) ON DELETE SET NULL
- provider_payload — jsonb NOT NULL DEFAULT '{}'::jsonb
- created_by — uuid REFERENCES public.profiles (id) ON DELETE SET NULL
- created_at — timestamptz NOT NULL DEFAULT now()
- updated_at — timestamptz NOT NULL DEFAULT now()

### `after_action_reports`
מיגרציה: `0020_tasks_ops.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- job_id — uuid NOT NULL REFERENCES public.jobs (id) ON DELETE CASCADE
- narrative — text
- payload — jsonb NOT NULL DEFAULT '{}'::jsonb
- created_by — uuid REFERENCES public.profiles (id) ON DELETE SET NULL
- created_at — timestamptz NOT NULL DEFAULT now()

### `assignments`
מיגרציה: `0009_assignments.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- user_id — uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE
- resource_type — public.assignment_resource_type NOT NULL
- resource_id — uuid NOT NULL
- assigned_by — uuid REFERENCES public.profiles (id) ON DELETE SET NULL
- created_at — timestamptz NOT NULL DEFAULT now()

### `audit_logs`
מיגרציה: `0022_audit.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- actor_user_id — uuid REFERENCES public.profiles (id) ON DELETE SET NULL
- action — text NOT NULL
- entity_type — text
- entity_id — uuid
- metadata — jsonb NOT NULL DEFAULT '{}'::jsonb
- ip — inet
- user_agent — text
- created_at — timestamptz NOT NULL DEFAULT now()

### `beta_participants`
מיגרציה: `20260908205910_platform_admin_beta_participants_events.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- user_id — uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- cohort — text NOT NULL DEFAULT 'Founding Technicians — 2026'
- status — text NOT NULL
- invited_at — timestamptz
- registered_at — timestamptz
- activated_at — timestamptz
- joined_at — timestamptz
- paused_at — timestamptz
- exited_at — timestamptz
- internal_note — text
- created_at — timestamptz NOT NULL DEFAULT now()
- updated_at — timestamptz NOT NULL DEFAULT now()

### `capabilities`
מיגרציה: `0050_v3_capabilities_registry.sql`

- key — text PRIMARY KEY
- value_type — text NOT NULL
- description — text NOT NULL DEFAULT ''

### `checklist_template_items`
מיגרציה: `0020_tasks_ops.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- template_id — uuid NOT NULL REFERENCES public.checklist_templates (id) ON DELETE CASCADE
- label_he — text NOT NULL
- required — boolean NOT NULL DEFAULT false
- sort_order — integer NOT NULL DEFAULT 0

### `checklist_templates`
מיגרציה: `0020_tasks_ops.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- key — text NOT NULL
- name_he — text NOT NULL

### `customer_activities`
מיגרציה: `0010_customers.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- customer_id — uuid NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE
- type — public.activity_type NOT NULL
- title — text NOT NULL
- body — text
- created_by — uuid REFERENCES public.profiles (id) ON DELETE SET NULL
- created_at — timestamptz NOT NULL DEFAULT now()

### `customer_contacts`
מיגרציה: `0010_customers.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- customer_id — uuid NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE
- full_name — text NOT NULL
- role_title — text
- email — text
- phone — text
- is_primary — boolean NOT NULL DEFAULT false
- created_at — timestamptz NOT NULL DEFAULT now()
- updated_at — timestamptz NOT NULL DEFAULT now()

### `customer_notes`
מיגרציה: `0010_customers.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- customer_id — uuid NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE
- body — text NOT NULL
- created_by — uuid REFERENCES public.profiles (id) ON DELETE SET NULL
- created_at — timestamptz NOT NULL DEFAULT now()

### `customers`
מיגרציה: `0010_customers.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- display_name — text NOT NULL
- type — public.customer_type NOT NULL DEFAULT 'private'
- status — public.customer_status NOT NULL DEFAULT 'active'
- legal_name — text
- tax_id — text
- email — text
- phone — text
- billing_address — jsonb NOT NULL DEFAULT '{}'::jsonb
- notes — text
- created_by — uuid REFERENCES public.profiles (id) ON DELETE SET NULL
- created_at — timestamptz NOT NULL DEFAULT now()
- updated_at — timestamptz NOT NULL DEFAULT now()
- deleted_at — timestamptz

### `documents`
מיגרציה: `0013_documents.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- entity_type — public.document_entity_type NOT NULL
- entity_id — uuid NOT NULL
- kind — public.document_kind NOT NULL DEFAULT 'document'
- storage_bucket — text NOT NULL
- storage_path — text NOT NULL
- mime_type — text
- byte_size — integer
- original_filename — text
- captured_at — timestamptz
- created_by — uuid REFERENCES public.profiles (id) ON DELETE SET NULL
- created_at — timestamptz NOT NULL DEFAULT now()

### `equipment`
מיגרציה: `0012_systems.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- site_id — uuid NOT NULL REFERENCES public.sites (id) ON DELETE CASCADE
- system_id — uuid REFERENCES public.systems (id) ON DELETE SET NULL
- zone_id — uuid REFERENCES public.site_zones (id) ON DELETE SET NULL
- category — public.equipment_category NOT NULL DEFAULT 'other'
- status — public.equipment_status NOT NULL DEFAULT 'planned'
- name — text NOT NULL
- manufacturer — text
- model — text
- serial — text
- mac — text
- ip — text
- location_note — text
- installed_at — date
- created_at — timestamptz NOT NULL DEFAULT now()
- updated_at — timestamptz NOT NULL DEFAULT now()

### `feature_flags`
מיגרציה: `0036_beta_feedback.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- name — text NOT NULL UNIQUE
- enabled_for_beta — boolean NOT NULL DEFAULT false
- enabled_for_production — boolean NOT NULL DEFAULT false
- description — text
- created_at — timestamptz NOT NULL DEFAULT now()
- updated_at — timestamptz NOT NULL DEFAULT now()

### `features`
מיגרציה: `0008_features_plans.sql`

- key — text PRIMARY KEY

### `feedback_reports`
מיגרציה: `0036_beta_feedback.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- ticket_id — text NOT NULL UNIQUE
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- user_id — uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE
- report_type — text NOT NULL CHECK (report_type IN ('bug', 'feature', 'general'))
- severity — text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'blocker'))
- status — text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'triage', 'in_progress', 'resolved', 'wont_fix'))
- title — text NOT NULL
- body — text NOT NULL
- page_url — text
- user_agent — text
- viewport — text
- role_key — text
- plan_key — text
- is_beta — boolean NOT NULL DEFAULT false
- screenshot_url — text
- internal_notes — text
- created_at — timestamptz NOT NULL DEFAULT now()
- updated_at — timestamptz NOT NULL DEFAULT now()

### `generated_documents`
מיגרציה: `0044_company_document_system.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- document_type — text NOT NULL
- template_version — text NOT NULL DEFAULT 'quote-v2'
- source_entity_type — text
- source_entity_id — uuid
- revision — int NOT NULL DEFAULT 1
- storage_bucket — text
- storage_key — text
- company_snapshot — jsonb NOT NULL DEFAULT '{}'::jsonb
- customer_snapshot — jsonb
- totals_snapshot — jsonb
- status — text NOT NULL DEFAULT 'generated'
- generated_at — timestamptz NOT NULL DEFAULT now()
- created_by — uuid REFERENCES public.profiles (id) ON DELETE SET NULL
- created_at — timestamptz NOT NULL DEFAULT now()

### `idempotency_keys`
מיגרציה: `0022_audit.sql`

- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- key — text NOT NULL
- method — text NOT NULL
- path — text NOT NULL
- response_status — integer
- response_body — jsonb
- created_at — timestamptz NOT NULL DEFAULT now()

### `invitations`
מיגרציה: `0006_memberships.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- email — text NOT NULL
- role_key — text NOT NULL REFERENCES public.roles (key)
- token_hash — text NOT NULL UNIQUE
- invited_by — uuid REFERENCES public.profiles (id) ON DELETE SET NULL
- expires_at — timestamptz NOT NULL DEFAULT (now() + interval '14 days')
- accepted_at — timestamptz
- created_at — timestamptz NOT NULL DEFAULT now()

### `job_checklist_items`
מיגרציה: `0020_tasks_ops.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- job_id — uuid NOT NULL REFERENCES public.jobs (id) ON DELETE CASCADE
- label_he — text NOT NULL
- required — boolean NOT NULL DEFAULT false
- completed — boolean NOT NULL DEFAULT false
- completed_at — timestamptz
- completed_by — uuid REFERENCES public.profiles (id) ON DELETE SET NULL
- sort_order — integer NOT NULL DEFAULT 0

### `jobs`
מיגרציה: `0017_projects_jobs.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- number — text NOT NULL
- title — text NOT NULL
- kind — public.job_kind NOT NULL DEFAULT 'service'
- status — public.job_status NOT NULL DEFAULT 'scheduled'
- project_id — uuid REFERENCES public.projects (id) ON DELETE SET NULL
- service_call_id — uuid
- customer_id — uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT
- site_id — uuid NOT NULL REFERENCES public.sites (id) ON DELETE RESTRICT
- scheduled_for — timestamptz
- started_at — timestamptz
- completed_at — timestamptz
- completion_notes — text
- created_by — uuid REFERENCES public.profiles (id) ON DELETE SET NULL
- created_at — timestamptz NOT NULL DEFAULT now()
- updated_at — timestamptz NOT NULL DEFAULT now()

### `knowledge_articles`
מיגרציה: `0020_tasks_ops.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- category — text NOT NULL DEFAULT 'general'
- title — text NOT NULL
- body — text NOT NULL
- created_at — timestamptz NOT NULL DEFAULT now()
- updated_at — timestamptz NOT NULL DEFAULT now()

### `leads`
מיגרציה: `0014_leads.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- title — text NOT NULL
- status — public.lead_status NOT NULL DEFAULT 'new'
- source — public.lead_source NOT NULL DEFAULT 'manual'
- owner_user_id — uuid REFERENCES public.profiles (id) ON DELETE SET NULL
- customer_id — uuid REFERENCES public.customers (id) ON DELETE SET NULL
- site_id — uuid REFERENCES public.sites (id) ON DELETE SET NULL
- contact_name — text
- email — text
- phone — text
- notes — text
- created_at — timestamptz NOT NULL DEFAULT now()
- updated_at — timestamptz NOT NULL DEFAULT now()

### `notification_preferences`
מיגרציה: `0021_notifications.sql`

- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- user_id — uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE
- event_type — text NOT NULL
- in_app — boolean NOT NULL DEFAULT true
- email — boolean NOT NULL DEFAULT true
- push — boolean NOT NULL DEFAULT true

### `notifications`
מיגרציה: `0021_notifications.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- recipient_user_id — uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE
- type — text NOT NULL
- title — text NOT NULL
- body — text
- entity_type — text
- entity_id — uuid
- payload — jsonb NOT NULL DEFAULT '{}'::jsonb
- read_at — timestamptz
- created_at — timestamptz NOT NULL DEFAULT now()

### `pdf_document_templates`
מיגרציה: `0043_settings_rbac_pdf_templates.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- name — text NOT NULL
- doc_type — text NOT NULL CHECK (doc_type IN ('quote', 'service', 'project'))
- status — text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft'))
- is_default — boolean NOT NULL DEFAULT false
- config — jsonb NOT NULL DEFAULT '{}'::jsonb
- created_at — timestamptz NOT NULL DEFAULT now()
- updated_at — timestamptz NOT NULL DEFAULT now()

### `permissions`
מיגרציה: `0005_rbac.sql`

- key — text PRIMARY KEY
- group_key — text NOT NULL
- description — text

### `plan_capabilities`
מיגרציה: `0050_v3_capabilities_registry.sql`

- plan_key — text NOT NULL REFERENCES public.plans (key) ON DELETE CASCADE
- capability_key — text NOT NULL REFERENCES public.capabilities (key) ON DELETE CASCADE
- enabled — boolean NOT NULL DEFAULT false
- limit_value — integer NULL
- config — jsonb NOT NULL DEFAULT '{}'::jsonb

### `plan_features`
מיגרציה: `0008_features_plans.sql`

- plan_key — text NOT NULL REFERENCES public.plans (key) ON DELETE CASCADE
- feature_key — text NOT NULL REFERENCES public.features (key) ON DELETE CASCADE

### `plan_limits`
מיגרציה: `0008_features_plans.sql`

- plan_key — text NOT NULL REFERENCES public.plans (key) ON DELETE CASCADE
- limit_key — text NOT NULL
- limit_value — integer NOT NULL

### `plans`
מיגרציה: `0008_features_plans.sql`

- key — text PRIMARY KEY
- label_he — text NOT NULL
- label_en — text NOT NULL
- is_public — boolean NOT NULL DEFAULT true

### `platform_admin_events`
מיגרציה: `20260908205910_platform_admin_beta_participants_events.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- actor_user_id — uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT
- action — text NOT NULL
- target_user_id — uuid REFERENCES public.profiles (id) ON DELETE SET NULL
- target_workspace_id — uuid REFERENCES public.workspaces (id) ON DELETE SET NULL
- metadata — jsonb NOT NULL DEFAULT '{}'::jsonb
- created_at — timestamptz NOT NULL DEFAULT now()

### `product_categories`
מיגרציה: `0015_catalog.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- key — text NOT NULL
- name_he — text NOT NULL
- sort_order — integer NOT NULL DEFAULT 0

### `products`
מיגרציה: `0015_catalog.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- category_id — uuid REFERENCES public.product_categories (id) ON DELETE SET NULL
- sku — text NOT NULL
- name — text NOT NULL
- unit — text NOT NULL DEFAULT 'unit'
- list_price — numeric(12, 2) NOT NULL DEFAULT 0
- cost — numeric(12, 2) NOT NULL DEFAULT 0
- vat_eligible — boolean NOT NULL DEFAULT true
- is_labor — boolean NOT NULL DEFAULT false
- is_active — boolean NOT NULL DEFAULT true
- metadata — jsonb NOT NULL DEFAULT '{}'::jsonb
- created_at — timestamptz NOT NULL DEFAULT now()
- updated_at — timestamptz NOT NULL DEFAULT now()

### `profiles`
מיגרציה: `0003_profiles.sql`

- id — uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE
- full_name — text NOT NULL DEFAULT ''
- phone — text
- locale — text NOT NULL DEFAULT 'he'
- avatar_path — text
- last_workspace_id — uuid
- created_at — timestamptz NOT NULL DEFAULT now()
- updated_at — timestamptz NOT NULL DEFAULT now()

### `projects`
מיגרציה: `0017_projects_jobs.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- name — text NOT NULL
- status — public.project_status NOT NULL DEFAULT 'draft'
- customer_id — uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT
- site_id — uuid REFERENCES public.sites (id) ON DELETE SET NULL
- source_quote_id — uuid REFERENCES public.quotes (id) ON DELETE SET NULL
- assigned_to — uuid REFERENCES public.profiles (id) ON DELETE SET NULL
- created_by — uuid REFERENCES public.profiles (id) ON DELETE SET NULL
- created_at — timestamptz NOT NULL DEFAULT now()
- updated_at — timestamptz NOT NULL DEFAULT now()

### `quote_events`
מיגרציה: `0016_quotes.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- quote_id — uuid NOT NULL REFERENCES public.quotes (id) ON DELETE CASCADE
- event_type — text NOT NULL
- actor_id — uuid REFERENCES public.profiles (id) ON DELETE SET NULL
- metadata — jsonb NOT NULL DEFAULT '{}'::jsonb
- created_at — timestamptz NOT NULL DEFAULT now()

### `quote_items`
מיגרציה: `0016_quotes.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- quote_id — uuid NOT NULL REFERENCES public.quotes (id) ON DELETE CASCADE
- product_id — uuid REFERENCES public.products (id) ON DELETE SET NULL
- item_type — public.quote_item_type NOT NULL DEFAULT 'catalog'
- description — text NOT NULL DEFAULT ''
- qty — numeric(12, 2) NOT NULL DEFAULT 1
- unit_price — numeric(12, 2) NOT NULL DEFAULT 0
- cost — numeric(12, 2) NOT NULL DEFAULT 0
- discount — numeric(12, 2) NOT NULL DEFAULT 0
- line_net — numeric(12, 2) NOT NULL DEFAULT 0
- sort_order — integer NOT NULL DEFAULT 0

### `quote_package_items`
מיגרציה: `0034_cpq_phase2.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- package_id — uuid NOT NULL REFERENCES public.quote_packages (id) ON DELETE CASCADE
- product_id — uuid REFERENCES public.products (id) ON DELETE SET NULL
- description — text NOT NULL DEFAULT ''
- qty — numeric(12, 2) NOT NULL DEFAULT 1
- sort_order — integer NOT NULL DEFAULT 0

### `quote_packages`
מיגרציה: `0034_cpq_phase2.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- name — text NOT NULL
- description — text NOT NULL DEFAULT ''
- category — text NOT NULL DEFAULT 'general'
- is_active — boolean NOT NULL DEFAULT true
- created_by — uuid REFERENCES public.profiles (id) ON DELETE SET NULL
- updated_by — uuid REFERENCES public.profiles (id) ON DELETE SET NULL
- created_at — timestamptz NOT NULL DEFAULT now()
- updated_at — timestamptz NOT NULL DEFAULT now()

### `quote_public_access`
מיגרציה: `20260816125639_quote_cpq_revenue_loop.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- quote_id — uuid NOT NULL REFERENCES public.quotes (id) ON DELETE CASCADE
- version — integer NOT NULL
- token_hash — text NOT NULL
- expires_at — timestamptz
- revoked_at — timestamptz
- created_at — timestamptz NOT NULL DEFAULT now()

### `quote_sections`
מיגרציה: `0034_cpq_phase2.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- quote_id — uuid NOT NULL REFERENCES public.quotes (id) ON DELETE CASCADE
- name — text NOT NULL DEFAULT ''
- sort_order — integer NOT NULL DEFAULT 0
- discount_type — text NOT NULL DEFAULT 'amount'
- discount_value — numeric(12, 2) NOT NULL DEFAULT 0
- collapsed — boolean NOT NULL DEFAULT false
- created_at — timestamptz NOT NULL DEFAULT now()
- updated_at — timestamptz NOT NULL DEFAULT now()

### `quote_template_items`
מיגרציה: `0015_catalog.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- template_id — uuid NOT NULL REFERENCES public.quote_templates (id) ON DELETE CASCADE
- product_id — uuid REFERENCES public.products (id) ON DELETE SET NULL
- description — text NOT NULL
- qty — numeric(12, 2) NOT NULL DEFAULT 1
- sort_order — integer NOT NULL DEFAULT 0

### `quote_templates`
מיגרציה: `0015_catalog.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- key — text NOT NULL
- name_he — text NOT NULL

### `quote_versions`
מיגרציה: `0016_quotes.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- quote_id — uuid NOT NULL REFERENCES public.quotes (id) ON DELETE CASCADE
- version — integer NOT NULL
- snapshot — jsonb NOT NULL
- created_by — uuid REFERENCES public.profiles (id) ON DELETE SET NULL
- created_at — timestamptz NOT NULL DEFAULT now()

### `quotes`
מיגרציה: `0016_quotes.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- number — text NOT NULL
- status — public.quote_status NOT NULL DEFAULT 'draft'
- customer_id — uuid REFERENCES public.customers (id) ON DELETE RESTRICT
- site_id — uuid REFERENCES public.sites (id) ON DELETE SET NULL
- lead_id — uuid REFERENCES public.leads (id) ON DELETE SET NULL
- owner_user_id — uuid REFERENCES public.profiles (id) ON DELETE SET NULL
- currency — text NOT NULL DEFAULT 'ILS'
- vat_percent — numeric(5, 2) NOT NULL DEFAULT 18
- discount_type — text
- discount_value — numeric(12, 2) NOT NULL DEFAULT 0
- subtotal_net — numeric(12, 2) NOT NULL DEFAULT 0
- vat_amount — numeric(12, 2) NOT NULL DEFAULT 0
- total_gross — numeric(12, 2) NOT NULL DEFAULT 0
- cost_total — numeric(12, 2) NOT NULL DEFAULT 0
- margin_amount — numeric(12, 2) NOT NULL DEFAULT 0
- margin_percent — numeric(8, 2) NOT NULL DEFAULT 0
- valid_until — date
- payment_terms — text
- customer_notes — text
- internal_notes — text
- version — integer NOT NULL DEFAULT 1
- created_by — uuid REFERENCES public.profiles (id) ON DELETE SET NULL
- created_at — timestamptz NOT NULL DEFAULT now()
- updated_at — timestamptz NOT NULL DEFAULT now()
- deleted_at — timestamptz

### `role_permissions`
מיגרציה: `0005_rbac.sql`

- role_key — text NOT NULL REFERENCES public.roles (key) ON DELETE CASCADE
- permission_key — text NOT NULL REFERENCES public.permissions (key) ON DELETE CASCADE

### `roles`
מיגרציה: `0005_rbac.sql`

- key — text PRIMARY KEY
- label_he — text NOT NULL
- label_en — text NOT NULL
- default_scope — text NOT NULL
- is_system — boolean NOT NULL DEFAULT true

### `service_calls`
מיגרציה: `0018_service.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- status — public.service_call_status NOT NULL DEFAULT 'open'
- priority — public.service_call_priority NOT NULL DEFAULT 'normal'
- customer_id — uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT
- site_id — uuid NOT NULL REFERENCES public.sites (id) ON DELETE RESTRICT
- system_id — uuid REFERENCES public.systems (id) ON DELETE SET NULL
- title — text NOT NULL
- description — text
- created_by — uuid REFERENCES public.profiles (id) ON DELETE SET NULL
- created_at — timestamptz NOT NULL DEFAULT now()
- updated_at — timestamptz NOT NULL DEFAULT now()

### `service_contracts`
מיגרציה: `0018_service.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- customer_id — uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT
- site_id — uuid REFERENCES public.sites (id) ON DELETE SET NULL
- plan — public.service_contract_plan NOT NULL DEFAULT 'basic'
- status — public.service_contract_status NOT NULL DEFAULT 'active'
- starts_on — date
- ends_on — date
- created_at — timestamptz NOT NULL DEFAULT now()
- updated_at — timestamptz NOT NULL DEFAULT now()

### `site_readiness`
מיגרציה: `0020_tasks_ops.sql`

- site_id — uuid PRIMARY KEY REFERENCES public.sites (id) ON DELETE CASCADE
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- cctv — smallint
- alarm — smallint
- access_control — smallint
- network — smallint
- power — smallint
- recording — smallint
- connectivity — smallint
- notes — text
- updated_at — timestamptz NOT NULL DEFAULT now()

### `site_timeline_events`
מיגרציה: `0011_sites.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- site_id — uuid NOT NULL REFERENCES public.sites (id) ON DELETE CASCADE
- event_type — public.timeline_event_type NOT NULL
- title — text NOT NULL
- body — text
- actor_id — uuid REFERENCES public.profiles (id) ON DELETE SET NULL
- source_type — text
- source_id — uuid
- created_at — timestamptz NOT NULL DEFAULT now()

### `site_zones`
מיגרציה: `0011_sites.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- site_id — uuid NOT NULL REFERENCES public.sites (id) ON DELETE CASCADE
- name — text NOT NULL
- sort_order — integer NOT NULL DEFAULT 0
- created_at — timestamptz NOT NULL DEFAULT now()

### `sites`
מיגרציה: `0011_sites.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- customer_id — uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT
- code — text NOT NULL
- name — text NOT NULL
- address — jsonb NOT NULL DEFAULT '{}'::jsonb
- installation_status — public.site_installation_status NOT NULL DEFAULT 'planned'
- access_notes — text
- public_token — text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex')
- created_by — uuid REFERENCES public.profiles (id) ON DELETE SET NULL
- created_at — timestamptz NOT NULL DEFAULT now()
- updated_at — timestamptz NOT NULL DEFAULT now()
- deleted_at — timestamptz

### `subscriptions`
מיגרציה: `0008_features_plans.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL UNIQUE REFERENCES public.workspaces (id) ON DELETE CASCADE
- plan_key — text NOT NULL REFERENCES public.plans (key)
- status — public.subscription_status NOT NULL DEFAULT 'active'
- current_period_end — timestamptz
- provider_ref — text
- created_at — timestamptz NOT NULL DEFAULT now()
- updated_at — timestamptz NOT NULL DEFAULT now()

### `systems`
מיגרציה: `0012_systems.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- site_id — uuid NOT NULL REFERENCES public.sites (id) ON DELETE CASCADE
- type — public.system_type NOT NULL
- name — text NOT NULL
- status — public.system_status NOT NULL DEFAULT 'planned'
- manufacturer — text
- model — text
- panel_id — text
- metadata — jsonb NOT NULL DEFAULT '{}'::jsonb
- created_at — timestamptz NOT NULL DEFAULT now()
- updated_at — timestamptz NOT NULL DEFAULT now()

### `tasks`
מיגרציה: `0020_tasks_ops.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- type — public.task_type NOT NULL DEFAULT 'other'
- status — public.task_status NOT NULL DEFAULT 'open'
- title — text NOT NULL
- due_at — timestamptz
- assignee_id — uuid REFERENCES public.profiles (id) ON DELETE SET NULL
- customer_id — uuid REFERENCES public.customers (id) ON DELETE SET NULL
- site_id — uuid REFERENCES public.sites (id) ON DELETE SET NULL
- lead_id — uuid REFERENCES public.leads (id) ON DELETE SET NULL
- quote_id — uuid REFERENCES public.quotes (id) ON DELETE SET NULL
- job_id — uuid REFERENCES public.jobs (id) ON DELETE SET NULL
- created_by — uuid REFERENCES public.profiles (id) ON DELETE SET NULL
- created_at — timestamptz NOT NULL DEFAULT now()
- updated_at — timestamptz NOT NULL DEFAULT now()

### `warranties`
מיגרציה: `0019_warranties.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- number — text NOT NULL
- public_token — text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex')
- type — public.warranty_type NOT NULL DEFAULT 'installation'
- status — public.warranty_status NOT NULL DEFAULT 'active'
- customer_id — uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT
- site_id — uuid NOT NULL REFERENCES public.sites (id) ON DELETE RESTRICT
- starts_on — date NOT NULL
- ends_on — date NOT NULL
- document_id — uuid REFERENCES public.documents (id) ON DELETE SET NULL
- created_at — timestamptz NOT NULL DEFAULT now()
- updated_at — timestamptz NOT NULL DEFAULT now()

### `workspace_counters`
מיגרציה: `0004_workspaces.sql`

- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- kind — text NOT NULL
- last_value — integer NOT NULL DEFAULT 0

### `workspace_feature_overrides`
מיגרציה: `0008_features_plans.sql`

- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- feature_key — text NOT NULL REFERENCES public.features (key) ON DELETE CASCADE
- enabled — boolean NOT NULL

### `workspace_memberships`
מיגרציה: `0006_memberships.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- user_id — uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE
- role_key — text NOT NULL REFERENCES public.roles (key)
- status — public.membership_status NOT NULL DEFAULT 'active'
- technician_code — text
- program_type — text
- program_started_at — timestamptz
- program_ends_at — timestamptz
- created_at — timestamptz NOT NULL DEFAULT now()
- updated_at — timestamptz NOT NULL DEFAULT now()

### `workspace_roles`
מיגרציה: `0043_settings_rbac_pdf_templates.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- workspace_id — uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE
- key — text NOT NULL
- label_he — text NOT NULL
- description — text NOT NULL DEFAULT ''
- is_system — boolean NOT NULL DEFAULT false
- is_locked — boolean NOT NULL DEFAULT false
- base_role_key — text NOT NULL REFERENCES public.roles (key)
- grants — jsonb NOT NULL DEFAULT '[]'::jsonb
- created_at — timestamptz NOT NULL DEFAULT now()
- updated_at — timestamptz NOT NULL DEFAULT now()

### `workspace_settings`
מיגרציה: `0004_workspaces.sql`

- workspace_id — uuid PRIMARY KEY REFERENCES public.workspaces (id) ON DELETE CASCADE
- branding — jsonb NOT NULL DEFAULT '{}'::jsonb
- quotes — jsonb NOT NULL DEFAULT '{}'::jsonb
- taxes — jsonb NOT NULL DEFAULT '{}'::jsonb
- scheduling — jsonb NOT NULL DEFAULT '{}'::jsonb
- notifications — jsonb NOT NULL DEFAULT '{}'::jsonb
- localization — jsonb NOT NULL DEFAULT '{"locale":"he","currency":"ILS"}'::jsonb
- created_at — timestamptz NOT NULL DEFAULT now()
- updated_at — timestamptz NOT NULL DEFAULT now()

### `workspaces`
מיגרציה: `0004_workspaces.sql`

- id — uuid PRIMARY KEY DEFAULT gen_random_uuid()
- name — text NOT NULL
- slug — text UNIQUE
- status — public.workspace_status NOT NULL DEFAULT 'active'
- timezone — text NOT NULL DEFAULT 'Asia/Jerusalem'
- country_code — text NOT NULL DEFAULT 'IL'
- vat_percent — numeric(5, 2) NOT NULL DEFAULT 18.00
- created_at — timestamptz NOT NULL DEFAULT now()
- updated_at — timestamptz NOT NULL DEFAULT now()

---

## 12. כל קבצי המיגרציות

- `0001_extensions.sql`
- `0002_updated_at.sql`
- `0003_profiles.sql`
- `0004_workspaces.sql`
- `0005_rbac.sql`
- `0006_memberships.sql`
- `0007_auth_helpers.sql`
- `0008_features_plans.sql`
- `0009_assignments.sql`
- `0010_customers.sql`
- `0011_sites.sql`
- `0012_systems.sql`
- `0013_documents.sql`
- `0014_leads.sql`
- `0015_catalog.sql`
- `0016_quotes.sql`
- `0017_projects_jobs.sql`
- `0018_service.sql`
- `0019_warranties.sql`
- `0020_tasks_ops.sql`
- `0021_notifications.sql`
- `0022_audit.sql`
- `0023_storage.sql`
- `0024_grants.sql`
- `0025_workspace_defaults.sql`
- `0026_realtime.sql`
- `0027_invitations_rpc.sql`
- `0028_entitlements_rpc.sql`
- `0029_documents_update.sql`
- `0030_foundation_directory_audit.sql`
- `0031_plan_storage_limits.sql`
- `0032_projects_source_quote_unique.sql`
- `0033_leads_opportunity.sql`
- `0034_cpq_phase2.sql`
- `0035_workspace_business_type.sql`
- `0036_beta_feedback.sql`
- `0037_backfill_document_byte_size.sql`
- `0038_plan_quota_limits.sql`
- `0039_invite_accept_enforcement.sql`
- `0040_hard_quota_enforcement.sql`
- `0041_entitlements_effective_overrides.sql`
- `0042_platform_admin_bootstrap_hygiene.sql`
- `0043_settings_rbac_pdf_templates.sql`
- `0044_company_document_system.sql`
- `0045_pdf_template_archived.sql`
- `0046_auth_contract_technician_scope.sql`
- `0047_technician_commercial_isolation.sql`
- `0048_technician_seed_grants_nonempty.sql`
- `0048_v3_plan_labels_free_pro_enterprise.sql`
- `0049_technician_seed_grants_nonempty.sql`
- `0050_v3_capabilities_registry.sql`
- `20260816125639_quote_cpq_revenue_loop.sql`
- `20260816131758_quote_template_lines.sql`
- `20260826220000_catalog_hierarchy_product_fields.sql`
- `20260905155735_catalog_import_commit_rpc.sql`
- `20260905162000_restore_catalog_hierarchy_seed_no_products.sql`
- `20260905163318_catalog_import_commit_remove_test_force_fail.sql`
- `20260908200000_profiles_recognition_badges.sql`
- `20260908205910_platform_admin_beta_participants_events.sql`
- `20260908210000_retire_founding_technician_role.sql`

---

## 13. API scripts

- `apps/api/scripts/_debug_prod_doc_upload.py`
- `apps/api/scripts/_field_photo_regression.py`
- `apps/api/scripts/_forensics_api_deploy.py`
- `apps/api/scripts/_gen_studio_fixtures.py`
- `apps/api/scripts/_generate_full_inventory_md.py`
- `apps/api/scripts/_merge_product_docs.py`
- `apps/api/scripts/_probe_api_image_catalog.py`
- `apps/api/scripts/_qa_send_check.py`
- `apps/api/scripts/_reprobe2_external.py`
- `apps/api/scripts/_reprobe_external_failures.py`
- `apps/api/scripts/apply_sql_via_mcp_helper.py`
- `apps/api/scripts/auth_live_verification.py`
- `apps/api/scripts/beta_014_closeout_smoke.py`
- `apps/api/scripts/beta_016_commercial_isolation_matrix.py`
- `apps/api/scripts/beta_cctv_blocker_regression.py`
- `apps/api/scripts/beta_gate_backup_drill.py`
- `apps/api/scripts/beta_gate_security_checklist.py`
- `apps/api/scripts/beta_integrity_smoke.py`
- `apps/api/scripts/beta_task04_local_e2e.py`
- `apps/api/scripts/beta_technician_qa_seed.py`
- `apps/api/scripts/bootstrap_platform_admin.py`
- `apps/api/scripts/debug_quote_errors.py`
- `apps/api/scripts/durability/_probe_deploy_identity.py`
- `apps/api/scripts/durability/beta_015_durability_matrix.py`
- `apps/api/scripts/durability/gate10b_drill.py`
- `apps/api/scripts/durability/logical_backup.py`
- `apps/api/scripts/durability/logical_restore.py`
- `apps/api/scripts/durability/storage_reconcile.py`
- `apps/api/scripts/e2e_quote_audit.py`
- `apps/api/scripts/e2e_quote_flow_live.py`
- `apps/api/scripts/e2e_quote_verify_8000.py`
- `apps/api/scripts/fetch_q12_pdf.py`
- `apps/api/scripts/final_api_closeout_smoke.py`
- `apps/api/scripts/final_external_beta_smoke.py`
- `apps/api/scripts/gen_fixture_quote_v2.py`
- `apps/api/scripts/get_owner_token.py`
- `apps/api/scripts/import_quote_500.py`
- `apps/api/scripts/platform_admin_beta_closeout.py`
- `apps/api/scripts/probe_pdf_rebuild.py`
- `apps/api/scripts/smoke_share_truth.py`
- `apps/api/scripts/task12_e2e_verification.py`
- `apps/api/scripts/verify_phase1_critical_flows.py`

## 14. API tests

- `apps/api/tests/conftest.py`
- `apps/api/tests/test_api_foundation.py`
- `apps/api/tests/test_apply_package.py`
- `apps/api/tests/test_apply_template.py`
- `apps/api/tests/test_authorize.py`
- `apps/api/tests/test_authz_scope.py`
- `apps/api/tests/test_catalog_attrs.py`
- `apps/api/tests/test_catalog_import.py`
- `apps/api/tests/test_catalog_import_http.py`
- `apps/api/tests/test_cctv_hardening.py`
- `apps/api/tests/test_cctv_recommend.py`
- `apps/api/tests/test_cctv_sizing_parity.py`
- `apps/api/tests/test_company_document_system.py`
- `apps/api/tests/test_dashboard.py`
- `apps/api/tests/test_documents_durability.py`
- `apps/api/tests/test_domain_api.py`
- `apps/api/tests/test_domain_live.py`
- `apps/api/tests/test_entitlements_effective.py`
- `apps/api/tests/test_entitlements_fail_closed.py`
- `apps/api/tests/test_entitlements_live.py`
- `apps/api/tests/test_http_supabase.py`
- `apps/api/tests/test_invite_accept_errors.py`
- `apps/api/tests/test_invite_accept_live.py`
- `apps/api/tests/test_leads.py`
- `apps/api/tests/test_limits.py`
- `apps/api/tests/test_occupancy.py`
- `apps/api/tests/test_pdf_studio_verification.py`
- `apps/api/tests/test_pdf_template_preview.py`
- `apps/api/tests/test_platform_admin.py`
- `apps/api/tests/test_platform_admin_live.py`
- `apps/api/tests/test_platform_beta_closeout_unit.py`
- `apps/api/tests/test_pricing.py`
- `apps/api/tests/test_project_from_quote.py`
- `apps/api/tests/test_public_quote_boundary.py`
- `apps/api/tests/test_quota_limits.py`
- `apps/api/tests/test_quota_live.py`
- `apps/api/tests/test_quote_item_sku_and_share_policy.py`
- `apps/api/tests/test_quote_pdf.py`
- `apps/api/tests/test_quote_phase2.py`
- `apps/api/tests/test_quote_share_truth.py`
- `apps/api/tests/test_quote_signature.py`
- `apps/api/tests/test_quote_snapshot.py`
- `apps/api/tests/test_quote_validation.py`
- `apps/api/tests/test_service_client_boundary_live.py`
- `apps/api/tests/test_tenant_isolation.py`
- `apps/api/tests/test_usage.py`
- `apps/api/tests/test_v3_p1_t02_capabilities.py`

---

## 15. packages/ — קבצים

- `packages/api-client/package.json`
- `packages/api-client/src/index.ts`
- `packages/authz/catalog.json`
- `packages/authz/package.json`
- `packages/authz/README.md`
- `packages/authz/src/index.ts`
- `packages/design-system/package.json`
- `packages/design-system/src/index.ts`
- `packages/design-system/src/tokens.css`
- `packages/design-system/src/tokens.json`
- `packages/design-system/tsconfig.json`
- `packages/types/src/database.ts`
- `packages/types/src/index.ts`
- `packages/ui/package.json`
- `packages/ui/src/Button.tsx`
- `packages/ui/src/cn.ts`
- `packages/ui/src/Controls.tsx`
- `packages/ui/src/Display.tsx`
- `packages/ui/src/Feedback.tsx`
- `packages/ui/src/Field.tsx`
- `packages/ui/src/index.ts`
- `packages/ui/src/Overlay.tsx`
- `packages/ui/src/ProgressList.tsx`
- `packages/ui/src/Table.tsx`
- `packages/ui/src/TabsHeader.tsx`
- `packages/ui/tests/primitives.test.tsx`
- `packages/ui/tests/setup.ts`
- `packages/ui/tsconfig.json`
- `packages/ui/vitest.config.ts`

---

## 16. Docs/ — כל המסמכים

- `Docs/architecture/V1-TO-V2.md`
- `Docs/architecture/V2-API.md`
- `Docs/architecture/V2-ARCHITECTURE.md`
- `Docs/architecture/V2-IA.md`
- `Docs/architecture/V2-MOBILE.md`
- `Docs/architecture/V2-PUBLIC-WEB.md`
- `Docs/architecture/V2-ROADMAP.md`
- `Docs/architecture/V2-SAAS-EXPERIENCE.md`
- `Docs/architecture/V2-WEB.md`
- `Docs/architecture/V3-PHASE0-DECISION-MEMO.md`
- `Docs/architecture/V3-PHASE1-TECHNICAL-SPEC.md`
- `Docs/architecture/V3-READINESS-AUDIT.md`
- `Docs/BETA_015_EXTERNAL_READINESS.md`
- `Docs/BETA_016_COMMERCIAL_ISOLATION.md`
- `Docs/BETA_BACKUP_OPERATOR_CHECKLIST.md`
- `Docs/BETA_GATE.md`
- `Docs/BETA_GATE_E2E.md`
- `Docs/database/V2-DATABASE-DESIGN.md`
- `Docs/development/CONTRIBUTING.md`
- `Docs/development/SETUP.md`
- `Docs/FINAL_EXTERNAL_BETA_SMOKE.md`
- `Docs/GATE_10_BACKUP_RESTORE_DRILL.md`
- `Docs/GATE_10B_DURABILITY.md`
- `Docs/mobile/V2-OFFLINE-SYNC.md`
- `Docs/operations/STAGING.md`
- `Docs/operations/VERCEL.md`
- `Docs/PRODUCT_STATUS_UNIFIED.md`
- `Docs/RECOVERY_RUNBOOK.md`
- `Docs/security/THREAT-MODEL.md`
- `Docs/security/V2-RBAC.md`
- `Docs/security/V2-RLS.md`
- `Docs/SITE-SECURE-CONTEXT.md`
- `Docs/SITE-SECURE-HOW-IT-WORKS.md`
- `Docs/TASK_13_BUILD_SYSTEM_V1_ARCHITECTURE_AUDIT.md`
- `Docs/ux/LOTTIE-REGISTRY.md`
- `Docs/ux/V2-APP-SHELL.md`
- `Docs/ux/V2-CRM-SPEC.md`
- `Docs/ux/V2-DASHBOARD-SPEC.md`
- `Docs/ux/V2-DESIGN-SYSTEM.md`
- `Docs/ux/V2-UX-PSYCHOLOGY.md`

---

## 17. Deploy / config files

- `render.yaml`
- `vercel.json`
- `package.json`
- `deploy/compose.staging.yml`
- `deploy/Dockerfile.api`
- `deploy/Dockerfile.web`
- `deploy/nginx.web.conf`
- `supabase/config.toml`
- `.env.example`
- `apps/web/package.json`
- `apps/api/pyproject.toml`
- `apps/web/vite.config.ts`
- `apps/web/tsconfig.json`

---

## 18. מה שאין בריפו (נבדק)

- `apps/mobile` קיים? **False**
- מופעי `leaflet` בקוד web+api: **0**
- מופעי `mapbox` בקוד web+api: **0**
- מופעי `MapContainer` בקוד web+api: **0**
- מופעי `geofence` בקוד web+api: **0**
- מופעי `stripe` בקוד web+api: **0**
- מופעי `patrol_checkpoint` בקוד web+api: **0**

## 19. הערת שלמות

המלאי כולל כל קובץ route/component/lib, כל endpoint מעוטר, כל CREATE TABLE שחולץ ממיגרציות,
כל הרשאה בקטלוג, כל מיגרציה/סקריפט/טסט/מסמך. לא כולל: תוכן מלא של כל פונקציה, node_modules,
קבצי build, גיבויי vault, סודות `.env`.

**סוף מלאי.**

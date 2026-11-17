# P1 — תוכנית פורטל לקוחות (תכנון בלבד)

תאריך: 2026-11-17  
סטטוס: תכנון בלבד — **אין קוד בפריט זה**.  
יעד MVP: לקוח נכנס בלי סיסמה (SMS / וואטסאפ), רואה רק את האתרים והמסמכים שמותרים לו, ופותח קריאת שירות.

---

## 1. Audit — מה קיים היום

### 1.1 Frontend (`apps/web`)

| נתיב | תפקיד | מצב |
|------|--------|-----|
| `src/routes/portal/route.tsx` | מעטפת `/portal` | קיים |
| `src/routes/portal/index.tsx` | בית פורטל: פרופיל, אתרים, התקנות, ציוד, אחריות, הצעות, שירות, מסמכים | קיים — UI רזה, דורש עיצוב מחדש לדפי MVP |
| `src/routes/portal/choose.tsx` | בחירת grant כשיש כמה לקוחות | קיים — לשמר לוגיקה |
| `src/routes/portal/invite/$token.tsx` | קבלת הזמנה אחרי login/register באימייל | קיים — **לא מתאים** לזרימת OTP בלי סיסמה |
| `src/components/customers/CustomerPortalAccess.tsx` + `portal-build.ts` | סטודיו staff: הזמנה, העתקת קישור, שליחה מחדש, ביטול | קיים ופעיל במסך לקוח (מוסתר כש־`is_demo`) |

**מסקנה UI:** מעטפת הפורטל + מודל ה־grants + הסטודיו למשרד — **לשימוש מחדש**. דפי MVP (בית עשיר, הצעות, התקנות/ביקורים, תיק אתר, אחריות, קריאת שירות) וזרימת התחברות — **לבנייה מחדש / הרחבה משמעותית**.

### 1.2 API (`apps/api`)

| רכיב | נתיב | מצב |
|------|------|-----|
| Router | `app/routers/customer_portal.py` | **קיים במלואו** — staff CRUD + invite peek/accept + session + home + document URL |
| Helpers | `app/portal_access.py` | קיים — capabilities, strip של שדות אסורים (`FORBIDDEN_PORTAL_KEYS`), פרויקציות |
| RPC | `peek_customer_portal_invite`, `accept_customer_portal_invite` | במיגרציה `20260926213103_customer_portal_foundation.sql` |
| טעינה ב־`main.py` | — | **⛔ ה־router לא נטען** (`include_router(customer_portal…)` חסר). ה־API החי לא חושף את הנתיבים עד חיבור מפורש. |

Endpoints קיימים (לא מחוברים ל־app כרגע):

- Staff: `GET/POST …/customers/{id}/portal`, `…/link`, `…/resend`, `…/revoke`
- Customer: `GET /portal/invites/peek`, `POST /portal/invites/accept`, `GET /portal/session`, `GET /portal/access/{access_id}`, `POST …/documents/{id}/url`

**מסקנה API:** לוגיקת הרשאות, home projection, ו־document signing — **לשימוש מחדש** אחרי חיבור ה־router. Auth באימייל+סיסמה דרך Supabase users — **להחלפה / שכבה נוספת** ל־OTP לפי טלפון.

### 1.3 סכמה ו־RLS

- `customer_portal_access` — grant נפרד מ־`workspace_memberships` (מפורש במיגרציה: accept **לא** יוצר membership ולא נוגע במושבים).
- `customer_portal_invite` — token_hash, TTL 7 ימים, delivery `copy|email`.
- `portal_login_events` — ביקורת כניסות.
- טבלאות portal: RLS מופעל + FORCE; **אין מדיניות ל־anon/authenticated** — גישה רק דרך `service_role` אחרי authorize בשרת.
- `documents.visibility` ∈ `{internal, customer}` — ברירת מחדל internal.
- Scope נוכחי: **רק `scope='customer'`** עם `site_id IS NULL`. הרשאה לפי אתר **עדיין לא ממומשת בסכמה** (constraint חוסם).

Capabilities מוגדרות:

`portal.profile.view`, `sites`, `installations`, `equipment`, `warranties`, `quotes`, `documents`, `service`.

### 1.4 Auth כיום

- Portal user = `auth.users` רגיל (אימייל+סיסמה / register).
- Invite דורש שהמשתמש המחובר תואם לאימייל בהזמנה (`wrong_account`).
- אין OTP SMS/WhatsApp, אין principal type נפרד מ־workspace member ברמת Supabase (ההפרדה היא בטבלת grant בלבד).

---

## 2. Reuse vs rebuild

| רכיב | החלטה | הערות |
|------|--------|--------|
| `customer_portal_access` + capabilities | **Reuse** | להרחיב scope לאתר / איש קשר |
| `peek` / `accept` RPC | **Reuse כבסיס** | לשמור לקישורי אימייל; OTP יהיה מסלול נפרד |
| `portal_access.py` + `FORBIDDEN_PORTAL_KEYS` | **Reuse** | להרחיב רשימת איסורים לפי MVP |
| `_build_home` / document URL | **Reuse + refine** | לפצל לדפי משנה; לסנן לפי `site_id` |
| Staff `CustomerPortalAccess` | **Reuse** | להוסיף הזמנת טלפון / ערוץ OTP |
| `/portal` shell + choose | **Reuse מבנה** | עיצוב עברית־ראשון, light |
| Invite email+password flow | **Rebuild UX** | נשאר כגיבוי; הכניסה הראשית = OTP |
| חיבור router ב־`main.py` | **חובה לפני כל פיתוח** | בלי זה הפורטל מת מול API |
| Site-scoped grants | **Build חדש (מיגרציה)** | שינוי constraint + RLS/API filters |
| OTP session (SMS/WA) | **Build חדש** | טבלאות challenge + provider adapter |
| דפי MVP מעוצבים | **Build חדש על בסיס home** | לא להמשיך את רשימות ה־`<p>` הנוכחיות כ־UX סופי |
| קריאת שירות (יצירה) | **Build חדש** | היום רק `service` לקריאה ברשימה |

---

## 3. התחברות בלי סיסמה (OTP)

### 3.1 מודל משתמש

- **Portal principal ≠ workspace member.**  
  אסור ליצור `workspace_memberships` בכניסת לקוח (כבר מובטח ב־accept הנוכחי — לשמור).
- זיהוי לפי **טלפון של איש קשר** (`customer_contacts.phone`) ו/או `customer_portal_access` עם `contact_id`.
- אופציה א: משתמש Supabase ייעודי עם `phone` + custom OTP (מומלץ לשלב עם Auth hook).  
  אופציה ב: session JWT ייעודי של האפליקציה (`portal_sessions`) בלי רשומת `auth.users` — יותר עבודה, פחות תלות ב־Supabase Auth phone.
- **המלצה:** Supabase user עם `app_metadata.principal = "customer_portal"` + grant ב־`customer_portal_access`; חסימת כניסה ל־`/app/*` אם אין membership.

### 3.2 זרימה

1. לקוח מזין נייד ישראלי.
2. השרת מוצא contact/access פעיל; אם אין — תשובה אחידה ("אם המספר רשום נשלח קוד") נגד enumeration.
3. שליחת קוד 6 ספרות ב־SMS או וואטסאפ (בחירת ערוץ / העדפת contact).
4. אימות → הנפקת session → `/portal` (או `/portal/choose` אם כמה grants).
5. Rate limit: לפי טלפון + IP; נעילה אחרי N ניסיונות.

### 3.3 ספק SMS / וואטסאפ ועלות משוערת (ישראל, נוב׳ 2026)

| ספק | ערוץ | עלות משוערת לאימות | הערות |
|-----|------|---------------------|--------|
| **019 / SMS ישראלי (חבילות)** | SMS OTP | ~₪0.02–0.08 להודעה בחבילה (למשל 1,000 ב־₪20–75 + מע״מ לפי מבצע) | זול לנפח מקומי; צריך API OTP |
| **SMS4Free / Global SMS / TextMe** | SMS | ~₪0.02–0.17 להודעה לפי חבילה | בנייה עצמית של קוד+אימות |
| **InforU OTP** | SMS / WA / שיחה (כשר) | מחיר לא פומבי — הצעת מחיר | חזק לטלפונים כשרים (שיחה קולית) |
| **Twilio Verify** | SMS | ~$0.31 ≈ ₪0.9–1.0 לאימות שהושלם לישראל | יקר יחסית; DX מעולה |
| **Twilio / Meta WhatsApp** | WA Authentication | ~$0.005 Twilio + תעריף Meta Authentication לישראל (נמוך מסנטים) | דורש WABA מאושר ותבנית Authentication |

**המלצת MVP:**  
1) ספק ישראלי ל־SMS (019 / InforU / SMS4Free) כערוץ ראשי.  
2) וואטסאפ כערוץ משני אחרי WABA (או InforU אם כבר כולל).  
3) לא Twilio Verify כברירת מחדל לישראל בגלל עלות ליחידה.

תקציב חודשי גס ל־MVP (1,000 כניסות/חודש): **₪50–150** ב־SMS מקומי, מול **~₪900+** ב־Twilio Verify.

---

## 4. הרשאות לפי איש קשר ואתר + RLS

### 4.1 מודל יעד

- Grant מקושר ל־`contact_id` (חובה ב־MVP חדש) ול־`customer_id`.
- `scope`:
  - `customer` — כל האתרים של הלקוח (כמו היום).
  - `sites` — רשימת `site_ids` (טבלת `customer_portal_site_grants` או מערך מאומת).
- Capabilities נשארות כ־ACL פונקציונלי מעל ה־scope.

### 4.2 RLS

- להשאיר טבלאות portal כ־service-role only (דפוס נוכחי טוב).
- סינון אתרים/מסמכים/עבודות **רק בשרת** דרך `_ownership_ids` מסונן לפי scope.
- מסמכים: רק `visibility='customer'` + שייכות ל־entity בתוך ה־scope.
- הצעות: רק סטטוסים ב־`QUOTE_PORTAL_STATUSES` (כבר מוגדר).

### 4.3 מיגרציות נדרשות (עתידי — לא בפריט זה)

1. הרחבת `scope` + טבלת אתרים ל־grant.  
2. `phone` / `auth_phone_e164` על access או contact.  
3. `portal_otp_challenges` (hash, expires, attempts, channel).  
4. אופציונלי: `delivery` כולל `sms` / `whatsapp`.

---

## 5. עמודי MVP

| עמוד | תוכן ללקוח | מקור נתונים קיים | עבודה |
|------|------------|------------------|--------|
| **בית** | שלום, סיכום: הצעות ממתינות, ביקור קרוב, אחריות פעילה, CTA קריאת שירות | `_build_home` | עיצוב + סיכומים |
| **הצעות** | רשימה + קישור לעמוד הציבורי (`/q/…`) כשיש token פעיל | `portal.quotes.view` | UI + mint/lookup קישור בטוח |
| **התקנות וביקורים** | עבודות מתוזמנות/הושלמו (תאריך, אתר, סטטוס) — בלי הערות פנימיות | `portal.installations.view` | פילטר site + עברית סטטוסים |
| **תיק אתר** | פרטי אתר, ציוד באתר, מסמכי customer | sites + equipment + documents | דף per-site |
| **אחריות** | תעודות פעילות / פגות, קישור להורדה אם visibility=customer | `portal.warranties.view` | UI |
| **קריאת שירות** | טופס: אתר, תיאור, דחיפות, תמונה אופציונלית → ticket/job למשרד | חלקי (`service` לקריאה בלבד) | **יצירה חדשה** + notify למשרד |

ניווט מובייל־ראשון (390) עם מעטפת `/portal` קיימת.

---

## 6. מה אסור שיופיע ללקוח

כבר מקודד חלקית ב־`FORBIDDEN_PORTAL_KEYS` — לחזק ולבדוק בכל projection:

- עלויות, מרווחים, הנחות פנימיות, `internal_notes`, `completion_notes`, `revise_reason`
- פרטי ספקים פנימיים, `catalog_snapshot` מלא, SKU פנימי אם רגיש
- `token_hash`, `public_token` גולמי של הצעות אחרות, IP/MAC/panel
- מסמכים עם `visibility=internal`
- הצעות בטיוטה / לא נשלחו
- יומני audit, outbound provider payloads, פרטי צוות (טלפונים פרטיים של טכנאים) אלא אם אושרו במפורש
- מסכי workspace: תמחור, קטלוג עלויות, RBAC, הגדרות משרד, SSP/workforce/fleet
- כל UI באנגלית / קודי סטטוס גולמיים — רק תוויות עבריות

---

## 7. תוכנית מימוש מומלצת (אחרי אישור — לא בפריט זה)

1. לחבר `customer_portal` ב־`main.py` + בדיקות smoke.  
2. מיגרציית scope לפי אתר + OTP challenges.  
3. Adapter ספק SMS (ואחר כך WA).  
4. מסך כניסת OTP + חסימת `/app` ל־portal principals.  
5. דפי MVP על בסיס home API מפורק.  
6. טופס קריאת שירות + התראת משרד.  
7. עדכון staff studio להזמנת טלפון ול־site scope.

---

## 8. רשימת בדיקות (קבלה)

### Auth / הפרדה
- [ ] כניסת OTP עם נייד רשום מצליחה; נייד לא רשום לא חושף קיום.
- [ ] Portal user **לא** מופיע ב־team / לא מקבל `workspace_memberships` / לא נכנס ל־`/app`.
- [ ] Workspace member רגיל לא מקבל `/portal/session` grants בלי שורת access.
- [ ] Rate limit על שליחת קוד ועל ניחוש קוד.

### הרשאות ו־RLS
- [ ] Contact עם scope אתר א׳ לא רואה אתר ב׳ / ציוד / מסמכים / עבודות של ב׳.
- [ ] מסמך `internal` מחזיר 404 ב־URL חתום.
- [ ] הצעת draft לא מופיעה; sent/viewed/approved/rejected כן (לפי מדיניות).
- [ ] אחרי revoke — session נכשלת מיד.

### עמודי MVP
- [ ] בית מציג סיכום עברי בלי שדות אסורים.
- [ ] הצעות: פתיחת קישור ציבורי קיים; אין מק״ט/עלות.
- [ ] התקנות/ביקורים: תאריכים וסטטוסים בעברית בלבד.
- [ ] תיק אתר: ציוד + מסמכי customer בלבד.
- [ ] אחריות: הורדה רק למסמך מותר.
- [ ] קריאת שירות: נוצרת במשרד + התראה; הלקוח רואה אישור שליחה.

### אבטחה / פרטיות
- [ ] אין דליפת `FORBIDDEN_PORTAL_KEYS` ב־JSON של home/quotes/documents.
- [ ] `noindex` על דפי פורטל.
- [ ] OTP ו־invite tokens לא נכתבים ללוגים ב־plaintext.

### רגרסיה staff
- [ ] `CustomerPortalAccess`: יצירה, העתקת קישור, resend, revoke עדיין עובדים.
- [ ] Peek/accept אימייל נשארים תקינים כמסלול גיבוי.

---

## 9. סיכום החלטה

הבסיס (טבלאות, grants, capabilities, home projection, staff studio, דפי `/portal`) **שווה שימוש מחדש**, אבל הפורטל החי **לא מחובר ל־API** והכניסה מבוססת אימייל+סיסמה.  
ל־MVP: חיבור router → OTP טלפון נפרד מחברי workspace → scope לפי איש קשר/אתר → דפי MVP + קריאת שירות → ספק SMS ישראלי (וואטסאפ בהמשך).

**עצירה כאן — תכנון בלבד, בלי קוד.**

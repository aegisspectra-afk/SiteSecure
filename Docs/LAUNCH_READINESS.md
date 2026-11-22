# דוח מוכנות להשקה — שלב F

**ענף:** `ss-quote-core-s1-s2`  
**תאריך:** 2026-11-22  
**בסיס commits:** מאז `723b251` (סגירת DEMO_PATH_CHECK)  
**שער:** ⛔ **עצירה אחרי דוח זה** — אין פריסה לענן / Vercel / Render / `main` בסבב זה.

---

## 1. סיכום מנהלים

| מצב | משמעות |
|-----|--------|
| **בטא סגורה** | מנוע הצעות B1–B8, מנויים C1–C3 (בלי סליקה), שיווק D1–D3, משפטי E — מקומית ועם בדיקות יחידה על נתיבי הסבב. |
| **השקה ציבורית** | חסרים PayPlus (C4 לא ממומש), בדיקות דפדפן רשמיות 390/768/1440 על כל המסכים החדשים, תיקון QuoteBuilder (TDZ) + עדכון בדיקות `public.test.tsx`, והרצת B8 live מול Supabase מקומי פעיל. |
| **ענן** | טיפ DB בענן נשאר `20261117200000` — **7 מיגרציות** ממתינות (ראו §6). |

---

## 2. הרצת בדיקות (שלב F)

### תנאי הרצה

- **pytest:** דורש `SUPABASE_URL=http://127.0.0.1:54321` (אחרת `conftest` עוצר עם Supabase target guard על ענן).
- **vitest:** בהנחיית `npm test` נכשל בגלל `&` בנתיב OneDrive — הרצה בפועל:  
  `node ../../node_modules/vitest/vitest.mjs run` מתוך `apps/web`.

### pytest — `apps/api` (מלא)

| מדד | ערך |
|-----|-----|
| עברו | **1031** |
| נכשלו | **39** |
| דולגו | **105** |
| שגיאות setup (live) | **86** |
| משך | ~89s |

**Baseline היסטורי (סבב קודם, קובץ `tmp/_audit_pytest.txt`):** 35 נכשלו · 540 עברו — סוויטה קטנה יותר; לא להשוואה ישירה.

**כשלונות קריטיים לסבב הנוכחי:**

- `test_quote_b8_engine_e2e_live` — GoTrue admin `403` (Supabase מקומי לא זמין / מפתחות).
- רוב ה-**86 errors** — סימון `live` / `c5_local` (demo, s2 lockdown, s3 grants, acceptance) כשאין API מקומי רץ או DB לא מסונכרן.

**חבילת סבב (ללא live) — 34/34 עברו:**

`test_public_marketing_d`, `test_ss_c3_billing_upgrade`, `test_c1_section8_matrix`, `test_c1_capabilities_authz`, `test_quote_b7_terms`

### vitest — `apps/web` (מלא)

| מדד | ערך |
|-----|-----|
| קבצי בדיקה | **157 עברו** · **119 נכשלו** (276) |
| בדיקות | **970 עברו** · **84 נכשלו** (1054) |
| משך | ~169s |

**Baseline סבב S3.5 (`tmp/_ss_s35_baseline_vitest.json`):** 711 עברו · **101 נכשלו** (812) — **מספר הכשלונות ירד** (84 &lt; 101), עומד בכלל הבריף.

**חבילת סבב (ממוקדת) — 12/12 עברו:**

`public-pricing`, `plan-quota`, `billing-settings`, `cookie-consent`, `legal`

**שורש כשלונות מרכזי (לא רק סבב F):** `QuoteBuilder.tsx` — `ReferenceError: Cannot access 'items' before initialization` (שורה ~477) — שובר ~70 בדיקות CPQ/מובייל.

### typecheck — `apps/web`

`tsc --noEmit` — **נכשל** (בין השאר `QuoteBuilder` TDZ, `SettingsNavId` ל-`billing`, ניווט TanStack עם `search` חובה). לא נחסם על ידי CI מקומי בסבב זה.

### lint

לא הורץ מלא על כל ה-repo; מומלץ לפני פריסה: `npm run lint` ב-`apps/web`, `ruff` ב-`apps/api`.

### בדיקות דפדפן 390 / 768 / 1440

**לא בוצעו באופן שיטתי בשלב F** על D1/D2/E. קיימים סקריפטי Playwright ידניים תחת `apps/web/scripts/*_qa.mjs` — לתעד כחובה לפני בטא חיצונית.

---

## 3. כיסוי E2E — שלושה מסלולים (מול בריף §7)

### (א) מבקר → עמוד בית → מחירון → טופס בטא

| שכבה | כיסוי | הערה |
|------|--------|------|
| API | ✅ `tests/test_public_marketing_d.py` — `/public/pricing`, מחשבון אחסון, ולידציית beta | ללא DB לטופס מלא |
| Web unit | ✅ `tests/public-pricing.test.ts` — קטלוג C1, מע"מ, השוואה | |
| Web UI | ⚠️ `tests/public.test.tsx` — **נכשל** (Hero ו-CTA ישנים אחרי D1 `SiteSecureLanding`) | צריך עדכון הציפיות |
| דפדפן אוטומטי | ❌ אין spec אחד רציף home→pricing→beta | API שומר לידים ב-`marketing_beta_signups` (service) |

**מוכן לבטא:** זרימת API + עמודים בקוד. **חסר:** e2e דפדפן + תיקון `public.test.tsx`.

### (ב) הרשמה → workspace → Free → מגבלה → «שדרג»

| שכבה | כיסוי | הערה |
|------|--------|------|
| API unit | ✅ `test_c1_section8_matrix`, `test_c1_capabilities_authz`, `test_quota_limits` | מגבלות §8 |
| API mocked | ✅ `test_ss_c3_billing_upgrade.py` — טופס שדרוג בטא | |
| Web unit | ✅ `plan-quota.test.ts`, `billing-settings.test.ts` | הודעות 409 בלי checkout |
| Web UI | ✅ `auth.test.tsx` (הרשמה/כניסה) — עבר במלוא הריצה | |
| Live quota | ⚠️ `test_quota_live.py` — תלוי Supabase מקומי + seed | לא אומת בשלב F |
| דפדפן | ❌ אין golden path הרשמה→10 הצעות→שדרג | C2 הקצאה ידנית בפאנל ניהול |

**מוכן לבטא:** אכיפת מגבלות ב-API + UI הגדרות billing + טופס פנייה. **חסר:** e2e מלא + סליקה (C4).

### (ג) מנוע הצעות מלא — B8

| שכבה | כיסוי | הערה |
|------|--------|------|
| API live | ❌ `test_quote_b8_engine_e2e_live` — **נכשל** (GoTrue 403) | commit `2235248` |
| API unit | ✅ B7 terms, C1 alternatives authz, רכיבי pricing קיימים | |
| Web | ❌ רוב בדיקות `quote-builder*` נכשלות בגלל TDZ ב-`QuoteBuilder` | תיקון קוד נדרש לפני UI e2e |

**מוכן לבטא:** לוגיקה ומיגרציות B3/B7 קיימות; **חסר:** הרצת B8 live מול stack מקומי + תיקון QuoteBuilder.

---

## 4. אבטחה — טבלאות חדשות (מיגרציות סבב `20261122*`)

| מיגרציה | טבלה / אובייקט | RLS | בידוד workspace |
|---------|----------------|-----|------------------|
| `20261122140000` | `quote_alternatives` | ✅ FORCE RLS · select לחברים · write לתפקידי מכירה רק על `quotes.status=draft` | `workspace_id` + join ל-`quotes` |
| `20261122160000` | (plan keys, RPC workspace) | משתמש בטבלאות קיימות | מנוי Free ביצירה workspace |
| `20261122170000` | מטריצת plans (עדכון) | קטלוג / הרשאות קיימות | limits ב-API + DB helpers |
| `20261122180000` | `seed_quote_terms_b7` (הגדרות ב-`workspace_settings`) | אין טבלה חדשה — seed דרך `SECURITY DEFINER` · **EXECUTE רק `service_role`** | פרמטר `p_workspace_id` |
| `20261122190000` | `subscription_allocation_log` | ✅ רק `auth_is_platform_admin()` SELECT | `workspace_id` · אין כתיבה מ-authenticated |
| `20261122190500` | `billing_upgrade_requests` | ✅ insert: `user_id=auth.uid()` + חבר workspace · select: בעלים או אדמין פלטפורמה | `workspace_id` FK |
| `20261122191000` | `marketing_beta_signups` | ✅ אין גישת anon/authenticated ללידים — **רק platform admin** | לידים גלובליים (לא tenant); כתיבה דרך API + service |

**הערות:**

- לידים שיווקיים ויומן הקצאת מנוי — **לא** נגישים ל-tenant; מפחית דליפת PII בין workspaces.
- חלופות הצעה — כתיבה חסומה אחרי שליחה (דרך מדיניות draft + API).
- כל endpoint חדש בסבב C/D אמור לעבור `authz` + `workspace_id` בשרת (לא אומת penetration בשלב F).

---

## 5. מוכן לבטא סגורה (10–20 מתקינים)

- מנוע הצעות: B1–B7 + מסלול B8 מתועד (live תלוי stack).
- מנויים: מטריצת §8, מגבלות API, הגדרות billing, הקצאה ידנית C2, טופס שדרוג C3.
- שיווק: דף בית D1, `/pricing` D2, מחשבון אחסון D3, SEO בסיסי.
- משפטי: טיוטות E + באנר עוגיות לפני אנליטיקס.
- מיגרציות עם rollback תחת `supabase/rollbacks/`.

---

## 6. חסר להשקה ציבורית

| נושא | סטטוס |
|------|--------|
| PayPlus + חיוב חוזר + webhooks | תכנון בלבד — `Docs/billing/PAYPLUS_PLAN.md` (C4 ⛔) |
| checkout / חשבוניות Morning | לא ממומש |
| סליקה והורדת חבילה אוטומטית | C2 ידני בבטא בלבד |
| בדיקות דפדפן רשמיות 390/768/1440 | לא הושלמו בשלב F |
| תיקון `QuoteBuilder` TDZ + typecheck ירוק | חוסם בדיקות CPQ |
| עדכון `public.test.tsx` למיתוג D1 | |
| ביקורת משפטית על טיוטות E | |
| פורטל לקוחות | מחוץ לסבב (ראו PORTAL_PLAN) |
| תזכורות שירות (ספרינט ב' §4) | עדיין חסר |

---

## 7. מיגרציות לפריסה העננית הבאה

מקור מחייב: **`Docs/ops/PENDING_CLOUD_MIGRATIONS.md`** (מעודכן לסבב הנוכחי).

| # | קובץ | שלב |
|---|------|-----|
| 1 | `20261122140000_ss_quote_alternatives_b3.sql` | B3 |
| 2 | `20261122160000_ss_c1_plan_keys_free_pro_business.sql` | C1 |
| 3 | `20261122170000_ss_c1_section8_plan_matrix.sql` | C1 |
| 4 | `20261122180000_ss_b7_quote_terms_templates.sql` | B7 |
| 5 | `20261122190000_ss_c2_manual_subscription_allocation.sql` | C2 |
| 6 | `20261122190500_ss_c3_billing_upgrade_requests.sql` | C3 |
| 7 | `20261122191000_ss_d1_marketing_beta_signups.sql` | D1 |

קוד B1/B2/B4/B5/B6 ו-D/E ללא מיגרציה נוספת — ייפרס עם Web/API אחרי אישור.

---

## 8. סיכונים

| סיכון | חומרה | מיטיגציה |
|-------|--------|----------|
| פריסת Web/API לפני מיגרציות 7 | גבוהה | סדר: DB → API → Web (ראו `NEXT_CLOUD_DEPLOY.md`) |
| B8 / live tests לא ירוקים מקומית | בינונית | `supabase start` + מפתחות + API על 54321 לפני בטא |
| QuoteBuilder TDZ | גבוהה (מוצר) | תיקון לפני מתקיני בטא על חלופות במשרד |
| `.env` מצביע לענן בפיתוח | בינונית | guard ב-pytest; סט מקומי ב-`.env` |
| טיוטות משפטיות | בינונית | באנר «טיוטה»; לא להשקה ציבורית בלי עו"ד |
| vitest ב-Windows + נתיב עם `&` | נמוכה | הרצה דרך `node …/vitest.mjs` |
| Vercel Analytics | נמוכה | opt-in דרך cookie consent (E) |

---

## 9. Commits — שלבים C1→F (מאז `723b251`)

| Commit | תיאור |
|--------|--------|
| `0c279b4` | תיקון רגרסיית שורות שירות בתמחור (demo guard) |
| `5aa779f` | **C1** — מטריצת Free/Pro/Business §8 |
| `5f81238` | **B7** — תבניות תנאים ותחזוקה שנתית |
| `2235248` | **B8** — e2e API למנוע הצעות (live) |
| `61bf517` | **C2** — הקצאת מנוי ידנית בפאנל ניהול |
| `039d192` | **C3** — עמודי billing, שדרוג, כרום חבילה |
| `d2d7d0d` | **C4** — מסמך PayPlus (תכנון בלבד) |
| `e4131a7` | **D1** — דף בית שיווקי, בטא, SEO |
| `1853863` | **D2** — `/pricing` מקטלוג C1 |
| `0e3b0ac` | **D3** — מחשבון אחסון ציבורי + בדיקות API |
| `62bb4a7` | **E** — עמודים משפטיים (טיוטה) |
| `ce53ebe` | **E** — הסכמת עוגיות לפני אנליטיקס |
| `fb53d99` | **E** — קישורים משפטיים בפוטר |

*(שלבים B ו-A קדמו ל-C1 על אותו ענף; ראו `STATE_OF_PRODUCT.md`.)*

---

## 10. שער שלב F

```
⛔ STOP — דוח מוכנות הושלם. אין deploy לענן בסבב זה.
```

פריסה, `git push`, ו-apply מיגרציות בענן — **סבב נפרד עם אישור מפורש**.

---

*נוצר בשלב F של `Docs/SITE_SECURE_MASTER_BRIEF.md` · תוצאות גולמיות: `tmp/_stage_f_pytest.txt`, `tmp/_stage_f_vitest.txt`*
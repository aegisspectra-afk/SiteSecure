# רשימת קבלה מקומית — SITE SECURE

**ענף:** `ss-quote-core-s1-s2`  
**תאריך סריקה:** 2026-11-22  
**כללים:** מקומי בלבד · אין ענן / push / פריסה · סעיף 0 ב-`Docs/SITE_SECURE_MASTER_BRIEF.md`  
**מחוץ לסבב:** PayPlus · Morning · Expo · אשפי אזעקה / בקרת כניסה / אינטרקום  

סטטוסים: **עובד** · **חלקי** · **חסר**

הוכחה: שם בדיקה / commit / קובץ קוד. צילומי דפדפן יתווספו אחרי שלב 3.

---

## 1. דשבורד

| דרישה | מצב | הוכחה |
|--------|------|--------|
| **D1** — מגבלות מושבים / שינוי תפקיד נחסם כשחורגים | עובד | `apps/api/tests/test_d1_dashboard_live.py` · `apps/api/app/dashboard.py` · `apps/api/app/authz/limits.py` |
| **D3** — תור «דורש תשומת לב» (הצעות / עבודות) | חלקי | API: `_quote_attention` / `_unassigned_jobs` ב-`dashboard.py` · UI: `OpsDashboard` · vitest `attention-dash3.test.tsx` **נכשל** (baseline, `60497a6`) |
| **D2** — אישור הצעה יוצר פרויקט + עבודת התקנה בסטטוס «ממתין לשיבוץ» | חלקי | אישור ציבורי: `POST …/public/quotes/{token}/approve` · יצירת פרויקט: `POST …/projects/from-quote` (ידני/API, לא אוטומטי באישור) · B8: `test_quote_b8_engine_e2e_live.py` יוצר פרויקט+עבודה אחרי אישור · **אין** ערך סטטוס `ממתין לשיבוץ` ב-`jobStatuses` (יש `scheduled` = «מתוכננת»; עבודה ללא טכנאי = attention `job_unassigned`) |

---

## 2. בונה ההצעות

| דרישה | מצב | הוכחה |
|--------|------|--------|
| **Q1** / אשף CCTV מהיר | עובד | `SystemBuilderDrawer` · `sprint-b1-cctv-quick-clicks.test.tsx` · `dc5d6a4` |
| **B1** חלון הוספת פריט | עובד | `QuoteQuickAdd.tsx` · בדיקות quote-builder |
| **B2** רווחיות למשרד | עובד | `pricing.py` · strip ללקוח · `quote-commercial-q4` |
| **B3** חלופות ועד בית | עובד | מיגרציה `20261122140000_*` · `generate-alternatives` · B8 |
| **B4** מצלמות לפי מיקום (מקצועי) | עובד | STATE_OF_PRODUCT + CCTV professional path |
| **B5** מעקב מכירה / שכפול / follow-up | עובד | timeline + WA follow-up בקוד הצעות |
| **B6** תמונות סיור | עובד | עד 10 · B8 מעלה photo · ציבורי |
| **B7** תבניות תנאים + חוזה תחזוקה שנתי | עובד | `5f81238` · `20261122180000_ss_b7_*` · `seed_quote_terms_b7` · SKU `SS-SVC-MAINT-ANNUAL` |
| **B8** e2e מנוע | עובד | `test_quote_b8_engine_e2e_live.py` **PASSED** מול Supabase מקומי (`tmp/_b8_run3.txt`) · commit `2235248` + תיקוני ייצוב |
| **Q6** עמוד ציבורי | עובד | `routes/public/quotes/$token.tsx` · `public_quotes.py` |
| ארכיון הצעות | עובד | `20261117200000_ss_quote_archive_*` · `test_q4_quote_archive_live.py` |

---

## 3. Q4 סעיפים 6–9 (יציבות משרד)

| דרישה | מצב | הוכחה |
|--------|------|--------|
| «בוטלה» לא נספרת בדשבורד | חלקי | מונה `cancelled` קיים ב-`quotes.py` סיכומים; אין בדיקה ייעודית שמוכיחה החרגה מ-KPI/attention · לדאוג לסגירה + בדיקה |
| הצעה שבוטלה נפתחת ב-**200** (לא 403) | חלקי / לא מאומת | מחזור חיים + archive קיימים; חסרה בדיקה מפורשת ל-GET אחרי ביטול |
| חלון אישור מערכת במקום `window.confirm` | חסר | `QuoteBuilder.tsx` עדיין קורא ל-`window.confirm` (שורה ~2112) · אין `ConfirmDialog` משותף |
| טיפול ב-401: רענון token → כשל → התחברות + הודעה | חלקי | `session.tsx` + `onAuthStateChange` · `api-client` ממפה 401 ל-`UNAUTHENTICATED` בלי retry/`refreshSession` מתועד בבדיקה |

---

## 4. שטח

| דרישה | מצב | הוכחה |
|--------|------|--------|
| שיבוץ טכנאי (+ זמן) | עובד | `test_demo3_job_schedule_live.py` · `POST …/jobs/{id}/assign` · דורש תוכנית Business (`field.dispatch`) |
| «היום» לטכנאי | עובד | `/app/today` · scope לפי שיוך · DEMO-1 |
| צ׳קליסט | עובד | `test_demo4_cctv_checklist_live.py` · `jobs.checklist` |
| חתימה | עובד | `SIGNABLE_JOB_STATUSES` · מסכי field · DEMO |
| סיום עבודה | עובד | `job_lifecycle` · `completeJob` |
| תעודת מסירה | עובד | `public_handover.py` · `routes/public/handover/$token.tsx` |
| וואטסאפ (הצעה / מסירה) | עובד | `quote-whatsapp-share.ts` · `sprint-b2-quote-whatsapp-sent.test.tsx` · `wa.me` |

---

## 5. מסחרי

| דרישה | מצב | הוכחה |
|--------|------|--------|
| **C1** מגבלות לפי חבילה (§8) | עובד | `catalog.json` · `5aa779f` · `20261122160000` / `170000` · `test_c1_*` · capabilities 409+«שדרג» |
| **C2** שינוי חבילה בפאנל ניהול + תאריך + הערה + audit · workspace חדש → Free | עובד | `61bf517` · `subscription_allocation_log` · admin UI · `create_workspace` default `free` |
| **C3** עמוד מנוי + שימוש + «רוצה לשדרג» → פאנל · שם חבילה בכותרת | עובד | `039d192` · `/app/settings/billing` · `billing.usage` · `admin/billing-requests` · `billing-settings.test.ts` |
| **C4** PayPlus תכנון בלבד | עובד (מסמך) / מחוץ למימוש | `Docs/billing/PAYPLUS_PLAN.md` · `d2d7d0d` · **לא מממשים** |

---

## 6. אתר שיווקי

| דרישה | מצב | הוכחה |
|--------|------|--------|
| **D1** עמוד בית + טופס בטא נשמר ומופיע בפאנל | עובד | `e4131a7` · `SiteSecureLanding` · `marketing_beta_signups` · admin |
| D1 SEO: sitemap / schema / Open Graph | חלקי | SEO בסיסי ב-D1 · לא אומת Lighthouse/schema מלא בסריקה זו |
| D1 Lighthouse מובייל ≥90 | חסר (לא נמדד) | אין דוח Lighthouse עדכני ב-repo |
| D1 Vercel Analytics בלי 400 | חלקי | `CookieConsentBanner` לפני אנליטיקס (`ce53ebe`) · 400 בפרוד לא אומת מקומית |
| **D2** `/pricing` | עובד | `1853863` · `routes/pricing.tsx` · `public-pricing.test.ts` · מקור C1 |
| **D3** `/tools/cctv-storage` + «הפוך להצעת מחיר» אחרי הרשמה | חלקי | `0e3b0ac` · `routes/tools/cctv-storage.tsx` · API ציבורי · **טעינת הקלט לאשף אחרי הרשמה** — לא אומתה בבדיקת e2e ייעודית |

---

## 7. משפטי (E)

| דרישה | מצב | הוכחה |
|--------|------|--------|
| אבטחת מידע / תנאי שימוש / פרטיות / ביטול / נגישות | עובד | `62bb4a7` · `i18n/legal-he.ts` (כולל `cancellation`, `accessibility`) · `routes/legal/*` |
| טיוטות מסומנות «ממתין לבדיקה משפטית» | עובד | `draftNotice` ב-`legal-he.ts` |
| באנר עוגיות | עובד | `CookieConsentBanner` · `__root.tsx` · `ce53ebe` |

---

## 8. תזכורות שירות / אחריות

| דרישה | מצב | הוכחה |
|--------|------|--------|
| תזכורת 60 ו-14 יום לפני סוף אחריות | חסר | אין route/job/cron ייעודי · `service.reminders` capability ב-C1 כבוי ב-Free/Pro |
| התראה למי שרשאי לנהל עבודות | חסר | — |
| כפתור «הצע חוזה תחזוקה» מתבנית שנתית | חסר | תבנית B7 קיימת · אין כפתור/זרימה מתזכורת |
| כרטיס דשבורד «אחריות שמסתיימת ב-60 יום» | חסר | — |
| מנגנון יומי בלי כפילויות | חסר | — |

---

## 9. פורטל לקוחות (MVP — **בסבב זה**)

| דרישה | מצב | הוכחה |
|--------|------|--------|
| תוכנית מוצר | חלקי | `Docs/portal/PORTAL_PLAN.md` |
| UI scaffold | חלקי | `routes/portal/*` · `CustomerPortalAccess` |
| API מחובר ל-`main` | חסר | `customer_portal.py` **קיים** אך **לא** ב-`include_router` ב-`main.py` |
| התחברות בקוד חד-פעמי (לוג/מייל מקומי) | חסר | — |
| סוג משתמש נפרד + RLS + בידוד לקוח/אתר | חסר / חלקי בטבלאות ישנות | לדרוש מיגרציה + בדיקות בידוד |
| עמודים: בית, הצעות, התקנות, תיק אתר, אחריות, קריאת שירות+תמונה | חסר | — |
| בלי עלויות / רווח / הערות פנימיות / לקוחות אחרים | חסר | — |
| «הזמן לפורטל» + גישה פעילה/מבוטלת בכרטיס לקוח | חלקי | רכיבי גישה ישנים · לא e2e |
| מותג מתקין + «נוצר ב-SITE SECURE» | חסר | — |

---

## 10. מובייל טכנאי מול `docs/design/mobile-guidelines.md`

| דרישה | מצב | הוכחה |
|--------|------|--------|
| מסכי טכנאי (היום / עבודה / צ׳קליסט) עומדים בהנחיות | חלקי | הנחיות קיימות · שדה offline/`fieldOffline*` קיים · **אין** דוח פערים 390/768/1440 עדכני · בדיקות ויזואליות חובה בשלב 3 |

---

## 11. שערי בדיקות (רקע לייצוב)

| מדד | ערך אחרון | הוכחה |
|------|-----------|--------|
| pytest מלא (מקומי) | **1155 עברו · 0 נכשלו** | `tmp/_pytest_stab_final.txt` |
| vitest | **8 נכשלו** (≤ baseline 13) | `tmp/_stab_vitest_final.json` · `0849db0` |
| B8 live | **PASSED** | `tmp/_b8_run3.txt` |

---

## 12. סיכום לפערים לשלב 2 (לפי עדיפות)

1. **חסר:** תזכורות אחריות 60/14 + כרטיס דשבורד + «הצע חוזה תחזוקה» + מנגנון יומי.  
2. **חסר / חלקי גדול:** פורטל לקוחות MVP (חיבור API + OTP מקומי + עמודים + RLS + בידוד).  
3. **חסר / חלקי:** Q4 §6–9 (`window.confirm`, 401 refresh מוכח, ביטול בדשבורד/GET).  
4. **חלקי:** D2 דשבורד — יצירה אוטומטית / סטטוס «ממתין לשיבוץ» אחרי אישור.  
5. **חלקי:** D3 שיווקי — העברת קלט מחשבון לאשף אחרי הרשמה.  
6. **חלקי:** SEO/Lighthouse/Analytics · מובייל טכנאי מול guidelines · D3 attention vitest.  

**לא נכנס:** PayPlus / Morning / Expo / אשפים נוספים.

---

## 13. שער

```
שלב 1 הושלם — Docs/ACCEPTANCE_LOCAL.md נוצר (בלי קוד מוצר).
המשך: שלב 2 — השלמת חסר/חלקי, commit נפרד לכל משימה.
```

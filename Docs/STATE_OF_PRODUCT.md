# מצב המוצר — SITE SECURE

**ענף:** `ss-quote-core-s1-s2` · **HEAD מקומי:** `62da1f3` · **תאריך סריקה:** 2026-11-22  
**מקור:** סריקת קוד מול `Docs/SITE_SECURE_MASTER_BRIEF.md` (שלב A). אין שינויי מוצר בסריקה זו.

סטטוסים: **עובד** · **חלקי** · **חסר**

---

## 1. פריסה וענן

| נושא | סטטוס | פרטים |
|------|--------|--------|
| Web (Vercel) | עובד בענן | פרויקט `site-secure` → `https://site-secure-umber.vercel.app` (`vercel.json`, `Docs/operations/VERCEL.md`) |
| API (Render) | עובד בענן | `site-secure-api-staging` · Frankfurt · `render.yaml` · health `/health` |
| DB (Supabase) | עובד בענן | פרויקט `rhxqqudlngimhplvndmz` |
| טיפ מיגרציות בענן (ידוע מסבב קודם) | חלקי מול מקומי | בענן אומתה לפחות עד `20261002222349_catalog_general_accessories_category`. מאז נוספו מקומית מיגרציות רבות מנובמבר 2026 (ראה למטה) — **לא לפרוס בסבב זה בלי אישור** |
| עבודה מקומית בלבד מאז הפריסה | חלקי | כל ענף `ss-quote-core-s1-s2` כולל ליבת הצעות, DEMO-5, פורטל docs, ארכיון הצעות וכו' |

**מיגרציות חדשות יחסית על הדיסק (חדשות ביותר, מקומי):**

1. `20261117200000_ss_quote_archive_and_delete_guard.sql`
2. `20261117194500_ss_sites_lat_lng.sql`
3. `20261117193000_ss_demo5_completion_uniques.sql`
4. `20261117190000_ss_demo_workspace_flag.sql`
5. `20261117180000_ss_installation_complete.sql`
6. `20261117130000_ss_job_checklist_cctv_template.sql`
7. `20261117120000_ss_job_customer_signature.sql`
8. `20261116140000_ss_jobs_idempotency_key.sql`
9. `20261116130000_ss_starter_mark_office_only.sql`
10. `20261116120000_ss_technician_assigned_job_scope.sql`

`Docs/operations/STAGING.md` קיים אך חלקים בו מיושנים (טוען ש-CRM/Quotes UI «לא נבנו»).

---

## 2. ספרינט ב' (סעיפים 1–5)

| # | נושא | סטטוס | קבצים / commits | הערות |
|---|------|--------|-----------------|--------|
| 1 | מצב מהיר CCTV | עובד | `CctvRequirementsWorkspace.tsx`, `SystemBuilderDrawer.tsx`, `sprint-b1-cctv-quick-clicks.test.tsx`, commit `dc5d6a4` | 4 שאלות; מצב מקצועי נפרד |
| 2 | וואטסאפ להצעה | עובד | `quote-whatsapp-share.ts`, `QuoteSentHonesty.tsx`, `sprint-b2-quote-whatsapp-sent.test.tsx`, `8344a0c`, `c27c967` | `wa.me` + קישור ציבורי; בלי הבטחת משלוח |
| 3 | חבילות (quote packages) | עובד | `quote_cpq.py`, `SystemPickerModal.tsx`, `0034_cpq_phase2.sql` | apply / save-as-package |
| 4 | תזכורות שירות | חסר | — | לא נמצא feature / route / doc ייעודי |
| 5 | מחשבון אחסון ציבורי | חסר | מנוע פנימי: `cctv-sizing/`, `POST …/cctv/recommend` | רק בתוך אשף ההצעה; אין `/tools/cctv-storage` |

---

## 3. מנוע הצעות המחיר (מול שלב B)

| יכולת | סטטוס | מול שלב B | קבצים עיקריים |
|--------|--------|-----------|----------------|
| אשף CCTV (מהיר / מקצועי) | עובד | B4 מרחיב מקצועי | `SystemBuilderDrawer.tsx`, `routers/cctv.py`, `cctv-*.ts` |
| חבילות מוכנות | עובד | — | `quote_cpq.py`, `QuoteQuickAdd.tsx` |
| תבניות הצעה | עובד | B7 מרחיב תנאים | `TemplateApplyModal.tsx`, `apply-template` |
| חלון «הוספת פריט» | עובד | **B1** ✅ | `QuoteQuickAdd.tsx` + `sort=recent` בקטלוג — חיפוש / אחרונים / מקלדת |
| הנחות (שורה / סעיף / הצעה) | עובד | — | `QuoteSectionDiscountField.tsx`, `pricing.py` |
| מע״מ | עובד | — | `pricing.py`, `QuoteSummaryAside.tsx` |
| גרסאות / revise | עובד | B5 מרחיב | `RevisionHistoryPanel.tsx`, `POST …/revise` |
| ארכיון | עובד | — | `archive_quote`, `20261117200000_ss_quote_archive_*` |
| עמוד ציבורי | עובד | B3/B6 מרחיבים | `routes/public/quotes/$token.tsx`, `public_quotes.py` |
| PDF | עובד | B3 מרחיב | `quote_pdf.py` |
| אישור / דחייה + חתימה | עובד | B3: רק מחלופה | `public_quotes.py`, `SignaturePad` |
| רווחיות / עלות | עובד | **B2** ✅ | משרד רואה עלות/רווח; שליחה עם שוליים נמוכים = אזהרה בלי חסימה; ללקוח לא דולף |
| חלופות ועד בית (עד 3) | עובד | **B3** ✅ | `quote_alternatives` · freeze בשליחה · בחירה באישור · PDF השוואה · `generate-alternatives` CCTV · שורות ל-`alternative_id` |
| רשימת מצלמות לפי מיקום | עובד | **B4** ✅ | מצב מקצועי: טבלת מיקומים → אגרגציה ל-recommend; מצב מהיר ללא שינוי |
| מעקב מכירה / תזכורת 3 ימים | עובד | **B5** ✅ | צפיות חוזרות ב־timeline · follow-up 3 ימים + WA · שכפול מהבונה · superseded «גרסה מעודכנת» |
| שכפול הצעה | עובד | **B5** ✅ | `שכפל הצעה` ב־QuoteBuilder + duplicate ברשימה |
| תמונות סיור בהצעה | חסר | **B6** | אין gallery עד 10 על ההצעה |
| תבניות תנאים / חוזה תחזוקה | חלקי | **B7** | תבניות שורות קיימות; אין ספריית תנאי תשלום/אחריות כברירת מחדל ייעודית |

---

## 4. חבילות ומנויים (SaaS plans)

| נושא | סטטוס | קבצים | הערות |
|------|--------|--------|--------|
| מפתחות תוכנית | עובד | `packages/authz/catalog.json`, `0048_v3_plan_labels_*` | מפתחות DB: `solo` / `business` / `enterprise` · תצוגה: Free / Pro / Enterprise |
| `plan_limits` / מכסות | עובד | `0038_plan_quota_limits.sql`, `limits.py`, `usage.py` | הצעות, לקוחות, אחסון, מושבים |
| `plan_capabilities` (V3) | חלקי | `0050_v3_capabilities_registry.sql` | 16 מפתחות seeded; **לא** מחוברים ל-`authorize()` בזמן ריצה |
| commit `54aa15f` | עובד | `OnboardingSoloSetup.tsx`, `settings/plan.tsx` | onboarding solo + מסך מכסות בלי תשלום |
| אכיפה API | עובד | `authz/limits.py`, routers | HTTP 409 `raise_plan_limit` |
| אכיפה RLS | חלקי | `auth_feature()`, invite RPCs | ספירות מכסה בעיקר ב-API |
| אכיפה UI | עובד | `plan-quota.ts`, `UsageThresholdBanner.tsx`, `settings/plan.tsx` | בלי checkout (`billing-honesty`) |
| מחירון סעיף 8 (Free/Pro/Business/Enterprise + ₪) | חסר | — | המודל הנוכחי 3 מפתחות; Business כשכבה רביעית + מחירים — לשלב C |
| `/app/settings/billing` | חסר | קיים `/app/settings/plan` | יעד C3 |
| PayPlus | חסר | — | תכנון בלבד ב-C4 |

---

## 5. עמוד הבית (landing)

| נושא | סטטוס | קבצים | הערות |
|------|--------|--------|--------|
| נתיב | עובד | `routes/index.tsx` → `PublicHome.tsx` | `/` |
| מבנה נוכחי | חלקי מול D1 | `PublicHome.tsx`, `PublicSurfaces.tsx`, `PublicChrome.tsx` | anchors: `#platform`, `#products`, `#quotes`, `#flow`, `#site-file`, `#solutions`, `#friction`, `#security`, `#contact`, `#pilot` |
| מסר | חלקי | `PublicLocaleProvider` | פלטפורמה למתקינים; CTA לפיילוט/הרשמה — לא עדיין המשפט המדויק מהבריף בכל ה-hero |
| SEO | חלקי | `useDocumentMeta`, `public/robots.txt` | חסרים sitemap / schema מלאים לפי D1 |
| Vercel Analytics | חלקי | `VercelAnalytics.tsx`, `__root.tsx` | מחובר; דווח 400 בפרוד — לטפל ב-D1 |
| ביצועים Lighthouse | לא נמדד בסריקה | `landing-v2/*.jpg` | יעד D1: 90+ מובייל, WebP, lazy |
| `/pricing` | חסר | — | D2 |
| `/tools/cctv-storage` | חסר | — | D3 |

---

## 6. פורטל לקוחות

| נושא | סטטוס | הפניה |
|------|--------|--------|
| תוכנית | חלקי (תכנון) | `Docs/portal/PORTAL_PLAN.md` (commits `21b71d2`, `62da1f3`) |
| UI scaffold | חלקי | `routes/portal/*`, `CustomerPortalAccess.tsx` |
| API | חלקי / לא מחובר | `customer_portal.py` — **לא** מורכב ב-`main.py` |
| בסבב זה | לא מממשים | לפי סעיף 9 בבריף |

---

## 7. עמודים משפטיים ואמון

| עמוד | סטטוס | קבצים |
|------|--------|--------|
| פרטיות / תנאים / cookies / disclaimer / security | עובד (טקסט קיים) | `routes/legal/$slug.tsx`, `i18n/legal-he.ts` |
| הצהרת נגישות | חסר | — (שלב E) |
| מדיניות ביטול | חסר / לבדוק מול slugs | — (שלב E) |
| באנר עוגיות | חלקי | עמוד cookies קיים; באנר מינימלי — E |

---

## 8. באגים פתוחים ידועים

| מקור | נושא | חומרה |
|------|------|--------|
| ~~בריף B1 + `QuoteQuickAdd`~~ | ~~לחיצה על «מוצר» לא פתחה חיפוש~~ | **סגור ב-B1** |
| `Docs/QUOTE-11-CCTV-PLANNER-QUOTE-REPORT.md` | בורר קטלוג בשורות CCTV מתוכננות — לא נשלח במלואו | בינוני |
| `Docs/demo/DEMO_PATH_CHECK.md` | נתיב DEMO: דליפות תיאור starter, שורות שירות חוסמות שליחה, כפילויות סעיפים, overflow בדיאלוג שליחה, היקף טכנאי רחב | מעורב (חלק עשוי להיות מיושן אחרי `c27c967` / `8344a0c`) |
| Audit G-012 | מנויים בלי ספק תשלום | מכוון (בטא) |
| ~~רווחיות~~ | ~~חסימת שליחה על שוליים~~ | **סגור ב-B2** (אזהרה בלבד) |

---

## 9. פערים מול הבריף (סיכום לביצוע)

| שלב | מוכן להמשך? | הערה |
|------|-------------|------|
| A | ✅ | מסמך זה |
| B | כן — אין סתירה | מרחיבים מנגנונים קיימים; לא לבנות CPQ שני |
| C | כן | לאחד מחירים/4 חבילות עם catalog קיים; לא PayPlus |
| D–F | כן | landing קיים לשיפור; pricing/tool חדשים |

**אין חסם שעוצר מעבר ל-B.** ענן לא נוגעים. `docs/design/mobile-guidelines.md` **לא קיים** — מובייל לפי דפוסי UI קיימים עד שייווצר.

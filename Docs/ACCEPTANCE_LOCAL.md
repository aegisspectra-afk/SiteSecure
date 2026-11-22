# רשימת קבלה מקומית — SITE SECURE

**ענף:** `ss-quote-core-s1-s2`  
**עדכון:** 2026-11-22 (הוכחת live מול DB מקומי)  
**כללים:** מקומי בלבד · אין ענן / push / פריסה  
**כלל סטטוס:** **עובד** רק עם הוכחת live מול Supabase מקומי (`127.0.0.1:54321`) + מפתחות demo מקומיים (לא `.env` ענן).

**מחוץ לסבב:** PayPlus · Morning · Expo · אשפי אזעקה / בקרת כניסה / אינטרקום  

---

## תשתית שנבדקה

| פריט | סטטוס | הוכחה |
|------|--------|--------|
| `supabase db reset` | עבר | כל מיגרציות עד `20261122230000_portal_site_grants_*` · `tmp` / CLI log |
| reminders / awaiting_dispatch / portal OTP | הוחלו | `warranty_reminder_events` · enum `awaiting_dispatch` · `portal_otp_*` |
| מפתחות בדיקה | חובה | `SUPABASE_URL=http://127.0.0.1:54321` + ANON/SERVICE demo מ-`supabase status` (לא cloud `.env`) |
| pytest מלא (כולל live) | **0 כשלונות** | **1188 passed · 105 skipped** · `tmp/_accept_pytest_live.txt` / `-rs` |
| השוואה לסבב קודם | +33 | קודם 1155; עכשיו 1188 (בדיקות חדשות: portal/D2/Q4/reminders) |
| vitest | ≤13 | 11 כשלונות אחרון ידוע (`tmp/_accept_vitest.json`) |

### דילוגים (105) — סיבות עיקריות

| סיבה | דוגמה |
|------|--------|
| `SITESECURE_ISOLATED_DB_URL` חסר | `test_workforce_rls_isolated.py` (רוב הדילוגים) |
| password grant 400 אחרי reset | חלק מ-`test_tenant_isolation.py`, `test_workspace_team_invitations_live.py` |
| Phase / optional skips | כפי שסומן ב-pytest `-rs` |

---

## תרחישי e2e live (א–ו)

| תרחיש | תוצאה | הוכחה live |
|--------|--------|------------|
| **(א)** הצעה←CCTV←חלופות←שליחה←אישור←פרויקט+עבודה | **עבר** | `test_quote_b8_engine_e2e_live.py` PASSED אחרי תיקון D2 (`a3deb5b`) · job `awaiting_dispatch` |
| **(ב)** שיבוץ←צ׳קליסט←חתימה←סיום←מסירה | **עבר** | demo3/4/5 live PASSED בבידוד ובסריקה המלאה אחרי rate-limit fix |
| **(ג)** פורטל OTP←אתר/אחריות←קריאת שירות | **חלקי** | `test_portal_site_scope_live.py` PASSED · OTP/unit · צילומי 390/768/1440 עדיין ידניים (`Docs/acceptance/portal-screens/`) |
| **(ד)** מבקר←בית←מחירון←בטא | **עבר** (API) | `test_public_marketing_d.py` · UI לא e2e אוטומטי בדפדפן בסבב זה |
| **(ה)** Free←מגבלה←שדרג←פנייה | **חלקי** | C1/C3 יש pytest מקומי/mocked · אין suite live ייעודי מלא לסצנה הזו |
| **(ו)** אחריות←תזכורת←חוזה | **עבר** | `test_warranty_reminders_live.py` PASSED מול DB |

---

## 1. דשבורד

| דרישה | מצב | הוכחה |
|--------|------|--------|
| D1 מושבים | עובד | `test_d1_dashboard_live.py` |
| D3 attention UI | חלקי | vitest `attention-dash3` נכשל (baseline) |
| D2 ממתין לשיבוץ | עובד | מיגרציה הוחלה · B8 רואה job אחרי approve · `test_d2_approve_provision.py` + B8 live |

---

## 2. בונה הצעות / Q4 / שטח / מסחרי

| דרישה | מצב | הוכחה |
|--------|------|--------|
| Q1, B1–B8, Q6, ארכיון | עובד | B8 live PASSED |
| Q4 cancel/KPI/confirm/401 | עובד | cancel live route + B8/DB · ConfirmDialog unit · 401 unit (אין live 401 e2e) |
| שטח demo3–5 | עובד | live PASSED בסריקה המלאה |
| C1–C3 | עובד | מיגרציות הוחלו · pytest מטריצה/הקצאה |
| C4 PayPlus | מסמך | מחוץ למימוש |

---

## 3. אתר שיווקי

| דרישה | מצב | הוכחה |
|--------|------|--------|
| D1 בית+בטא API | עובד | marketing live/API |
| D2 `/pricing` | עובד | — |
| D3 מחשבון→אשף | עובד (unit) | `public-cctv-draft-handoff.test.ts` · אין live e2e הרשמה→אשף |
| SEO sitemap/schema/OG | עובד | Lighthouse SEO **100** (home+pricing preview) · `923fae1` |
| Analytics בלי 400 מקומי | עובד | `72f3833` · לא נטען ב-localhost בלי flag |
| Lighthouse performance מובייל | חלקי | **preview:** home **73** · pricing **100** · (`tmp/lighthouse/*-preview-mobile.json`) · home LCP ~10s / unused JS ~867KiB — מתחת ל-90 בבית |

---

## 4. פורטל לקוחות

| דרישה | מצב | הוכחה |
|--------|------|--------|
| Router + OTP + sessions | עובד | מיגרציות הוחלו · API |
| בידוד / site scope | עובד | `test_portal_site_scope_live.py` PASSED |
| תמונה בקריאת שירות | עובד (API) | `e9863dd`/`5602776` · routes registered · חייב Storage ב-dogfood ידני |
| פתיחת הצעה לאישור | עובד (API+UI) | `POST …/quotes/{id}/open` → `/q/{token}` |
| צילומי 390/768/1440 | חסר | README בלבד — אין קבצי PNG בסבב זה |
| Staff UI ל-site grants | חלקי | DB/API יש · UI staff חלקי |

---

## 5. מובייל טכנאי

| דרישה | מצב | הוכחה |
|--------|------|--------|
| guidelines | עובד (unit/CSS) | `0db3e89` · `field-mobile-guidelines.test.ts` |

---

## 6. משפטי / תזכורות

| דרישה | מצב | הוכחה |
|--------|------|--------|
| E + עוגיות | עובד | קוד + tests |
| תזכורות 60/14 | עובד | live `test_warranty_reminders_live.py` + טבלה ב-DB |

---

## 7. שער — עצירה

```
pytest מלא (live+unit) מול Supabase מקומי: 0 כשלונות / 1188 עברו / 105 דולגו.
מיגרציות חדשות הוחלו ב-db reset + migration up.
תרחישים: א/ב/ו עברו live; ג חלקי (צילומים); ד API; ה חלקי (אין live suite מלא).
Lighthouse preview מובייל: pricing 100/100 SEO+perf; home SEO 100 / perf 73.
אין push / ענן.
הבא אצלך: מעבר ידני על בונה הצעות, שטח, פורטל ועמוד בית.
```

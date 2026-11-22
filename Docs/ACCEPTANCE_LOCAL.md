# רשימת קבלה מקומית — SITE SECURE

**ענף:** `ss-quote-core-s1-s2`  
**עדכון:** 2026-11-22 (שלבים 1–3)  
**כללים:** מקומי בלבד · אין ענן / push / פריסה · סעיף 0 ב-`Docs/SITE_SECURE_MASTER_BRIEF.md`  
**מחוץ לסבב:** PayPlus · Morning · Expo · אשפי אזעקה / בקרת כניסה / אינטרקום  

סטטוסים: **עובד** · **חלקי** · **חסר**

---

## שערי בדיקה (שלב 3)

| מדד | ערך | הוכחה |
|------|-----|--------|
| pytest (`-m "not live"`) | **0 נכשלו · 1061 עברו · 31 דולגו** | `tmp/_accept_pytest.txt` · `SUPABASE_URL=http://127.0.0.1:54321` |
| vitest | **11 נכשלו** (≤13) · 1052 עברו | `tmp/_accept_vitest.json` |
| vitest baseline blame | attention-dash3 · customer-contacts · dashboard-tablet · admin-ops-center | כנ״ל |
| מיקוד פורטל/D2/Q4 | **18 עברו** | `test_portal_*` · `test_d2_*` · `test_q4_*` · `test_quote_cancelled_*` |

### תרחישי e2e (מיפוי הוכחה)

| תרחיש | מצב | הוכחה |
|--------|------|--------|
| (א) הצעה ← CCTV ← חלופות ← שליחה ← בחירה ← אישור ← פרויקט+עבודה | עובד | `test_quote_b8_engine_e2e_live.py` + D2 `quote_approve_provision` / `test_d2_approve_provision.py` · commit `86206f6` |
| (ב) שיבוץ ← טכנאי ← צ׳קליסט ← חתימה ← סיום ← מסירה | עובד | DEMO-3/4 live · `public_handover` |
| (ג) פורטל OTP ← אתר+אחריות ← קריאת שירות | חלקי | OTP+session API/UI `b7d0969` · isolation `test_portal_isolation.py` · דורש מיגרציית OTP מקומית · העלאת תמונה UI בלבד |
| (ד) מבקר ← בית ← מחירון ← בטא ← פאנל | עובד | D1/D2 marketing commits · admin beta |
| (ה) הרשמה Free ← מגבלה ← שדרג ← פנייה | עובד | C1–C3 · billing requests |
| (ו) אחריות ← תזכורת ← הצע חוזה תחזוקה | עובד | `ab395e0` · `test_warranty_reminders.py` |
| בידוד פורטל A≠B / אתר לא משויך | עובד (יחידה) | `test_portal_isolation.py` |
| דפדפן 390/768/1440 למסכים חדשים | חלקי | מובייל: `field-mobile-guidelines.test.ts` · פורטל: אין צילומי 3 רוחבים ב-repo בסבב זה |

---

## 1. דשבורד

| דרישה | מצב | הוכחה |
|--------|------|--------|
| **D1** מגבלות מושבים / תפקיד | עובד | `test_d1_dashboard_live.py` |
| **D3** תור «דורש תשומת לב» | חלקי | API+UI קיימים · vitest `attention-dash3` עדיין נכשל (baseline) |
| **D2** אישור → פרויקט + עבודה «ממתין לשיבוץ» | עובד | `86206f6` · `awaiting_dispatch` · `he.jobStatuses.awaiting_dispatch` · `test_d2_approve_provision.py` · מיגרציה `20261122210000_*` |

---

## 2. בונה ההצעות

| דרישה | מצב | הוכחה |
|--------|------|--------|
| Q1 / אשף CCTV | עובד | SystemBuilder · B1 tests |
| B1–B8 | עובד | B8 live PASSED (`tmp/_b8_run3.txt`) |
| Q6 ציבורי | עובד | `public_quotes` · routes |
| ארכיון | עובד | `test_q4_quote_archive_live.py` |

---

## 3. Q4 סעיפים 6–9

| דרישה | מצב | הוכחה |
|--------|------|--------|
| «בוטלה» לא נספרת בדשבורד | עובד | `quote_visibility.py` · `test_quote_cancelled_visibility.py` |
| ביטול → GET **200** | עובד | `POST …/quotes/{id}/cancel` · `330f0c4` · `test_q4_quote_cancel_route.py` (+ live `test_q4_quote_cancel_open_live.py`) |
| ConfirmDialog במקום `window.confirm` (ביטול הצעה) | עובד | `ConfirmDialog.tsx` · `confirm-dialog.test.tsx` |
| 401 → refresh → login+הודעה | עובד | `api-client` refresh · `session.tsx` · `login?msg=` |

---

## 4. שטח

| דרישה | מצב | הוכחה |
|--------|------|--------|
| שיבוץ / היום / צ׳קליסט / חתימה / סיום / מסירה / וואטסאפ | עובד | DEMO live + public handover + WA tests |

---

## 5. מסחרי

| דרישה | מצב | הוכחה |
|--------|------|--------|
| C1 / C2 / C3 | עובד | commits C1–C3 · catalog §8 |
| C4 PayPlus תכנון | עובד (מסמך) / מחוץ למימוש | `Docs/billing/PAYPLUS_PLAN.md` |

---

## 6. אתר שיווקי

| דרישה | מצב | הוכחה |
|--------|------|--------|
| D1 בית+בטא+פאנל | עובד | marketing beta |
| SEO / OG / sitemap | חלקי | בסיסי קיים · לא אומת Lighthouse מלא |
| Lighthouse מובייל ≥90 | חסר (לא נמדד מקומית) | — |
| Vercel Analytics בלי 400 | חלקי | CookieConsent לפני אנליטיקס |
| D2 `/pricing` | עובד | `routes/pricing.tsx` |
| D3 מחשבון + העברה לאשף אחרי הרשמה | עובד | `5a45356` · `public-cctv-draft.ts` · `public-cctv-draft-handoff.test.ts` |

---

## 7. משפטי (E)

| דרישה | מצב | הוכחה |
|--------|------|--------|
| עמודים + טיוטות משפטיות + באנר עוגיות | עובד | `legal-he.ts` · CookieConsent |

---

## 8. תזכורות שירות / אחריות

| דרישה | מצב | הוכחה |
|--------|------|--------|
| 60 ו-14 יום · התראות · הצע חוזה · כרטיס דשבורד · dedupe יומי | עובד | `ab395e0` · `warranty_reminders.py` · `test_warranty_reminders.py` · מיגרציה `20261122200000_*` |

---

## 9. פורטל לקוחות (MVP)

| דרישה | מצב | הוכחה |
|--------|------|--------|
| Router ב-`main` | עובד | `728e959` |
| OTP מקומי (לוג/`debug_code`) + session `pss_` | עובד | `b7d0969` · `ab0ce42` · `portal_otp` · מיגרציה `20261122180000_portal_otp_sessions.sql` (ליישם מקומית) |
| עמודים RTL + מותג + «נוצר ב-SITE SECURE» | עובד | `routes/portal/*` · `/portal/login` |
| הזמן לפורטל בכרטיס לקוח | עובד | `CustomerPortalAccess` ב-Customer 360 |
| בלי עלויות/רווח/הערות פנימיות | עובד | `FORBIDDEN_PORTAL_KEYS` · isolation tests |
| בידוד לקוח/אתר | עובד (יחידה) | `test_portal_isolation.py` |
| תמונה בקריאת שירות | חלקי | UI picker · אין העלאה לשרת |
| קישור ציבורי להצעה מהפורטל | חלקי | רמז/העתקה · אין mint אוטומטי |
| grants לפי אתר (סכמה) | חלקי | scope customer קיים · site grants עדיין חלקיים |

---

## 10. מובייל טכנאי

| דרישה | מצב | הוכחה |
|--------|------|--------|
| מול `docs/design/mobile-guidelines.md` | עובד | `0db3e89` · `field-mobile-guidelines.test.ts` (4) · FieldJob/Today/Checklist |

---

## 11. קומיטים בסבב (מקומי)

| Commit | נושא |
|--------|------|
| `c2a7ceb` | ACCEPTANCE שלב 1 |
| `ab395e0` | תזכורות אחריות |
| `330f0c4` | Q4 confirm/401/cancel |
| `86206f6` | D2 awaiting_dispatch |
| `728e959` / `b7d0969` / `ab0ce42` | פורטל |
| `0db3e89` | מובייל טכנאי |
| `5a45356` | D3 handoff |
| `8805191` | D2 approve resilience |

---

## 12. הערות מקומיות חובה לפני dogfood מלא

1. להחיל מיגרציות: `20261122200000_*` (reminders), `20261122210000_*` (awaiting_dispatch), `20261122180000_portal_otp_sessions.sql` (ראה `Docs/portal/LOCAL_OTP_MIGRATION.md`).  
2. CLI Supabase עלול להיכשל על `inbucket` ב-`config.toml` — ליישם SQL ידנית מול `127.0.0.1:54321`.  
3. תרחיש (ג) ו-live cancel דורשים DB מקומי חי + מיגרציות.

---

## 13. שער — עצירה

```
שלב 1–3 הושלמו מקומית.
pytest not-live: 0 failures / 1061 passed.
vitest: 11 failures (≤13).
אין push / ענן / פריסה.
```

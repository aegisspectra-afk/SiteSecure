# PayPlus integration plan (C4 — design only)

**Status:** תכנון בלבד. אין מימוש PayPlus, Morning, או webhooks בסבב C2–C3.

**מטרה:** כשתתקבל החלטת מוצר, לחבר את SITE SECURE ל-PayPlus לתשלום ראשון, חיוב חוזר, וניהול מנוי — בלי לשמור פרטי כרטיס בשרת שלנו, עם חשבונית מס של Aegis Spectra דרך Morning.

## עקרונות

1. **אמת מנוי** נשארת ב-`public.subscriptions` (כבר קיים מ-C1/C2).
2. **מקור שינוי תוכנית:** עד PayPlus — `admin_override` + `subscription_allocation_log`. אחרי PayPlus — `source = 'billing'` מאירועי ספק מאומתים בלבד.
3. **כנות ב-UI:** אין “תשלום הצליח” בלי webhook מאומת (ראו `BillingHonestyNote` / `SAAS-PHASE-4-BILLING-READINESS.md`).

## זרימות מוצר (עתידי)

| זרימה | תיאור |
|--------|--------|
| Checkout ראשון | בעלים ב-`/app/settings/billing` → PayPlus Hosted / J5 → חזרה לאפליקציה → הפעלת מנוי לאחר webhook |
| חיוב חוזר | טוקן PayPlus בלבד; ללא PAN ב-DB שלנו |
| שדרוג / שנמוך | שינוי `plan_key` דרך PayPlus + עדכון שורת מנוי |
| ביטול | סטטוס `canceled` / `past_due` לפי אירועי ספק |
| כשל תשלום | `past_due` → שלב grace → הגבלה בהדרגה (לא מחיקת נתונים) |
| חשבונית מס | Morning API לאחר אירוע `payment.succeeded` מאומת |

## Webhooks PayPlus

- נקודת קצה ייעודית ב-FastAPI (לא Edge היסטורי).
- **אימות חתימה** לפי תיעוד PayPlus (HMAC / secret header — לקבוע ביישום).
- **`billing_events`** (חדש): `id`, `provider`, `provider_event_id` UNIQUE, `payload` jsonb, `processed_at`, `error` — idempotency.
- עיבוד: transaction — עדכון `subscriptions` + אופציונלי `billing_invoices` — commit.

## טבלאות מוצעות מול קיים

| ישות | קיים היום | מוצע ל-PayPlus |
|------|-----------|----------------|
| מנוי ל-workspace | `subscriptions` (plan_key, status, source, override_*, provider_ref, current_period_end) | **הרחבה:** `provider_customer_id`, `provider_subscription_id`; הפחתת שימוש ב-override לאחר go-live |
| אירועי ספק | — | `billing_events` (idempotency) |
| בקשות שדרוג בטא | `billing_upgrade_requests` (C3) | נשאר ללידים; checkout יחליף “שדרג” לבעלים |
| יומן הקצאה ידנית | `subscription_allocation_log` (C2) | נשאר לתמיכה ולפיילוט |
| חשבוניות | — | `billing_invoices` (workspace_id, morning_doc_id, amount_agorot, status, period) |
| אמצעי תשלום | — | **לא** טבלת כרטיסים — רק מזהה טוקן אצל PayPlus + `provider_ref` |

## אדפטר שירות (גבול קוד)

```
payplus/
  create_checkout_session(workspace_id, plan_key, return_urls)
  create_management_session(workspace_id)  # שינוי כרטיס / ביטול אצל ספק
  verify_webhook(headers, body) -> VerifiedEvent
  apply_verified_event(event) -> updates subscriptions + billing_events
```

`apply_verified_event` הוא המקום היחיד שמעדכן `plan_key` / `status` כש-`source = billing`.

## Morning (חשבונית מס)

- לאחר webhook תשלום מוצלח: קריאה ל-Morning ליצירת חשבונית על שם Aegis Spectra.
- שמירת `morning_doc_id` ב-`billing_invoices`; קישור ל-PDF בהגדרות (שלב מאוחר מ-C3 — לא נבנה עמוד חשבוניות עכשיו).

## סביבות וסודות

| משתנה | שימוש |
|--------|--------|
| `PAYPLUS_API_KEY` | שרת בלבד |
| `PAYPLUS_WEBHOOK_SECRET` | אימות חתימה |
| `PAYPLUS_TERMINAL_ID` / `PAGE_ID` | לפי סוג אינטגרציה |
| `MORNING_API_*` | חשבוניות |

ללא ערכים ב-repo; רישום ב-`Docs/ops/NEXT_CLOUD_DEPLOY.md` בעת הטמעה.

## תלות בסבב הנוכחי

- C1 מגבלות/יכולות → אכיפה אחרי שינוי מנוי.
- C2 הקצאה ידנית → ממשיך לבטא ללא PayPlus.
- C3 טופס שדרוג → מוחלף בהדרגה ב-checkout; נשאר ללידים חיצוניים.

## בדיקות עתידיות (Acceptance)

- Webhook כפול → שורת `billing_events` אחת, מנוי לא מתעדכן פעמיים.
- חתימה שגויה → 401, ללא שינוי DB.
- `payment_failed` → `past_due` + הודעה ב-UI.
- ביטול → `canceled` + גישה לפי מדיניות grace.

---

**⛔ לא מממשים בסבב C.** מסמך זה הוא מקור האמת לשלב תשלומים הבא.
# DEMO-5 — סטטוס 25 הבדיקות מהתוכנית

מקור: [`DEMO5_PLAN.md`](./DEMO5_PLAN.md) §4.  
עודכן אחרי מימוש claim/rollback/uniques + pytest חי ל־6/8/10/18–20/25.

| # | בדיקה | איפה בקוד / איך | רצה? |
|---|--------|------------------|------|
| 1 | סעיף חובה לא סומן → 409, בלי שינוי | `installation_complete.validate_completion_gates` + `COMPLETION_BLOCKED`; unit דרך `test_dispatch_ops` (mock) | חלקי — אין pytest live ייעודי |
| 2 | תמונה חסרה / נמחקה → 409 | אותם gates (`photo_document_id` + documents) | חלקי — לוגיקה קיימת, אין live assert |
| 3 | אין חתימה / חתימה של עבודה אחרת → 409 | gates על `customer_signature_document_id` + kind=signature | חלקי |
| 4 | N/A = בוצע; רשות לא חוסם | gates: `completed \|\| not_applicable`; required בלבד | חלקי |
| 5 | Idempotency אותו מפתח → אותה תשובה, בלי כפילויות | `completion_idempotency_key` + `completion_result` + `test_demo5_complete_idempotency_live` | **כן** |
| 6 | בקשות במקביל אותו מפתח | claim `status=eq.in_progress` + uniques + `test_demo5_complete_idempotency_live` (2 מקבילים) | **כן** |
| 7 | מפתח אחר אחרי סיום → 409 `JOB_ALREADY_COMPLETED` | `complete_installation` | חלקי — קוד קיים, אין pytest ייעודי |
| 8 | כשל באמצע → rollback מלא | `_rollback_partial_completion` + `test_demo5_complete_rollback_live` (inject על mint) | **כן** |
| 9 | טכנאי אחר → 404 | authz + RLS (קיים מדמו-1) | לא רץ ספציפית ל־DEMO-5 |
| 10 | טכנאי לא קורא billing/outbound; מנהל כן; workspace אחר לא קורא/כותב | RLS + `test_demo5_billing_outbound_rls_live` | **כן** |
| 11 | Workspace אחר → 403/404 | דפוס קיים | לא רץ ספציפית |
| 12 | שתי עבודות בפרויקט: in_progress ואז completed | `_update_project_status` | חלקי — נבדק ב־e2e עקיף (ביטול אחים + סגירה) |
| 13 | ציוד מפריטי תכנון, בלי אופציונליים, אידמפוטנטי | `_install_equipment` + e2e (`equipment_on_site=3`) | **כן** (e2e) |
| 14 | אחריות לפי warranty_months / draft בלי הגדרה | `_create_warranty` + e2e (`active`+12ח׳) | **כן** (e2e); draft path ללא live |
| 15 | billing = total_gross של הצעה מאושרת | `_maybe_billing_item` | חלקי — פריט נוצר ב־e2e; השוואת סכום לא נאכפה |
| 16 | outbound `preview`, אין שליחה | insert `status=preview`; אין worker | **כן** (קוד + schema) |
| 17 | קישור תקין 200 + PDF עברית | `public_handover` + e2e PDF | **כן** |
| 18 | Token שגוי → 404 אחיד | `_load_access` + `test_demo5_handover_token_live` | **כן** |
| 19 | פג תוקף → 404 (או 410) בלי דליפת קיום | אותו shape כמו missing + `test_demo5_handover_token_live` | **כן** |
| 20 | בוטל → 404 אחיד; rate limit על public `/h` API | revoke + `RATE_LIMIT` + `test_demo5_handover_token_live` | **כן** |
| 21 | DB רק hash; אין raw בלוגים | `token_hash` בלבד | חלקי — by design; אין audit scan test |
| 22 | תשובה ציבורית בלי שדות פנימיים | `assemble_handover_document` | חלקי — אין assert allowlist |
| 23 | תיקון trigger warranties public token | מיגרציה `warranties_set_public_token_hash` | **חסר** SQL test |
| 24 | דפדפן 390px: צ׳קליסט→סיום→סיכום→PDF; double-complete | `tmp/ss_demo5_e2e.py` | **כן** (מסלול מלא); double-click לא נבדק |
| 25 | משרד: פעמון, פרויקט, תיק אתר, revoke/new link + ייחודיות צד־אפקטים | e2e + `test_demo5_complete_idempotency_live` (warranty/billing/notify/handover=1) | **כן** (ייחודיות); revoke UI חלקי |

## סיכום פערים (לכתיבה)

נסגרו: **6, 8, 10, 18–20, 25** (ייחודיות צד־אפקטים).  
עדיין חסר/חלקי: **1–4, 7, 9, 11–12, 15, 21–23**, ו־revoke UI ב־24/25.  
כיסוי טוב בפועל: **5–6, 8, 10, 13–14, 16–20, 24–25** (+ שרשרת e2e).

Unit קיים: `apps/api/tests/test_installation_complete_unit.py` (TTL קישור) + `test_dispatch_ops` ל־complete/assign.

Live חדשים:
- `apps/api/tests/test_demo5_billing_outbound_rls_live.py`
- `apps/api/tests/test_demo5_handover_token_live.py`
- `apps/api/tests/test_demo5_complete_idempotency_live.py`
- `apps/api/tests/test_demo5_complete_rollback_live.py`

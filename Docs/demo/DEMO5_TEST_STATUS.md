# DEMO-5 — סטטוס 25 הבדיקות מהתוכנית

מקור: [`DEMO5_PLAN.md`](./DEMO5_PLAN.md) §4.  
עודכן אחרי המימוש המקומי + `tmp/ss_demo5_e2e.py`.

| # | בדיקה | איפה בקוד / איך | רצה? |
|---|--------|------------------|------|
| 1 | סעיף חובה לא סומן → 409, בלי שינוי | `installation_complete.validate_completion_gates` + `COMPLETION_BLOCKED`; unit דרך `test_dispatch_ops` (mock) | חלקי — אין pytest live ייעודי |
| 2 | תמונה חסרה / נמחקה → 409 | אותם gates (`photo_document_id` + documents) | חלקי — לוגיקה קיימת, אין live assert |
| 3 | אין חתימה / חתימה של עבודה אחרת → 409 | gates על `customer_signature_document_id` + kind=signature | חלקי |
| 4 | N/A = בוצע; רשות לא חוסם | gates: `completed \|\| not_applicable`; required בלבד | חלקי |
| 5 | Idempotency אותו מפתח → אותה תשובה, בלי כפילויות | `completion_idempotency_key` + `completion_result` ב־`complete_installation` | חלקי — מנגנון קיים, אין test כפול חי |
| 6 | 4 בקשות במקביל אותו מפתח | — | **חסר** |
| 7 | מפתח אחר אחרי סיום → 409 `JOB_ALREADY_COMPLETED` | `complete_installation` | חלקי — קוד קיים, אין pytest ייעודי |
| 8 | כשל באמצע → rollback מלא | התוכנית ביקשה DB RPC טרנזקציוני; המימוש הוא שרשרת PostgREST | **חסר** (אין טרנזקציה אחת / אין inject test) |
| 9 | טכנאי אחר → 404 | authz + RLS (קיים מדמו-1) | לא רץ ספציפית ל־DEMO-5 |
| 10 | טכנאי לא קורא billing/outbound; מנהל כן | RLS על הטבלאות במיגרציה | **חסר** pytest RLS |
| 11 | Workspace אחר → 403/404 | דפוס קיים | לא רץ ספציפית |
| 12 | שתי עבודות בפרויקט: in_progress ואז completed | `_update_project_status` | חלקי — נבדק ב־e2e עקיף (ביטול אחים + סגירה) |
| 13 | ציוד מפריטי תכנון, בלי אופציונליים, אידמפוטנטי | `_install_equipment` + e2e (`equipment_on_site=3`) | **כן** (e2e) |
| 14 | אחריות לפי warranty_months / draft בלי הגדרה | `_create_warranty` + e2e (`active`+12ח׳) | **כן** (e2e); draft path ללא live |
| 15 | billing = total_gross של הצעה מאושרת | `_maybe_billing_item` | חלקי — פריט נוצר ב־e2e; השוואת סכום לא נאכפה |
| 16 | outbound `preview`, אין שליחה | insert `status=preview`; אין worker | **כן** (קוד + schema) |
| 17 | קישור תקין 200 + PDF עברית | `public_handover` + e2e PDF | **כן** |
| 18 | Token שגוי → 404 | `_load_access` | **חסר** test |
| 19 | פג תוקף → 404 | `_load_access` | **חסר** test |
| 20 | בוטל → 404; קישור חדש עובד | revoke + mint | חלקי — endpoints קיימים, אין test |
| 21 | DB רק hash; אין raw בלוגים | `token_hash` בלבד | חלקי — by design; אין audit scan test |
| 22 | תשובה ציבורית בלי שדות פנימיים | `assemble_handover_document` | חלקי — אין assert allowlist |
| 23 | תיקון trigger warranties public token | מיגרציה `warranties_set_public_token_hash` | **חסר** SQL test |
| 24 | דפדפן 390px: צ׳קליסט→סיום→סיכום→PDF; double-complete | `tmp/ss_demo5_e2e.py` | **כן** (מסלול מלא); double-click לא נבדק |
| 25 | משרד: פעמון, פרויקט, תיק אתר, revoke/new link | e2e owner site + notifications count | חלקי — התראה+אתר כן; revoke/new link UI לא |

## סיכום פערים (לכתיבה)

חסרים כבדים: **6, 8, 10**, ובדיקות public token **18–20, 23**.  
חלקיים שדורשים חיזוק: **1–5, 7, 9, 11–12, 15, 21–22, 25** (revoke UI / double complete).  
כיסוי טוב בפועל: **13, 14, 16, 17, 24** (+ שרשרת e2e).

Unit קיים: `apps/api/tests/test_installation_complete_unit.py` (TTL קישור בלבד) + עדכון `test_dispatch_ops` ל־complete/assign.

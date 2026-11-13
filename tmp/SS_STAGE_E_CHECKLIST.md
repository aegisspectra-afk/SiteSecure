# SITE SECURE: רשימת שלב E (פריסה)

**סטטוס: חסום עד הודעת הבעלים.** שום דבר כאן לא הורץ בענן. כל המיגרציות הוחלו מקומית בלבד.

## 0. תנאים מקדימים (פעולות של הבעלים)
- [ ] ניקוי הענן מבדיקות שרצו בעבר: משתמשי `*@sitesecure.test` (`ss.phase3.*`, `ss.ft.*`, `ss.invite.*`, ...) וה-workspaces שלהם. ייצוא לפני מחיקה. לא נוגעים בשורה שלא תואמת את הדפוסים.
- [ ] בדיקה ב-Authentication ← Logs: האם נשלחו מיילי אימות לדומיין `sitesecure.test` והאם יש הגבלת שליחה.
- [ ] מומלץ: סיבוב (rotate) מפתחות anon ו-service של הפרויקט. קובצי `.env` ישבו על OneDrive.
- [ ] גיבוי מלא של בסיס הנתונים בענן לפני כל מיגרציה.

## 1. מיגרציות שלא הוחלו בענן (לפי סדר הגרסה)
| גרסה | קובץ | תנאי מקדים | Rollback |
|---|---|---|---|
| 20261031112121 | quote_contact_search_indexes | צריך להפעיל `pg_trgm` בפרויקט **לפני** המיגרציה (דרך הדשבורד) | `tmp/rollback_20261031112121_quote_contact_search.sql` |
| 20261031120000 | warranty_public_token_hash | — | `tmp/rollback_20261031120000_warranty_hash.sql` |
| 20261031121000 | quote_public_access_required_ttl | — | `tmp/rollback_20261031121000_quote_ttl.sql` |
| 20261031122000 | storage_rls_documents_signed_only | — | `tmp/rollback_20261031122000_storage_rls.sql` |
| 20261031193159 | drop_unused_customer_notes_activities | ספירת שורות ב-`customer_notes` וב-`customer_activities` וגיבוי. ה-rollback משחזר רק את מבנה הטבלאות, לא את הנתונים. **לא הוחלה גם מקומית.** | `tmp/rollback_20261031193159_customer_notes.sql` |
| 20261107120000 | ss_quote_money_lockdown | **מצומדת לקוד ה-API**, ראו סעיף 2 | `tmp/rollback_20261107120000_ss_quote_money_lockdown.sql` |
| 20261108100000 | ss_apply_optional_lines | אחרי 20261107120000. מחליפה את אותו RPC ושומרת את ה-grants (service_role בלבד). מצומדת לקוד ה-API מ-`0f85b19`: API ישן לא שולח `is_optional`, והשורות נוצרות כרגילות. | `tmp/rollback_20261108100000_ss_apply_optional_lines.sql` (מחזירה את גרסת S2) |
| 20261113120000 | ss_lock_function_grants_and_role_escalation | אחרי 20261108100000. מבטלת EXECUTE מ-anon ומ-authenticated על כל הפונקציות ב-public (חוץ מ-pg_trgm), ומשאירה ל-authenticated רק 25 פונקציות. מוסיפה triggers נגד הסלמת תפקידים. **לפני החלה בענן:** לוודא שהפונקציות שבענן זהות למקומיות; לולאת ה-REVOKE דינמית ומכסה כל פונקציה שקיימת. אחרי ההחלה: create_workspace מקבל רק solo. | `tmp/rollback_20261113120000_ss_lock_function_grants_and_role_escalation.sql` (משחזרת את ה-ACL המדויק) |

`20261023140000_ssp_unit_login` שייכת ל-SSP ולא להיקף של SITE SECURE. לא נוגעים בה.

## 2. צימוד בין 20261107120000 לקוד ה-API (מ-commit `24b5458` ואילך)
| שילוב | תוצאה |
|---|---|
| API ישן מול DB נעול | **כל כתיבה להצעות נכשלת**: שורות, סכומים, שליחה, revise |
| API חדש מול DB לא נעול | הכול עובד חוץ מ-Apply של CCTV. ה-RPC הישן דורש `auth.uid()`, והקוד החדש קורא לו כ-service role. **הפרצות עדיין פתוחות.** |
| API חדש מול DB נעול | המצב הנכון |

**סדר פריסה:**
1. לפרוס את קוד ה-API החדש. מכאן Apply של CCTV לא עובד עד שלב 2.
2. מיד אחר כך להחיל את `20261107120000` ואחריה את `20261108100000`.
3. בדיקת עשן (סעיף 4).

**סדר rollback (הפוך):**
1. להריץ את ה-rollback של `20261108100000`, ואחריו את ה-rollback של `20261107120000` (כל אחד בטרנזקציה אחת). מכאן חוזר המצב "API חדש מול DB לא נעול".
2. להחזיר את קוד ה-API לגרסה הקודמת.

## 3. משתני סביבה ל-API בסביבה המיועדת
- [ ] `APP_ENV=staging` או `production`. לא `development`, כי שומר ה-dev מסרב לכתובת Supabase שאינה מקומית.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` מוגדר, ומפתח service אמיתי. **מהשינוי ב-S3-pre, ה-API לא עולה בלי המפתח מחוץ ל-dev.** כל הכתיבות להצעות וחתימת אישורי Apply תלויות בו.
- [ ] `SUPABASE_URL` ו-`SUPABASE_ANON_KEY` של הפרויקט המיועד. ב-Vercel: `VITE_SUPABASE_URL` ו-`VITE_SUPABASE_ANON_KEY`.
- [ ] אסור להגדיר `SS_ALLOW_REMOTE_SUPABASE` או `VITE_ALLOW_REMOTE_SUPABASE` בסביבה פרוסה. הם לא נדרשים שם.

## 4. בדיקת עשן אחרי פריסה
- [ ] owner: יצירת הצעה, הוספת שורה, שינוי כמות. הסכום מתעדכן.
- [ ] שליחה. הקישור הציבורי מציג את אותן שורות ואותו סכום.
- [ ] revise להצעה שנשלחה עובד. revise להצעה מאושרת מחזיר 409.
- [ ] Apply של CCTV על טיוטה עובד.
- [ ] sales: שליחה מתחת לסף המרווח נחסמת.
- [ ] קריאה ישירה ל-PostgREST עם JWT של משתמש: עדכון `total_gross` לא משנה את ה-DB. בדיקות `test_ss_s2_quote_lockdown_live.py` רצות רק מקומית, ולכן הבדיקה הזו בענן ידנית.

# SITE SECURE: Backlog

פריטים שהוחלט במפורש **לא** לבנות עכשיו. כל פריט כולל את ההקשר שנדרש כדי להתחיל אותו בלי חקירה מחדש.

## תעודת אחריות ציבורית (קישור ללקוח)
- **סטטוס:** נדחה (החלטת הבעלים, 2026-11-13). לא נבנה עד אחרי העלייה לענן.
- **מצב היום:** אין זרימה כזו בכלל. אין נתיב ב-web, אין endpoint ב-API ואין RPC.
- **ממצא חשוב:** הטריגר `public.warranties_set_public_token_hash` (BEFORE INSERT על `warranties`) מייצר token אקראי (`gen_random_bytes(32)`), שומר רק את ה-SHA-256 שלו בעמודה `warranties.public_token` **ומשליך את ה-token עצמו**. אף אחד, לא המשתמש ולא ה-API, לא מקבל אותו, ולכן אי אפשר לשתף קישור. המקור: מיגרציה `20261031120000_warranty_public_token_hash.sql`, שהחליפה את העמודה הגולמית ב-hash.
- **מה צריך כשבונים**, באותו דפוס של הקישור הציבורי להצעת מחיר (`quote_public_access` + `routers/public_quotes.py`):
  1. endpoint לצוות, `POST /workspaces/{ws}/warranties/{id}/share`, עם הרשאה, טעינה תחת RLS וסינון `workspace_id`. הוא מנפיק token, שומר את ה-hash ומחזיר את ה-URL פעם אחת. אפשר גם revoke.
  2. endpoint ציבורי, `GET /api/v1/public/warranties/{token}`: חיפוש לפי hash דרך service role, תוקף וביטול, rate limit, ותשובה עם שדות שהלקוח רשאי לראות בלבד.
  3. עמוד ציבורי ב-web, בעברית ו-RTL, עם מצבי טעינה, שגיאה ו"קישור לא תקף".
  4. החלטה: האם הטריגר ממשיך לייצר hash אקראי שאף אחד לא משתמש בו, או שהנפקת ה-token עוברת ל-endpoint השיתוף בלבד.
  5. בדיקות: cross-workspace, token לא תקף או מבוטל, ובדיקה שאין דליפת שדות פנימיים.

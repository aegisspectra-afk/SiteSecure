# מיגרציות ממתינות לפריסה לענן

רשימה מצטברת לסבב הפריסה הבא (רק עם אישור מפורש). לא להריץ אוטומטית.

| מיגרציה | תיאור | Rollback |
|---------|--------|----------|
| `20261122140000_ss_quote_alternatives_b3.sql` | B3: חלופות ועד בית (`quote_alternatives`, `presentation_mode`, `approved_alternative_id`, `alternative_id` על שורות/סעיפים) | `supabase/rollbacks/20261122140000_ss_quote_alternatives_b3.sql` |

**הערה:** מיגרציות מנובמבר 2026 תחת `ss_*` על הדיסק עשויות גם הן להיות מקומיות בלבד מול הענן — לאמת מול `list_migrations` לפני פריסה.

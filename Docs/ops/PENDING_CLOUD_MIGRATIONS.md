# מיגרציות ממתינות לפריסה לענן

**בסיס בענן (אומת 18.11.2026):** טיפ = `20261117200000_ss_quote_archive_and_delete_guard`  
**GitHub `main`:** `62da1f3`  
כל 33 המיגרציות עד הטיפ כבר רצו בענן — **לא להריץ שוב**.

רשימה מצטברת לסבב הפריסה הבא (רק עם אישור מפורש). לא להריץ אוטומטית.

| מיגרציה | מקור | תיאור | Rollback |
|---------|------|--------|----------|
| `20261122140000_ss_quote_alternatives_b3.sql` | B3 | חלופות ועד בית | `supabase/rollbacks/20261122140000_ss_quote_alternatives_b3.sql` |
| `20261122160000_ss_c1_plan_keys_free_pro_business.sql` | C1 | מפתחות free/pro/business/enterprise · `quotes.alternatives` | `supabase/rollbacks/20261122160000_ss_c1_plan_keys_free_pro_business.sql` |

**קוד בלי מיגרציה (ייפרס עם Web/API):** B1 · B2 · B4 · B5 · שער capabilities ב-API.

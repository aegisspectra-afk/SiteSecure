# מיגרציות ממתינות לפריסה לענן

**בסיס בענן (אומת 18.11.2026):** טיפ = `20261117200000_ss_quote_archive_and_delete_guard`  
**GitHub `main`:** `62da1f3`  
כל 33 המיגרציות עד הטיפ כבר רצו בענן — **לא להריץ שוב**.

רשימה מצטברת לסבב הפריסה הבא (רק עם אישור מפורש). לא להריץ אוטומטית.

| מיגרציה | מקור | תיאור | Rollback |
|---------|------|--------|----------|
| `20261122140000_ss_quote_alternatives_b3.sql` | B3 | חלופות ועד בית | `supabase/rollbacks/20261122140000_ss_quote_alternatives_b3.sql` |
| `20261122160000_ss_c1_plan_keys_free_pro_business.sql` | C1 | מפתחות free/pro/business/enterprise · `quotes.alternatives` | `supabase/rollbacks/20261122160000_ss_c1_plan_keys_free_pro_business.sql` |
| `20261122170000_ss_c1_section8_plan_matrix.sql` | C1 | §8 מגבלות (משתמשים/אחסון/הצעות) + מטריצת יכולות מלאה | `supabase/rollbacks/20261122170000_ss_c1_section8_plan_matrix.sql` |
| `20261122180000_ss_b7_quote_terms_templates.sql` | B7 | תבניות תנאים ב-workspace · ברירת מחדל להצעה חדשה · תבנית חוזה תחזוקה שנתי | `supabase/rollbacks/20261122180000_ss_b7_quote_terms_templates.sql` |
| `20261122190000_ss_c2_manual_subscription_allocation.sql` | C2 | יומן הקצאת מנוי ידנית (בטא) | `supabase/rollbacks/20261122190000_ss_c2_manual_subscription_allocation.sql` |
| `20261122190500_ss_c3_billing_upgrade_requests.sql` | C3 | תור בקשות שדרוג מטופס הגדרות | `supabase/rollbacks/20261122190500_ss_c3_billing_upgrade_requests.sql` |
| `20261122191000_ss_d1_marketing_beta_signups.sql` | D1 | טופס בטא בשיווק → טבלת לידים לפאנל ניהול | `supabase/rollbacks/20261122191000_ss_d1_marketing_beta_signups.sql` |
| `20261122200000_ss_warranty_reminder_events.sql` | תזכורות שירות | יומן dedup לתזכורות אחריות 60/14 | `supabase/rollbacks/20261122200000_ss_warranty_reminder_events.sql` |

**קוד בלי מיגרציה (ייפרס עם Web/API):** B1 · B2 · B4 · B5 · B6 · C1 שער capabilities מלא ב-API · C2/C3 API+UI · תזכורות אחריות (API).

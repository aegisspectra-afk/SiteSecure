# פריסה הבאה לענן — רשימת שינויים מאז הטיפ

**טיפ בענן:** `20261117200000` (18.11.2026, 33 מיגרציות)  
**GitHub main:** `62da1f3`  
**ענף עבודה מקומי:** `ss-quote-core-s1-s2`

אין להריץ מיגרציות ≤ `20261117200000`. הרשימה למטה היא **רק מה שנוסף אחרי הטיפ**.

## 1. מיגרציות DB

1. `supabase/migrations/20261122140000_ss_quote_alternatives_b3.sql` — B3 חלופות ועד בית  
2. `supabase/migrations/20261122160000_ss_c1_plan_keys_free_pro_business.sql` — C1 מפתחות + `quotes.alternatives`

## 2. קוד API / Web (בלי מיגרציה)

| שלב | תוכן |
|-----|------|
| B1 | חיפוש הוספת פריט / `sort=recent` |
| B2 | רווחיות משרד, אזהרת שוליים בלי חסימת שליחה, מניעת דליפת עלות |
| B3 | UI חלופות, PDF השוואה, freeze בשליחה, CCTV generate-alternatives |
| B4 | `cameraPlacements` במצב מקצועי + המשך לצ'קליסט/ציוד מותקן |
| B5 | צפיות חוזרות, follow-up 3 ימים, שכפול הצעה, superseded |

## 3. סדר פריסה מומלץ (רק אחרי אישור מפורש)

1. Apply מיגרציות מהטבלה למעלה על Supabase cloud  
2. Deploy API (Render)  
3. Deploy Web (Vercel)  
4. Smoke: enable alternatives → send → public choose → approve  

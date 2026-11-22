# צילומי מסך — פורטל לקוחות

**מצב:** אוטומציית דפדפן לא הורצה בסבב זה (סביבת סוכן ללא שרת dev קבוע).  
**דרוש ידנית** אחרי `pnpm --filter web dev` מקומי.

## רוחבי מסך

| רוחב | דפים |
|------|------|
| 390 | `/portal/login`, `/portal`, `/portal/service`, `/portal/quotes` |
| 768 | אותם דפים |
| 1440 | אותם דפים |

## שמירה

שמרו קבצים בשמות:

- `portal-login-390.png`, `portal-login-768.png`, `portal-login-1440.png`
- `portal-home-390.png`, …
- `portal-service-390.png`, …
- `portal-quotes-390.png`, …

בתיקייה זו (`Docs/acceptance/portal-screens/`).

## אימות עיצוב (אוטומטי)

- `apps/web/tests/portal-responsive.test.ts` — RTL, יעדי מגע, גודל גופן בסיסי.
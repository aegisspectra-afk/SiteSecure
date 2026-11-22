# CLAUDE.md — SITE SECURE

הנחיות קצרות לסוכני קוד שעובדים על הריפו.

## מסמכים מחייבים

| נושא | נתיב |
|------|------|
| בריף סבב נוכחי | `Docs/SITE_SECURE_MASTER_BRIEF.md` |
| מצב מוצר | `Docs/STATE_OF_PRODUCT.md` |
| פריסה הבאה לענן | `Docs/ops/NEXT_CLOUD_DEPLOY.md` · `Docs/ops/PENDING_CLOUD_MIGRATIONS.md` |
| **מובייל (חובה)** | [`docs/design/mobile-guidelines.md`](docs/design/mobile-guidelines.md) |

כל מסך מובייל (≤768, ובדיקות ב-390) חייב לעמוד ב-`docs/design/mobile-guidelines.md`: ניווט תחתון עד 4, יעדי מגע 48px, גופן ≥17px, מסך אחד = משימה אחת, bottom sheet, RTL, מצבים ריקים, מצב ללא קליטה.

## כללי סבב

- לא בונים מחדש — מרחיבים מנגנונים קיימים.
- לא נוגעים בענן / `main` בלי אישור מפורש.
- עבודה על `ss-quote-core-s1-s2` מקומית.

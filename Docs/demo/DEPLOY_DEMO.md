# פריסת סביבת הדמו (DEMO-6)

מטרה: סטאק נפרד להדגמות — **לא** Production. עצור אחרי הכנת הקבצים; הרצת מיגרציות ו־seed רק אחרי שמילאת `.env.demo.local`.

## רכיבים

| רכיב | פלטפורמה | הערות |
|------|-----------|--------|
| Web | Vercel (פרויקט נפרד לדמו) | build כמו Production, משתני `VITE_*` של הדמו |
| API | Render (שירות נפרד) | Docker `deploy/Dockerfile.api`, אזור `frankfurt` |
| DB/Auth/Storage | Supabase (פרויקט נפרד או Local) | מיגרציות מאפס + seed |

תבנית סודות: [`.env.demo.local.example`](../../.env.demo.local.example) → העתק ל־`.env.demo.local` (לא ב־git).

---

## 1. Supabase (דמו)

1. צור פרויקט חדש (או השתמש ב־Local `127.0.0.1:54321`).
2. העתק `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ל־`.env.demo.local`.
3. אם זה `*.supabase.co`: הוסף `DEMO_ALLOW_CLOUD=1`.
4. **אחרי** מילוי ה־env (לא עכשיו): החל מיגרציות מאפס (`supabase db reset` מקומית, או pipeline מול הפרויקט החדש), ואז:

```bash
python apps/api/scripts/demo_workspace_seed.py
```

לפני כל הדגמה:

```bash
python apps/api/scripts/demo_workspace_reset.py
```

---

## 2. Render — API דמו

העתק מה־blueprint [`render.yaml`](../../render.yaml) לשירות חדש, למשל `site-secure-api-demo`:

| מפתח | ערך |
|------|-----|
| `APP_ENV` | `demo` |
| `API_PUBLIC_URL` | `https://<demo-api>.onrender.com` |
| `WEB_PUBLIC_URL` | `https://<demo-web>.vercel.app` |
| `CORS_EXTRA_ORIGINS` | אותו origin של Vercel הדמו (אם נדרש) |
| `SUPABASE_URL` | מה־`.env.demo.local` |
| `SUPABASE_ANON_KEY` | מה־`.env.demo.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | **רק ב־Render** — לעולם לא ב־Vercel |
| אזור | `frankfurt` |
| Health check | `GET /health` → `{"ok":true,"service":"site-secure-api"}` |
| Dockerfile | `./deploy/Dockerfile.api` |

ודא ש־`WEB_PUBLIC_URL` תואם את דומיין Vercel כדי שקישורי `/h/{token}` ו־WhatsApp יצביעו נכון.

---

## 3. Vercel — Web דמו

פרויקט Vercel נפרד (לא Production). Build כמו ב־[`vercel.json`](../../vercel.json).

| מפתח | ערך |
|------|-----|
| `VITE_SUPABASE_URL` | אותו Supabase דמו |
| `VITE_SUPABASE_ANON_KEY` | anon בלבד |
| `VITE_API_URL` | `https://<demo-api>.onrender.com` |

אין להגדיר `SUPABASE_SERVICE_ROLE_KEY` ב־Vercel.

אחרי deploy: פתח `/login` עם `demo.owner@sitesecure.test` — אמור להופיע פס «סביבת הדגמה».

---

## 4. בדיקות עשן אחרי עלייה

1. `GET {API_PUBLIC_URL}/health`
2. התחברות owner → פס דמו → אין ניווט ל־SSP / Workforce / מודיעין טכני
3. טכנאי → «היום» רואה עבודות מה־seed
4. תעודת מסירה מהדוח `tmp/demo_workspace_seed_report.json` → `/h/{token}` + PDF
5. אין שליחת מייל אמיתית (`outbound_messages.status = preview` בלבד)

---

## 5. איפוס לפני הדגמה

```bash
# עם .env.demo.local טעון
python apps/api/scripts/demo_workspace_reset.py
```

תסריט דיבור: [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md).

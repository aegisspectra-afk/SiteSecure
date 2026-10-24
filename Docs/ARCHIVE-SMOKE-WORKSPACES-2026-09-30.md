# Cold archive — smoke cleanup 2026-09-30

Batch: `smoke_cleanup_2026_09_30`

## In-app access

Platform Admin → **ארכיון** (`/admin/archive`)

- סביבות בארכיון
- משתמשים בארכיון (+ snapshot מלא בלחיצה)
- **שחזור משתמש**: בחירת סביבה חיה + תפקיד → יצירה מחדש ב־Auth, צירוף לסביבה, קישור איפוס סיסמה

API (platform admin JWT):

- `GET /api/v1/admin/archive?kind=workspaces|profiles|all`
- `GET /api/v1/admin/archive/profiles/{id}`
- `POST /api/v1/admin/archive/profiles/{id}/restore` `{ "workspace_id", "role_key" }`

## Storage

- Cold schema: `archive.workspace_index`, `archive.profile_snapshots`
- Service-role views: `public.archive_workspaces`, `public.archive_profiles`
- Hot tenants remain in `public.workspaces` / `auth.users`

## Hot DB remaining workspaces

- אגיס מערכות בע''מ
- איליה מערכות
- Aegis Spectra systeme
- מערכות  מיגון ואבטחה
- מייק בסין

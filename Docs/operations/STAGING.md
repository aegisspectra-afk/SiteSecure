# SITE SECURE V2 — Staging / Private Preview

**Name it this, not Production.** The live surface is Auth + Onboarding + Dashboard + Today. That is enough to dogfood. It is not the product you sell.

**Right now:** keep running on **localhost**. Web public host is **Vercel** — [VERCEL.md](./VERCEL.md). FastAPI stays separate (Render later). Not Production.

**Do not start:** Public Website UI, CRM 7B, Customers/Sites/Quotes/Jobs UI, Site File, Mobile.

```
localhost (now)                    public Web (Vercel)              FastAPI (later)
─────────────                      ──────────────────               ──────────────
http://localhost:5173      →       https://<project>.vercel.app
http://localhost:8000      →                                        https://api.site-secure.com
        \                              \                            /
         \                              \                          /
          →  Supabase V2  rhxqqudlngimhplvndmz  (Auth, DB, Storage)
```

---

## 0. What you can dogfood (already built)

| Surface | Status |
|---------|--------|
| `/login` `/register` `/forgot-password` `/reset-password` | Built |
| `/onboarding` | Built |
| `/app/dashboard` `/app/today` | Built |
| FastAPI, Auth, RBAC, RLS, Storage | Built |
| Public marketing | Not built — do not wait |
| CRM / Customers / Sites / Quotes / Jobs UI | Not built — do not start |
| Site File / Mobile | Not built |

`/` still redirects to `/login`. Correct until Public Website ships. Staging sends `noindex`.

---

## 1. Supabase Auth URLs (do not get this wrong)

**Site URL is the web origin only.** It is **not** `/login`.

Supabase uses Site URL as the default after-auth landing when a redirect is missing. Putting `/login` there is a misconfiguration.

### While you stay on localhost

| Field | Value |
|-------|--------|
| **Site URL** | `http://localhost:5173` |
| **Redirect URLs** | exact paths the **code** uses (below) |

Code today:

| Flow | Code | Redirect URL to allow |
|------|------|------------------------|
| Signup email confirm | `emailRedirectTo: origin + '/login'` | `http://localhost:5173/login` |
| Forgot password | `redirectTo: origin + '/reset-password'` | `http://localhost:5173/reset-password` |

Also allow (safe extras, same origin):

```
http://localhost:5173/**
http://localhost:5173/register
http://localhost:5173/onboarding
http://localhost:5173/app
http://localhost:5173/app/dashboard
http://localhost:5173/app/today
```

### When Vercel Web exists

Follow [VERCEL.md](./VERCEL.md). Site URL is the Vercel origin (`https://<project>.vercel.app`), never `/login` and never the API host.

Keep localhost Redirect URLs until you drop local email tests.

---

## 2. Localhost (current)

Two terminals, repo root `.env` filled (see [`.env.example`](../../.env.example)):

```bash
cd apps/api
uvicorn app.main:app --reload --port 8000
```

```bash
npm run web:dev
```

- Web: http://localhost:5173  
- API: http://localhost:8000/health  
- `APP_ENV=development` (or omit) so CORS includes localhost  
- `WEB_PUBLIC_URL=http://localhost:5173`  
- `VITE_API_URL=http://localhost:8000`

`SUPABASE_SERVICE_ROLE_KEY` stays in the API env only.

You can run the QA list in §5 against localhost now (except “open on a phone on the public internet”). Phone on the same Wi‑Fi can use the laptop’s LAN IP only if you bind `0.0.0.0` and add that origin to CORS + Supabase Redirect URLs — optional.

---

## 3. Public Web (Vercel) then FastAPI (separate)

Web: [VERCEL.md](./VERCEL.md) — Vite on Vercel, not Render.

FastAPI later (`render.yaml` is API-only): set `WEB_PUBLIC_URL` to the Vercel origin, then Redeploy the Vercel project with the real `VITE_API_URL`. Confirm the browser Network tab does not call `localhost:8000`.

Do not put `SUPABASE_SERVICE_ROLE_KEY` on Vercel.

---

## 4. Environment names

| Layer | Variables |
|-------|-----------|
| Web build | `VITE_SUPABASE_URL` `VITE_SUPABASE_ANON_KEY` `VITE_API_URL` |
| API runtime | `SUPABASE_URL` `SUPABASE_ANON_KEY` `SUPABASE_SERVICE_ROLE_KEY` `WEB_PUBLIC_URL` `API_PUBLIC_URL` `APP_ENV` `CORS_EXTRA_ORIGINS` |

Never put the service role in `VITE_`, `EXPO_PUBLIC_`, git, or the browser.

---

## 5. QA (you and a human — not “the agent said it works”)

Do Tests 1–4 on localhost now. Repeat on Vercel + a phone browser after the API is public.

### Test 1 — Registration

Site → הרשמה → email verify (if on) → Login → Onboarding → Create workspace → Dashboard.

### Test 2 — Owner

Workspace name in shell. Dashboard (Attention may be empty — success). Owner is **not** sent to Today as home. Logout. Login again. Session survives refresh.

### Test 3 — Technician

Login → `/app/today`. Assigned scheduled job: **התחל עבודה** then **סיים עבודה**. Confirm the job **status changed via the API** (refresh / Network), not only a local label.

### Test 4 — Viewer

UI: no Create / Edit / Delete / Start / Complete.  
**Also API:** with the viewer JWT, mutating calls must be **403** (or 404), not 200. Hidden buttons are not security. Existing live tests cover isolation; a manual `POST .../customers` or `POST .../jobs/{id}/start` as viewer is the dogfood check.

### Test 5 — Tenant isolation

Workspace A / User A vs Workspace B / User B. A must not read B’s dashboard (403/404). Do not paste B’s ids into A’s URL and expect data.

### Test 6 — Phone browser (after a reachable URL)

Login, signup, onboarding, dashboard, today, start/complete if a job exists. RTL, type size, scroll, tap targets, overflow, on-screen keyboard. This is **not** the Expo app.

---

## 6. After staging works

```
STAGING QA → bugfix → Public Website → CRM 7B → Site File → Mobile
```

Public CTAs will then point at a real system: פיילוט → `/register`, התחברות → `/login`.

---

## 7. Stop line

- Do not start CRM or the marketing site before this QA.  
- Do not market this as Production.  
- If Auth Site URL is set to `…/login`, fix it to the **origin**.  
- If a Vercel build still calls `http://localhost:8000`, `VITE_API_URL` was wrong — fix it and Redeploy. Production builds now fail if the value contains localhost.

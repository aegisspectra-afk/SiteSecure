# SITE SECURE V2 — Vercel (Web only)

**Vercel hosts the Vite web app. It does not replace FastAPI.**  
Service role never goes here. Public Website is **not** this step.

```
Vercel                          FastAPI (later, separate host)
  └── SITE SECURE Web             └── API Server
        /login /register                CORS ← Vercel origin
        /onboarding                     VITE_API_URL points here
        /app/dashboard
        /app/today
              \                        /
               →  Supabase V2  rhxqqudlngimhplvndmz
                    Auth + Database + Storage
```

Local daily work stays `http://localhost:5173` + `http://localhost:8000`.  
Vercel is the first **public Web** origin (`https://site-secure-xxxx.vercel.app`). Custom domain `site-secure.com` comes after this works.

---

## 0. GitHub before Vercel

1. This folder is a Git repo on `main`.  
2. Push to GitHub (`site-secure-v2`).  
3. Vercel → **Add New** → **Project** → that GitHub repo.  
4. Root Directory: leave empty. Do not select `apps/web`.

---

## 1. Import settings (do not pick `apps/web` as Root Directory)

npm workspaces live at the **repository root**. If Root Directory is `apps/web`, `@site-secure/ui` will not install.

In the Vercel import screen:

| Field | Value |
|--------|--------|
| **Root Directory** | leave empty (repository root `.`) |
| **Framework Preset** | Other |
| **Build Command** | `npm run web:build` |
| **Output Directory** | `apps/web/dist` |
| **Install Command** | `npm ci` |
| **Node.js Version** | `20` |

`vercel.json` in the repo already encodes build / output / SPA rewrites / `noindex`. Prefer matching the dashboard to that file.

Do **not** enable a Vercel Python / FastAPI project for this repo.

---

## 2. Environment variables (Web)

Set on **Production** and **Preview**. Changing them requires a **Redeploy** (Vite bakes `VITE_*` at build time).

| Key | Put on Vercel Web? | Value |
|-----|--------------------|--------|
| `VITE_SUPABASE_URL` | Yes | `https://rhxqqudlngimhplvndmz.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Yes | anon / `sb_publishable_…` only |
| `VITE_API_URL` | Yes | public FastAPI origin, **no trailing slash**, **not** `http://localhost:8000` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Never** | API server only |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` without `VITE_` | No | unused by the browser bundle |

Production build **fails** if `VITE_API_URL` is missing or contains `localhost`.

Until FastAPI has a public URL, Login/Signup can still talk to **Supabase Auth** from the browser. Onboarding, Dashboard, and Today **will not** work: they need `VITE_API_URL` + CORS on the API. Sequence: deploy Web → publish API → set `VITE_API_URL` → Redeploy Web → set API `WEB_PUBLIC_URL` to the Vercel origin.

---

## 3. Supabase Auth (add, do not replace localhost yet)

**Site URL** stays an origin, never `/login`.

While dogfooding both local and Vercel:

| Field | Keep localhost | Add Vercel |
|-------|----------------|------------|
| Site URL | `http://localhost:5173` until you switch daily use | then `https://<project>.vercel.app` |
| Redirect URLs | existing localhost paths | same paths on the Vercel origin |

Required Vercel redirects (code today):

```
https://<project>.vercel.app/login
https://<project>.vercel.app/reset-password
```

Also allow:

```
https://<project>.vercel.app/**
https://<project>.vercel.app/register
https://<project>.vercel.app/onboarding
https://<project>.vercel.app/app
```

---

## 4. After the Web URL exists — FastAPI (not Vercel)

On the API host (Render later, or whatever you choose):

| Key | Value |
|-----|--------|
| `WEB_PUBLIC_URL` | `https://<project>.vercel.app` (no path) |
| `APP_ENV` | `staging` (so localhost is **not** kept in CORS) |
| `CORS_EXTRA_ORIGINS` | extra preview origins if needed, comma-separated |

Then rebuild Web with the real `VITE_API_URL`. Confirm in the browser Network tab: requests go to that origin, never `localhost:8000`.

---

## 5. Later custom domain

```
site-secure.com/          → still Login redirect until Public Website
site-secure.com/login
site-secure.com/register
site-secure.com/app
api.site-secure.com       → FastAPI, not Vercel
```

Update Supabase Site URL + Redirects, `VITE_API_URL`, API `WEB_PUBLIC_URL`, then Redeploy.

---

## 6. Do not start here

Public Website UI, CRM 7B, Site File, Mobile, Dashboard redesign.

# SITE SECURE V2 — Vercel (frontends only)

**Vercel hosts the Vite SPAs. It does not replace FastAPI.**  
Service role never goes here. Public Website is **not** this step. Do not create a Vercel Python project for this repo.

Three frontend projects can share this Git repository. **Root Directory stays the repository root** for every project. `vercel.json` cannot hold three different Output Directories, so the build script copies the selected app into `vercel-output`.

| Vercel project | `SITESECURE_VERCEL_APP` | Build | Output copied from |
|----------------|-------------------------|-------|--------------------|
| SITE SECURE (existing) | unset, or `web` | `npm run web:build` | `apps/web/dist` |
| WorkForce | `workforce` | `npm run workforce:build` | `apps/WorkForce/dist` |
| SSP | `ssp` | `npm run ssp:build` | `apps/ssp/dist` |

Do **not** set Root Directory to `apps/web`, `apps/WorkForce`, or `apps/ssp`. npm workspaces live at the repository root. Do **not** set `SITESECURE_VERCEL_APP=workforce` on the existing SITE SECURE project.

```
Vercel (static SPAs)            FastAPI (separate host, not Vercel)
  ├── SITE SECURE Web             └── API Server
  ├── WorkForce                     CORS ← each Vercel origin
  └── SSP                           VITE_API_URL points here
              \                        /
               →  Supabase V2  rhxqqudlngimhplvndmz
                    Auth + Database + Storage
```

Local daily work stays `http://localhost:5173` (web), `5174` (SSP), `5175` (WorkForce) + `http://localhost:8000`.  
Existing public Web origin: `https://site-secure-umber.vercel.app`. Do not invent WorkForce/SSP production hostnames here; set them in the Vercel project after it exists.

---

## 0. GitHub before Vercel

1. This folder is a Git repo on `main`.  
2. Push to GitHub (`site-secure-v2`).  
3. Vercel → **Add New** → **Project** → that GitHub repo.  
4. Root Directory: leave empty. Do not select `apps/web`.

---

## 1. Import settings (Root Directory is always the repository root)

npm workspaces live at the **repository root**. If Root Directory is `apps/web` or `apps/WorkForce`, `@site-secure/ui` will not install.

### SITE SECURE (existing project)

| Field | Value |
|--------|--------|
| **Root Directory** | leave empty (repository root `.`) |
| **Framework Preset** | Other |
| **Build Command** | `node scripts/vercel-build.mjs` (from `vercel.json`; default app is web) |
| **Output Directory** | `vercel-output` |
| **Install Command** | `npm ci` |
| **Node.js Version** | `20` |
| **`SITESECURE_VERCEL_APP`** | leave unset |

`vercel.json` encodes install / build / output / SPA rewrites / `noindex`. Prefer matching the dashboard to that file. Unset `SITESECURE_VERCEL_APP` keeps this project on SITE SECURE web.

### WorkForce (new project, same Git repo)

Create a **second** Vercel project. Do not reuse the SITE SECURE project.

| Field | Value |
|--------|--------|
| **Root Directory** | leave empty (repository root `.`) |
| **Framework Preset** | Other |
| **Build Command** | leave as `vercel.json` (`node scripts/vercel-build.mjs`) |
| **Output Directory** | leave as `vercel.json` (`vercel-output`) |
| **Install Command** | `npm ci` |
| **Node.js Version** | `20` |
| **`SITESECURE_VERCEL_APP`** | `workforce` (Production and Preview) |

### SSP (new project, same Git repo)

Same as WorkForce, with **`SITESECURE_VERCEL_APP=ssp`**. SSP production env guards are not part of this WorkForce pass.

Do **not** enable a Vercel Python / FastAPI project for this repo.

---

## 2. Environment variables (frontends)

Set on **Production** and **Preview**. Changing them requires a **Redeploy** (Vite bakes `VITE_*` at build time). Never put `SUPABASE_SERVICE_ROLE_KEY` in a `VITE_` variable.

### SITE SECURE Web

| Key | Put on this Vercel project? | Value |
|-----|-----------------------------|--------|
| `VITE_SUPABASE_URL` | Yes | `https://rhxqqudlngimhplvndmz.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Yes | anon / `sb_publishable_…` only |
| `VITE_API_URL` | Yes | public FastAPI origin, **no trailing slash**, **not** localhost |
| `VITE_WORKFORCE_APP_URL` | Yes, after WorkForce has a public origin | WorkForce HTTPS origin, **not** localhost |
| `SITESECURE_VERCEL_APP` | No | default is web |
| `SUPABASE_SERVICE_ROLE_KEY` | **Never** | API server only |

### WorkForce

| Key | Put on this Vercel project? | Value |
|-----|-----------------------------|--------|
| `SITESECURE_VERCEL_APP` | Yes | `workforce` |
| `VITE_SUPABASE_URL` | Yes | same public Supabase URL as web |
| `VITE_SUPABASE_ANON_KEY` | Yes | anon / `sb_publishable_…` only |
| `VITE_API_URL` | Yes | same public FastAPI origin as web, **not** localhost |
| `VITE_PLATFORM_HOME_URL` | Yes | SITE SECURE origin + `/platform`, **not** localhost |
| `SUPABASE_SERVICE_ROLE_KEY` | **Never** | API server only |

WorkForce production **build fails** if `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, or `VITE_PLATFORM_HOME_URL` is missing or points at localhost.

Until FastAPI has a public URL, Login/Signup can still talk to **Supabase Auth** from the browser. Onboarding, Dashboard, and Today **will not** work: they need `VITE_API_URL` + CORS on the API. Sequence: deploy Web → publish API → set `VITE_API_URL` → Redeploy Web → set API `WEB_PUBLIC_URL` to the Vercel origin.

---

## 3. Supabase Auth URL Configuration (required for Vercel email)

**Site URL is the default fallback origin.** If a requested `emailRedirectTo` is not in Redirect URLs, Auth silently uses Site URL. That is why production confirmation emails went to `http://localhost:5173`.

Code always sends the **current browser origin** (`window.location.origin`), never a baked Vercel alias:

| Flow | Value sent |
|------|------------|
| Signup / resend | `{origin}/login` |
| Forgot password | `{origin}/reset-password` |

### Cloud project (Authentication → URL Configuration)

| Field | Value |
|-------|--------|
| **Site URL** | `https://site-secure-umber.vercel.app` (origin only, no `/login`) |
| **Redirect URLs** | exact paths below, plus localhost so local email still works |

Required Redirect URLs:

```
https://site-secure-umber.vercel.app/login
https://site-secure-umber.vercel.app/reset-password
https://site-secure-umber.vercel.app/**
http://localhost:5173/login
http://localhost:5173/reset-password
http://localhost:5173/**
```

Also allow if you still land on these paths from older links:

```
https://site-secure-umber.vercel.app/onboarding
https://site-secure-umber.vercel.app/app
http://localhost:5173/onboarding
http://localhost:5173/app
```

Preview deployments: add `https://*-site-secure-*.vercel.app/**` only if you send auth emails from those hosts.

After a WorkForce Vercel origin exists, add that origin’s `/login` and `/**` to Redirect URLs. WorkForce has no `/register` or `/reset-password`; password recovery stays on SITE SECURE `/forgot-password`.

Do **not** leave Site URL on `http://localhost:5173` once real users register on Vercel.

---

## 4. After the Web URL exists — FastAPI (not Vercel)

On the API host (Render later, or whatever you choose):

| Key | Value |
|-----|--------|
| `WEB_PUBLIC_URL` | SITE SECURE Vercel origin (no path) |
| `APP_ENV` | `staging` (so localhost is **not** kept in CORS) |
| `CORS_EXTRA_ORIGINS` | WorkForce Vercel origin, SSP origin, and extra preview origins — comma-separated |

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

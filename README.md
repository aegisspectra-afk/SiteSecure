# SITE SECURE V2

Hebrew-first, field-first SaaS for security-system businesses.

**One platform → two clients (web + mobile) → one FastAPI → one new Supabase project.**

This repository is a **clean rebuild**. It does not copy the V1 SPA, demo store, Aegis auth coupling, or hybrid schema.

## Current status

Phases 0–6B and Auth UX are in this repo (Web: `/login` `/register` `/onboarding` `/app`).  
Web deploys to **Vercel** from the monorepo root. FastAPI is **not** on Vercel. See [`docs/operations/VERCEL.md`](docs/operations/VERCEL.md).

Do not put `SUPABASE_SERVICE_ROLE_KEY` in Git, Vercel Web, or the browser.

## Documents

Start here:

1. [`Docs/SITE-SECURE-CONTEXT.md`](Docs/SITE-SECURE-CONTEXT.md) — V1 facts
2. [`docs/architecture/V1-TO-V2.md`](docs/architecture/V1-TO-V2.md) — KEEP / REBUILD / REMOVE
3. [`docs/architecture/V2-ARCHITECTURE.md`](docs/architecture/V2-ARCHITECTURE.md) — platform
4. [`docs/architecture/V2-ROADMAP.md`](docs/architecture/V2-ROADMAP.md) — phases
5. [`docs/development/SETUP.md`](docs/development/SETUP.md) — how to run

## What I need from you before live Auth/DB

Create a **new** Supabase project (not the V1 project) and provide:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (API server only)

Until then, use local `supabase start` (see setup doc). Never put the service role in web or mobile.

## Layout

```
apps/          # web, mobile, api — not scaffolded until Phase 3–6
packages/      # authz catalog lives here already
supabase/      # migrations, seed, storage policies
docs/          # architecture
```

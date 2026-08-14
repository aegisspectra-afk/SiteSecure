# Contributing — SITE SECURE V2

## Architecture first

Read, in order:

1. `Docs/SITE-SECURE-CONTEXT.md` (V1 facts)
2. `docs/architecture/V1-TO-V2.md`
3. `docs/architecture/V2-ARCHITECTURE.md`
4. The domain doc for your change (database, RBAC, RLS, API, web, mobile, UX)

If a change fights those documents, update the document in the same PR and explain why.

## Non-negotiables

- One authorization catalog; no `role === 'owner'` product logic
- Tenant isolation in RLS + API
- No service role on clients
- No `USING (true)` on tenant tables
- Server-authoritative quote totals
- No placeholder navigation
- No V1 imports, demo store, or Aegis auth coupling
- Hebrew UI strings via i18n catalogs once they exist

## Database

Every schema change is a numbered migration. Do not edit applied migrations. Do not “quick fix” in the Supabase SQL editor without a matching file.

## UX

New screens go through the 18-point checklist in `docs/ux/V2-UX-PSYCHOLOGY.md`.  
Tokens from `docs/ux/V2-DESIGN-SYSTEM.md` — no random colors.

## Tests

Isolation, authz, pricing, and sync duplication tests are stop-the-line (see roadmap).

## Git

Do not commit `.env`, service role keys, or customer data dumps.

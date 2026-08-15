# V2 Roadmap

**Status:** Phased delivery. Do not build the entire product in one pass.  
**After each phase:** implement → typecheck → lint → test → inspect → fix → document.

Architecture documents in this folder are **Phase 0–1**. Database migrations in `/supabase` begin **Phase 2**.

Product / SaaS / RBAC / billing UX operating system: [V2-SAAS-EXPERIENCE.md](./V2-SAAS-EXPERIENCE.md). That spec does **not** unlock CRM, Site File, Mobile, or fake billing. Catalog plans remain `solo` / `business` / `enterprise`.

SITE SECURE is **one product, three clients** of the same FastAPI + Supabase stack:

```
Visitor          Technician
  ↓                  ↓
Public Web        Mobile App
  ↓                  ↓
Value / Trust     Same Auth user
  ↓                  ↓
Pilot / Signup    Same workspace
  ↓                  ↓
Authentication    Same backend
  ↓
Onboarding
  ↓
Authenticated Web App (/app)
```

Public Website is **not** “another `/app` screen” and is **not** deferred marketing. Spec: [V2-PUBLIC-WEB.md](./V2-PUBLIC-WEB.md).

Authenticated app modules (CRM, Quotes, Jobs, …) still ship only when their spec is approved. Hidden nav ≠ fake modules.

**Current stop:** Foundation SaaS (workspace, catalog plans, `authorize()` + RLS, seat limits). Next: **server usage meters on Render**. Do **not** start CRM / Phase 7B, Site File, Mobile Expo, billing, or fake dashboard widgets. Web: [VERCEL.md](../operations/VERCEL.md). API: Render `site-secure-api-staging`.

---

## Phase 0 — Architecture discovery

**Done when:** `SITE-SECURE-CONTEXT.md` read; KEEP/REBUILD/REMOVE recorded in [V1-TO-V2.md](./V1-TO-V2.md).

---

## Phase 1 — V2 architecture

**Done when:** the architecture documents exist and do not contradict each other (including [V2-PUBLIC-WEB.md](./V2-PUBLIC-WEB.md)).

---

## Phase 2 — New Supabase project + database

- New Supabase project (credentials from the human; never invented)
- Migrations `0001`–`0024` applied
- Seed: roles, permissions, plans
- Storage buckets + policies
- RLS tests for cross-workspace isolation
- Generated types pipeline

**Human action:** create the Supabase project; provide `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only).

---

## Phase 3 — Auth + workspace + RBAC + RLS

- Email/password, verify, reset
- Session hydration API
- Create workspace (explicit)
- Invitations
- `authorize()` engine + catalog
- Membership roles including Founding Technician
- No demo mode

---

## Phase 4 — Backend API foundation

- FastAPI skeleton, error envelope, pagination, logging, rate-limit interface
- Health, session, workspace CRUD
- OpenAPI → `packages/api-client`

---

## Phase 5 — Web foundation + design system

- Tokens, RTL shell, login, onboarding, dashboard frame
- `<Can>`, nav filtering
- Empty/loading/error patterns

---

## Phase 6 — Mobile foundation

- Expo app, auth, secure session, Today shell
- SQLite + empty outbox
- Assigned-jobs placeholder wired to API when jobs exist

---

## Phase PW — Public Website (SITE SECURE origin)

**Not a screen inside `/app`.** Visitor UX product: marketing IA, trust, honest CTAs, SEO-capable HTML, claim safety.

- Sections: הכאב, ROI (illustrative only), Site File (concept), Digital Twin (concept), אמון, פיילוט, Pricing, FAQ, About, Contact
- Doors: `/login`, `/register` (trial / pilot intent)
- Public inquiry ≠ tenant CRM `leads` / `customers`
- Depends on: Auth pages already exist (Phase 5). Does **not** depend on CRM, Quotes, or Jobs UI
- **Schedule:** started when the human requested the public origin. Must not be treated as “later.”
- Claim gate: no 99.9%, partnership logos, customer counts, guaranteed savings, or unverified encryption/hosting claims

---

## Phase 7 — CRM + customers + sites

- Customers, contacts, Customer 360
- Sites identity + address + code allocator
- Web list/detail; mobile peek from later jobs

---

## Phase 8 — Systems + Site Files

- Systems, equipment, zones, documents, photos, timeline
- Site File UX (web dossier; mobile read/capture)
- Tokenized public site view (narrow, **noindex** — not the marketing origin)

---

## Phase 9 — Quotes + catalog

- Products, categories, templates
- Quote builder (web)
- Server pricing, PDF, send, viewed, approve
- Authz on cost/margin

---

## Phase 10 — Projects + jobs + service

- Projects from quotes
- Jobs as field unit
- Service calls → jobs
- Field workflow on mobile (online)
- Checklists, signatures, completion

---

## Phase 11 — Inventory

- Warehouses, stock, movements
- Consume on job (optional)
- Feature-gated; absent from nav on Solo

---

## Phase 12 — Notifications + realtime

- In-app bell
- Email transactional
- Realtime for jobs/quotes/notifications
- Push device registration

---

## Phase 13 — Offline sync

- Full outbox protocol
- Conflicts UI
- Photo/signature queue
- Isolation tests

---

## Phase 14 — Billing + reports

- Stripe (or chosen provider) against `plans` / `subscriptions`
- Usage limits
- Honest upgrade UX
- First operational reports (not vanity charts)

---

## Phase 15 — AI + automation

- Only workspace-scoped, authorized, audited assistants
- Quote/product recommendations, summaries
- No generic chatbot bolted on

---

## Phase 16 — Security audit, performance, production hardening

- Threat model review
- Pen-adjacent checklist (authz, RLS, storage, rate limits)
- Indexes, query plans
- Observability (errors, API, sync failures)
- Accessibility pass
- Load: lists virtualized, PDFs server-side

---

## Explicitly not in this roadmap

- Automatic V1 → V2 data migration (later: export → transform → import)
- Aegis-hosted auth
- Demo/localStorage product
- Site-planning CAD module
- Fake finance/inventory nav before those phases

---

## Suggested stop-the-line

If RLS isolation tests fail, **do not** continue to CRM.  
If pricing tests fail, **do not** send quotes.  
If sync duplicates rows, **do not** ship offline.

# Phase B4 — Aegis SSP Extraction

**Document status:** B4.3 — O4 auth decision + `public_ssp` / Home cutover **planning only** (no implementation)  
**Date:** 2026-10-19  
**Parents:** `PRODUCT_BOUNDARIES.md`, `PHASE_B2_1_IMPLEMENTATION.md` §6, `PHASE_B3_SITE_SECURE_BOUNDARIES.md`  
**O4 short record:** `PHASE_B4_3_O4_DECISION.md`

### Legend

| Marker | Meaning |
|--------|---------|
| **Fact** | Verified in repo / this phase |
| **Decision** | Binding for B4.x |
| **Proposal** | Forward-looking; not implemented |
| **Deferred** | Explicitly out of current sub-phase |

---

## 1. Phase goals

| Phase | In scope | Out of scope |
|-------|----------|--------------|
| **B4.1** | Scaffold `apps/ssp`, env, anon Supabase, API client, smoke | Product screens, `public_ssp` |
| **B4.2** | Authenticated forms/submissions UI in `apps/ssp`; explicit login; entitlement + permission gates | Moving/deleting `/app/ssp`; `public_ssp`; Platform Home `entry_path`; SSO cookie/BFF |
| **B4.3** | O4 decision; `public_ssp` cutover plan; Home `entry_path` migration sequence (docs) | Any code/config/deploy change |

**Decision:** Same Supabase project and data model; no data migration.

---

## 2. Application structure (B4.2)

```text
apps/ssp/
  src/
    main.tsx                 # QueryClient + SessionProvider + Router
    router.tsx               # /login + authenticated tree
    lib/
      env.ts                 # VITE_* helpers; VITE_WEB_ORIGIN for public links
      supabase.ts            # anon client only
      api.ts                 # createApiClient + Bearer from session
      session.tsx            # hydrate GET /auth/session; signIn/signOut
      can.ts                 # UI can() via @site-secure/authz/catalog.json (read-only)
    components/
      SspShell.tsx
      RequirePermission.tsx
    routes/
      LoginPage.tsx
      AuthenticatedLayout.tsx  # session → workspace → ssp → ssp.forms.view
      FormsListPage.tsx
      FormDetailPage.tsx
      SubmissionsListPage.tsx
      SubmissionDetailPage.tsx
    i18n/he.ts               # SSP string subset (copied, not shared package)
  scripts/smoke-ssp-foundation.mts
```

---

## 3. Screens and routes moved (ported; web copy kept)

| `apps/ssp` path | Source in `apps/web` | Notes |
|-----------------|----------------------|--------|
| `/login` | Pattern from `routes/login.tsx` (password only) | Explicit login — no cross-port session share |
| `/` | `/app/ssp/` forms list | |
| `/forms/$formId` | `/app/ssp/forms/$formId` | Public assignment URL uses `VITE_WEB_ORIGIN` + `public_path` |
| `/submissions` | `/app/ssp/submissions/` | Requires `ssp.submissions.view` |
| `/submissions/$submissionId` | `/app/ssp/submissions/$submissionId` | Requires `ssp.submissions.view` |

**Not moved:** `/ssp/$token` public tablet UI, `demo/ssp`, Platform Home entry still `/app/ssp`.

### Shared vs copied

| Shared packages | Copied / app-local |
|-----------------|-------------------|
| `@site-secure/api-client` | `i18n/he.ts` SSP subset |
| `@site-secure/ui`, `design-system` | Page components under `src/routes` |
| `@site-secure/authz/catalog.json` (**read-only** for UI `can`) | `can.ts` (same logic as web `lib/can.ts`) |
| Existing FastAPI SSP routers | SessionProvider specialized for SSP host |

---

## 4. Identity / session contract in practice (B4.2)

1. Browser holds Supabase Auth session for **this origin only** (5174).  
2. `createSspApi()` attaches `Authorization: Bearer <access_token>`.  
3. `GET /api/v1/auth/session` hydrates memberships / features / permissions (server archive + tenancy).  
4. UI gates: `has_workspace` → feature `ssp` → `ssp.forms.view` (shell); submissions need `ssp.submissions.view`.  
5. **Server** still runs JWT + membership + `authorize` + entitlement on every SSP API call — client gates are UX only.  
6. No JWT in URLs. No `service_role` in the bundle.  
7. **Decision:** No new Cookie/BFF in B4.2 — use `signInWithPassword` on the SSP origin.

### Env / CORS / proxy

| Variable | Role |
|----------|------|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Anon Auth |
| `VITE_API_URL` | FastAPI (prod); dev uses Vite `/api` proxy |
| `VITE_PLATFORM_HOME_URL` | Blocked/entitlement CTA |
| `VITE_WEB_ORIGIN` | Prefix for `/ssp/{token}` links (still on web) |

Allow `http://localhost:5174` in API CORS if not using the proxy, or rely on same-origin `/api` proxy in `vite` dev.

---

## 5. Backward compatibility

- `apps/web` `/app/ssp/**` **unchanged** and remains the Platform Home target.  
- `public_ssp` / submit RPC / rate limit **unchanged**.  
- No API contract changes in B4.2.  
- Catalog.json not modified.

---

## 6. Known limitations

- Session does not sync from `:5173` → `:5174`.  
- Public tablet fill stays on web origin.  
- UI `can()` can drift if catalog changes — server remains authoritative.  
- Windows OneDrive `&` path may require `subst` for `ssp:build` (same as B4.1).

---

## 7. Remains after B4.3 (implementation phases)

- **B4.4 (proposal):** Implement `public_ssp` UI host cutover per §11 (API may stay monolith initially).  
- **B4.5 (proposal):** Platform Home `entry_path` + `openProduct` external navigation per §12.  
- Optional deprecation of embedded `/app/ssp` after soak.  
- Future upgrade from O4 Option B → shared cookie / BFF only after §10.5 opens close.

---

## 8. Tests (B4.2)

| Check | Result |
|-------|--------|
| `ssp:typecheck` | **Pass** |
| `ssp:smoke` | **Pass** — routes, gates, login, public link origin, `can()` / missing feature, embedded SSP + `public_ssp` paths preserved |
| `ssp:build` | **Pass** via `subst S:` (OneDrive `&` path workaround) |

**Not run:** interactive browser E2E. Smoke covers static wiring for: signed-out → `/login`; entitlement/`ssp.forms.view` gates in layout; `can()` false without feature. Live session / expired-token UX verified by code paths (`ACCOUNT_INACTIVE` / 401 → local sign-out) but not exercised against a live API in this phase.

---

## 9. Responsibility boundaries (unchanged)

| Party | Owns | Must not own |
|-------|------|--------------|
| Platform Core | Auth, workspaces, entitlements, Home, Admin | SSP domain UI long-term |
| Site Secure | CRM/ops; **still hosts** `/app/ssp` + public `/ssp/:token` | Granting entitlements |
| `apps/ssp` | Authenticated SSP product UI (B4.2) | `service_role`; workspace create |
| API | JWT / membership / authorize / `public_ssp` | Browser secrets |

---

## 10. O4 authentication decision (B4.3)

### 10.1 Options evaluated (this phase’s labels)

| ID | Definition (B4.3) | Repo support today |
|----|-------------------|--------------------|
| **A** | Shared secure cookie **plus** BFF / session gateway that issues HttpOnly app cookies | **Not present.** No BFF, no session-cookie middleware, no gateway package found |
| **B** | Explicit login per app via same Supabase Auth project (anon JS client; Bearer to FastAPI) | **Fact:** `apps/web` + `apps/ssp` both use Supabase JS; B4.2 ships `/login` on SSP |
| **C** | Other architecture evidenced in-repo | **None** beyond stacked SPA on one origin (pre-extract). URL/token handoff **rejected** (hard constraint) |

> **Label note:** B2.1 §6.6 used “Option A” for parent-domain Auth cookie *without* requiring a BFF, and “Option B” for BFF. B4.3 adopts the **product brief’s** A/B definitions above. See `PHASE_B4_3_O4_DECISION.md`.

### 10.2 Evidence

| Topic | Finding | Class |
|-------|---------|-------|
| Session storage | Web uses custom `authTokenStorage` over `localStorage`/`sessionStorage` (`remember-device.ts`). SSP uses Supabase default persist (also origin-local storage). | **Fact** |
| Cookie sharing today | Auth session is **not** an HttpOnly first-party cookie shared across ports/hosts. Different origins (`:5173` vs `:5174`) do not share Web Storage. | **Fact** |
| JWT validation | FastAPI `user_client` / `current_user` (archive fail-closed B2.1a); no reliance on UI alone | **Fact** |
| Membership / entitlement / permissions | `load_authz_context` + `authorize` / `require` on protected routers; SSP feature + `ssp.*` permissions | **Fact** |
| CORS | `WEB_PUBLIC_URL` + `CORS_EXTRA_ORIGINS`; in development also `http://localhost:5173` and `:8081`. **`5174` is not auto-added** | **Fact** (`config.py`) |
| Dev API access for SSP | Vite `/api` proxy on 5174 → FastAPI (same pattern as web) | **Fact** |
| Production origins | `WEB_PUBLIC_URL` / future SSP public URL are **env-configured**; concrete production hostnames for Platform vs SSP **not fixed in code** | **Open** |
| Logout / refresh | Per-origin Supabase `signOut` / `autoRefreshToken`; no cross-app logout fan-out | **Fact** |
| Workspace switch | Platform/web `PUT /me/active-workspace` + cache clear; SSP reads `memberships[0]` after hydrate — no shared switch UX across hosts yet | **Fact** |

### 10.3 Security trade-offs

| Concern | Option A (cookie + BFF) | Option B (explicit login) |
|---------|-------------------------|-----------------------------|
| XSS token theft | Better if access token never in JS | Token in JS storage (current model) — same class as today’s web app |
| CSRF | Must design cookie SameSite/CSRF for BFF | Bearer-from-memory/storage on API calls; classic cookie CSRF less central |
| New infra | **Requires** new gateway + deploy + cookie domain policy | None beyond CORS/proxy already understood |
| UX | One login across apps | Re-login on SSP origin until upgrade |
| Workspace switch | Needs shared session or BFF sync | User switches on Platform; SSP re-login/refresh picks `last_workspace_id` via session API |
| Fit to repo | Greenfield | Matches existing Auth usage |

### 10.4 Decision

**O4 = Option B (explicit login per app)** for near-term SSP extraction and for **entry_path cutover prerequisites**.

Rationale: the repository already operates Option B; Option A needs a BFF that does not exist and production parent-domain facts that are unverified. Choosing A now would invent infrastructure.

**Hard constraints remain:** no JWT in URLs; no browser `service_role`; per-request server authz unchanged.

### 10.5 Open deployment assumptions (must close before considering Option A upgrade)

| ID | Question |
|----|----------|
| D1 | Production Platform web origin (final `WEB_PUBLIC_URL`) |
| D2 | Production SSP origin (apex / subdomain, e.g. `ssp.example.com`) |
| D3 | Whether D1 and D2 share a registrable parent domain suitable for cookie `Domain=` |
| D4 | Whether compliance/security requires HttpOnly-only access tokens (forces BFF) |
| D5 | Multi-instance rate-limit store approval before scaling public API workers |

### 10.6 Future upgrade path (**Proposal**, not selected)

1. If D1–D3 allow a common parent domain and D4 is false → evaluate Supabase cookie-based multi-subdomain session (legacy B2.1 “shared cookie”) **without** inventing URL handoff.  
2. If D4 is true or domains diverge → design BFF (brief Option A) as a separate approved project.  
3. Until then, keep Option B.

---

## 11. `public_ssp` cutover plan (planning only — B4.3)

### 11.1 Current flow (**Fact**)

```text
Admin/authenticated SSP UI
  → POST .../ssp/forms/{id}/assignments
  → returns public_token once + public_path "/ssp/{token}"
  → token stored hashed (token_hash); plaintext only at creation

Tablet browser (unauthenticated)
  → GET  /api/v1/public/ssp/assignments/{token}          (peek)
  → POST /api/v1/public/ssp/assignments/{token}/unlock   (access code)
  → POST /api/v1/public/ssp/assignments/{token}/submit   (answers)
       → ServiceClient (service_role) loads assignment/form/version
       → RPC ssp_public_submit (+ optional write_audit_log)
       → in-process access-code failure rate limit (token hash + IP)
```

| Piece | Location |
|-------|----------|
| Public UI | `apps/web/src/routes/ssp/$token.tsx` |
| Public API | `apps/api/app/routers/public_ssp.py` |
| Token helpers | `apps/api/app/ssp/tokens.py` |
| Rate-limit notes | `apps/api/app/ssp/RATE_LIMIT.md` |
| Assignment create | `ssp_forms.py` → `public_path: f"/ssp/{token}"` |
| Client helpers | `api-client` `peekSspAssignment` / `unlock` / `submit` |

**Workspace boundary:** assignment rows carry `workspace_id`; service role queries filter by that id. Public routes do **not** use end-user JWT.

### 11.2 What stays vs what moves

| Component | Temporary (during cutover) | Target |
|-----------|----------------------------|--------|
| `public_ssp` FastAPI router + RPC + ServiceClient | **Stay on monolith API** (same project) | May later move with SSP API deployable; not required for first UI cutover |
| In-process rate limit | Stay (document limitation) | Shared store (RATE_LIMIT.md) before multi-worker public scale |
| Tablet UI `/ssp/$token` | Dual-serve or redirect from web | **Move to `apps/ssp`** (e.g. `/public/$token` or keep `/ssp/$token` on SSP host) |
| Authenticated SSP UI | Already on `apps/ssp` (B4.2) + web copy | Web copy deprecated after Home cutover soak |
| `public_path` string | Relative `/ssp/{token}` works on web origin | Absolute URL using SSP (or web) public origin, or reverse-proxy path on one host |

### 11.3 Recommended migration sequence

1. **Freeze contracts:** Keep `/api/v1/public/ssp/*` paths and submit/idempotency semantics unchanged.  
2. **Env:** Define `SSP_PUBLIC_URL` / `VITE_SSP_PUBLIC_URL` (tablet origin) and ensure CORS includes that origin for public + authenticated API calls if not same-origin proxied.  
3. **Port tablet UI** into `apps/ssp` (reuse api-client public methods; still **no** service_role in browser).  
4. **Compatibility:**  
   - **Preferred:** Web route `/ssp/$token` becomes a **302/meta redirect** to SSP origin same path (or configured path), preserving existing printed QR/links when hosts share path shape; **or**  
   - Reverse-proxy `/ssp/*` from web edge to SSP app (no client change).  
5. **Assignment links:** Change create-assignment response to emit absolute `public_url` (new field) while keeping `public_path` for backward compatibility until clients updated (`apps/ssp` already prefixes `VITE_WEB_ORIGIN` — switch to SSP public origin when tablet UI moves).  
6. **Do not** relocate rate limiter or RPC until shared-store decision (D5) and/or SSP API extract is approved.  
7. **Soak:** Monitor unlock/submit 4xx/429; keep web redirect until error budget met.  
8. **Remove** web tablet page only after redirect proven (separate approval).

### 11.4 Security & rollback gates

| Gate | Requirement |
|------|-------------|
| S1 | Browser bundle still contains **zero** service_role material |
| S2 | Public token remains unguessable; access-code hashing unchanged |
| S3 | Rate limit not weaker than today; document multi-instance gap |
| S4 | No JWT/token in redirect query strings — path token only (already the model) |
| R1 | Rollback = point `public_url` / redirects back to web `/ssp/$token`; API untouched |
| R2 | Feature flag or env switch for link origin without migration |

### 11.5 Targeted tests before any cutover implementation

- Peek / unlock success & wrong code → 429 after budget  
- Submit + idempotency replay  
- Revoked/expired/completed assignment → expected errors  
- Redirect/proxy preserves token path  
- Absolute link generation from authenticated SSP create-assignment  
- Confirm `service_role` absent from `apps/ssp` build artifacts  

---

## 12. Platform Home `entry_path` cutover (planning only)

### 12.1 Current behavior (**Fact**)

- API: `product_entry_path("ssp")` → `"/app/ssp"` (`platform_products.py`).  
- UI: `openProduct` only special-cases relative paths `/app/ssp`, `/app/fleet`, `/app/today`, else dashboard (`platform/index.tsx`).  
- **Implication:** Changing `entry_path` to an absolute SSP URL **without** updating `openProduct` would incorrectly fall through to `/app/dashboard`.

### 12.2 Safe order

1. **Auth readiness:** O4 Option B accepted — users can sign in on SSP origin (done in B4.2).  
2. **Product gates on SSP:** entitlement `ssp` + `ssp.forms.view` (done).  
3. **Config:** Introduce `SSP_APP_URL` (server and/or `VITE_`) for the authenticated SSP origin (e.g. `http://localhost:5174` / prod URL). **Do not** invent hostnames.  
4. **Platform Home client:** Extend `openProduct` to detect absolute `http(s)://` (or configured SSP base) and `window.location.assign` / `href` — **no token in URL**.  
5. **Deep links:** Document bookmarks to `/app/ssp/*`; optional web redirect `/app/ssp` → SSP app after soak.  
6. **Workspace:** User selects workspace on Platform Home (`switchWorkspace`) **before** opening SSP; SSP hydrates `memberships[0]` via session. Document that switching workspace while SSP is open requires refresh/re-entry under Option B.  
7. **API change:** Point `product_entry_path` for `ssp` at absolute SSP URL **or** keep path and resolve via env in Home only — prefer single SoT in `platform_products` + env for origin.  
8. **Rollout:** Flag / env `SSP_HOME_ENTRY=embedded|standalone`; default embedded until smoke on staging.  
9. **Rollback:** Flip flag to embedded `/app/ssp`; web routes still present (must not delete in cutover PR).

### 12.3 Prerequisites checklist

- [ ] O4 Option B documented and accepted (this section)  
- [ ] `openProduct` supports external SSP URL  
- [ ] CORS or proxy covers SSP origin for authenticated API  
- [ ] Staging SSP app deployable with anon env only  
- [ ] Entitlement-denied UX still offers Platform Home return  
- [ ] Rollback flag tested  

### 12.4 Out of scope until later

- Deleting `/app/ssp` from web  
- Changing O4 to cookie/BFF  
- Moving `public_ssp` service_role off monolith API  

---

## 13. B4.3 unresolved questions & next implementation phase

### Unresolved

| ID | Item |
|----|------|
| D1–D5 | Production domains / cookie feasibility / HttpOnly mandate / shared rate-limit store (§10.5) |
| U1 | Exact prod path shape for tablet UI on SSP host (`/ssp/:token` vs `/public/:token`) |
| U2 | Edge redirect vs reverse-proxy for legacy tablet links |
| U3 | Whether assignment API adds `public_url` field or clients compose from env only |

### Next implementation phase (**B4.4 proposal**)

1. Port public tablet UI into `apps/ssp` behind compatibility redirects (per §11).  
2. Then **B4.5:** `openProduct` + `entry_path` flag cutover (per §12).  
3. Do **not** start Cookie/BFF work unless D1–D4 close in favor of Option A.

### B4.3 validation (lightweight)

| Check | Result |
|-------|--------|
| Paths exist: `public_ssp.py`, `ssp/$token`, `RATE_LIMIT.md`, `platform_products.py` | **Verified** |
| CORS defaults omit `:5174` | **Verified** in `parse_cors_origins` |
| `openProduct` hard-codes `/app/ssp` | **Verified** |
| No code/config changed in B4.3 | **Decision** — docs only |

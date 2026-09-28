# BETA-0 FOUNDING TECHNICIAN RELEASE READINESS REPORT

**Date:** 2026-09-28  
**Mode:** READ-ONLY (no implementation, no migrations, no fixes)  
**Scope:** Ready for 2–5 external Founding Technicians?  
**Evidence base:** Code + migrations + prior live suites (BETA-ADMIN-1/2, invite accept, tenant isolation, commercial Q4, FT QA) + admin browser spot-check + DB counts  

---

## Executive decision

**READY WITH BLOCKERS**

Product paths for invite → owner → first quote → technician exist and are largely proven in automated/live tests.  
External cohort #1 is **not “green light today”** until a short **ops/config gate** is closed (Auth redirects, backup freshness, production URL dry-run).  
There is **no P0 cross-tenant leak proven open** in this audit. Catalog emptiness is **not** a hard blocker (free lines enable first quote).

---

## 1. Auth readiness

| Flow | Status |
|------|--------|
| Invite link open | PASS — `/invite/{token}` + public/auth peek |
| Signup / login | PASS — Supabase Auth + session hydrate |
| Existing-user accept | PASS — membership only; idempotent if already member |
| Password reset | PASS — `/forgot-password`, `/reset-password` |
| Logout | PASS |
| Revoked / expired invite | PASS — RPC + UI statuses |
| Duplicate membership | PASS — create blocked; accept safe |

**Gap:** Auth email redirects depend on **live Supabase Site URL / Redirect URLs**. Historical incident: confirmation fell back to `localhost:5173`. Must verify dashboard before real emails.

**Browser note:** Full guest invite→signup click-path not re-driven in this 20‑min window; covered by live API suites + invite UI code.

---

## 2. Platform Admin readiness

| Check | Status |
|-------|--------|
| `/admin` gated by `is_platform_admin` | PASS (UI + API) |
| Create workspace (empty) | PASS — `admin_provision_workspace` |
| Create owner invite + copy link | PASS |
| Revoke / reissue + accepted status | PASS (live BETA-ADMIN-1) |
| Workspace Owner ≠ Platform Admin | PASS |

Admin home/shell polished for operator clarity (still not a large admin product).

---

## 3. Workspace invite readiness

| Check | Status |
|-------|--------|
| Owner → Settings → צוות → invite Technician | PASS |
| Copy link / revoke / reissue | PASS (BETA-ADMIN-2) |
| Manager can invite | PASS (policy updated) |
| Sales / Tech / Viewer cannot invite | PASS |
| No cross-workspace invite | PASS |
| Owner role blocked on team path | PASS |

---

## 4. Empty workspace result

New Owner after onboarding (workspace name + business type) sees **activation-led empty UX**:

| Surface | Experience |
|---------|------------|
| Dashboard | Activation strip → first customer / first quote |
| Customers / Sites / Quotes / Projects | Real empty states + CTAs |
| Catalog | Empty of products (categories seeded) |
| Jobs | Empty until projects exist |
| Settings | Functional forms (company/quotes/users) |

**Verdict:** Owner can understand “start with customer → quote” without developer help. Dead surfaces are intentional empties, not broken links.

---

## 5. First-run setup

| Item | Class |
|------|--------|
| Workspace / company display name | **REQUIRED BEFORE FIRST QUOTE** (onboarding satisfies PDF name) |
| Logo | OPTIONAL |
| Currency | DEVELOPER-ONLY (ILS locked) |
| VAT | OPTIONAL (default 18%) |
| Quote defaults in Settings | OPTIONAL to configure |
| Applying defaults into new Quote | **MISSING UX** (validity + payment terms must be filled on quote; both are send blockers) |
| Catalog products | OPTIONAL for first quote |
| Templates / packages | OPTIONAL (seeded shells empty of lines) |
| Team | OPTIONAL until extra techs needed |

---

## 6. Catalog bootstrap

- Seed: category hierarchy only — **no products** (by design).
- Owner can: manual create, Excel import, labor as `service`, packages via save-as from quote.
- **Empty catalog is NOT a P1 blocker** — free lines allow a sendable quote.
- Credible catalog path: ~1–3h import/manual; first useful quote can be ~15–30 min with free lines.

---

## 7. Owner E2E result

**Code-proven path (no DB edits):**  
Customer → Site → Quote (free/catalog lines) → price → PDF → Send → public approve → Project → planned scope → Installed Assets → Asset  

**Proven by:** domain live / quote / project / INF unit+QA reports — not a fresh browser dry-run in this audit.

**Developer intervention required for external FT:** none if Auth redirects + invite link host are correct.  
**Friction:** manually set `valid_until` + `payment_terms` on first quotes despite Settings defaults.

---

## 8. Technician E2E result

| Check | Status |
|-------|--------|
| Home → Today | PASS |
| Assigned / visible work + FieldJob | PASS (FT QA) |
| No commercial cost / margin / GP via API | PASS (Q4-S) |
| No `/admin` | PASS |
| No invite | PASS |
| Asset technical context where permitted | PASS (INF-1A/D) |

**Dead-end / friction:** job-only assignment can block some site document uploads (P2 product/ops).

---

## 9. Multi-tenant security

- Core CRM/quotes/jobs/customers/sites/invitations: strong live + smoke evidence — **no open P0 leak found**.
- INF (IPAM / connections / equipment / warranties / planned items): unit/API strong; **live two-tenant denial under-covered** → residual **P1 coverage gap**, not proven exploit.
- Storage RLS: **workspace membership**, not site-scoped (design vs aspirational V2-RLS) → **P1 residual** for same-workspace over-read via Storage JWT.

---

## 10. Commercial data security

- **Cost / margin / GP:** column lockdown + API strip + public PDF scrub — PASS.
- **Residual:** selling `list_price` / quote gross totals still SELECT-able via PostgREST for members under RLS → **P1** (commercial cost is locked; list prices are not).

---

## 11. File security

- Private buckets + short-lived signed URLs — PASS for intended model.
- Quote PDF via API/token, not public bucket — PASS.
- Cross-workspace document complete mismatch denied — PASS (prior durability matrix).
- No permanent public bucket leakage found in code path.

---

## 12. Error recovery

| Failure | User sees | Retry / retain |
|---------|-----------|----------------|
| Quote autosave | Yes (`quoteSaveError`) | Local draft state generally retained |
| PDF fail | Yes | Retry |
| Invite accept | Mapped Hebrew errors | Clear |
| Upload fail | Yes | Retry |
| Mid-session 401 | Often generic “load failed” | **Weak** — P2 |

---

## 13. Observability

| Capability | Status |
|------------|--------|
| Backend structured logs + `X-Request-Id` | PRESENT |
| Audit / platform_admin_events | PRESENT |
| Frontend crash → backend telemetry | **MISSING** (console + sessionStorage only; `reportClientError` client exists but AppErrorBoundary does not call it) |
| Alerting (5xx / backup age) | **MISSING** |

“My quote failed” → possible via request ID **if** user/admin captures it and logs are retained; otherwise weak.

---

## 14. Backup / restore

- Mechanism: **operator-run** logical vault (`logical_backup.py`) + runbooks.
- Free plan: **no** automated Supabase daily/PITR assumed.
- Retention: checklist says keep last **7** epochs.
- Restore path: documented in `RECOVERY_RUNBOOK.md` — **not re-drilled in this audit**.

**Do not claim automated backup safety.**

---

## 15. Production config

- Hosted web guards against localhost `VITE_API_URL`.
- Service role server-only (API) — no browser exposure by design.
- Invite links built from `window.location.origin` — wrong host if admin uses preview/local.
- Must confirm: `WEB_PUBLIC_URL`, `API_PUBLIC_URL`, CORS, Auth redirect URLs.

---

## 16. Email / account recovery

- Invites: **copy-link** (WhatsApp/email manual) — intentional.
- Signup confirm / password reset: **Supabase Auth emails** — requires correct Site URL.
- mailto helpers: honest, not delivery infrastructure.

---

## 17. Legal / support surfaces

| Surface | Class |
|---------|--------|
| Privacy / Terms / related legal routes | **PRESENT** — NON-BLOCKER |
| Beta-specific terms | **MISSING** — NON-BLOCKER (prefer soft notice) |
| Support contact (mailto in legal/landing) | **PRESENT** — NON-BLOCKER |
| Legal overclaims (broad GDPR “full compliance”) | **PRESENT risk** — P2 optics |

---

## 18. Feedback loop

- In-app `FeedbackCenter` FAB (app + admin) — **PRESENT**.
- Admin feedback triage — **PRESENT**.
- Not a helpdesk SLA — acceptable for private beta.

---

## 19. Responsive critical flows

Prior QA packs cover 1440 / ~1032 / 768 / 390 / 360 for Today, FieldJob, dashboard, quotes, customers, assets.  
No full re-audit this run. Residual polish only (e.g. topology 390) — **P3**.

---

## 20. P0 findings

**None proven open** in this audit (no confirmed cross-tenant read/write; no confirmed cost/GP API leak).

**Conditional P0 if live:** Supabase Auth Site URL still pointing at localhost when sending real signup/reset emails.

---

## 21. P1 findings

1. **Ops:** Auth Site URL / Redirect URLs not verified in this audit (historical localhost failure).  
2. **Ops:** Backups are manual; no scheduler/alerts — must run before cohort activity.  
3. **Coverage:** Live two-tenant gaps for INF domains + planned items.  
4. **Residual:** Storage RLS membership-only (same-workspace over-read via direct Storage).  
5. **Residual:** Technician can still PostgREST-select **selling** prices / quote totals (not cost/GP).  
6. **UX:** Quote Settings defaults not auto-applied → first-send friction (workaround: type fields).

---

## 22. P2 findings

1. Invite delivery = copy-link only.  
2. No frontend crash telemetry / no ops alerting.  
3. Mid-session expiry UX weak.  
4. Multi-membership client uses `memberships[0]` (wrong-workspace UX risk).  
5. Job-only assignment ↔ site upload friction.  
6. Legal overclaims.  
7. Invite link host = current browser origin.

---

## 23. P3 findings

1. Admin/docs polish remaining.  
2. Topology mobile polish.  
3. Stale RBAC docs vs manager invite.  
4. `margin_override_*` metadata still SELECT-grantable.

---

## 24. Exact blockers before first external invite

1. Verify Supabase **Site URL + Redirect URLs** = production web origin.  
2. Run **logical backup**; confirm `last_backup_ok` and age &lt; ~24h.  
3. Confirm production **web + API + CORS** env (no localhost).  
4. **Dry-run** as Platform Admin: create beta WS → owner invite → accept on prod origin → Settings invite tech → accept.  
5. Brief FT on: fill payment terms + validity on first quote; empty catalog OK (free lines / import later).

---

## 25. Recommended first beta cohort size

**2 Founding Technicians** (not 5).  
Expand to 3–5 only after 7 days with clean backup cadence + no Auth/redirect incidents.

---

## 26. Recommended rollout sequence

1. Ops gate (§24)  
2. Invite FT #1 (owner of dedicated beta WS)  
3. Shadow support 48h (Feedback FAB + WhatsApp)  
4. Invite FT #2  
5. Weekly backup drill + feedback triage  
6. Then optional: auto-fill quote defaults, invite email, crash telemetry (post-start)

---

## FINAL ANSWERS

### A. Can we invite the first external Founding Technician today?
**Not until the §24 ops gate is closed.** After that gate: **Yes** for a single carefully invited FT.

### B. If no, what exact blockers must be fixed first?
1. Auth redirect / Site URL verification  
2. Fresh successful backup  
3. Production URL / CORS confirmation  
4. End-to-end invite dry-run on production origin  

(Product code for admin + team invite + accept is already in place.)

### C. What can safely wait until after beta starts?
- Catalog import polish / packages UX  
- Auto-applying quote settings defaults  
- Automated invite email  
- Frontend error pipeline + alerting  
- Site-scoped storage RLS tightening  
- Extra live INF tenancy suites  
- Broader onboarding redesign  

### D. What monitoring/support must exist before cohort #1?
- Daily backup checklist executed  
- Ability to pull API logs by approximate time / `X-Request-Id`  
- Feedback FAB watched (`/admin/feedback`)  
- Human WhatsApp/email channel for Auth/invite failures  
- Named operator for revoke/reissue invites  

### E. What is the smallest path from current state to first external user?
1. Close §24 ops gate (≤1–2 hours if env already production).  
2. Platform Admin: create beta workspace → invite **owner** → copy `/invite/…` → send manually.  
3. FT: signup/login → accept → create customer → quote with free lines + payment/validity → send.  
4. Later: Settings → invite technician; catalog import when needed.

---

**STOP.** No BETA-1 implementation started.

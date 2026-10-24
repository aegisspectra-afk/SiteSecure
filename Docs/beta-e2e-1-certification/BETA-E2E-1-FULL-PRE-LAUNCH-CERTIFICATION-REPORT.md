# BETA-E2E-1 FULL PRE-LAUNCH CERTIFICATION REPORT

**Mode:** Release certification (live origins)  
**Data honesty:** REAL BETA-LIKE QA against Vercel + Render + Supabase using disposable `@sitesecure.test` accounts only. Not synthetic seed fixtures.  
**Harness:** `apps/api/scripts/beta_e2e_1_certification.py`  
**Artifacts:** `Docs/beta-e2e-1-certification/`

---

## Environment

| Item | Value |
|---|---|
| Web | `https://site-secure-umber.vercel.app` |
| API | `https://site-secure-api-staging.onrender.com` |
| Web version probe | `0.1.6-beta` (`assets/index-DABaH9VX.js`) |
| API health | `{"ok":true,"version":"v1"}` |
| Local git SHA (workspace) | `d34032dea597af251f71899760db83d49753ac29` |
| Timestamp (UTC) | `2026-09-30T18:10:55Z` (final successful matrix run) |
| Evidence matrix | `Docs/beta-e2e-1-certification/matrix.md` |
| Machine report | `Docs/beta-e2e-1-certification/artifacts/report.json` |
| QA PDF | `Docs/beta-e2e-1-certification/pdfs/quote-*.pdf` |
| UI shots | `Docs/beta-e2e-1-certification/screenshots/*-login.png`, `*-forgot-password.png` |

**Test accounts (emails only):** see `artifacts/report.json` → `accounts` (passwords omitted).

**Workspace IDs (final run):**

- Workspace A: `20ca6bf5-efb0-47c2-a881-c526900082fc`
- Workspace B: `70f6bb49-bcc4-4c5d-aee1-d0342d2a2e3a`
- Customer / Site / Quote / Project / Job: see `artifacts/report.json` → `ids`

---

## Critical Golden Path

Invitation → Account → Workspace → Setup/settings → Customer → Site → Quote → Preview → PDF → Send → Public → Approval (signature) → Project → Job

**Result: PASS** (path completed end-to-end on live API)

Caveat: quote validity / payment defaults did **not** auto-apply from workspace settings on this API build — harness set them explicitly (as a user would in UI) before send. Site `require_address` / `require_access_notes` flags saved as True but were **not** enforced on create.

---

## Results

1. **Invitation** — PASS (admin create workspace → owner invite → peek → accept; same-user re-accept is idempotent 200)
2. **Authentication** — PASS (signup/confirm/login; invalid password / unknown user rejected; bad bearer denied)
3. **Password recovery** — PASS (recovery link → set new password → login new works → old fails)
4. **Workspace selection** — PASS (single membership then multi-membership A+B)
5. **Tenant isolation** — PASS (Workspace B owner gets 404 on A customer/site IDs)
6. **Setup completion** — PASS with caveat (profile/settings writable; onboarding routes exist; no separate wizard invent)
7. **Settings propagation** — **FAIL / P1** (quotes.validity_days / payment_terms / site requirements not consumed by create on live API)
8. **Customer** — PASS (create/edit Hebrew long name)
9. **Site** — PASS (create/edit with address object); enforcement probe **P1**
10. **Quote creation** — PASS (draft + number)
11. **Quote compose** — PASS (free BOM lines + labor + manual; empty catalog)
12. **Autosave** — PASS (qty patch persists)
13. **Pricing** — PASS (line math / totals present; PDF total consistent)
14. **Commercial security** — PASS (public quote no cost keys; tech denied admin/invite; owner may see margin fields)
15. **Preview** — PASS
16. **PDF** — PASS (`%PDF`, ~35KB stored under `pdfs/`)
17. **Send/share** — PASS (public token minted; status sent)
18. **Public quote** — PASS (anonymous GET; no cost/margin leak)
19. **Approve/reject** — PASS (approve requires `terms_accepted` + `signature_data_url`; reject on separate quote PASS)
20. **Revision/history** — PASS revise; History endpoint present; Compare **NOT IMPLEMENTED** (404)
21. **Quote → Project** — PASS
22. **Project** — PASS
23. **Jobs** — PASS
24. **Today / Technician** — PASS (jobs list/today endpoint reachable for tech)
25. **Installed assets** — **NOT IMPLEMENTED** on this API (404)
26. **Roles/RBAC** — PASS (owner/manager/sales/tech/viewer probes)
27. **Platform admin boundary** — PASS (admin session; owner denied `/admin/summary`)
28. **Responsive/mobile** — PASS (API path + login/forgot screenshots at 1440/390)
29. **Error recovery** — PASS (controlled bad item patch → 403 + `X-Request-Id`)
30. **Console/network** — UI smoke pages loaded without pageerror; API failures documented in matrix
31. **Request-ID** — PASS (captured on health/invite/accept/error paths)

### Matrix counts (final run)

| Result | Count |
|---|---|
| PASS | 39 |
| NOT IMPLEMENTED | 3 (`Optional` on staging create schema, `Compare`, `Installed asset`) |
| FAIL | 0 |
| BLOCKED | 0 |

---

## Defects

### P0 BLOCKERS

None remaining after final run.

### P1 MAJORS

1. **Site requirements not enforced on live API**  
   `scheduling.sites.require_address` / `require_access_notes` persist as `true`, but site create without address returns **200**.  
   Likely cause: live Render API behind local SETTINGS-3B enforcement, or silent flag load failure.  
   Evidence: `artifacts/report.json` defects + steps `site_requirement_flags` / `site_create`.

2. **Quote workspace defaults not applied on create**  
   After saving `quotes.validity_days=21` and `payment_terms`, new quote still has `valid_until=null` and `payment_terms=null`. Send correctly blocks until validity is set.  
   Evidence: `settings_propagation_quote` FAIL; explicit PATCH made quote sendable.

### P2 POLISH / NOT IMPLEMENTED

- Optional line `is_optional` rejected as `extra_forbidden` on staging item create (feature not on this API schema build).
- Quote compare endpoint 404.
- Create-installed-assets endpoint 404 on this API build.
- Same-user invite re-accept returns 200 (idempotent by design); different-user path still raises already-accepted.

---

## Release Decision

**FOUNDING BETA: NO-GO**

Reason: remaining **P1** defects on the live API break the certified **settings → product** contract (site requirements + quote defaults). Golden path otherwise works when validity is set explicitly.

**Unblock condition (explicit):** Redeploy API staging with SETTINGS-3B (`site_requirements` + `quote_workspace_defaults`) and re-run sections 7, 13, and quote-create defaults until both P1s clear — then re-issue GO.

---

## Exact questions

**A. Can a completely new invited Owner onboard without developer help?**  
**YES** — admin invite → peek → signup/login → accept → membership owner (API/UI invite routes exist; email delivery not separately proven beyond token mint + peek).

**B. Does workspace selection work for one and multiple workspaces?**  
**YES** — single then multi membership verified via session.

**C. Does setup completion persist and affect the real product correctly?**  
**PARTIAL** — settings persist; **defaults/enforcement do not affect create** on this API build (P1).

**D. Can a user create a Customer and Site reliably?**  
**YES**.

**E. Can a user create, save, preview, PDF and send a professional quote?**  
**YES** (after setting validity explicitly).

**F. Can a real customer open, approve and reject the quote?**  
**YES** (approve requires terms + digital signature; reject PASS on separate quote).

**G. Does revision preserve historical truth?**  
**YES** — revise bumps version to draft; prior sent remains.

**H. Does approved Quote → Project preserve correct scope/version?**  
**YES** — project created from approved quote.

**I. Can a Technician enter and perform operational workflow?**  
**YES at smoke level** — invite/role, job exists, today/jobs list reachable. Full FieldJob photo/checklist UI not deeply UI-certified in this pass.

**J. Did any tenant/security/cost/internal-data leakage occur?**  
**NO** in exercised probes (isolation 404s; public quote clean of cost/margin keys).

**K. Are there any P0 or P1 defects remaining?**  
**P0: no. P1: yes (2).**

**L. Would you allow a real external customer to start using this build today?**  
**NO** — not until live API enforces the settings it claims (or those settings are marked unavailable). Re-test after API deploy.

---

## Files created

- `apps/api/scripts/beta_e2e_1_certification.py`
- `apps/web/scripts/beta_e2e_1_ui_smoke.mjs`
- `Docs/beta-e2e-1-certification/matrix.md`
- `Docs/beta-e2e-1-certification/artifacts/report.json`
- `Docs/beta-e2e-1-certification/artifacts/run.log`
- `Docs/beta-e2e-1-certification/pdfs/*.pdf`
- `Docs/beta-e2e-1-certification/screenshots/*.png`
- `Docs/beta-e2e-1-certification/BETA-E2E-1-FULL-PRE-LAUNCH-CERTIFICATION-REPORT.md` (this file)

**Product code:** no redesign; no feature expansion beyond certification harness/docs. P1 fixes require **API staging redeploy** of already-landed SETTINGS-3B code (not applied in this task).

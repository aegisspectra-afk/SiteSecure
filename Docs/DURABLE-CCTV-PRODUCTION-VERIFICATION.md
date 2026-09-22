# DURABLE CCTV SYSTEM DESIGN — PRODUCTION READINESS / LIVE VERIFICATION GATE

**Date:** 2026-09-22  
**Mode:** VERIFICATION ONLY (no feature work, no new engines, no schema changes applied)  
**Depends on:** R1 / R2 / R3 implementation closed in repo

---

## 1. Executive result

Live verification of the durable CCTV System Design vertical **could not complete** against the configured Supabase project because **migrations `0054_system_designs.sql` and `0055_system_design_apply_owned.sql` are not present in that database**.

Evidence:

- PostgREST returns `PGRST205` for `public.system_designs` / `public.system_design_components`
- PostgREST returns `PGRST202` for `public.system_design_apply_owned`
- OpenAPI schema cache does not list those objects
- Parent commercial tables (`quotes`, `quote_items`) **do** exist on the same project (connectivity confirmed)

Therefore live RLS, tenant isolation, Apply/Re-Apply, divergence confirmation, SECURITY DEFINER abuse checks, Send/Revise against Apply, and Design delete behavior **were not executable** on live DB state.

Automated unit/regression suites for R1–R3 + CCTV + Quote + web typecheck/build **passed**.

**Final classification:** see §23.

---

## 2. Environment verified

| Item | Value |
|---|---|
| Config source | Repository root `.env` (`SUPABASE_URL`, anon, service role) |
| Supabase host | `rhxqqudlngimhplvndmz.supabase.co` |
| Auth health | HTTP 200 |
| Quotes present | Yes (`content-range` showed existing quote rows) |
| Supabase MCP | Auth prompt **rejected by user** — no MCP SQL apply/list |
| Supabase CLI | Not installed in environment (`supabase not found`) |
| Direct `DATABASE_URL` / psql | Not available in app env (same finding as prior DR docs) |
| FastAPI public URL in env | `http://localhost:8000` (not required for schema probe) |

No alternate staging project URL was configured in env. Verification used the single configured cloud project.

---

## 3. Migration verification

### Repo artifacts (present)

| Migration | Purpose |
|---|---|
| `supabase/migrations/0054_system_designs.sql` | Tables, indexes, unique owned `quote_item_id`, RLS FORCE, `system_design_quote_visible`, policies |
| `supabase/migrations/0055_system_design_apply_owned.sql` | SECURITY DEFINER RPC `system_design_apply_owned`, fixed `search_path`, grants to `authenticated` |

### Live project status

| Check | Result |
|---|---|
| `0054` tables exist | **FAIL** — not in schema cache |
| Constraints / indexes / RLS policies from 0054 | **NOT OBSERVABLE** (objects absent) |
| `0055` RPC installed | **FAIL** — function not found |
| Function owner / SECURITY DEFINER / search_path / grants | **NOT OBSERVABLE** (RPC absent) |
| Migrations applied in order on this project | **NO** — neither migration reflected |

**Mismatch:** Repository assumes R1/R3 schema; configured live DB does not include it.

**Action taken:** Did **not** apply migrations (would mutate production schema). Verification STOPPED for live DB-dependent sections.

**Minimum unblock (ops, not done here):** Apply `0054` then `0055` to the target project via authorized Supabase workflow (Dashboard SQL / linked CLI / approved MCP), reload PostgREST schema cache, re-run this gate.

---

## 4. RLS verification

| Check | Result |
|---|---|
| RLS enabled/forced on `system_designs` | **NOT LIVE-VERIFIED** (table missing) |
| RLS enabled/forced on `system_design_components` | **NOT LIVE-VERIFIED** |
| Policies installed | **NOT LIVE-VERIFIED** |
| Repo intent (code review) | ENABLE + FORCE; SELECT/INSERT/UPDATE/DELETE gated by `system_design_quote_visible` |

---

## 5. Tenant-isolation matrix

| Attempt (Workspace A → B) | Live result |
|---|---|
| SELECT Design | **BLOCKED — schema absent** |
| Load components | **BLOCKED — schema absent** |
| PATCH Design | **BLOCKED — schema absent** |
| DELETE Design | **BLOCKED — schema absent** |
| Apply Design | **BLOCKED — RPC absent** |
| Target Quote / quote_item / product cross-tenant via Apply | **BLOCKED — RPC absent** |

Existing live tenant suite (`tests/test_tenant_isolation.py`) was **not** used as substitute for Design/RPC isolation: it does not cover `system_designs` / `system_design_apply_owned`, and prior runs require working Auth password-grant fixtures.

---

## 6. Initial Apply

**NOT LIVE-EXECUTED.** Prerequisite Design tables + Apply RPC missing.

Repo automated coverage: mocked R3 initial Apply (`test_initial_apply_calls_rpc_and_persist`) — not a substitute for live.

---

## 7. Clean Re-Apply

**NOT LIVE-EXECUTED.**

---

## 8. Engineering divergence

**NOT LIVE-EXECUTED** (qty change / product change / delete owned item → Re-Apply).

Automated: divergence detection + “no RPC when diverged” unit tests pass.

---

## 9. Commercial-only edit preservation

**NOT LIVE-EXECUTED.**

Automated: preserve unit_price/discount/description/section_id when same engineering fingerprint; cost from catalog — unit tests pass.

---

## 10. Confirmation security

**NOT LIVE-EXECUTED** (no live divergence token issuance possible without Apply path).

Automated: HMAC bind / wrong quote / wrong proposed hash / tamper / stale revision — unit tests pass.

---

## 11. Concurrency

| Scenario | Live |
|---|---|
| Two Apply same revision | **NOT LIVE-EXECUTED** |
| Apply vs Design patch | **NOT LIVE-EXECUTED** |
| Apply after generated line change | **NOT LIVE-EXECUTED** |
| Apply against sent Quote | **NOT LIVE-EXECUTED** |

Automated: stale revision rejected before RPC; sent Quote rejected before RPC (mocked endpoint).

---

## 12. SECURITY DEFINER abuse checks

**NOT LIVE-EXECUTED** (RPC not installed).

Static repo contract audit (unit test reading `0055_…sql`): SECURITY DEFINER, `search_path = public`, owned-id delete only, reject `delete_item_id`, draft check, membership, actor=`auth.uid()` — present in migration text.

Cannot prove live enforcement until RPC is deployed.

---

## 13. Pricing authority

**NOT LIVE-EXECUTED** for Apply path.

Repo design still: FastAPI prepares catalog list_price/cost; `SystemDesignApplyIn` forbids client money fields; `_persist_totals` / `pricing.py` after RPC. No pricing formulas added to SQL in this verification.

---

## 14. Pricing failure recovery

| Mode | Result |
|---|---|
| Live injection of `_persist_totals` failure | **LIVE NOT INJECTED** (unsafe / Apply path unavailable) |
| Automated | **VERIFIED** — `test_pricing_failure_after_rpc_surfaces_recoverable_error` expects 503 + `apply_committed=true` + recalculate path |

---

## 15. Reopen / hydration after Apply

**NOT LIVE-EXECUTED** (no applied Design on live).

R2 hydration unit/FE tests remain green (requirements/recommendation/components restore from Design, not Quote lines).

---

## 16. Send / Revise boundary

**NOT LIVE-EXECUTED** for Design Apply after Send.

Automated: Apply rejects non-draft Quote before RPC.

No lifecycle code changes in this task.

---

## 17. Delete Design

**NOT LIVE-EXECUTED.**

Repo contract: hard-delete Design/components; Quote lines remain (FK SET NULL / no cascade delete of items).

---

## 18. Legacy fallback reachability

Code path still present (by design; not removed in this gate):

```text
SystemBuilderDrawer.handleAdd
  → if designRef.current: api.applySystemDesign (durable)
  → else: onApply → QuoteBuilder.applyCctvBuildLines → repeated addQuoteItem
```

| Question | Answer |
|---|---|
| Normal durable CCTV path after successful R2 persist? | Uses atomic Apply |
| When is legacy still reachable? | No Design in `designRef` (persist never succeeded / no quote / hydrate empty) |
| Production evidence for removal? | **None yet** — live durable Apply not verified; keep fallback |
| Cleanup in this task? | **No** |

---

## 19. Automated regression results

Re-run during this verification session:

| Suite | Result |
|---|---|
| `test_system_designs_r3_apply.py` + R1 + CCTV recommend/sizing/hardening + pricing + quote snapshot/validation/phase2 + A3 outbound + share truth + sku/share + public boundary | **114 passed** |
| Web: `cctv-design-persistence` + `system-section` + `quote-mobile-actions` | **24 passed** (3 files) |
| `npx tsc --noEmit` | **passed** |
| `npm run build` (vite + tsc) | **passed** |

Live `test_tenant_isolation.py`: not used as Design/RPC gate; schema objects required for Design isolation absent regardless.

---

## 20. Defects found

| ID | Severity | Finding | Layer | Reproduction |
|---|---|---|---|---|
| PV-1 | **BLOCKER** | Live Supabase project missing `system_designs` / `system_design_components` / `system_design_apply_owned` while app code expects them | Ops / migration deploy | Service-role GET `/rest/v1/system_designs` → `PGRST205`; RPC POST → `PGRST202` |

No application logic defect was proven beyond missing deploy. No silent code “fix” attempted.

---

## 21. Production blockers

1. **Deploy `0054` then `0055`** to the target Supabase project (or point env at a staging DB that already has them).  
2. Re-run this verification gate end-to-end (RLS matrix, Apply, Re-Apply, divergence, confirmation, SECURITY DEFINER abuse, Send boundary, delete Design).  
3. Optional: authorize Supabase MCP or provide CLI/`DATABASE_URL` so function owner/search_path/grants can be asserted via SQL, not only PostgREST presence.

---

## 22. Deferred items

- Full live concurrency pressure tests  
- Live intentional pricing-fail injection (`AUTOMATED VERIFIED / LIVE NOT INJECTED`)  
- Removal of legacy `addQuoteItem` fallback  
- Additional domain engines (explicitly out of scope)  
- Supabase MCP auth (user declined this session)

---

## 23. Final release recommendation

**NOT PRODUCTION VERIFIED — BLOCKERS FOUND**

Reason (evidence-based): live tenant/RPC/RLS/Apply checks **could not actually be executed** because required migrations are not installed on the configured Supabase project. Automated suites passing is necessary but not sufficient for this gate’s “PRODUCTION VERIFIED” bar.

---

## Confirmation

- No next domain engine started  
- No Alarm / Access / Intercom / Network / generic engine work  
- No pricing / lifecycle / Share-Send / PDF / QuoteBuilder mobile redesign  
- No migration file edits  
- No live schema apply performed during verification

# SaaS · RBAC · Entitlements · Quotas — Phase 0 Reconciliation

**Date:** 2026-09-24  
**Mode:** Repository-grounded audit (code + migrations win over Docs)  
**Rule:** EXISTS → reuse · PARTIAL → extend · MISSING → implement · LEGACY → do not resurrect · CONFLICT → stop that path and document

---

## Executive summary

SITE SECURE already has a **substantial SaaS foundation**: plans table, `subscriptions`, `my_workspace_entitlements`, seat occupancy + invite reservation, hard quotas for customers/quotes/storage, `GET …/usage`, Free (`solo`) provisioning via `create_workspace`, Platform Admin plan columns, Founding Technician as badge (not role).

It is **not** aligned with the **USER-LOCKED Free model** (3 total members / 2 technicians / Service Calls off / 4-tier catalogue). That mismatch is the primary **CONFLICT** for Phase 1.

**Billing provider:** none in application code → **NEEDS PRODUCT DECISION**.

**Do not rebuild** authz, invitations, Platform Admin, or entitlement RPCs.

---

## Subsystem matrix

| Subsystem | State | Authoritative surfaces |
|---|---|---|
| Auth / session | **EXISTS** | Supabase Auth · `GET /api/v1/auth/session` · `apps/api/app/deps.py` |
| Workspace creation | **EXISTS** | RPC `create_workspace` · `POST /workspaces` · onboarding `createWorkspace` |
| Memberships | **EXISTS** | `workspace_memberships` · invite accept RPC |
| RBAC catalogue | **EXISTS** | `packages/authz/catalog.json` · `authorize()` · frontend `can()` presentation-only |
| Platform Admin | **EXISTS** | `profiles.is_platform_admin` · `require_platform_admin()` · `/admin/*` |
| Founding Technician | **EXISTS** | `recognition_badges` / program · **not** `role_key` (retired migration `20260908210000_…`) |
| Invitations | **EXISTS** / **PARTIAL** | `/invite/$token` · create reserves seats in API · accept re-checks in SQL · race on create is soft |
| Plans catalogue | **PARTIAL** / **CONFLICT** | Keys `solo`/`business`/`enterprise` (labels Free/Pro/Enterprise) · seat buckets ≠ locked Free model · no separate Business tier |
| Entitlements | **EXISTS** | RPC `my_workspace_entitlements` · `workspace_feature_overrides` · session features |
| Seat quotas | **PARTIAL** / **CONFLICT** | `seats_operator` + `seats_field` · pending invite reservation · **≠** `max_members`/`max_technicians` |
| Storage quotas | **PARTIAL** | 15 GiB Free in catalog + DB trigger reservation · documents accounting |
| Billing / checkout | **MISSING** | No Stripe/provider in apps · Docs mention Edge checkout as historical/partial |
| Usage UI | **PARTIAL** | `GET …/usage` · Settings Users meters · dashboard UsageSnapshot · no dedicated «חבילה וחיוב» |
| Admin plan visibility | **PARTIAL** | Organizations list shows `plan_key` / subscription status · no usage meters / override UX |
| Multi-workspace | **PARTIAL** / **LIMITATION** | `memberships[0]` ~56 call sites in web · `last_workspace_id` exists |

---

## 1. Auth

**EXISTS**

- Supabase Auth password / magic link
- API session loads memberships + plan/features via entitlements RPC (`deps.py` → `my_workspace_entitlements`)
- Register does **not** create workspace (`register.tsx` comment); onboarding creates Free workspace

---

## 2. Workspaces + automatic Free

**EXISTS**

- `public.create_workspace(p_name, p_plan_key DEFAULT 'solo')` inserts workspace + owner membership + `subscriptions(plan_key, status)` (`0008_features_plans.sql`)
- API `POST /workspaces` forces `default_plan_key()` → `"solo"` (`catalog.json` / `workspaces.py`)
- Onboarding: profile → `api.createWorkspace` → `/app`

**PARTIAL**

- Idempotency/transactionality depends on RPC; no separate “subscription backfill job” documented for workspaces missing rows (RPC falls back to solo features if subscription null)

---

## 3. RBAC

**EXISTS — REUSE; do not rewrite**

Roles: `owner`, `administrator`, `manager`, `sales`, `technician`, `viewer`  
Engine: `apps/api/app/authz/engine.py` + catalogue grants  
Frontend: `can()` presentation only

**LEGACY remnant**

- `seat_buckets.seats_field` still lists `founding_technician` in `catalog.json`
- `accept_invitation` SQL still mentions `founding_technician` role_key (role retired)

---

## 4. Platform Admin

**EXISTS — REUSE / EXTEND later**

- `profiles.is_platform_admin`
- `/admin/*` + `apps/api/app/routers/admin.py`
- Organizations already select `subscriptions(plan_key,status)`

**MISSING for SaaS ops**

- Audited expiring plan override UI
- Members/techs/storage usage columns
- Override expiry enforcement productization (feature overrides exist; plan override expiry fields incomplete vs target model)

---

## 5. Founding Technician

**EXISTS — REUSE**

- Badge/program: `recognition_badges` includes `founding_technician`
- Role retired: migration `20260908210000_retire_founding_technician_role.sql`
- Product pass: badge does not grant permissions

**Must keep:** badge ≠ plan ≠ Platform Admin ≠ seat bypass

---

## 6. Invitations

**EXISTS**

- Create: API seat check via `evaluate_seat_limit` + occupancy (members + unique open invites)
- Accept: `accept_invitation` FOR UPDATE workspace + subscription + seat re-check
- Preview: `invitation_preview`
- UI: `/invite/$token` · Settings Users

**PARTIAL**

- Create path is **check-then-insert** without DB-level lock → concurrent final-seat invites can race (**seat race PARTIAL**)
- Accept still allows legacy `founding_technician` role strings

**Invite vs personal Free**

- Accept joins invited workspace and sets `last_workspace_id`
- Register/onboarding creates workspace only when user has **no** memberships — invited users with membership should skip personal Free (**verify edge cases in Phase 1 tests**)

---

## 7. Plan catalogue

### Current (authoritative)

| Key | Label | Operator seats | Field seats | Storage | Notable features |
|---|---|---|---|---|---|
| `solo` | Free | 1 | 3 | 15 GiB | includes **`service`** |
| `business` | Pro | 15 | 40 | 100 GiB | api, audit, team, … |
| `enterprise` | Enterprise | 0 (=unlimited) | 0 | 0 | all features |

Sources: `packages/authz/catalog.json` + `public.plans` / `plan_limits` / `plan_features`

### USER-LOCKED target Free

| Rule | Target | Current |
|---|---|---|
| max_members (incl. owner) | **3** | Not modeled (bucket model) |
| max_technicians | **2** | Field bucket 3 (tech+viewer) |
| storage | **15 GiB** | **EXISTS** |
| Owner+Tech+Tech | VALID | VALID under field seats |
| Owner+Manager+Tech | VALID | **BLOCKED** (`seats_operator=1`) |
| Service Calls | no | Free has `service` feature → **CONFLICT** |

### Recommended 4-tier (FREE/PRO/BUSINESS/ENTERPRISE)

**CONFLICT / MISSING:** repo is **3-tier** with `business` labeled Pro. Adding a fourth “Business” key requires migration + entitlement remapping — **do not invent in Phase 1 without an explicit remapping plan**. Phase 1 should **reconcile Free seat model + labels** and document Pro/Business naming.

**Enterprise unlimited:** `0` means unlimited today (`is_unlimited`) — **CONFLICT** with “NULL must never mean unlimited / contractual limits required”. Enterprise contractual caps are **MISSING**.

---

## 8. Entitlements

**EXISTS**

- RPC `my_workspace_entitlements(workspace_id)` → `{plan_key, status, features}` with overrides
- Session loads features into authz context
- `authorize()` gates permission_feature map

**PARTIAL**

- Feature keys are product modules (`service`, `api`, …) not the exact target list (`service_calls`, `today_fieldjob`, …)
- Free includes `service` while Service Call V1 is incomplete and technician nav hides Service

**No duplicate entitlement service needed** — extend catalogue + RPC-fed features.

There is **no** separate `GET /workspaces/{id}/entitlements` HTTP route beyond session/RPC; usage is `GET …/usage`. Adding a thin HTTP entitlements mirror is optional polish.

---

## 9. Seat quotas + reservation

**EXISTS (bucket model)**

- Occupancy: active members + unique pending invites (`authz/usage.py`)
- Meters: `seats_operator`, `seats_field`
- Invite create checks limit; accept re-checks members in bucket
- Duplicate invites same email do not double-count
- Expired/accepted ignored

**CONFLICT with USER-LOCKED Free**

Must move (or dual-enforce) to:

1. **Total member capacity** (active + reserved invites) ≤ `max_members`
2. **Technician capacity** (role_key = technician only; badge still counts as technician) ≤ `max_technicians`

Viewer should consume **member** seat but **not** technician seat.

**PARTIAL race safety**

- Accept: subscription `FOR UPDATE` → good
- Create invite: API-only check → **needs RPC/trigger lock** for “exactly one of two concurrent invites”

---

## 10. Storage

**PARTIAL — Phase 3 ready to extend, not greenfield**

- Catalog + `plan_limits` storage_gb; Free **15**
- Trigger `enforce_document_storage_quota` + `reserved_bytes` + 24h expiry
- API `evaluate_storage_limit` / documents upload path
- Usage meter `storage_gb`

**Gaps for Phase 3 inventory**

- Confirm every browser upload goes through documents reservation (avatars, PDF studio, knowledge, etc.)
- No separate `workspace_usage` cache table (computed live)
- Quote PDF/snapshot counting policy needs explicit document

---

## 11. Subscription model

**EXISTS (simpler than target)**

`subscriptions`: workspace_id, plan_key, status (`trialing|active|past_due|canceled|manual`), current_period_end, provider_ref

**MISSING vs target**

- `source` (system/billing/admin_override)
- `override_expires_at`
- `provider_key` / separate customer vs subscription refs
- `cancel_at_period_end`
- `billing_events` idempotency table
- status `free` (uses plan_key=solo + active instead)

**Extend `subscriptions` rather than invent `workspace_subscriptions`.**

---

## 12. Structured errors

**PARTIAL**

- Dominant code: `PLAN_LIMIT_REACHED` (often HTTP **403**, not 409)
- Details include `limit_key`, `current`, `limit`, `resource`
- Frontend `planQuotaMessage()` maps customers/quotes/storage

**Gap:** dedicated codes `technician_quota_exceeded` / `member_quota_exceeded` / `feature_not_in_plan` / HTTP 409 — extend envelope without collapsing RBAC denials

---

## 13. Settings · Plan & Usage UI

**PARTIAL**

- Settings → Users: shows plan label + seat meters + invite capacity UX
- Settings → System: raw `plan_key`
- Dashboard UsageSnapshot / threshold banner
- **MISSING:** dedicated «חבילה וחיוב» / «שימוש ומכסות» pages with truthful upgrade CTA (no fake checkout)

---

## 14. Billing provider

**MISSING**

- Zero Stripe/checkout implementation in `apps/web` + `apps/api` application paths
- Docs (`SITE-SECURE-CONTEXT.md`) describe Edge checkout as PARTIAL/historical — **do not treat as live**

→ **SELF_SERVICE_BILLING_PROVIDER: NEEDS PRODUCT DECISION**

---

## 15. Multi-workspace

**CURRENT LIMITATION**

- Widespread `session.memberships[0]`
- `profiles.last_workspace_id` exists but AppShell primarily uses `[0]`
- Prefer one operational workspace for Founding Technician cohort

Full switcher → Phase 5 discovery only (`Docs/MULTI-WORKSPACE-HARDENING.md`)

---

## 16. Protected systems

Do not casually touch: pricing.py, quote PDF/snapshot/lifecycle, CCTV, job_lifecycle, R3 apply, authz permission semantics (grants), RLS isolation, mobile quote dock.

Seat/plan **limits** and catalogue **limits/features** are in scope; permission keys are not a cleanup project.

---

## Compatibility / grandfathering decisions (required before Free seat cutover)

1. **Existing Free workspaces with 3 field seats used** (owner + 3 techs) would violate new max_technicians=2 / max_members=3 → need **over-limit / admin_override** preserve-read, block new invites.
2. **Removing `service` from Free** would change entitlements for all solo workspaces → grandfather via `workspace_feature_overrides` or delayed cutover until Service V1 product decision.
3. **Allowing Manager on Free** (USER example) requires assignable_roles + seat model change together.
4. **Enterprise `0` = unlimited** stays until contractual limit columns exist — document as known debt; do not silently treat null as unlimited in new code paths.

---

## Phase gate recommendations

| Phase | Proceed? | Notes |
|---|---|---|
| **0 Reconciliation** | DONE (this doc) | |
| **1 Entitlement core + Free seats** | **YES with CONFLICT handling** | Implement `max_members`/`max_technicians`; migrate accept/invite enforcement; grandfather over-cap; do **not** invent 4th plan key or billing provider |
| **2 Plan & Usage UI + Admin** | YES after Phase 1 | Reuse usage API; add Settings surfaces; extend admin columns/override |
| **3 Storage** | YES after inventory | Extend existing reservation; do not rebuild |
| **4 Billing readiness** | Doc-only until provider chosen | Provider-neutral fields only if needed for override |
| **5 Multi-workspace** | Discovery doc only | No switcher rewrite in this program |

---

## Exact files / tables / RPCs (index)

**Tables:** `plans`, `plan_features`, `plan_limits`, `subscriptions`, `workspace_feature_overrides`, `features`, `invitations`, `workspace_memberships`, `documents` (+ `reserved_bytes`)

**RPCs:** `create_workspace`, `my_workspace_entitlements`, `invitation_preview`, `accept_invitation`, `_workspace_plan_limit`, `_workspace_storage_used_bytes`, quota triggers

**API:** `POST /workspaces`, invite routes, `GET /workspaces/{id}/usage`, documents upload, admin organizations

**Packages:** `packages/authz/catalog.json`, `apps/api/app/authz/{catalog,limits,usage,engine}.py`, `apps/web/src/lib/plan-quota.ts`

**Migrations (seat/plan related):** `0008`, `0028`, `0031`, `0038`, `0039`, `0040`, `0041`, `0048_v3_plan_labels…`, `20260908210000_retire_founding_technician_role`

**Migration head (repo filenames, not proof of production apply):** latest timestamped includes `20260908210000_…`; numbered chain through `0056_…`

---

## Next implementation step

**Phase 1:** Extend catalogue + SQL accept/invite enforcement to USER-LOCKED Free seats (`max_members=3`, `max_technicians=2`), keep storage 15 GiB, remove LEGACY `founding_technician` from seat buckets, add grandfathering for over-cap workspaces, improve structured quota details, add concurrency-safe invite reservation — **without** Stripe and **without** a fourth plan key.

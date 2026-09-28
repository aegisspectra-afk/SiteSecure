# SaaS Phase 1 — Entitlement Core + Automatic Free + Seat Enforcement

**Date:** 2026-09-24  
**Depends on:** `Docs/SAAS-RBAC-ENTITLEMENTS-RECONCILIATION.md`  
**Migration (created, not production-applied by this pass):**  
`supabase/migrations/20260924191046_saas_phase1_member_technician_quotas.sql`

---

## Goal

Align SITE SECURE Free seat accounting with the **USER-LOCKED** model without rebuilding RBAC, invitations, or entitlements RPC.

| Locked Free rule | Phase 1 result |
|---|---|
| max_members = 3 (incl. owner) | **PASS** (catalogue + API + SQL) |
| max_technicians = 2 | **PASS** |
| storage = 15 GiB | **EXISTS** (unchanged) |
| Pending invites reserve seats | **PASS** (API occupancy + INSERT trigger) |
| Concurrent final-seat invites | **PASS** (subscription `FOR UPDATE` in invite trigger) |
| Owner + Manager + Technician | **PASS** (assignable + member cap) |
| Plans ≠ roles | **PASS** |
| Founding badge ≠ seats bypass | **PASS** (still counts as technician if role legacy) |

---

## What changed

### Catalogue (`packages/authz/catalog.json`)

- Free (`solo`): `max_members=3`, `max_technicians=2`, storage 15 GiB  
- Pro (`business`): `max_members=15`, `max_technicians=10`, storage 100 GiB  
- Enterprise: `0` = unlimited (known debt vs contractual caps)  
- Free assignable roles: `manager`, `technician`, `viewer`  
- Removed LEGACY `founding_technician` from `seat_buckets`

### API

- `evaluate_seat_limit` → member + technician caps; details include `quota_code`, `upgrade_required`  
- Quota denials via invite path → **HTTP 409** + `PLAN_LIMIT_REACHED`  
- Usage meters → `max_members`, `max_technicians` (replacing office/field as primary)

### SQL migration

- `plan_limits` for `max_members` / `max_technicians`  
- `subscriptions.source`, `override_expires_at`, `override_reason` (provider-neutral override readiness)  
- `_workspace_member_occupancy`  
- `enforce_invitation_seat_quota` **BEFORE INSERT** on `invitations` (race-safe)  
- `accept_invitation` rewritten for member/technician caps; maps retired `founding_technician` → `technician`

### Frontend

- Usage rings / tips accept new meter keys  
- `planQuotaMessage` Hebrew for members/technicians  
- `@site-secure/authz` `seatUsage` / `seatLimitReached` updated

---

## Intentionally NOT done in Phase 1

| Item | Reason |
|---|---|
| Fourth plan key “Business” | CONFLICT — keep 3-tier solo/business/enterprise |
| Remove `service` from Free features | CONFLICT — grandfather / Service V1 incomplete |
| Stripe / checkout | NEEDS PRODUCT DECISION |
| Dedicated Settings «חבילה וחיוב» page | Phase 2 |
| Admin override UI | Phase 2 |
| Storage path inventory + harden | Phase 3 |
| Enterprise contractual non-zero caps | Deferred |
| Production migration apply | Preflight required — **not applied here** |

---

## Over-cap existing workspaces

No mass deactivation. Workspaces already above new caps keep working members; **new** invites/activations that increase usage are blocked (section 23 behavior).

---

## Tests run (Phase 1 focused)

- `tests/test_limits.py` · `test_occupancy.py` · `test_quota_limits.py` → pass  
- Web `entitlements.test.ts` · `dashboard.test.tsx` → pass  

Live tenant isolation seat tests updated for 409 + new meter keys — run in full suite / CI with live Supabase when available.

---

## Deploy note

1. Inspect migration head on target DB  
2. Apply `20260924191046_saas_phase1_member_technician_quotas.sql` via established procedure  
3. Deploy API + web that consume new meter keys together  
4. Confirm Settings Users meters show חברי צוות / טכנאים

# SITE SECURE V3 — Phase 0 Decision Memo

**Status:** LOCKED — awaiting acknowledgment before Phase 1 implementation  
**Date:** 2026-09-11  
**Prior:** [V3-READINESS-AUDIT.md](./V3-READINESS-AUDIT.md) — **APPROVED**  
**Companion:** [V3-PHASE1-TECHNICAL-SPEC.md](./V3-PHASE1-TECHNICAL-SPEC.md)

---

## 0. Binding statement

SITE SECURE V3 will be developed as an **expand-in-place Modular Operations Platform on the existing Core**.

This is **not a rewrite**.

```
SITE SECURE CORE
├── SITE AI
├── Workforce
├── Inspections & Compliance
└── Technical / Field Service
```

Commercial surface: **Free / Pro / Enterprise**  
Control plane: **Entitlements + Quotas + RBAC + Scope + Audit**  
Shared spine: **Customer → Site → Asset → Person → Work → Inspection → Evidence**

---

## 1. Plan model — LOCKED

| Public name | Internal `plan_key` (persisted) | Migration now? |
|-------------|----------------------------------|----------------|
| **Free** | `solo` | **No** |
| **Pro** | `business` | **No** |
| **Enterprise** | `enterprise` | **No** |

### Dependency audit summary

Persisted / catalog keys `solo` | `business` | `enterprise` appear in:

- `public.plans`, `plan_features`, `plan_limits`, `subscriptions.plan_key`
- `packages/authz/catalog.json` (`default_plan_key`, plans, limits, assignable_roles)
- SQL RPCs (`create_workspace`, quota helpers)
- API authz limits / usage meters (`plan_key` for limit lookup only)
- Tests and seed scripts
- UI **labels** via `planLabel()` — today still shows Solo/Business/Enterprise

**Decision:** Keep internal keys. Labels Free/Pro/Enterprise shipped in **P1-T01**. Defer key rename until a dedicated migration with clear technical need.

**Authorization rule:** Feature access must resolve through **entitlements/capabilities**, never scattered `plan === "business"` product gates. `plan_key` may be used only to **look up plan defaults** inside the entitlement resolver.

---

## 2. Asset SoT — LOCKED

**Asset SoT = `equipment`**

- Do not create a competing `assets` table.
- Generalize categories/types beyond CCTV (vehicle, tool, sensor, network, etc.).
- Relationship: Workspace → Customer → Site → Asset.
- `systems` remains optional grouping layer (alarm/cctv/access/…); not required for every Asset.

Low usage (0 rows) is **not** a deletion signal — it is an adoption/activation problem.

---

## 3. Work Order SoT — LOCKED

**Work Order SoT = `jobs`**

- Do not create a competing `work_orders` table.
- Product language may say “Work Order”; persistence remains `jobs.id`.
- Evolve FSM; do not replace unnecessarily.
- `service_calls` remains intake / request layer that may spawn jobs.

Target lifecycle (workspaces may use a subset):

Created → Scheduled → Assigned → Dispatched → En Route → On Site → In Progress → Awaiting/Blocked → Completed → Verified/Closed

---

## 4. Module order — LOCKED

| Phase | Focus |
|-------|--------|
| **1** | Core abstractions (capabilities, Person, Evidence links, events, Asset/Job extension contracts) |
| **2** | Technical / Field Service |
| **3** | Inspections & Compliance + Patrol |
| **4** | Workforce depth |
| **5** | SITE AI (+ Enterprise configurator later in/after this phase) |

Phase 1 must design contracts so Phase 2–5 can connect:

- Inspection → Finding → Corrective Action → Job  
- Workforce Person → Assignment → Job  
- SITE AI → permission-aware Job analysis/action  

**Homepage:** conceptually approved; **do not implement** until capabilities are real.

---

## 5. Security Twin / Cyber — LOCKED (defer)

- Do not delete prior Twin/Cyber concepts from docs.
- **Out of immediate V3 scope.**
- Architecture must not hard-block later expansion.
- Do not add speculative Twin/Cyber schema complexity in Phase 1–4.

Priority now: **Physical operations + Workforce + Inspections + Field Service + Operational AI**.

---

## 6. Workforce Person — LOCKED

| Concept | Responsibility |
|---------|----------------|
| **User** (`auth.users` / `profiles`) | Authentication identity |
| **Workspace Membership** | Access + role + authorization |
| **Operational Person** (new profile entity) | Workforce operational data |

- Membership must **not** be overloaded with skills/certs/shifts.
- Person **may** link to a membership/user when login exists.
- Architecture must allow Persons **without** accounts (future field workers).
- Do not invent a second login system.

---

## 7. Inspections / Patrol — LOCKED (design constraint for Phase 1)

- Existing checklists are **reusable components**, not the final Inspection architecture.
- Target: Template → Run → Responses → Findings → Corrective Actions → Evidence → Verification → Closure.
- Patrol: Site → Checkpoint → Schedule → Scan Event → Person/Shift → Evidence → derived compliance.
- Scan events are **immutable timeline facts**; aggregates are derived.

Phase 1 delivers **contracts/hooks** only; full builder/patrol ships in Phase 3.

---

## 8. Domain events — LOCKED (Phase 1 deliverable)

- Controlled application/domain event model (not a premature distributed bus).
- Durable + auditable for critical ops events.
- Consumers later: notifications, reports, automation, SITE AI.

---

## 9. Evidence — LOCKED

**Evidence = `documents` + multi-parent link table**

- No per-module file islands.
- Access via workspace + parent-entity authorization.
- Kinds: document, photo, signature, generated report, scan evidence, …

---

## 10. RBAC — HARD LOCK

Always separate:

1. **Entitlement** — does the workspace own the capability?  
2. **Permission** — may this user perform the operation?  
3. **Scope** — on which records?

Server-side `authorize()` on every mutation. **Hidden UI ≠ authorization.**

---

## 11. Capability + quota model — LOCKED (Phase 1 deliverable)

- Evolve beyond boolean-only features **without breaking** current secure precedence.
- Support: boolean, numeric quota, optional config value, plan default, workspace override.
- **Fail-closed.** No permissive fallback on resolver errors (preserve current behavior).

---

## 12. Enterprise — LOCKED (direction)

- Enterprise ≠ unlimited Pro.
- Custom configuration must resolve through the **same entitlement system**.
- Internal Enterprise Configurator / Pricing Calculator is **later** (Phase 5+).
- Pricing logic ≠ authorization logic.

---

## 13. Usage-cold domains — LOCKED

Keep and generalize: `equipment`, `jobs`, `assignments`, systems, notification tables as appropriate.  
Validate existing rows; do not delete because empty.

---

## 14. Implementation principle — LOCKED

**Do not start Phase 1 coding until this memo + Phase 1 Technical Spec are approved.**

Philosophy:

> Extend the existing production Core. Do not replace it.  
> Reuse canonical entities. Do not create competing models.  
> Entitlements = what the workspace owns. RBAC = what the user can do. Scope = where.  
> Modules communicate via shared entities + auditable domain events.

---

## Approval

| Item | Status |
|------|--------|
| Expand-in-place V3 | APPROVED |
| Plan label mapping Free/Pro/Enterprise; keep keys | LOCKED |
| Asset = `equipment` | LOCKED |
| Work Order = `jobs` | LOCKED |
| Module order 1→2→3→4→5 | LOCKED |
| Twin/Cyber deferred | LOCKED |
| Person ≠ Membership | LOCKED |
| Phase 1 Spec required before coding | LOCKED |

**Next:** Approve [V3-PHASE1-TECHNICAL-SPEC.md](./V3-PHASE1-TECHNICAL-SPEC.md), then authorize Phase 1 Task execution.

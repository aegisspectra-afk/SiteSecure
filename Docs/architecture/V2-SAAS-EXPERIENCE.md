# SITE SECURE — V2 SaaS Experience, RBAC, Billing & UX Operating System

**Status:** Binding Master Specification — **already in force**  
**Do not paste this document back into Cursor as a greenfield prompt.** Inspect the running system and extend it.

**Locked delivery sequence (do not skip):**

```
V2-SAAS-EXPERIENCE.md
      ↓
UX OS (constraints, not new screens)
      ↓
RBAC / authorize() / RLS
      ↓
packages/authz/catalog.json
      ↓
Usage meters (server) → Render
      ↓
CRM (only when unlocked)
      ↓
UI expansions that those capabilities actually support
```

**Hard stops:** no CRM UI, no billing/checkout, no Enterprise self-serve, no fake KPIs/activity, no `plan_key === "solo"` in React, no hardcoded limits, no nav items for modules that are not live. Owner Dashboard reflects **current** capabilities, not the future vision.

**Inherits (do not contradict):**

- UX OS: [V2-UX-PSYCHOLOGY.md](../ux/V2-UX-PSYCHOLOGY.md)
- Visual: [V2-DESIGN-SYSTEM.md](../ux/V2-DESIGN-SYSTEM.md)
- Dashboard screen rule: [V2-DASHBOARD-SPEC.md](../ux/V2-DASHBOARD-SPEC.md)
- RBAC: [V2-RBAC.md](../security/V2-RBAC.md) + `packages/authz/catalog.json`
- RLS: [V2-RLS.md](../security/V2-RLS.md)
- Architecture: [V2-ARCHITECTURE.md](./V2-ARCHITECTURE.md)
- Roadmap / phase locks: [V2-ROADMAP.md](./V2-ROADMAP.md)

If this document fights a more specific screen spec (Dashboard, CRM, Mobile, [Application Shell](../ux/V2-APP-SHELL.md)), the screen spec wins **for that screen**. This document wins for identity, SaaS, RBAC, billing psychology, and what must never be faked.

---

## How to read examples

Numbers, plan names, and prices in narrative examples (`FREE`, `PRO`, `5 users`, `5 GB`, `₪0`) are **illustrative psychology**. They are not product configuration.

**Binding commercial configuration lives in:**

- `packages/authz/catalog.json` — plans, features, limits, assignable roles, seat buckets
- Postgres `plans` / `plan_features` / `plan_limits` / `subscriptions`
- The billing provider, when one exists

Current catalog plans: **`solo`**, **`business`**, **`enterprise`**.  
Do not hardcode a `free` / `pro` SKU, a 5-user cap, or a 5 GB storage cap in components.

Do not advertise a feature, limit, certification, or module that the running system does not actually provide.

---

## 0. Mission

SITE SECURE must not feel like a generic CRM, a basic admin dashboard, a freelancer tool, a startup template, an AI-generated dashboard, a consumer SaaS, a cyberpunk site, an oversized card collection, or a pile of CRUD screens.

It must feel like a **serious international Security Operations Platform** built by a mature technology company.

It must communicate: security, control, reliability, operational clarity, professionalism, scalability, trust, technical maturity, enterprise readiness.

The user should immediately understand: *this is a real platform for running a security business.*

**Identity:** SITE SECURE is the product. Aegis Spectra is the company. Authenticated UI must not look like “Aegis Spectra Admin.”

---

## 1. Core product principle

SITE SECURE is not primarily an admin panel. It is the operating environment of a security business.

```
Acquire customer → manage customer → manage site → create quote → get approval
→ create project / job → install / service → document → close
→ maintain site → track equipment → manage team → analyze business
```

The architecture must support this lifecycle without exposing the database.

The **first-value funnel** (customer → site → quote → job) is the north-star journey. It must not be faked in the UI before those modules exist. Until CRM ships, the honest next action is whatever live route actually exists (workspace, team, settings, security).

---

## 2. Product hierarchy

SITE SECURE contains one coherent system: Identity, Workspace, Subscription, RBAC, Operations, Customers, Sites, Jobs, Service, Documents, Equipment, Reports, Security.

Navigation exposes only **implemented and entitled** modules. Never “coming soon” in production nav.

---

## 3. Critical architecture — USER ≠ ROLE ≠ PLAN

These systems interact. They are not the same system.

```
USER → WORKSPACE MEMBERSHIP → RBAC ROLE → PERMISSIONS → SCOPE

WORKSPACE → SUBSCRIPTION PLAN → FEATURE ENTITLEMENTS → RESOURCE LIMITS → USAGE
```

Never create roles named Free User / Pro User / Enterprise User.

Correct: Role `owner` + Plan `solo`. Or Role `technician` + Plan `business`.

---

## 4–6. New user, owner vs technician, workspace type

A brand-new registrant gets a **Workspace**. They become **Owner**. Subscription is the catalog **default plan** (`solo` today). They do **not** become Technician merely because they install systems professionally.

One account can be:

- RBAC: Owner
- Operational profile: Solo technician

Do not require two accounts for business administration and field work.

**Workspace type** (solo / small team / security company / multi-team / enterprise) is contextual personalization for onboarding, defaults, and education. It is **not** an authorization boundary and must not replace RBAC.

Do not persist a workspace-type field until a migration exists. Do not ask a question whose answer is thrown away.

---

## 7–9. Registration and workspace creation

Registration stays short: full name, email, password. Password rules are visible before failure. Secondary: already have an account → login.

After authentication, create the Workspace through an **explicit** flow. Do not silently create a tenant.

Smart defaults (editable, never silently overwrite): Hebrew, `Asia/Jerusalem`, ILS, VAT 18%.

Self-serve `POST /workspaces` assigns the catalog **default plan**. The client must not be able to self-provision `business` / `enterprise` until checkout exists.

---

## 10–17. Plan experience (when billing exists)

Preferred flow: account → workspace → understand the product → start on the default plan → experience value → upgrade when useful.

Never force a complicated pricing decision before the user can start. Never display a paid plan as **ACTIVE** before the billing provider confirms payment.

Selecting a paid plan means: selected → checkout → provider → confirmed → subscription activated.

Until Phase 14 billing exists: **do not** ship a fake comparison grid, fake prices, fake checkout, or fake “PRO ACTIVE” badges.

---

## 18–24. Subscription, entitlements, limits

The **Workspace** owns the subscription. Members operate under that plan.

Plan entitlements answer: *what may this workspace use?* (`inventory`, `audit`, `api`, `ai`, …)

Plan limits answer: *how much?* (`seats_operator`, `seats_field`, later storage/customers/sites when those meters exist)

Do **not** scatter `if users.length >= 5` through the app. Read limits from the catalog. Enforce them on the server.

`0` in current catalog limits means **unlimited** (enterprise seats).

---

## 25–26. Authorization decision

A protected action must pass:

```
Authenticated → Workspace member → RBAC permission → resource scope
→ plan entitlement → plan limit → backend authorize() → RLS → ALLOW
```

Any failure is denial.

Frontend visibility is UX only. Hidden buttons, React state, and client `can()` are not security.

Machine codes the UI must be able to translate:

| Code | Meaning |
|------|---------|
| `UNAUTHENTICATED` | No session |
| `PERMISSION_DENIED` | Role lacks the action |
| `SCOPE_DENIED` | Resource outside scope (`assigned` / `owned` / …) |
| `FEATURE_NOT_INCLUDED` | Plan does not include the feature |
| `PLAN_LIMIT_REACHED` | Usage is at the catalog cap |
| `BUSINESS_RULE` | Plan/role assignment rule (e.g. Solo cannot invite Manager) |
| `SUBSCRIPTION_INVALID` | Subscription not in an allowed state |

Do not invent a second permission system.

---

## 27–30. Limit behavior

Treat resources differently:

- **Seats at cap:** cannot invite / add that seat bucket. Existing members remain. Explain why. Offer a real upgrade path only when billing exists.
- **Storage at cap (when metered):** cannot upload new files. Existing files follow the actual policy. Never silently delete on downgrade.
- **Sites at cap (when metered):** cannot create another site; can still view/edit/archive where permitted.

Downgrade with over-usage must explain the policy (read-only, no new uploads, grace, export). Never silently delete.

---

## 31–33. Subscription lifecycle and billing UX

Support only states the billing provider actually has. Do not fake Trial / Past Due / Grace.

Owner billing surface (when it exists): current plan, usage, included / not included, price, cycle, payment method, invoices, upgrade, change, **discoverable cancellation**. No confirm-shaming.

Usage meters are contextual, not advertisements.

---

## 34–41. Onboarding, dashboard, role homes

Onboarding is short and business-focused. Progress is real: Done / Current / Upcoming. Never “80% complete” as decoration.

Every onboarding screen: one primary action. Skip only if skip is genuinely allowed.

Dashboard answers only: what happened, what matters, what needs attention, what is next. No vanity KPIs.

**Role homes (when data and routes exist):**

| Role | Prioritize |
|------|------------|
| Owner | Attention, waiting quotes, unassigned jobs, customers, sites, team, business overview |
| Manager | Unassigned jobs, technicians, service, sites, schedule, operational issues |
| Sales | Leads, customers, quotes, follow-up |
| Technician | Today’s jobs, assigned sites, service, schedule, tasks, equipment |
| Viewer | Read-only. No fake primary actions |

A new solo Owner must not land in a huge enterprise IAM console. They should see: greeting, workspace, operational status, “the business is ready,” and **one** honest next step.

Technician home is **field command**, not the Owner revenue/quotes/SITE FILE demo. Do not copy V1 owner widgets onto Technician Today.

---

## 42–48. Navigation, security, team, roles

Permission-aware and feature-aware nav. Conceptual groups: Overview, Operations, Documents, Assets, Analytics, Administration.

Security Center shows **real** signals only. Never claim SOC 2, ISO 27001, military-grade encryption, 99.9% uptime, GDPR certification, or Zero Trust unless implemented and verified.

Audit (permission `audit.view`): who, what, when, resource, action, result.

Team table: name, email, role, status, scope, last active, actions. One primary action; secondary behind “עוד פעולות.”

Custom role **editing** waits until catalog, RBAC, scope, backend, audit, and entitlements are stable. Foundation may keep the permission catalog read-only.

---

## 49–73. UX Operating System (summary)

Full cascade, spacing, type, color, motion, empty/error/loading, Hebrew verbs, and ethical psychology live in [V2-UX-PSYCHOLOGY.md](../ux/V2-UX-PSYCHOLOGY.md) and [V2-DESIGN-SYSTEM.md](../ux/V2-DESIGN-SYSTEM.md).

Non-negotiable reminders:

- One primary action per view; advanced collapsed
- Human Hebrew; buttons are verbs; no raw `Error 403`
- Clickable looks clickable; disabled explains why; never color-only
- Spacing: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64
- Hebrew: Heebo. Latin: Inter. Technical tokens: JetBrains Mono
- Primary `#0b6bcb`. Small semantic set. Enterprise cybersecurity, **not** cyberpunk
- Auth surfaces may be dark; `/app` stays operational and light
- Radius: controls 6px, panels 8px. Lucide icons. No emoji as UI icons
- Every control: default / hover / press / focus / disabled / loading
- Every data view: loading / empty / error / success
- Mobile is not shrunk desktop. Tap target ≥ 44px. Field conditions: sun, gloves, one hand, poor connectivity
- Motion 150–200ms, no bounce/confetti, honor `prefers-reduced-motion`
- i18n-ready: no hardcoded strings in business logic; dates/currency/numbers locale-aware
- Never expose database names (`workspace_members`, `jobs_status`)
- Feel fast: skeletons, pagination, no loading an entire tenant to show `4 / 5`

**Psychology — allowed:** decision-fatigue reduction, goal gradient, endowment, contrast, loss aversion, progressive disclosure, smart defaults, reciprocity, clear next action.

**Psychology — forbidden:** fake urgency, scarcity, popularity, reviews, usage, progress, discounts, hidden pricing/limits, forced upgrade, confirm-shaming, deceptive cancellation, manipulative countdowns.

North star: **make the next action obvious.**

---

## 74–76. Security architecture

Do not disable RLS, bypass auth, trust browser-provided roles, expose secrets, enforce authorization only on the client, or leak internal errors / sensitive data.

Audit administrative actions (invite, remove, role change, workspace settings, subscription, security). Do not log secrets. Audit logs are themselves access-controlled.

---

## 77–87. Public vs app, owner admin, plan × RBAC

One design system; different purposes.

- **Public:** explain, trust, convert
- **Authenticated `/app`:** operate, decide, execute — no marketing heroes

Owner admin (team, roles, security, settings, plan) is **secondary** to running the business.

Same plan, different permissions, different scope is correct. Example: Inventory on Business + Technician `inventory.view` / assigned vs Owner edit / workspace.

Upgrade UX (when billing exists): current plan, real usage, what the next plan actually includes, one calm CTA. No flashing urgency.

---

## 88–94. Screen checklist, two-second test, no fake data

Every screen must pass: user goal, primary/secondary action, cognitive load, affordance, signifiers, hierarchy, smart defaults, progressive disclosure, feedback, error prevention, empty/loading/success, mobile, a11y, responsive, motion, RBAC, entitlement, limits, data security, i18n readiness.

Two-second test: can the user see where they are and what the primary action is?

Never use fake customers, jobs, activity, usage, security events, users, financials, reviews, or statistics unless explicitly labeled Demo/Preview. Demo workspaces must say **DEMO**.

A brand-new workspace should feel intentional: ready to start, not broken.

**Do not:** rebuild working backend without need; duplicate RBAC; fake subscription states/metrics/activity/security; disable RLS; client-only authz; hardcode plan limits; scatter `role ===` checks; expose unfinished modules; decorative dashboards; unnecessary modals; excessive cards; cyberpunk; fake enterprise claims.

---

## 95–96. Implementation process and order

Before modifying anything, inspect Auth, Workspace, RBAC, Subscription, Usage, and UX. Preserve working systems. Identify gaps. Implement reusable foundations. Do not one-off hack.

| Phase | Intent | Current product lock |
|-------|--------|----------------------|
| 1 Architecture audit | Understand the running system | This document § Audit |
| 2 SaaS foundation | Workspace, subscription, entitlements, limits, usage | Catalog + server limits; no fake billing |
| 3 RBAC | Role, permission, scope, backend, RLS | Exists — verify, do not duplicate |
| 4 Signup / workspace | Register → workspace → type → plan | Type deferred until schema; plan = catalog default |
| 5 Onboarding | Real progress, smart defaults, first **honest** business action | No “add customer” until CRM UI |
| 6 Billing | Upgrade, downgrade, payment, cancel, failure, grace | Roadmap Phase 14 — do not fake |
| 7 Application shell | Sidebar, header, workspace, user, plan, security, **bottom nav** | Live routes only; [V2-APP-SHELL.md](../ux/V2-APP-SHELL.md) |
| 8 Dashboard | Role-aware, data-driven | [V2-DASHBOARD-SPEC.md](../ux/V2-DASHBOARD-SPEC.md) |

This order does **not** unlock CRM, Site File, or Mobile. Those stay on the locked product sequence.

---

## 97–100. Definition of done and master principle

UI looking good is not done.

Done when UX, UI, RBAC, SaaS, and security criteria in this document are true for the slice that shipped.

SITE SECURE must combine enterprise security + SaaS architecture + RBAC + entitlements + limits + data-driven operations + premium UI + world-class UX + ethical psychology into one coherent product.

> Complexity belongs in the system. Clarity belongs in the user's hands.

---

## Audit — 2026-08-15

Inspected against the running V2 repo. Preserve what works.

| Area | Exists | Gap |
|------|--------|-----|
| Auth (Supabase email/password, session, recovery) | Yes | — |
| Explicit workspace create, owner membership | Yes | Client could previously send an arbitrary `plan_key`; self-serve must use catalog default |
| RBAC catalog + FastAPI `authorize()` + RLS | Yes | Do not duplicate |
| Scopes `all` / `owned` / `assigned` / `team` | Yes | — |
| Plan features via `my_workspace_entitlements` | Yes | — |
| Catalog limits `seats_operator` / `seats_field` | Configured | **Not enforced** on invite until this foundation |
| Storage / customers / sites meters | No | Do not invent UI meters |
| Billing provider / checkout / invoices | No | Do not fake |
| Workspace type question | No schema | Do not ask yet |
| Register / onboarding Hebrew, smart defaults | Yes | Keep short |
| Permission-aware nav, no CRM placeholders | Yes | Keep |
| Owner ops home / technician Today | Yes | Empty state must not promise CRM |
| Security Center / audit (when API present) | Partial | Only real signals; `sessions` may be `not_built` |
| Custom role editor | Read-only catalog | Correct for Foundation |
| CRM / Quotes / Jobs **UI** | No | `moduleHref` returns `null` — do not add nav |
| Web phone navigation | Hamburger + full sidebar drawer | Replace with bottom bar of **live** destinations + עוד |

**This increment (foundation):** catalog as the only plan/limit/assignable-role source; server seat enforcement; `PLAN_LIMIT_REACHED`; self-serve default plan; UI usage and empty states that tell the truth.

**Shell increment:** one nav catalog; web `< lg` bottom navigation from **live** routes only; overflow in עוד.

**Usage increment:** `GET /workspaces/{id}/usage` returns catalog seat meters. No storage/customer meters until those limits exist and can be counted. Deploy with the API on Render — do not fake counts in React.

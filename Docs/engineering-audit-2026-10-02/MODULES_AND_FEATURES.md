# MODULES AND FEATURES — SITE SECURE

**Taxonomy:** VERIFIED WORKING | IMPLEMENTED — NOT FULLY VERIFIED | PARTIALLY IMPLEMENTED | UI ONLY / BACKEND MISSING | BACKEND ONLY / UI MISSING | BACKEND ONLY / NOT MOUNTED | BROKEN | PLANNED / NOT IMPLEMENTED | NOT FOUND | NOT VERIFIED  
**Date:** 2026-10-02 · Static evidence unless noted

| Module | Status | Screens | API | DB | Entitlement | Notes |
|--------|--------|---------|-----|----|-------------|-------|
| Auth / Session | IMPLEMENTED — NOT FULLY VERIFIED | login/register/reset/verify | auth router | profiles | — | Soft-archive gate in deps |
| Workspaces / Onboarding | IMPLEMENTED — NOT FULLY VERIFIED | onboarding | workspaces | workspaces, memberships | plan default solo | memberships[0] UX |
| RBAC / Entitlements | IMPLEMENTED — NOT FULLY VERIFIED | settings/roles (matrix) | authorize + authz/catalog | roles, grants, overrides, RPC | features + capabilities | Dual vocab AUDIT-005 |
| Invitations / Team | IMPLEMENTED — NOT FULLY VERIFIED | invite token + settings users | workspaces invitations + team | invitations | seat quotas | |
| Customers CRM | IMPLEMENTED — NOT FULLY VERIFIED | customers/* | customers | customers, contacts | crm | |
| Leads | IMPLEMENTED — NOT FULLY VERIFIED | leads/* | ops_modules | leads | leads.* | |
| Catalog | IMPLEMENTED — NOT FULLY VERIFIED | catalog | catalog + import | products, categories | catalog | |
| Quotes / CPQ | IMPLEMENTED — NOT FULLY VERIFIED | quotes/* + builder | quotes + quote_cpq | quotes, items, sections, versions | quotes | Core product |
| CCTV System Design | IMPLEMENTED — NOT FULLY VERIFIED | CPQ CCTV components | cctv + system_designs | system_designs* | quotes | HEAD commit focus |
| Public quote approve/PDF | IMPLEMENTED — NOT FULLY VERIFIED | `/q/$token` | public_quotes | quote_public_access | token | |
| PDF templates / company profile | IMPLEMENTED — NOT FULLY VERIFIED | settings | workspace_settings | pdf_document_templates | settings | |
| Projects | IMPLEMENTED — NOT FULLY VERIFIED | projects/* | ops_modules | projects, planned_items | projects | from-quote path |
| Field Jobs | IMPLEMENTED — NOT FULLY VERIFIED | jobs/* | jobs | jobs, assignments | jobs | lifecycle endpoints |
| Service calls | PARTIALLY IMPLEMENTED | list only | ops_modules | service_calls | service | no detail route |
| Warranties | IMPLEMENTED — NOT FULLY VERIFIED | warranties/* | ops_modules | warranties | warranties | |
| Tasks / “Calendar” | PARTIALLY IMPLEMENTED | tasks | ops_modules | tasks | calendar.* perms | No true calendar grid found |
| Sites / Site file | IMPLEMENTED — NOT FULLY VERIFIED | sites/* | sites + systems | sites, systems, equipment | sites | |
| Equipment assets | IMPLEMENTED — NOT FULLY VERIFIED | asset detail route | systems/equipment | equipment | systems | INF-1A era |
| IPAM | BACKEND ONLY / NOT MOUNTED (+ FE tests) | site network UI tests exist | ipam router **unwired** | site_vlans/networks/ips | — | AUDIT-001 |
| Asset topology | BACKEND ONLY / NOT MOUNTED | FE tests | connections **unwired** | asset_connections | — | AUDIT-001 |
| Customer portal | PARTIALLY IMPLEMENTED | portal routes | customer_portal **unwired** | portal tables | customer_portal.* perms in tests | AUDIT-001 |
| Documents / Storage | IMPLEMENTED — NOT FULLY VERIFIED | embedded | documents | documents | documents + quotas | |
| Dashboard / Today | IMPLEMENTED — NOT FULLY VERIFIED | dashboard, today | dashboard | aggregated | dashboard.view | |
| Analytics | NOT VERIFIED | analytics.tsx | ? | — | reports? | Depth unknown |
| Knowledge | PARTIALLY IMPLEMENTED | knowledge index | ops_modules | knowledge_articles | knowledge | |
| Notifications product | PARTIALLY IMPLEMENTED / schema-ahead | settings notifications? | no dedicated list router found | notifications tables | — | Prior gap G-008 |
| Inventory stock | NOT FOUND (feature flag only) | — | — | — | inventory feature | Catalog feature without module |
| Finance / Accounting docs | PARTIALLY / schema | — | accounting helpers exist | accounting_documents | finance / accounting_documents | Not full product |
| Reports module | NOT FOUND | — | — | — | reports feature | |
| Billing / Stripe | NOT FOUND (provider) | usage UI may exist | no checkout/webhook | subscriptions | workspace.billing perm | Schema stub |
| Platform Admin | IMPLEMENTED — NOT FULLY VERIFIED | /admin/* | admin | flags, beta, archive | is_platform_admin | |
| Mobile native | NOT FOUND | — | env stubs | — | — | apps/mobile missing |
| SITE AI / LLM | NOT FOUND | — | — | — | ai feature | Rules ≠ AI |
| Workforce scheduling | NOT FOUND / PLANNED | — | — | — | V3 docs | |
| Maps | NOT FOUND | — | — | — | — | |
| Inspections / Patrol | PLANNED / NOT IMPLEMENTED | — | — | capabilities docs | V3 | |
| Supplier portals | NOT FOUND | — | — | — | — | |

## Entitlements sources of truth (as implemented)

1. `packages/authz/catalog.json` — plans/features/permissions/grants (API+FE package).
2. DB `plans` / `plan_features` / `plan_limits` / `subscriptions`.
3. `workspace_feature_overrides` + RPC effective entitlements.
4. `capabilities` / `plan_capabilities` (V3 registry migration).
5. FE visibility checks (non-authoritative).

**Conflict risk:** multiple editable/parallel concepts — document only; do not “fix” here.
